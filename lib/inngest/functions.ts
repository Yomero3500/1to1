import { inngest, type ImageProcessEvent, type GeminiAnalysisResult } from "./client";
import { analyzeImageWithGemini } from "./gemini-analysis";
import { upscaleWithTopaz } from "./topaz-upscale";
import { processFrameWithSharp } from "./frame-processing";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Función principal de Inngest para procesar imágenes.
 * 
 * Flujo "Fire and Forget":
 * 1. Recibe el evento con la URL de la imagen
 * 2. Step A: Análisis con Gemini → obtiene recomendaciones de color
 * 3. Step B: Upscaling con Topaz Gigapixel → obtiene imagen de alta resolución
 * 4. Step C: Procesamiento con Sharp → aplica ajustes y genera marco
 * 5. Step D: Persistencia → sube a Supabase Storage y actualiza BD
 */
export const processImageFlow = inngest.createFunction(
  {
    id: "process-image",
    name: "Procesar Imagen para Impresión",
    retries: 3,
    onFailure: async ({ error, event }) => {
      // Actualizar estado a "failed" en caso de error
      const eventData = (event as any).data as ImageProcessEvent["data"] | undefined;
      console.error(`Error procesando imagen ${eventData?.imageId}:`, error);
      
      try {
        if (eventData?.imageId) {
          const supabase = createAdminClient();
          await supabase
            .from("images")
            .update({ 
              status: "failed",
            })
            .eq("id", eventData.imageId);
        }
      } catch (dbError) {
        console.error("Error actualizando estado de fallo:", dbError);
      }
    },
  },
  { event: "image/process.new" },
  async ({ event, step }) => {
    const { imageId, batchId, userId, originalUrl, cropData } = event.data as ImageProcessEvent["data"];
    
    console.log(`[Inngest] 🚀 Iniciando procesamiento de imagen: ${imageId}`);
    console.log(`[Inngest] Batch: ${batchId}, User: ${userId}`);
    console.log(`[Inngest] URL original: ${originalUrl}`);

    // Actualizar estado a "processing"
    await step.run("update-status-processing", async () => {
      console.log(`[Inngest][${imageId}] Actualizando estado a 'processing'...`);
      const supabase = createAdminClient();
      const { error } = await supabase
        .from("images")
        .update({ status: "processing" })
        .eq("id", imageId);
      
      if (error) {
        console.error(`[Inngest][${imageId}] Error actualizando estado:`, error);
      } else {
        console.log(`[Inngest][${imageId}] ✅ Estado actualizado a 'processing'`);
      }
      
      return { status: "processing" };
    });

    // Step A: Análisis con Gemini
    const colorAnalysis = await step.run("analyze-with-gemini", async () => {
      console.log(`[${imageId}] Iniciando análisis con Gemini...`);
      
      const analysis = await analyzeImageWithGemini(originalUrl);
      
      console.log(`[${imageId}] Análisis completado:`, analysis.recommendation);
      
      return analysis;
    });

    // Step B: Upscaling con Topaz + subir a Storage intermedio
    const upscaleResult = await step.run("upscale-with-topaz", async () => {
      const topazApiKey = process.env.TOPAZ_API_KEY;
      const supabase = createAdminClient();
      
      if (!topazApiKey) {
        console.log(`[${imageId}] Topaz API no configurada, saltando upscaling...`);
        return {
          upscaledUrl: originalUrl,
          skipped: true,
        };
      }

      console.log(`[${imageId}] Iniciando upscaling con Topaz...`);
      
      const result = await upscaleWithTopaz(originalUrl, 4);
      
      if (!result.upscaledImageBase64) {
        console.log(`[${imageId}] Topaz no devolvió imagen, usando original`);
        return {
          upscaledUrl: originalUrl,
          skipped: true,
        };
      }

      // Subir imagen upscaled a Storage inmediatamente para evitar pasar base64 entre steps
      const upscaledBuffer = Buffer.from(result.upscaledImageBase64, "base64");
      const upscaledFileName = `${userId}/${batchId}/${imageId}_upscaled.jpg`;
      
      console.log(`[${imageId}] Subiendo imagen upscaled a Storage (${upscaledBuffer.byteLength} bytes)...`);
      
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(upscaledFileName, upscaledBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`[${imageId}] Error subiendo imagen upscaled:`, uploadError);
        return {
          upscaledUrl: originalUrl,
          skipped: true,
        };
      }

      // Obtener signed URL para la imagen upscaled
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("images")
        .createSignedUrl(upscaledFileName, 3600); // 1 hora es suficiente para el siguiente step

      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.error(`[${imageId}] Error obteniendo signed URL:`, signedUrlError);
        return {
          upscaledUrl: originalUrl,
          skipped: true,
        };
      }

      console.log(`[${imageId}] ✅ Imagen upscaled guardada en Storage`);
      
      return {
        upscaledUrl: signedUrlData.signedUrl,
        skipped: false,
      };
    });

    // Step C: Procesamiento del marco con Sharp + persistencia final
    // Combinamos Sharp y persistencia en un solo step para evitar pasar base64
    const finalResult = await step.run("process-and-persist", async () => {
      const supabase = createAdminClient();
      
      // Usar la URL upscaled o la original
      const imageUrl = upscaleResult.upscaledUrl;
      console.log(`[${imageId}] Procesando imagen desde: ${imageUrl.substring(0, 80)}...`);

      console.log(`[${imageId}] Generando marco con ajustes de color...`);
      
      const result = await processFrameWithSharp(
        imageUrl,
        colorAnalysis as GeminiAnalysisResult,
        cropData
      );
      
      console.log(`[${imageId}] Marco generado: ${result.width}x${result.height}`);

      // Subir imagen final a Storage
      const finalFileName = `${userId}/${batchId}/${imageId}_framed.jpg`;
      
      console.log(`[${imageId}] Subiendo imagen final a Storage...`);
      
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(finalFileName, result.framedImageBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Error subiendo imagen: ${uploadError.message}`);
      }

      // Obtener Signed URL (válida por 1 año)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("images")
        .createSignedUrl(finalFileName, 31536000); // 1 año

      let processedUrl: string;
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        console.warn(`[${imageId}] Error creando signed URL, usando public URL`);
        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(finalFileName);
        processedUrl = publicUrlData.publicUrl;
      } else {
        processedUrl = signedUrlData.signedUrl;
      }

      // Actualizar registro en la base de datos
      const { error: updateError } = await supabase
        .from("images")
        .update({
          processed_url: processedUrl,
          status: "completed",
        })
        .eq("id", imageId);

      if (updateError) {
        throw new Error(`Error actualizando BD: ${updateError.message}`);
      }

      console.log(`[${imageId}] ✅ Procesamiento completado: ${processedUrl}`);

      return {
        processedUrl,
        fileName: finalFileName,
        width: result.width,
        height: result.height,
      };
    });

    return {
      success: true,
      imageId,
      processedUrl: finalResult.processedUrl,
      colorAnalysis: {
        brightness: colorAnalysis.brightness,
        contrast: colorAnalysis.contrast,
        saturation: colorAnalysis.saturation,
        recommendation: colorAnalysis.recommendation,
      },
      upscaled: !upscaleResult.skipped,
      dimensions: {
        width: finalResult.width,
        height: finalResult.height,
      },
    };
  }
);

// Exportar todas las funciones para el handler
export const functions = [processImageFlow];

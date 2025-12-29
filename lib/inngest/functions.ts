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

    // Step B: Upscaling con Topaz (opcional, skip si TOPAZ_API_KEY no está configurada)
    const upscaleResult = await step.run("upscale-with-topaz", async () => {
      const topazApiKey = process.env.TOPAZ_API_KEY;
      
      if (!topazApiKey) {
        console.log(`[${imageId}] Topaz API no configurada, saltando upscaling...`);
        return {
          upscaledUrl: originalUrl,
          skipped: true,
          originalWidth: 0,
          originalHeight: 0,
          newWidth: 0,
          newHeight: 0,
          scaleFactor: 1,
        };
      }

      console.log(`[${imageId}] Iniciando upscaling con Topaz...`);
      
      const result = await upscaleWithTopaz(originalUrl, 2);
      
      if (result.upscaledImageBase64) {
        console.log(`[${imageId}] Upscaling completado: imagen recibida en base64 (${result.upscaledImageBase64.length} chars)`);
      } else {
        console.log(`[${imageId}] Upscaling completado: ${result.originalWidth}x${result.originalHeight} → ${result.newWidth}x${result.newHeight}`);
      }
      
      return { ...result, skipped: false };
    });

    // Step C: Procesamiento del marco con Sharp
    const frameResult = await step.run("process-frame-with-sharp", async () => {
      // Determinar la fuente de la imagen para procesar
      let imageToProcess: string | Buffer;
      
      if (upscaleResult.skipped) {
        // Si no hubo upscaling, usar la URL original
        imageToProcess = originalUrl;
        console.log(`[${imageId}] Usando imagen original (sin upscaling)`);
      } else if (upscaleResult.upscaledImageBase64) {
        // Si Topaz devolvió la imagen en base64, convertir a Buffer
        imageToProcess = Buffer.from(upscaleResult.upscaledImageBase64, "base64");
        console.log(`[${imageId}] Usando imagen upscaled desde base64`);
      } else if (upscaleResult.upscaledUrl) {
        // Si Topaz devolvió una URL
        imageToProcess = upscaleResult.upscaledUrl;
        console.log(`[${imageId}] Usando imagen upscaled desde URL`);
      } else {
        // Fallback a la imagen original
        imageToProcess = originalUrl;
        console.log(`[${imageId}] Fallback a imagen original`);
      }

      console.log(`[${imageId}] Generando marco con ajustes de color...`);
      
      const result = await processFrameWithSharp(
        imageToProcess,
        colorAnalysis as GeminiAnalysisResult,
        cropData
      );
      
      console.log(`[${imageId}] Marco generado: ${result.width}x${result.height}`);
      
      // Convertir Buffer a base64 para paso entre steps
      return {
        ...result,
        framedImageBase64: result.framedImageBuffer.toString("base64"),
        framedImageBuffer: undefined, // No podemos pasar Buffer entre steps
      };
    });

    // Step D: Persistencia en Supabase
    const persistResult = await step.run("persist-to-supabase", async () => {
      const supabase = createAdminClient();
      
      // Reconstruir Buffer desde base64
      const imageBuffer = Buffer.from(frameResult.framedImageBase64, "base64");
      
      // Generar nombre único para el archivo
      const fileName = `${userId}/${batchId}/${imageId}_framed.jpg`;
      
      console.log(`[${imageId}] Subiendo imagen procesada a Storage...`);
      
      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("images")
        .upload(fileName, imageBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Error subiendo imagen: ${uploadError.message}`);
      }

      // Obtener Signed URL (válida por 1 año) para evitar problemas de permisos
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("images")
        .createSignedUrl(fileName, 31536000); // 1 año

      let processedUrl: string;
      
      if (signedUrlError || !signedUrlData?.signedUrl) {
        // Fallback a URL pública si falla
        console.warn(`[${imageId}] Error creando signed URL, usando public URL`);
        const { data: publicUrlData } = supabase.storage
          .from("images")
          .getPublicUrl(fileName);
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
        fileName,
        width: frameResult.width,
        height: frameResult.height,
      };
    });

    return {
      success: true,
      imageId,
      processedUrl: persistResult.processedUrl,
      colorAnalysis: {
        brightness: colorAnalysis.brightness,
        contrast: colorAnalysis.contrast,
        saturation: colorAnalysis.saturation,
        recommendation: colorAnalysis.recommendation,
      },
      upscaled: !upscaleResult.skipped,
      dimensions: {
        width: persistResult.width,
        height: persistResult.height,
      },
    };
  }
);

// Exportar todas las funciones para el handler
export const functions = [processImageFlow];

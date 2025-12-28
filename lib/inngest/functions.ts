import { inngest, type ImageProcessEvent, type GeminiAnalysisResult } from "./client";
import { analyzeImageWithGemini } from "./gemini-analysis";
import { upscaleWithTopaz } from "./topaz-upscale";
import { processFrameWithSharp } from "./frame-processing";
import { createClient } from "@/lib/supabase/server";

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
      console.error(`Error procesando imagen ${event.data.imageId}:`, error);
      
      try {
        const supabase = await createClient();
        await supabase
          .from("images")
          .update({ 
            status: "failed",
            // Podríamos añadir un campo error_message en el futuro
          })
          .eq("id", event.data.imageId);
      } catch (dbError) {
        console.error("Error actualizando estado de fallo:", dbError);
      }
    },
  },
  { event: "image/process.new" },
  async ({ event, step }) => {
    const { imageId, batchId, userId, originalUrl, cropData } = event.data as ImageProcessEvent["data"];

    // Actualizar estado a "processing"
    await step.run("update-status-processing", async () => {
      const supabase = await createClient();
      await supabase
        .from("images")
        .update({ status: "processing" })
        .eq("id", imageId);
      
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
      const topazApiKey = process.env.TOPAZ_API_KEY || process.env.GIGAPIXEL_API_KEY;
      
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
      
      console.log(`[${imageId}] Upscaling completado: ${result.originalWidth}x${result.originalHeight} → ${result.newWidth}x${result.newHeight}`);
      
      return { ...result, skipped: false };
    });

    // Step C: Procesamiento del marco con Sharp
    const frameResult = await step.run("process-frame-with-sharp", async () => {
      const imageToProcess = upscaleResult.skipped 
        ? originalUrl 
        : upscaleResult.upscaledUrl;

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
      const supabase = await createClient();
      
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

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from("images")
        .getPublicUrl(fileName);

      const processedUrl = publicUrlData.publicUrl;

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

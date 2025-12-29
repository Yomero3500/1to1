"use server";

import { inngest } from "@/lib/inngest/client";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface StartProcessingResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Server Action para iniciar el procesamiento de una imagen.
 * 
 * Esta función es "Fire and Forget":
 * - Envía el evento a Inngest y retorna inmediatamente
 * - El procesamiento ocurre en segundo plano
 * - El cliente puede hacer polling al estado de la imagen
 */
export async function startImageProcessing(
  imageId: string,
  batchId: string,
  originalUrl: string,
  cropData?: { x: number; y: number; width: number; height: number }
): Promise<StartProcessingResult> {
  console.log(`[ImageProcessing] Iniciando procesamiento de imagen: ${imageId}`);
  console.log(`[ImageProcessing] URL original: ${originalUrl?.substring(0, 80)}...`);
  try {
    // Obtener usuario actual
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Usuario no autenticado",
      };
    }

    // Verificar que la imagen pertenece al usuario
    const { data: image, error: imageError } = await supabase
      .from("images")
      .select("id, batch_id, batches!inner(user_id)")
      .eq("id", imageId)
      .single();

    if (imageError || !image) {
      return {
        success: false,
        error: "Imagen no encontrada",
      };
    }

    // Enviar evento a Inngest
    console.log(`[ImageProcessing] Enviando evento a Inngest para imagen: ${imageId}`);
    const { ids } = await inngest.send({
      name: "image/process.new",
      data: {
        imageId,
        batchId,
        userId: user.id,
        originalUrl,
        cropData,
      },
    });
    console.log(`[ImageProcessing] ✅ Evento enviado con ID: ${ids[0]}`);

    // Actualizar estado inmediatamente a "pending" (pre-processing)
    await supabase
      .from("images")
      .update({ status: "pending" })
      .eq("id", imageId);

    // Revalidar la página de resultados
    revalidatePath(`/results?batch=${batchId}`);

    return {
      success: true,
      eventId: ids[0],
    };
  } catch (error) {
    console.error("Error iniciando procesamiento:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Server Action para procesar todas las imágenes de un batch.
 */
export async function startBatchProcessing(
  batchId: string
): Promise<{ success: boolean; processedCount: number; errors: string[] }> {
  console.log(`[BatchProcessing] Iniciando procesamiento de batch: ${batchId}`);
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log(`[BatchProcessing] Error: Usuario no autenticado`);
      return {
        success: false,
        processedCount: 0,
        errors: ["Usuario no autenticado"],
      };
    }
    console.log(`[BatchProcessing] Usuario autenticado: ${user.id}`);

    // Obtener todas las imágenes pendientes del batch
    console.log(`[BatchProcessing] Buscando imágenes pendientes para batch: ${batchId}`);
    const { data: images, error: imagesError } = await supabase
      .from("images")
      .select("id, original_url, status")
      .eq("batch_id", batchId)
      .in("status", ["pending", "failed"]); // Procesar pendientes y fallidas

    if (imagesError) {
      console.log(`[BatchProcessing] Error obteniendo imágenes: ${imagesError.message}`);
      return {
        success: false,
        processedCount: 0,
        errors: [imagesError.message],
      };
    }

    console.log(`[BatchProcessing] Imágenes encontradas: ${images?.length || 0}`);
    if (images) {
      images.forEach((img, i) => console.log(`  [${i}] ID: ${img.id}, Status: ${img.status}, URL: ${img.original_url?.substring(0, 50)}...`));
    }

    if (!images || images.length === 0) {
      console.log(`[BatchProcessing] No hay imágenes pendientes para procesar`);
      return {
        success: true,
        processedCount: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    let processedCount = 0;

    // Enviar eventos para cada imagen
    console.log(`[BatchProcessing] Enviando ${images.length} imágenes a Inngest...`);
    for (const image of images) {
      console.log(`[BatchProcessing] Procesando imagen: ${image.id}`);
      const result = await startImageProcessing(
        image.id,
        batchId,
        image.original_url
      );

      if (result.success) {
        processedCount++;
        console.log(`[BatchProcessing] ✅ Imagen ${image.id} enviada a Inngest, eventId: ${result.eventId}`);
      } else {
        console.log(`[BatchProcessing] ❌ Error con imagen ${image.id}: ${result.error}`);
        errors.push(`Imagen ${image.id}: ${result.error}`);
      }
    }

    revalidatePath(`/results?batch=${batchId}`);

    return {
      success: errors.length === 0,
      processedCount,
      errors,
    };
  } catch (error) {
    console.error("Error iniciando procesamiento de batch:", error);
    return {
      success: false,
      processedCount: 0,
      errors: [error instanceof Error ? error.message : "Error desconocido"],
    };
  }
}

/**
 * Server Action para obtener el estado actual de las imágenes de un batch.
 */
export async function getBatchProcessingStatus(batchId: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const supabase = await createClient();
    
    const { data: images, error } = await supabase
      .from("images")
      .select("status")
      .eq("batch_id", batchId);

    if (error || !images) {
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }

    return {
      total: images.length,
      pending: images.filter(i => i.status === "pending").length,
      processing: images.filter(i => i.status === "processing").length,
      completed: images.filter(i => i.status === "completed").length,
      failed: images.filter(i => i.status === "failed").length,
    };
  } catch {
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

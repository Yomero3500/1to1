import type { TopazUpscaleResult } from "./client";

const TOPAZ_API_BASE = "https://api.topazlabs.com/v1";
const POLLING_INTERVAL = 5000; // 5 segundos
const MAX_POLLING_ATTEMPTS = 60; // 5 minutos máximo

/**
 * Envía una imagen a Topaz Gigapixel Cloud API para upscaling.
 * Usa polling para esperar el resultado.
 */
export async function upscaleWithTopaz(
  imageUrl: string,
  scaleFactor: number = 2
): Promise<TopazUpscaleResult> {
  const apiKey = process.env.TOPAZ_API_KEY;
  
  if (!apiKey) {
    throw new Error("TOPAZ_API_KEY no está configurada");
  }

  // Paso 1: Descargar la imagen original
  const imageResponse = await fetch(imageUrl);
  const imageBlob = await imageResponse.blob();
  
  // Obtener dimensiones originales (estimadas, se actualizarán con la respuesta)
  const contentLength = imageResponse.headers.get("content-length");
  
  // Paso 2: Crear el job de upscaling
  const formData = new FormData();
  formData.append("image", imageBlob, "image.jpg");
  formData.append("scale", scaleFactor.toString());
  formData.append("model", "standard"); // standard, high-fidelity, or art
  formData.append("denoise", "auto");
  formData.append("sharpen", "auto");
  formData.append("output_format", "jpg");
  formData.append("output_quality", "95");

  const createResponse = await fetch(`${TOPAZ_API_BASE}/enhance`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Error al crear job de Topaz: ${createResponse.status} - ${errorText}`);
  }

  const createResult = await createResponse.json();
  const jobId = createResult.job_id || createResult.id;

  if (!jobId) {
    // Respuesta inmediata (sin job_id significa resultado directo)
    if (createResult.result_url || createResult.output_url) {
      return {
        upscaledUrl: createResult.result_url || createResult.output_url,
        originalWidth: createResult.original_width || 0,
        originalHeight: createResult.original_height || 0,
        newWidth: createResult.output_width || 0,
        newHeight: createResult.output_height || 0,
        scaleFactor,
      };
    }
    throw new Error("Respuesta de Topaz inválida: no contiene job_id ni result_url");
  }

  // Paso 3: Polling para obtener el resultado
  let attempts = 0;
  
  while (attempts < MAX_POLLING_ATTEMPTS) {
    await sleep(POLLING_INTERVAL);
    attempts++;

    const statusResponse = await fetch(`${TOPAZ_API_BASE}/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      throw new Error(`Error al consultar estado del job: ${statusResponse.status} - ${errorText}`);
    }

    const statusResult = await statusResponse.json();
    const status = statusResult.status?.toLowerCase();

    if (status === "completed" || status === "success") {
      return {
        upscaledUrl: statusResult.result_url || statusResult.output_url,
        originalWidth: statusResult.original_width || 0,
        originalHeight: statusResult.original_height || 0,
        newWidth: statusResult.output_width || 0,
        newHeight: statusResult.output_height || 0,
        scaleFactor,
      };
    }

    if (status === "failed" || status === "error") {
      throw new Error(`Job de Topaz falló: ${statusResult.error || "Error desconocido"}`);
    }

    // Continuar polling si está "processing" o "pending"
    console.log(`Topaz job ${jobId}: ${status} (intento ${attempts}/${MAX_POLLING_ATTEMPTS})`);
  }

  throw new Error(`Timeout esperando resultado de Topaz después de ${MAX_POLLING_ATTEMPTS * POLLING_INTERVAL / 1000} segundos`);
}

/**
 * Versión alternativa que usa webhook en lugar de polling.
 * Útil cuando Topaz soporta callbacks.
 */
export async function upscaleWithTopazWebhook(
  imageUrl: string,
  webhookUrl: string,
  scaleFactor: number = 2
): Promise<{ jobId: string }> {
  const apiKey = process.env.TOPAZ_API_KEY;
  
  if (!apiKey) {
    throw new Error("TOPAZ_API_KEY no está configurada");
  }

  const imageResponse = await fetch(imageUrl);
  const imageBlob = await imageResponse.blob();

  const formData = new FormData();
  formData.append("image", imageBlob, "image.jpg");
  formData.append("scale", scaleFactor.toString());
  formData.append("model", "standard");
  formData.append("denoise", "auto");
  formData.append("sharpen", "auto");
  formData.append("output_format", "jpg");
  formData.append("output_quality", "95");
  formData.append("webhook_url", webhookUrl);

  const response = await fetch(`${TOPAZ_API_BASE}/enhance`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error al crear job de Topaz: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  
  return {
    jobId: result.job_id || result.id,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

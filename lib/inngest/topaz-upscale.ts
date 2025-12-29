import type { TopazUpscaleResult } from "./client";

const TOPAZ_API_URL = "https://api.topazlabs.com/image/v1/enhance";
const POLLING_INTERVAL = 3000; // 3 segundos
const MAX_POLLING_ATTEMPTS = 120; // 6 minutos máximo

/**
 * Envía una imagen a Topaz Gigapixel Cloud API para upscaling.
 * Basado en la documentación oficial de Topaz Labs.
 * 
 * Modelos disponibles:
 * - "Standard V2" - Modelo estándar de alta calidad
 * - "High Fidelity V2" - Mayor fidelidad al original
 * - "Graphics" - Para gráficos e ilustraciones
 */
export async function upscaleWithTopaz(
  imageUrl: string,
  scaleFactor: number = 2
): Promise<TopazUpscaleResult> {
  const apiKey = process.env.TOPAZ_API_KEY;
  
  if (!apiKey) {
    console.log("[Topaz] API Key no configurada, saltando upscaling...");
    throw new Error("TOPAZ_API_KEY no está configurada");
  }

  console.log(`[Topaz] Iniciando upscaling con factor ${scaleFactor}x...`);
  console.log(`[Topaz] URL de imagen: ${imageUrl}`);

  try {
    // Paso 1: Descargar la imagen original
    console.log("[Topaz] Descargando imagen original...");
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      throw new Error(`Error descargando imagen: ${imageResponse.status} ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBlob = new Blob([imageBuffer], { type: "image/jpeg" });
    
    console.log(`[Topaz] Imagen descargada: ${imageBuffer.byteLength} bytes`);

    // Paso 2: Crear el FormData con los parámetros correctos
    const formData = new FormData();
    formData.append("image", imageBlob, "image.jpg");
    formData.append("model", "Standard V2");

    console.log("[Topaz] Enviando imagen a la API...");

    // Paso 3: Enviar a Topaz API
    const enhanceResponse = await fetch(TOPAZ_API_URL, {
      method: "POST",
      headers: {
        "Accept": "*/*", // Aceptar cualquier tipo de respuesta
        "X-API-Key": apiKey,
      },
      body: formData,
    });

    console.log(`[Topaz] Respuesta recibida: ${enhanceResponse.status}`);
    const contentType = enhanceResponse.headers.get("content-type") || "";
    console.log(`[Topaz] Content-Type: ${contentType}`);

    if (!enhanceResponse.ok) {
      const errorText = await enhanceResponse.text();
      console.error(`[Topaz] Error de API: ${errorText}`);
      throw new Error(`Error de Topaz API: ${enhanceResponse.status} - ${errorText}`);
    }

    // Verificar si la respuesta es una imagen directa (binary)
    if (contentType.includes("image/")) {
      console.log("[Topaz] ✅ API devolvió imagen directamente, procesando...");
      
      // Obtener los bytes de la imagen
      const imageArrayBuffer = await enhanceResponse.arrayBuffer();
      const upscaledImageBuffer = Buffer.from(imageArrayBuffer);
      
      console.log(`[Topaz] Imagen upscaled recibida: ${upscaledImageBuffer.byteLength} bytes`);
      
      // Retornar con la imagen en base64 para que el siguiente step la procese
      return {
        upscaledUrl: "", // No hay URL, la imagen está en el buffer
        upscaledImageBase64: upscaledImageBuffer.toString("base64"),
        originalWidth: 0,
        originalHeight: 0,
        newWidth: 0,
        newHeight: 0,
        scaleFactor,
      };
    }

    // Si es JSON, parsear la respuesta
    const result = await enhanceResponse.json();
    console.log("[Topaz] Respuesta JSON:", JSON.stringify(result, null, 2));

    // Manejar diferentes formatos de respuesta de Topaz
    // Opción 1: Respuesta inmediata con URL
    if (result.output_url || result.result_url || result.url) {
      const upscaledUrl = result.output_url || result.result_url || result.url;
      console.log(`[Topaz] ✅ Upscaling completado inmediatamente: ${upscaledUrl}`);
      
      return {
        upscaledUrl,
        originalWidth: result.original_width || result.input_width || 0,
        originalHeight: result.original_height || result.input_height || 0,
        newWidth: result.output_width || result.width || 0,
        newHeight: result.output_height || result.height || 0,
        scaleFactor,
      };
    }

    // Opción 2: Job asíncrono - necesita polling
    const jobId = result.job_id || result.id || result.request_id;
    
    if (jobId) {
      console.log(`[Topaz] Job creado: ${jobId}, iniciando polling...`);
      return await pollTopazJob(jobId, apiKey, scaleFactor);
    }

    // Opción 3: La respuesta contiene imagen en base64
    if (result.image || result.data) {
      console.log("[Topaz] Respuesta contiene imagen en base64...");
      const base64Data = result.image || result.data;
      return {
        upscaledUrl: "",
        upscaledImageBase64: base64Data,
        originalWidth: result.original_width || 0,
        originalHeight: result.original_height || 0,
        newWidth: result.output_width || 0,
        newHeight: result.output_height || 0,
        scaleFactor,
      };
    }

    console.error("[Topaz] Respuesta inesperada:", result);
    throw new Error("Respuesta de Topaz inválida: formato no reconocido");

  } catch (error) {
    console.error("[Topaz] Error en upscaling:", error);
    throw error;
  }
}

/**
 * Polling para jobs asíncronos de Topaz
 */
async function pollTopazJob(
  jobId: string, 
  apiKey: string,
  scaleFactor: number
): Promise<TopazUpscaleResult> {
  const statusUrl = `https://api.topazlabs.com/image/v1/status/${jobId}`;
  let attempts = 0;

  while (attempts < MAX_POLLING_ATTEMPTS) {
    await sleep(POLLING_INTERVAL);
    attempts++;

    console.log(`[Topaz] Polling job ${jobId} (intento ${attempts}/${MAX_POLLING_ATTEMPTS})...`);

    try {
      const statusResponse = await fetch(statusUrl, {
        headers: {
          "Accept": "application/json",
          "X-API-Key": apiKey,
        },
      });

      if (!statusResponse.ok) {
        console.error(`[Topaz] Error en polling: ${statusResponse.status}`);
        continue;
      }

      const statusResult = await statusResponse.json();
      const status = (statusResult.status || "").toLowerCase();

      console.log(`[Topaz] Estado del job: ${status}`);

      if (status === "completed" || status === "success" || status === "done") {
        const upscaledUrl = statusResult.output_url || statusResult.result_url || statusResult.url;
        
        if (!upscaledUrl) {
          throw new Error("Job completado pero sin URL de resultado");
        }

        console.log(`[Topaz] ✅ Job completado: ${upscaledUrl}`);
        
        return {
          upscaledUrl,
          originalWidth: statusResult.original_width || statusResult.input_width || 0,
          originalHeight: statusResult.original_height || statusResult.input_height || 0,
          newWidth: statusResult.output_width || statusResult.width || 0,
          newHeight: statusResult.output_height || statusResult.height || 0,
          scaleFactor,
        };
      }

      if (status === "failed" || status === "error") {
        throw new Error(`Job de Topaz falló: ${statusResult.error || statusResult.message || "Error desconocido"}`);
      }

    } catch (error) {
      console.error(`[Topaz] Error en polling intento ${attempts}:`, error);
      if (attempts >= MAX_POLLING_ATTEMPTS / 2) {
        throw error;
      }
    }
  }

  throw new Error(`Timeout esperando resultado de Topaz después de ${(MAX_POLLING_ATTEMPTS * POLLING_INTERVAL) / 1000} segundos`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

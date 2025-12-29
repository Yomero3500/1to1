"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { imageAnalysisSchema, type AnalyzeImageResult } from "./types";

/**
 * Server Action que analiza una imagen usando Gemini para obtener
 * recomendaciones de ajustes de color óptimos para impresión.
 *
 * @param base64Image - La imagen en formato base64 (sin el prefijo data:image/...)
 * @param mimeType - El tipo MIME de la imagen (ej: "image/jpeg")
 */
export async function analyzeImage(
  base64Image: string,
  mimeType: string
): Promise<AnalyzeImageResult> {
  try {
    const { object } = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: imageAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Eres un experto en fotografía y preparación de imágenes para impresión profesional.
Analiza esta imagen y proporciona recomendaciones de ajustes para optimizarla para impresión en papel fotográfico.

Considera:
- Las impresiones tienden a verse más oscuras que en pantalla
- Los colores pueden perder viveza al imprimir
- El contraste suele necesitar un pequeño boost para impresión
- Evita ajustes extremos (mantén valores moderados entre -30 y 30 cuando sea posible)

Proporciona valores numéricos entre -100 y 100 para cada ajuste.`,
            },
            {
              type: "image",
              image: base64Image,
              mimeType: mimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
            },
          ],
        },
      ],
    });

    return {
      success: true,
      data: object,
    };
  } catch (error) {
    console.error("Error analizando imagen con IA:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

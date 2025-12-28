import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import type { GeminiAnalysisResult } from "./client";

// Esquema Zod para el análisis completo de Inngest
const geminiAnalysisSchema = z.object({
  brightness: z.number().min(-100).max(100),
  contrast: z.number().min(-100).max(100),
  saturation: z.number().min(-100).max(100),
  vibrance: z.number().min(-100).max(100),
  warmth: z.number().min(-100).max(100),
  highlights: z.number().min(-100).max(100),
  shadows: z.number().min(-100).max(100),
  recommendation: z.string(),
});

/**
 * Analiza una imagen usando Google Gemini (via Vercel AI SDK) para obtener 
 * recomendaciones de ajustes de color óptimos para impresión de alta calidad.
 */
export async function analyzeImageWithGemini(
  imageUrl: string
): Promise<GeminiAnalysisResult> {
  try {
    // Descargar la imagen y convertirla a base64
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = (response.headers.get("content-type") || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const { object } = await generateObject({
      model: google("gemini-1.5-flash"),
      schema: geminiAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Eres un experto en fotografía y preparación de imágenes para impresión profesional.
Analiza esta imagen y proporciona recomendaciones de ajustes de color para optimizarla 
para impresión en papel fotográfico de alta calidad.

Proporciona valores numéricos entre -100 y 100 para cada ajuste:
- brightness: Ajuste de brillo (-100 más oscuro, 100 más brillante)
- contrast: Ajuste de contraste (-100 menos contraste, 100 más contraste)
- saturation: Ajuste de saturación (-100 desaturado, 100 muy saturado)
- vibrance: Ajuste de vibrance (saturación inteligente)
- warmth: Temperatura de color (-100 más frío/azul, 100 más cálido/amarillo)
- highlights: Ajuste de altas luces (-100 reducir, 100 aumentar)
- shadows: Ajuste de sombras (-100 más oscuras, 100 más claras)
- recommendation: Breve descripción de por qué recomiendas estos ajustes

Considera:
- Las impresiones tienden a verse más oscuras que en pantalla
- Los colores pueden perder viveza al imprimir
- El contraste suele necesitar un pequeño boost para impresión
- Evita ajustes extremos (mantén valores moderados entre -30 y 30 cuando sea posible)`,
            },
            {
              type: "image",
              image: base64Image,
              mimeType,
            },
          ],
        },
      ],
    });

    return {
      brightness: clamp(object.brightness, -100, 100),
      contrast: clamp(object.contrast, -100, 100),
      saturation: clamp(object.saturation, -100, 100),
      vibrance: clamp(object.vibrance, -100, 100),
      warmth: clamp(object.warmth, -100, 100),
      highlights: clamp(object.highlights, -100, 100),
      shadows: clamp(object.shadows, -100, 100),
      recommendation: object.recommendation || "Ajustes optimizados para impresión",
    };
  } catch (error) {
    // Si falla, devolver valores neutros
    console.error("Error en análisis Gemini:", error);
    return {
      brightness: 5,
      contrast: 10,
      saturation: 5,
      vibrance: 10,
      warmth: 0,
      highlights: -5,
      shadows: 5,
      recommendation: "Valores por defecto aplicados debido a error de análisis",
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

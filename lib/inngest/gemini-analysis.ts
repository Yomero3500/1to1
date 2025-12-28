import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GeminiAnalysisResult } from "./client";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);

/**
 * Analiza una imagen usando Google Gemini para obtener recomendaciones
 * de ajustes de color óptimos para impresión de alta calidad.
 */
export async function analyzeImageWithGemini(
  imageUrl: string
): Promise<GeminiAnalysisResult> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  // Descargar la imagen y convertirla a base64
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const base64Image = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  const prompt = `Eres un experto en fotografía y preparación de imágenes para impresión profesional.
Analiza esta imagen y proporciona recomendaciones de ajustes de color para optimizarla 
para impresión en papel fotográfico de alta calidad.

Devuelve un objeto JSON con los siguientes campos (todos los valores numéricos deben estar entre -100 y 100):

{
  "brightness": número,      // Ajuste de brillo (-100 más oscuro, 100 más brillante)
  "contrast": número,        // Ajuste de contraste (-100 menos contraste, 100 más contraste)
  "saturation": número,      // Ajuste de saturación (-100 desaturado, 100 muy saturado)
  "vibrance": número,        // Ajuste de vibrance (saturación inteligente)
  "warmth": número,          // Temperatura de color (-100 más frío/azul, 100 más cálido/amarillo)
  "highlights": número,      // Ajuste de altas luces (-100 reducir, 100 aumentar)
  "shadows": número,         // Ajuste de sombras (-100 más oscuras, 100 más claras)
  "recommendation": "string" // Breve descripción de por qué recomiendas estos ajustes
}

Considera:
- Las impresiones tienden a verse más oscuras que en pantalla
- Los colores pueden perder viveza al imprimir
- El contraste suele necesitar un pequeño boost para impresión
- Evita ajustes extremos (mantén valores moderados entre -30 y 30 cuando sea posible)

Responde SOLO con el JSON, sin explicaciones adicionales.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Image,
      },
    },
  ]);

  const responseText = result.response.text();
  
  try {
    const analysis: GeminiAnalysisResult = JSON.parse(responseText);
    
    // Validar y limitar valores
    return {
      brightness: clamp(analysis.brightness, -100, 100),
      contrast: clamp(analysis.contrast, -100, 100),
      saturation: clamp(analysis.saturation, -100, 100),
      vibrance: clamp(analysis.vibrance, -100, 100),
      warmth: clamp(analysis.warmth, -100, 100),
      highlights: clamp(analysis.highlights, -100, 100),
      shadows: clamp(analysis.shadows, -100, 100),
      recommendation: analysis.recommendation || "Ajustes optimizados para impresión",
    };
  } catch {
    // Si falla el parsing, devolver valores neutros
    console.error("Error parsing Gemini response:", responseText);
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

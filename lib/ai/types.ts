import { z } from "zod";

// Esquema Zod para los ajustes de imagen
export const imageAnalysisSchema = z.object({
  brightness: z
    .number()
    .min(-100)
    .max(100)
    .describe("Ajuste de brillo recomendado (-100 a 100)"),
  saturation: z
    .number()
    .min(-100)
    .max(100)
    .describe("Ajuste de saturación recomendado (-100 a 100)"),
  contrast: z
    .number()
    .min(-100)
    .max(100)
    .describe("Ajuste de contraste recomendado (-100 a 100)"),
  suggestions: z
    .string()
    .describe("Sugerencias breves para mejorar la imagen para impresión"),
});

export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;

export interface AnalyzeImageResult {
  success: boolean;
  data?: ImageAnalysis;
  error?: string;
}

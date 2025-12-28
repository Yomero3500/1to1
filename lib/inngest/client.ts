import { Inngest } from "inngest";

// Crear cliente de Inngest
export const inngest = new Inngest({
  id: "1to1-framefix",
  name: "FrameFix Image Processing",
});

// Tipos para los eventos
export type ImageProcessEvent = {
  data: {
    imageId: string;
    batchId: string;
    userId: string;
    originalUrl: string;
    cropData?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
};

// Tipos para los resultados de cada paso
export type GeminiAnalysisResult = {
  brightness: number;      // -100 a 100
  contrast: number;        // -100 a 100
  saturation: number;      // -100 a 100
  vibrance: number;        // -100 a 100
  warmth: number;          // -100 a 100 (temperatura de color)
  highlights: number;      // -100 a 100
  shadows: number;         // -100 a 100
  recommendation: string;  // Descripción textual de los ajustes
};

export type TopazUpscaleResult = {
  upscaledUrl: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  scaleFactor: number;
};

export type FrameProcessResult = {
  framedImageBuffer: Buffer;
  width: number;
  height: number;
  format: "jpeg" | "png";
};

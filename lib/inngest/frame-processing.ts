import sharp from "sharp";
import type { GeminiAnalysisResult, FrameProcessResult } from "./client";

// Configuración del marco
const FRAME_CONFIG = {
  // Tamaño final del marco en píxeles (para impresión a 300dpi)
  // 20x25cm a 300dpi = 2362x2953 píxeles
  frameWidth: 2362,
  frameHeight: 2953,
  
  // Proporciones del marco (porcentajes)
  outerFramePercent: 0.08,    // Marco blanco exterior: 8%
  paspartuPercent: 0.12,       // Paspartú: 12%
  
  // Colores
  outerFrameColor: "#FFFFFF",  // Blanco
  
  // Calidad de salida
  outputQuality: 95,
};

/**
 * Procesa una imagen aplicando ajustes de color y generando el marco de 3 capas.
 */
export async function processFrameWithSharp(
  imageUrl: string,
  colorAdjustments: GeminiAnalysisResult,
  cropData?: { x: number; y: number; width: number; height: number }
): Promise<FrameProcessResult> {
  // Descargar la imagen
  const response = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  // Cargar imagen con Sharp
  let image = sharp(imageBuffer);
  const metadata = await image.metadata();

  // Aplicar recorte si se proporciona
  if (cropData) {
    image = image.extract({
      left: Math.round(cropData.x),
      top: Math.round(cropData.y),
      width: Math.round(cropData.width),
      height: Math.round(cropData.height),
    });
  }

  // Aplicar ajustes de color
  image = applyColorAdjustments(image, colorAdjustments);

  // Calcular dimensiones del marco
  const { frameWidth, frameHeight, outerFramePercent, paspartuPercent } = FRAME_CONFIG;
  
  const outerFrameSize = Math.round(Math.min(frameWidth, frameHeight) * outerFramePercent);
  const paspartuSize = Math.round(Math.min(frameWidth, frameHeight) * paspartuPercent);
  
  // Área disponible para la foto (después de marco y paspartú)
  const photoAreaWidth = frameWidth - (outerFrameSize * 2) - (paspartuSize * 2);
  const photoAreaHeight = frameHeight - (outerFrameSize * 2) - (paspartuSize * 2);

  // Redimensionar la foto para que encaje en el área disponible (mantener aspecto 2:3)
  const photoBuffer = await image
    .resize(photoAreaWidth, photoAreaHeight, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 95 })
    .toBuffer();

  // Crear el paspartú con la imagen difuminada
  const paspartuWidth = photoAreaWidth + (paspartuSize * 2);
  const paspartuHeight = photoAreaHeight + (paspartuSize * 2);
  
  const blurredPaspartu = await sharp(imageBuffer)
    .resize(paspartuWidth, paspartuHeight, {
      fit: "cover",
      position: "center",
    })
    .blur(30) // Difuminar significativamente
    .modulate({
      brightness: 0.7, // Oscurecer un poco
      saturation: 0.8, // Reducir saturación
    })
    .toBuffer();

  // Componer el paspartú con la foto centrada
  const paspartuWithPhoto = await sharp(blurredPaspartu)
    .composite([
      {
        input: photoBuffer,
        top: paspartuSize,
        left: paspartuSize,
      },
    ])
    .toBuffer();

  // Crear el marco final con fondo blanco
  const framedImageBuffer = await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      {
        input: paspartuWithPhoto,
        top: outerFrameSize,
        left: outerFrameSize,
      },
    ])
    .jpeg({ quality: FRAME_CONFIG.outputQuality })
    .toBuffer();

  return {
    framedImageBuffer,
    width: frameWidth,
    height: frameHeight,
    format: "jpeg",
  };
}

/**
 * Aplica ajustes de color basados en el análisis de Gemini.
 */
function applyColorAdjustments(
  image: sharp.Sharp,
  adjustments: GeminiAnalysisResult
): sharp.Sharp {
  // Convertir valores de -100 a 100 a los rangos que Sharp espera
  
  // Brillo: Sharp usa 0.5-2.0 donde 1.0 es neutro
  // -100 → 0.5, 0 → 1.0, 100 → 2.0
  const brightness = 1 + (adjustments.brightness / 200);
  
  // Saturación: Sharp usa 0-2 donde 1.0 es neutro
  // -100 → 0, 0 → 1.0, 100 → 2.0
  const saturation = 1 + (adjustments.saturation / 100);

  // Aplicar modulación básica
  image = image.modulate({
    brightness: Math.max(0.5, Math.min(2, brightness)),
    saturation: Math.max(0, Math.min(2, saturation)),
  });

  // Aplicar contraste usando linear
  // El contraste en Sharp se maneja con la función linear
  // a = contraste (1.0 es neutro), b = brillo offset
  if (adjustments.contrast !== 0) {
    const contrastMultiplier = 1 + (adjustments.contrast / 100);
    image = image.linear(
      Math.max(0.5, Math.min(2, contrastMultiplier)),
      0 // Sin offset adicional de brillo
    );
  }

  // Aplicar temperatura de color (warmth) mediante tint
  // Esto es una aproximación usando gamma por canal
  if (adjustments.warmth !== 0) {
    const warmthFactor = adjustments.warmth / 100;
    
    if (warmthFactor > 0) {
      // Más cálido: aumentar rojos/amarillos, reducir azules
      image = image.gamma(
        1 - (warmthFactor * 0.1),  // Rojo: gamma menor = más brillante
        1,                          // Verde: neutro
        1 + (warmthFactor * 0.15)  // Azul: gamma mayor = más oscuro
      );
    } else {
      // Más frío: aumentar azules, reducir rojos
      const coolFactor = Math.abs(warmthFactor);
      image = image.gamma(
        1 + (coolFactor * 0.15),  // Rojo: gamma mayor = más oscuro
        1,                         // Verde: neutro
        1 - (coolFactor * 0.1)    // Azul: gamma menor = más brillante
      );
    }
  }

  return image;
}

/**
 * Genera solo la vista previa del marco (versión más pequeña para web).
 */
export async function generateFramePreview(
  imageUrl: string,
  previewWidth: number = 400
): Promise<Buffer> {
  const response = await fetch(imageUrl);
  const imageBuffer = Buffer.from(await response.arrayBuffer());

  const aspectRatio = FRAME_CONFIG.frameHeight / FRAME_CONFIG.frameWidth;
  const previewHeight = Math.round(previewWidth * aspectRatio);

  // Versión simplificada para preview
  const { outerFramePercent, paspartuPercent } = FRAME_CONFIG;
  
  const outerFrameSize = Math.round(previewWidth * outerFramePercent);
  const paspartuSize = Math.round(previewWidth * paspartuPercent);
  
  const photoAreaWidth = previewWidth - (outerFrameSize * 2) - (paspartuSize * 2);
  const photoAreaHeight = previewHeight - (outerFrameSize * 2) - (paspartuSize * 2);

  const photoBuffer = await sharp(imageBuffer)
    .resize(photoAreaWidth, photoAreaHeight, { fit: "cover" })
    .jpeg({ quality: 80 })
    .toBuffer();

  const paspartuWidth = photoAreaWidth + (paspartuSize * 2);
  const paspartuHeight = photoAreaHeight + (paspartuSize * 2);

  const blurredPaspartu = await sharp(imageBuffer)
    .resize(paspartuWidth, paspartuHeight, { fit: "cover" })
    .blur(15)
    .modulate({ brightness: 0.7, saturation: 0.8 })
    .toBuffer();

  const paspartuWithPhoto = await sharp(blurredPaspartu)
    .composite([{ input: photoBuffer, top: paspartuSize, left: paspartuSize }])
    .toBuffer();

  return sharp({
    create: {
      width: previewWidth,
      height: previewHeight,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([{ input: paspartuWithPhoto, top: outerFrameSize, left: outerFrameSize }])
    .jpeg({ quality: 80 })
    .toBuffer();
}

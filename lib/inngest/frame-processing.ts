import sharp from "sharp";
import type { GeminiAnalysisResult, FrameProcessResult } from "./client";

// Configuración del marco basada en proporciones del usuario
// Proporción 2:3 vertical (retrato)
// Cuadro grande: 80x120 cm
// Cuadro mediano: 60x90 cm
// Cuadro pequeño: 40x60 cm
const FRAME_CONFIG = {
  // Tamaño final del marco en píxeles (para impresión a 300dpi)
  // Mantenemos proporción 2:3 (vertical) con tamaño manejable
  frameWidth: 2400,  // 8 pulgadas * 300dpi
  frameHeight: 3600, // 12 pulgadas * 300dpi (proporción 2:3)
  
  // Proporciones de los marcos (basadas en las medidas del usuario)
  // Marco exterior (diferencia entre 120x80 y 90x60): (120-90)/2 = 15cm de cada lado
  // Como porcentaje de 120: 15/120 = 12.5%
  outerFramePercent: 0.125,
  
  // Paspartú (diferencia entre 90x60 y 60x40): (90-60)/2 = 15cm de cada lado
  // Como porcentaje de 90: 15/90 = 16.67%
  // Pero relativo al frame total: ajustamos proporcionalmente
  paspartuPercent: 0.125,
  
  // Colores
  outerFrameColor: "#FFFFFF",  // Blanco
  
  // Calidad de salida
  outputQuality: 95,
};

/**
 * Procesa una imagen aplicando ajustes de color y generando el marco de 3 capas.
 * @param imageSource - URL de la imagen o Buffer con los bytes de la imagen
 */
export async function processFrameWithSharp(
  imageSource: string | Buffer,
  colorAdjustments: GeminiAnalysisResult,
  cropData?: { x: number; y: number; width: number; height: number }
): Promise<FrameProcessResult> {
  // Obtener el buffer de la imagen (desde URL o directamente)
  let imageBuffer: Buffer;
  
  if (Buffer.isBuffer(imageSource)) {
    // Ya es un Buffer, usarlo directamente
    imageBuffer = imageSource;
    console.log(`[Sharp] Usando imagen desde Buffer: ${imageBuffer.byteLength} bytes`);
  } else {
    // Es una URL, descargar la imagen
    console.log(`[Sharp] Descargando imagen desde URL: ${imageSource.substring(0, 80)}...`);
    const response = await fetch(imageSource);
    if (!response.ok) {
      throw new Error(`Error descargando imagen: ${response.status} ${response.statusText}`);
    }
    imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[Sharp] Imagen descargada: ${imageBuffer.byteLength} bytes`);
  }

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

  // Redimensionar la foto para que encaje en el área disponible (proporción 3:2)
  const photoBuffer = await image
    .resize(photoAreaWidth, photoAreaHeight, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 95 })
    .toBuffer();

  // Crear el paspartú con un color sólido derivado de la imagen
  // En lugar de blur que crea sombras, extraemos el color promedio
  const paspartuWidth = photoAreaWidth + (paspartuSize * 2);
  const paspartuHeight = photoAreaHeight + (paspartuSize * 2);
  
  // Obtener el color promedio de la imagen para el paspartú
  const { dominant } = await sharp(imageBuffer)
    .resize(10, 10, { fit: "cover" })
    .stats();
  
  // Oscurecer el color dominante para el paspartú
  const paspartuColor = {
    r: Math.round(dominant.r * 0.6),
    g: Math.round(dominant.g * 0.6),
    b: Math.round(dominant.b * 0.6),
  };
  
  // Crear paspartú con color sólido
  const paspartuBuffer = await sharp({
    create: {
      width: paspartuWidth,
      height: paspartuHeight,
      channels: 3,
      background: paspartuColor,
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  // Componer el paspartú con la foto centrada
  const paspartuWithPhoto = await sharp(paspartuBuffer)
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

  // Hue para temperatura de color (warmth)
  // warmth positivo = más cálido (tonos hacia amarillo/rojo) = hue negativo
  // warmth negativo = más frío (tonos hacia azul) = hue positivo
  // Sharp hue va de -180 a 180
  const hueShift = -(adjustments.warmth * 0.15); // Convertir -100..100 a aproximadamente -15..15 grados

  // Aplicar modulación con brillo, saturación y hue
  image = image.modulate({
    brightness: Math.max(0.5, Math.min(2, brightness)),
    saturation: Math.max(0, Math.min(2, saturation)),
    hue: Math.round(hueShift),
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

  // Aplicar gamma general para ajustar sombras/highlights
  // gamma < 1 no es válido, así que usamos gamma >= 1.0
  // Valores más altos oscurecen medios tonos, valores cercanos a 1 son neutros
  if (adjustments.shadows !== 0 || adjustments.highlights !== 0) {
    // Combinar shadows y highlights en un ajuste de gamma general
    // shadows positivo = aclarar sombras = gamma menor (más cerca de 1)
    // shadows negativo = oscurecer sombras = gamma mayor
    const shadowEffect = -(adjustments.shadows / 200); // -0.5 a 0.5
    const gammaValue = Math.max(1.0, Math.min(3.0, 1.0 + shadowEffect + 0.5));
    
    if (gammaValue !== 1.0) {
      image = image.gamma(gammaValue);
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

  // Obtener color dominante para el paspartú
  const { dominant } = await sharp(imageBuffer)
    .resize(10, 10, { fit: "cover" })
    .stats();
  
  const paspartuColor = {
    r: Math.round(dominant.r * 0.6),
    g: Math.round(dominant.g * 0.6),
    b: Math.round(dominant.b * 0.6),
  };

  const paspartuBuffer = await sharp({
    create: {
      width: paspartuWidth,
      height: paspartuHeight,
      channels: 3,
      background: paspartuColor,
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();

  const paspartuWithPhoto = await sharp(paspartuBuffer)
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

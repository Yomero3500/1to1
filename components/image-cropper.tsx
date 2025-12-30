"use client"

import { useState, useCallback, useEffect } from "react"
import Cropper, { type Area, type Point } from "react-easy-crop"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical } from "lucide-react"

export interface CropData {
  x: number
  y: number
  width: number
  height: number
}

interface ImageCropperProps {
  imageSrc: string
  imageId: string
  isOpen: boolean
  onClose: () => void
  onCropComplete: (imageId: string, cropData: CropData, croppedImageUrl: string) => void
}

// Función para crear imagen con flip aplicado
async function createFlippedImage(src: string, flipH: boolean, flipV: boolean): Promise<string> {
  if (!flipH && !flipV) return src
  
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        reject(new Error("No 2d context"))
        return
      }
      
      ctx.save()
      ctx.translate(flipH ? img.width : 0, flipV ? img.height : 0)
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      ctx.drawImage(img, 0, 0)
      ctx.restore()
      
      resolve(canvas.toDataURL("image/jpeg", 0.95))
    }
    img.onerror = reject
    img.src = src
  })
}

export function ImageCropper({ imageSrc, imageId, isOpen, onClose, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [processedImageSrc, setProcessedImageSrc] = useState<string>(imageSrc)
  const [isProcessingFlip, setIsProcessingFlip] = useState(false)

  // Actualizar imagen procesada cuando cambian los flips
  useEffect(() => {
    let cancelled = false
    
    const processFlip = async () => {
      setIsProcessingFlip(true)
      try {
        const flipped = await createFlippedImage(imageSrc, flipH, flipV)
        if (!cancelled) {
          setProcessedImageSrc(flipped)
        }
      } catch (error) {
        console.error("Error flipping image:", error)
        if (!cancelled) {
          setProcessedImageSrc(imageSrc)
        }
      } finally {
        if (!cancelled) {
          setIsProcessingFlip(false)
        }
      }
    }
    
    processFlip()
    
    return () => {
      cancelled = true
    }
  }, [imageSrc, flipH, flipV])

  // Reset cuando se abre el dialog
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setFlipH(false)
      setFlipV(false)
      setProcessedImageSrc(imageSrc)
    }
  }, [isOpen, imageSrc])

  const onCropChange = useCallback((crop: Point) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const handleRotateLeft = () => {
    setRotation((prev) => (prev - 90) % 360)
  }

  const handleRotateRight = () => {
    setRotation((prev) => (prev + 90) % 360)
  }

  const handleFlipHorizontal = () => {
    setFlipH((prev) => !prev)
  }

  const handleFlipVertical = () => {
    setFlipV((prev) => !prev)
  }

  const handleReset = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }

  const createCroppedImage = useCallback(async (): Promise<string> => {
    if (!croppedAreaPixels) throw new Error("No crop area")

    const image = new Image()
    image.crossOrigin = "anonymous"

    return new Promise((resolve, reject) => {
      image.onload = () => {
        // Crear canvas con la imagen rotada (el flip ya está aplicado en processedImageSrc)
        const rotatedCanvas = document.createElement("canvas")
        const rotatedCtx = rotatedCanvas.getContext("2d")

        if (!rotatedCtx) {
          reject(new Error("No 2d context"))
          return
        }

        // Calcular dimensiones del canvas rotado
        const isRotated90or270 = Math.abs(rotation % 180) === 90
        const rotatedWidth = isRotated90or270 ? image.height : image.width
        const rotatedHeight = isRotated90or270 ? image.width : image.height

        rotatedCanvas.width = rotatedWidth
        rotatedCanvas.height = rotatedHeight

        // Aplicar solo rotación (el flip ya está en la imagen)
        rotatedCtx.save()
        rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2)
        rotatedCtx.rotate((rotation * Math.PI) / 180)
        rotatedCtx.drawImage(image, -image.width / 2, -image.height / 2)
        rotatedCtx.restore()

        // Ahora recortar de la imagen ya transformada
        const finalCanvas = document.createElement("canvas")
        const finalCtx = finalCanvas.getContext("2d")

        if (!finalCtx) {
          reject(new Error("No 2d context for final canvas"))
          return
        }

        finalCanvas.width = croppedAreaPixels.width
        finalCanvas.height = croppedAreaPixels.height

        // Dibujar solo el área recortada
        finalCtx.drawImage(
          rotatedCanvas,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
        )

        // Convert to blob URL
        finalCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob))
            } else {
              reject(new Error("Failed to create blob"))
            }
          },
          "image/jpeg",
          0.95,
        )
      }

      image.onerror = () => reject(new Error("Failed to load image"))
      image.src = processedImageSrc
    })
  }, [croppedAreaPixels, processedImageSrc, rotation])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return

    try {
      const croppedImageUrl = await createCroppedImage()

      const cropData: CropData = {
        x: Math.round(croppedAreaPixels.x),
        y: Math.round(croppedAreaPixels.y),
        width: Math.round(croppedAreaPixels.width),
        height: Math.round(croppedAreaPixels.height),
      }

      onCropComplete(imageId, cropData, croppedImageUrl)
      handleReset()
      onClose()
    } catch (error) {
      console.error("Error cropping image:", error)
    }
  }

  const handleCancel = () => {
    handleReset()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl w-full h-[95vh] sm:h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-0">
          <DialogTitle className="text-base sm:text-lg">Recortar Imagen</DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-black mx-0 sm:mx-4 overflow-hidden touch-none">
          {isProcessingFlip && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="text-white text-sm">Aplicando transformación...</div>
            </div>
          )}
          <Cropper
            image={processedImageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={2 / 3}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
            cropShape="rect"
            showGrid={true}
            objectFit="auto-cover"
            style={{
              containerStyle: {
                width: "100%",
                height: "100%",
              },
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-3 sm:p-6 space-y-3 sm:space-y-4">
          {/* Zoom Control */}
          <div className="flex items-center gap-2 sm:gap-4">
            <ZoomOut className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
            <span className="text-xs sm:text-sm text-muted-foreground w-10 sm:w-12 text-right">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Rotation and Flip Controls */}
          <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 bg-transparent"
              onClick={handleRotateLeft}
              title="Rotar izquierda"
            >
              <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9 bg-transparent"
              onClick={handleRotateRight}
              title="Rotar derecha"
            >
              <RotateCw className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
            <Button
              variant={flipH ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={handleFlipHorizontal}
              title="Voltear horizontal"
            >
              <FlipHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <Button
              variant={flipV ? "default" : "outline"}
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              onClick={handleFlipVertical}
              title="Voltear vertical"
            >
              <FlipVertical className="h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs sm:text-sm h-8 sm:h-9">
              Restablecer
            </Button>
          </div>

          {/* Info */}
          <p className="text-[10px] sm:text-xs text-muted-foreground text-center text-balance">
            Proporción fija: 2:3 (formato vertical para cuadros)
          </p>
        </div>

        <DialogFooter className="p-3 sm:p-6 pt-0 flex-row gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1 sm:flex-none bg-transparent">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} className="flex-1 sm:flex-none">
            Aplicar Recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useCallback } from "react"
import Cropper, { Area, Point } from "react-easy-crop"
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

export function ImageCropper({ imageSrc, imageId, isOpen, onClose, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

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
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        
        if (!ctx) {
          reject(new Error("No 2d context"))
          return
        }

        // Set canvas size to the cropped area
        canvas.width = croppedAreaPixels.width
        canvas.height = croppedAreaPixels.height

        // Apply transformations
        ctx.save()
        
        // Move to center for transformations
        ctx.translate(canvas.width / 2, canvas.height / 2)
        
        // Apply rotation
        ctx.rotate((rotation * Math.PI) / 180)
        
        // Apply flips
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
        
        // Move back
        ctx.translate(-canvas.width / 2, -canvas.height / 2)

        // Draw the cropped image
        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height
        )

        ctx.restore()

        // Convert to blob URL
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob))
            } else {
              reject(new Error("Failed to create blob"))
            }
          },
          "image/jpeg",
          0.95
        )
      }

      image.onerror = () => reject(new Error("Failed to load image"))
      image.src = imageSrc
    })
  }, [croppedAreaPixels, imageSrc, rotation, flipH, flipV])

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

  // Calculate transform style for flips
  const getTransformStyle = () => {
    const transforms = []
    if (flipH) transforms.push("scaleX(-1)")
    if (flipV) transforms.push("scaleY(-1)")
    return transforms.length > 0 ? transforms.join(" ") : undefined
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Recortar Imagen</DialogTitle>
        </DialogHeader>

        <div className="flex-1 relative bg-black/90 mx-6 rounded-lg overflow-hidden">
          <div style={{ transform: getTransformStyle() }} className="absolute inset-0">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={2 / 3}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteCallback}
              cropShape="rect"
              showGrid={true}
              style={{
                containerStyle: {
                  width: "100%",
                  height: "100%",
                },
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 space-y-4">
          {/* Zoom Control */}
          <div className="flex items-center gap-4">
            <ZoomOut className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(value) => setZoom(value[0])}
              className="flex-1"
            />
            <ZoomIn className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground w-12 text-right">{Math.round(zoom * 100)}%</span>
          </div>

          {/* Rotation and Flip Controls */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={handleRotateLeft} title="Rotar izquierda">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRotateRight} title="Rotar derecha">
              <RotateCw className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button 
              variant={flipH ? "default" : "outline"} 
              size="icon" 
              onClick={handleFlipHorizontal}
              title="Voltear horizontal"
            >
              <FlipHorizontal className="h-4 w-4" />
            </Button>
            <Button 
              variant={flipV ? "default" : "outline"} 
              size="icon" 
              onClick={handleFlipVertical}
              title="Voltear vertical"
            >
              <FlipVertical className="h-4 w-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Restablecer
            </Button>
          </div>

          {/* Info */}
          <p className="text-xs text-muted-foreground text-center">
            Proporción fija: 2:3 (formato retrato estándar)
          </p>
        </div>

        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Aplicar Recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

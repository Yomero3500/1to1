"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Card } from "@/components/ui/card"
import { Upload, X, Crop, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CropData } from "@/components/image-cropper"

export interface UploadedImage {
  id: string
  file: File
  preview: string
  originalPreview: string
  aspectRatio: number
  cropData?: CropData
  isCropped: boolean
}

interface ImageUploadZoneProps {
  onImagesUploaded: (images: UploadedImage[]) => void
  images: UploadedImage[]
  onRemoveImage: (id: string) => void
  onCropImage: (image: UploadedImage) => void
}

export function ImageUploadZone({ onImagesUploaded, images, onRemoveImage, onCropImage }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return

      const newImages: UploadedImage[] = []

      Array.from(files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          const preview = URL.createObjectURL(file)
          const img = new Image()

          img.onload = () => {
            const aspectRatio = img.height / img.width
            const uploadedImage: UploadedImage = {
              id: `${Date.now()}-${Math.random()}`,
              file,
              preview,
              originalPreview: preview,
              aspectRatio,
              isCropped: false,
            }

            newImages.push(uploadedImage)

            if (newImages.length === Array.from(files).filter((f) => f.type.startsWith("image/")).length) {
              onImagesUploaded([...images, ...newImages])
            }
          }

          img.src = preview
        }
      })
    },
    [images, onImagesUploaded],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      processFiles(e.dataTransfer.files)
    },
    [processFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      processFiles(e.target.files)
    },
    [processFiles],
  )

  return (
    <div className="space-y-4">
      <Card
        className={`border-2 border-dashed transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <label className="flex flex-col items-center justify-center p-12 cursor-pointer">
          <Upload className={`h-12 w-12 mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          <p className="text-lg font-medium mb-2">Arrastra y suelta tus imágenes aquí</p>
          <p className="text-sm text-muted-foreground mb-4">o haz clic para seleccionar archivos</p>
          <input type="file" multiple accept="image/*" onChange={handleFileInput} className="hidden" />
          <Button type="button" variant="secondary">
            Seleccionar Imágenes
          </Button>
        </label>
      </Card>

      {/* Uploaded Images Preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image) => {
            const needsCrop = Math.abs(image.aspectRatio - 3 / 2) > 0.05 && !image.isCropped
            
            return (
              <div key={image.id} className="relative group">
                <Card className={`overflow-hidden ${needsCrop ? 'ring-2 ring-yellow-500/50' : ''} ${image.isCropped ? 'ring-2 ring-green-500/50' : ''}`}>
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={image.preview || "/placeholder.svg"}
                      alt="Uploaded"
                      className="w-full h-full object-cover"
                    />
                    {/* Status Badge */}
                    {image.isCropped && (
                      <Badge className="absolute bottom-2 left-2 bg-green-500/90 text-white text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Recortada
                      </Badge>
                    )}
                    {needsCrop && (
                      <Badge className="absolute bottom-2 left-2 bg-yellow-500/90 text-white text-xs">
                        Requiere recorte
                      </Badge>
                    )}
                  </div>
                </Card>
                
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-white/90 hover:bg-white"
                    onClick={() => onCropImage(image)}
                    title="Recortar imagen"
                  >
                    <Crop className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onRemoveImage(image.id)}
                    title="Eliminar imagen"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

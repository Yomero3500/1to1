"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Card } from "@/components/ui/card"
import { Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface UploadedImage {
  id: string
  file: File
  preview: string
  aspectRatio: number
}

interface ImageUploadZoneProps {
  onImagesUploaded: (images: UploadedImage[]) => void
  images: UploadedImage[]
  onRemoveImage: (id: string) => void
}

export function ImageUploadZone({ onImagesUploaded, images, onRemoveImage }: ImageUploadZoneProps) {
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
              aspectRatio,
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
          {images.map((image) => (
            <div key={image.id} className="relative group">
              <Card className="overflow-hidden">
                <div className="aspect-square bg-muted">
                  <img
                    src={image.preview || "/placeholder.svg"}
                    alt="Uploaded"
                    className="w-full h-full object-cover"
                  />
                </div>
              </Card>
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                onClick={() => onRemoveImage(image.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

"use client"

import type React from "react"

import { useCallback, useState } from "react"
import { Card } from "@/components/ui/card"
import { Upload, X, Crop, Check, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CropData } from "@/components/image-cropper"
import { analyzeImage, type ImageAnalysis } from "@/lib/ai/analyze-image"

export interface UploadedImage {
  id: string
  file: File
  preview: string
  originalPreview: string
  aspectRatio: number
  cropData?: CropData
  isCropped: boolean
  aiAnalysis?: ImageAnalysis
  isAnalyzing?: boolean
}

interface ImageUploadZoneProps {
  onImagesUploaded: (images: UploadedImage[]) => void
  images: UploadedImage[]
  onRemoveImage: (id: string) => void
  onCropImage: (image: UploadedImage) => void
  onAnalysisComplete?: (imageId: string, analysis: ImageAnalysis) => void
}

export function ImageUploadZone({ onImagesUploaded, images, onRemoveImage, onCropImage, onAnalysisComplete }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  // Función para convertir File a base64
  const fileToBase64 = useCallback((file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Eliminar el prefijo "data:image/jpeg;base64,"
        const base64 = result.split(",")[1]
        resolve({ base64, mimeType: file.type })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }, [])

  // Función para analizar imagen con IA
  const analyzeImageWithAI = useCallback(async (image: UploadedImage, allImages: UploadedImage[]) => {
    try {
      const { base64, mimeType } = await fileToBase64(image.file)
      const result = await analyzeImage(base64, mimeType)
      
      if (result.success && result.data) {
        // Actualizar el estado de la imagen con los resultados
        const updatedImages = allImages.map(img => 
          img.id === image.id 
            ? { ...img, aiAnalysis: result.data, isAnalyzing: false }
            : img
        )
        onImagesUploaded(updatedImages)
        onAnalysisComplete?.(image.id, result.data)
      } else {
        // En caso de error, solo quitar el estado de análisis
        const updatedImages = allImages.map(img => 
          img.id === image.id 
            ? { ...img, isAnalyzing: false }
            : img
        )
        onImagesUploaded(updatedImages)
      }
    } catch (error) {
      console.error("Error analizando imagen:", error)
      const updatedImages = allImages.map(img => 
        img.id === image.id 
          ? { ...img, isAnalyzing: false }
          : img
      )
      onImagesUploaded(updatedImages)
    }
  }, [fileToBase64, onImagesUploaded, onAnalysisComplete])

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
              isAnalyzing: true, // Marcar como analizando
            }

            newImages.push(uploadedImage)

            if (newImages.length === Array.from(files).filter((f) => f.type.startsWith("image/")).length) {
              const allImages = [...images, ...newImages]
              onImagesUploaded(allImages)
              
              // Iniciar análisis de IA para cada nueva imagen
              newImages.forEach(newImg => {
                analyzeImageWithAI(newImg, allImages)
              })
            }
          }

          img.src = preview
        }
      })
    },
    [images, onImagesUploaded, analyzeImageWithAI],
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
                    {needsCrop && !image.isAnalyzing && (
                      <Badge className="absolute bottom-2 left-2 bg-yellow-500/90 text-white text-xs">
                        Requiere recorte
                      </Badge>
                    )}
                    
                    {/* AI Analysis Skeleton/Status */}
                    {image.isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <Loader2 className="h-6 w-6 text-white animate-spin mb-2" />
                        <span className="text-white text-xs font-medium">IA Analizando iluminación...</span>
                      </div>
                    )}
                    
                    {/* AI Analysis Complete Badge */}
                    {image.aiAnalysis && !image.isAnalyzing && (
                      <Badge className="absolute top-2 left-2 bg-purple-500/90 text-white text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        IA Analizada
                      </Badge>
                    )}
                  </div>
                  
                  {/* AI Suggestions (shown below image when analyzed) */}
                  {image.aiAnalysis && !image.isAnalyzing && (
                    <div className="p-2 bg-muted/50 text-xs">
                      <p className="text-muted-foreground truncate" title={image.aiAnalysis.suggestions}>
                        {image.aiAnalysis.suggestions}
                      </p>
                    </div>
                  )}
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

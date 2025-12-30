"use client"

import type React from "react"

import { useCallback, useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Upload, X, Crop, Check, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CropData } from "@/components/image-cropper"
import { analyzeImage } from "@/lib/ai/analyze-image"
import type { ImageAnalysis } from "@/lib/ai/types"

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
  onUpdateImage?: (imageId: string, updates: Partial<UploadedImage>) => void
  images: UploadedImage[]
  onRemoveImage: (id: string) => void
  onCropImage: (image: UploadedImage) => void
  onAnalysisComplete?: (imageId: string, analysis: ImageAnalysis) => void
}

export function ImageUploadZone({
  onImagesUploaded,
  onUpdateImage,
  images,
  onRemoveImage,
  onCropImage,
  onAnalysisComplete,
}: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Función para abrir el selector de archivos
  const handleSelectClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    fileInputRef.current?.click()
  }, [])

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
  const analyzeImageWithAI = useCallback(
    async (imageToAnalyze: UploadedImage) => {
      try {
        const { base64, mimeType } = await fileToBase64(imageToAnalyze.file)
        const result = await analyzeImage(base64, mimeType)

        if (result.success && result.data) {
          // Usar onUpdateImage si está disponible (más confiable)
          if (onUpdateImage) {
            onUpdateImage(imageToAnalyze.id, { aiAnalysis: result.data, isAnalyzing: false })
          }
          onAnalysisComplete?.(imageToAnalyze.id, result.data)
        } else {
          // En caso de error, solo quitar el estado de análisis
          if (onUpdateImage) {
            onUpdateImage(imageToAnalyze.id, { isAnalyzing: false })
          }
        }
      } catch (error) {
        console.error("Error analizando imagen:", error)
        if (onUpdateImage) {
          onUpdateImage(imageToAnalyze.id, { isAnalyzing: false })
        }
      }
    },
    [fileToBase64, onUpdateImage, onAnalysisComplete],
  )

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return

      const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
      if (imageFiles.length === 0) return

      let loadedCount = 0
      const newImages: UploadedImage[] = []

      imageFiles.forEach((file) => {
        const preview = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
          const aspectRatio = img.height / img.width
          const uploadedImage: UploadedImage = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            file,
            preview,
            originalPreview: preview,
            aspectRatio,
            isCropped: false,
            isAnalyzing: true,
          }

          newImages.push(uploadedImage)
          loadedCount++

          // Cuando todas las imágenes están cargadas
          if (loadedCount === imageFiles.length) {
            const allImages = [...images, ...newImages]
            onImagesUploaded(allImages)

            // Iniciar análisis de IA para cada nueva imagen con un pequeño delay
            // para evitar sobrecargar el sistema en móvil
            newImages.forEach((newImg, index) => {
              setTimeout(() => {
                analyzeImageWithAI(newImg)
              }, index * 500) // 500ms de delay entre cada análisis
            })
          }
        }

        img.onerror = () => {
          console.error("Error loading image:", file.name)
          loadedCount++
        }

        img.src = preview
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
        <div className="flex flex-col items-center justify-center p-8 sm:p-12">
          <label className="cursor-pointer flex flex-col items-center">
            <Upload
              className={`h-10 w-10 sm:h-12 sm:w-12 mb-3 sm:mb-4 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
            />
            <p className="text-base sm:text-lg font-medium mb-2 text-center text-balance">
              Arrastra y suelta tus imágenes aquí
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 text-center">
              o haz clic para seleccionar archivos
            </p>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept="image/*" 
              onChange={handleFileInput} 
              className="hidden" 
            />
          </label>
          <Button 
            type="button" 
            variant="secondary" 
            size="sm"
            onClick={handleSelectClick}
          >
            Seleccionar Imágenes
          </Button>
        </div>
      </Card>

      {/* Uploaded Images Preview */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {images.map((image) => {
            const needsCrop = Math.abs(image.aspectRatio - 2 / 3) > 0.05 && !image.isCropped

            return (
              <div key={image.id} className="relative group">
                <Card
                  className={`overflow-hidden ${needsCrop ? "ring-2 ring-yellow-500/50" : ""} ${image.isCropped ? "ring-2 ring-green-500/50" : ""}`}
                >
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
                        <span className="hidden sm:inline">Recortada</span>
                        <span className="sm:hidden">OK</span>
                      </Badge>
                    )}
                    {needsCrop && !image.isAnalyzing && (
                      <Badge className="absolute bottom-2 left-2 bg-yellow-500/90 text-white text-[10px] sm:text-xs leading-tight">
                        <span className="hidden sm:inline">Requiere recorte</span>
                        <span className="sm:hidden">Recortar</span>
                      </Badge>
                    )}

                    {/* AI Analysis Skeleton/Status */}
                    {image.isAnalyzing && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-2">
                        <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 text-white animate-spin mb-2" />
                        <span className="text-white text-[10px] sm:text-xs font-medium text-center leading-tight">
                          IA Analizando...
                        </span>
                      </div>
                    )}

                    {/* AI Analysis Complete Badge */}
                    {image.aiAnalysis && !image.isAnalyzing && (
                      <Badge className="absolute top-2 left-2 bg-purple-500/90 text-white text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">IA</span>
                      </Badge>
                    )}
                  </div>
                </Card>

                {/* Action Buttons */}
                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8 bg-white/90 hover:bg-white"
                    onClick={() => onCropImage(image)}
                    title="Recortar imagen"
                  >
                    <Crop className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7 sm:h-8 sm:w-8"
                    onClick={() => onRemoveImage(image.id)}
                    title="Eliminar imagen"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4" />
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

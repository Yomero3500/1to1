"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Crop, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FramePreviewProps {
  imageSrc: string
  imageId: string
  aspectRatio?: number
  aiSuggestion?: string
  onCropRequested?: (imageId: string) => void
}

export function FramePreview({ imageSrc, imageId, aspectRatio = 2 / 3, aiSuggestion, onCropRequested }: FramePreviewProps) {
  const needsCrop = Math.abs(aspectRatio - 2 / 3) > 0.01

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      {/* 3-Layer Frame Preview */}
      <div className="relative mx-auto" style={{ maxWidth: "280px", width: "100%" }}>
        {/* Layer 1: Outer white background (Marco exterior) */}
        <div className="bg-white p-3 sm:p-4 shadow-lg rounded-sm">
          {/* Layer 2: Middle frame with image (Paspartú con imagen) */}
          <div
            className="relative p-3 sm:p-4 overflow-hidden"
            style={{
              backgroundImage: `url(${imageSrc || "/placeholder.svg"})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* Overlay to soften the middle frame image */}
            <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />

            {/* Layer 3: Photo container with 2:3 aspect ratio */}
            <div className="relative bg-muted overflow-hidden" style={{ aspectRatio: "2/3" }}>
              <img
                src={imageSrc || "/placeholder.svg"}
                alt={`Preview ${imageId}`}
                className="w-full h-full object-cover"
                style={{
                  objectFit: needsCrop ? "contain" : "cover",
                }}
              />

              {/* Crop Guide Overlay */}
              {needsCrop && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="text-center space-y-2 p-4">
                    <div className="border-2 border-dashed border-white/80 w-24 sm:w-32 h-36 sm:h-48 mx-auto" />
                    <p className="text-[10px] sm:text-xs text-white font-medium">Guía de recorte 2:3</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">Recomendación IA</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">{aiSuggestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* Crop Warning */}
      {needsCrop && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs sm:text-sm text-balance">
            Esta imagen no cumple la proporción 2:3. Se recomienda recortarla para un mejor resultado.
          </AlertDescription>
        </Alert>
      )}

      {/* Crop Button - siempre visible para mejorar UX */}
      {onCropRequested && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2 bg-transparent text-xs sm:text-sm"
          onClick={() => onCropRequested(imageId)}
        >
          <Crop className="h-3 w-3 sm:h-4 sm:w-4" />
          {needsCrop ? "Recortar Imagen" : "Ajustar Recorte"}
        </Button>
      )}
    </Card>
  )
}

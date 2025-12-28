"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, Crop } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FramePreviewProps {
  imageSrc: string
  imageId: string
  aspectRatio?: number
  onCropRequested?: (imageId: string) => void
}

export function FramePreview({ imageSrc, imageId, aspectRatio = 2 / 3, onCropRequested }: FramePreviewProps) {
  const needsCrop = Math.abs(aspectRatio - 2 / 3) > 0.01

  return (
    <Card className="p-6 space-y-4">
      {/* 3-Layer Frame Preview */}
      <div className="relative mx-auto" style={{ maxWidth: "300px" }}>
        {/* Layer 1: Outer white background (Marco exterior) */}
        <div className="bg-white p-4 shadow-lg rounded-sm">
          {/* Layer 2: Middle frame with image (Paspartú con imagen) */}
          <div 
            className="relative p-4 overflow-hidden"
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
                      <div className="border-2 border-dashed border-white/80 w-32 h-48 mx-auto" />
                      <p className="text-xs text-white font-medium">Guía de recorte 2:3</p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Frame Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-white border border-gray-300 rounded-sm" />
          <span>Marco exterior</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-gradient-to-br from-gray-200 to-gray-400 rounded-sm" />
          <span>Paspartú (imagen)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-500 rounded-sm" />
          <span>Foto</span>
        </div>
      </div>

      {/* Crop Warning */}
      {needsCrop && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Esta imagen no cumple la proporción 2:3. Se recomienda recortarla para un mejor resultado.
          </AlertDescription>
        </Alert>
      )}

      {/* Crop Button */}
      {needsCrop && onCropRequested && (
        <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={() => onCropRequested(imageId)}>
          <Crop className="h-4 w-4" />
          Recortar Imagen
        </Button>
      )}
    </Card>
  )
}

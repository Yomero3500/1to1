"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ImageUploadZone } from "@/components/image-upload-zone"
import { FramePreview } from "@/components/frame-preview"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

interface UploadedImage {
  id: string
  file: File
  preview: string
  aspectRatio: number
}

export default function UploadPage() {
  const router = useRouter()
  const [images, setImages] = useState<UploadedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleImagesUploaded = (newImages: UploadedImage[]) => {
    setImages(newImages)
    if (newImages.length > 0 && !selectedImage) {
      setSelectedImage(newImages[0])
    }
  }

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
    if (selectedImage?.id === id) {
      setSelectedImage(images[0] || null)
    }
  }

  const handleCropRequested = (imageId: string) => {
    alert(`Función de recorte para imagen ${imageId} - Por implementar`)
  }

  const handleProcessBatch = async () => {
    setIsProcessing(true)

    // Simulate processing (Gigapixel AI simulation)
    await new Promise((resolve) => setTimeout(resolve, 3000))

    router.push("/results")
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto p-6 space-y-6">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver al Dashboard
          </Button>
        </Link>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column: Upload Zone */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Subir Imágenes</CardTitle>
                <CardDescription>Arrastra y suelta múltiples imágenes para crear un nuevo lote</CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploadZone
                  onImagesUploaded={handleImagesUploaded}
                  images={images}
                  onRemoveImage={handleRemoveImage}
                />
              </CardContent>
            </Card>

            {images.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Detalles del Lote</CardTitle>
                  <CardDescription>Información sobre el lote actual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total de imágenes:</span>
                    <span className="font-medium">{images.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Requieren recorte:</span>
                    <span className="font-medium">
                      {images.filter((img) => Math.abs(img.aspectRatio - 2 / 3) > 0.01).length}
                    </span>
                  </div>
                  <Button onClick={handleProcessBatch} disabled={isProcessing} className="w-full gap-2">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      "Procesar Lote"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Frame Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Previsualización del Enmarcado</CardTitle>
                <CardDescription>Vista previa de cómo quedará tu foto con el marco de 3 capas</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedImage ? (
                  <FramePreview
                    imageSrc={selectedImage.preview}
                    imageId={selectedImage.id}
                    aspectRatio={selectedImage.aspectRatio}
                    onCropRequested={handleCropRequested}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-muted-foreground">Sube imágenes para ver la previsualización</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Image Selector */}
            {images.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Seleccionar Imagen</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-2">
                    {images.map((image) => (
                      <button
                        key={image.id}
                        onClick={() => setSelectedImage(image)}
                        className={`aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                          selectedImage?.id === image.id ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img
                          src={image.preview || "/placeholder.svg"}
                          alt="Thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

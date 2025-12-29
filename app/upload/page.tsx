"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImageUploadZone, type UploadedImage } from "@/components/image-upload-zone"
import { ImageCropper, type CropData } from "@/components/image-cropper"
import { FramePreview } from "@/components/frame-preview"
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { createBatch, createImage, uploadImage } from "@/lib/supabase/queries"

export default function UploadPage() {
  const router = useRouter()
  const [images, setImages] = useState<UploadedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>("")

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<UploadedImage | null>(null)

  const handleImagesUploaded = (newImages: UploadedImage[]) => {
    setImages(newImages)
    if (newImages.length > 0 && !selectedImage) {
      setSelectedImage(newImages[0])
    }
  }

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
    if (selectedImage?.id === id) {
      setSelectedImage(images.find((img) => img.id !== id) || null)
    }
  }

  const handleCropImage = (image: UploadedImage) => {
    setImageToCrop(image)
    setCropperOpen(true)
  }

  const handleCropComplete = (imageId: string, cropData: CropData, croppedImageUrl: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? {
              ...img,
              preview: croppedImageUrl,
              cropData,
              isCropped: true,
              aspectRatio: 3 / 2, // Now matches 2:3 portrait
            }
          : img,
      ),
    )

    // Update selected image if it was the one cropped
    if (selectedImage?.id === imageId) {
      setSelectedImage((prev) =>
        prev ? { ...prev, preview: croppedImageUrl, cropData, isCropped: true, aspectRatio: 3 / 2 } : null,
      )
    }
  }

  const handleCropRequested = (imageId: string) => {
    const image = images.find((img) => img.id === imageId)
    if (image) {
      handleCropImage(image)
    }
  }

  const handleProcessBatch = async () => {
    if (images.length === 0) return

    setIsProcessing(true)
    setError(null)

    try {
      // 1. Create batch in Supabase
      setUploadProgress("Creando lote...")
      const batch = await createBatch()

      // 2. Upload each image and create records
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        setUploadProgress(`Subiendo imagen ${i + 1} de ${images.length}...`)

        // If image was cropped, we need to convert the blob URL to a File
        let fileToUpload = img.file
        if (img.isCropped && img.preview !== img.originalPreview) {
          const response = await fetch(img.preview)
          const blob = await response.blob()
          fileToUpload = new File([blob], img.file.name, { type: "image/jpeg" })
        }

        // Upload to Storage
        const originalUrl = await uploadImage(fileToUpload, batch.id)
        console.log(`[Upload] Imagen ${i + 1} subida: ${originalUrl}`)

        // Create image record with crop data - status 'pending' for Inngest processing
        await createImage({
          batch_id: batch.id,
          original_url: originalUrl,
          status: "pending", // Changed from 'completed' to trigger Inngest processing
        })
        console.log(`[Upload] Registro de imagen creado para batch ${batch.id}`)
      }

      setUploadProgress("¡Lote creado exitosamente!")

      // Redirect to results page with batch ID
      router.push(`/results?batch=${batch.id}`)
    } catch (err: any) {
      console.error("Error procesando lote:", err)
      setError(err.message || "Error al procesar el lote. Intenta nuevamente.")
    } finally {
      setIsProcessing(false)
      setUploadProgress("")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Back Button */}
        <Link href="/dashboard">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver al Dashboard</span>
            <span className="sm:hidden">Volver</span>
          </Button>
        </Link>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Left Column: Upload Zone */}
          <div className="space-y-4 md:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Subir Imágenes</CardTitle>
                <CardDescription className="text-balance text-sm">
                  Arrastra y suelta múltiples imágenes para crear un nuevo lote
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUploadZone
                  onImagesUploaded={handleImagesUploaded}
                  images={images}
                  onRemoveImage={handleRemoveImage}
                  onCropImage={handleCropImage}
                />
              </CardContent>
            </Card>

            {images.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl">Detalles del Lote</CardTitle>
                  <CardDescription className="text-sm">Información sobre el lote actual</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total de imágenes:</span>
                    <span className="font-medium">{images.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Requieren recorte:</span>
                    <span className="font-medium">
                      {images.filter((img) => !img.isCropped && Math.abs(img.aspectRatio - 3 / 2) > 0.05).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ya recortadas:</span>
                    <span className="font-medium text-green-600">{images.filter((img) => img.isCropped).length}</span>
                  </div>
                  {uploadProgress && <p className="text-sm text-muted-foreground text-center">{uploadProgress}</p>}
                  <Button
                    onClick={handleProcessBatch}
                    disabled={isProcessing || images.length === 0}
                    className="w-full gap-2"
                  >
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
          <div className="space-y-4 md:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Previsualización del Enmarcado</CardTitle>
                <CardDescription className="text-balance text-sm">
                  Vista previa de cómo quedará tu foto con el marco de 3 capas
                </CardDescription>
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
                    <p className="text-muted-foreground text-sm">Sube imágenes para ver la previsualización</p>
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
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

      {/* Image Cropper Modal */}
      {imageToCrop && (
        <ImageCropper
          imageSrc={imageToCrop.originalPreview}
          imageId={imageToCrop.id}
          isOpen={cropperOpen}
          onClose={() => {
            setCropperOpen(false)
            setImageToCrop(null)
          }}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}

"use client"

import { useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, CheckCircle2, Package } from "lucide-react"
import Link from "next/link"
import { FramePreview } from "@/components/frame-preview"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// Mock processed images data
const mockProcessedImages = [
  {
    id: "img-001",
    originalName: "foto-1.jpg",
    preview: "/portrait-photo-person.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
  {
    id: "img-002",
    originalName: "foto-2.jpg",
    preview: "/vast-mountain-valley.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
  {
    id: "img-003",
    originalName: "foto-3.jpg",
    preview: "/diverse-family-portrait.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
  {
    id: "img-004",
    originalName: "foto-4.jpg",
    preview: "/nature-photography-collection.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
  {
    id: "img-005",
    originalName: "foto-5.jpg",
    preview: "/vibrant-urban-cityscape.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
  {
    id: "img-006",
    originalName: "foto-6.jpg",
    preview: "/romantic-outdoor-wedding.png",
    aspectRatio: 2 / 3,
    processed: true,
  },
]

export default function ResultsPage() {
  const [selectedImage, setSelectedImage] = useState<(typeof mockProcessedImages)[0] | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const handleDownloadImage = (imageId: string, imageName: string) => {
    console.log(`Downloading image: ${imageId}`)
    alert(`Descargando ${imageName}...`)
  }

  const handleDownloadAll = async () => {
    setIsDownloading(true)

    // Simulate download
    await new Promise((resolve) => setTimeout(resolve, 2000))

    alert("Descargando ZIP con todas las imágenes procesadas...")
    setIsDownloading(false)
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

        {/* Success Banner */}
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="bg-green-500/10 p-3 rounded-full">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Procesamiento Completado</h3>
                <p className="text-sm text-muted-foreground">
                  {mockProcessedImages.length} imágenes han sido procesadas y escaladas exitosamente
                </p>
              </div>
              <Button onClick={handleDownloadAll} disabled={isDownloading} className="gap-2">
                <Package className="h-4 w-4" />
                {isDownloading ? "Preparando..." : "Descargar Todo (ZIP)"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Batch Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lote LOTE-005</CardTitle>
                <CardDescription>Procesado el {new Date().toLocaleDateString("es-ES")}</CardDescription>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Completado
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Results Gallery */}
        <Card>
          <CardHeader>
            <CardTitle>Galería de Resultados</CardTitle>
            <CardDescription>Haz clic en una imagen para ver la previsualización completa con marco</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {mockProcessedImages.map((image) => (
                <div key={image.id} className="group relative">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        className="w-full rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                        onClick={() => setSelectedImage(image)}
                      >
                        <div className="aspect-[2/3] bg-muted">
                          <img
                            src={image.preview || "/placeholder.svg"}
                            alt={image.originalName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{image.originalName}</DialogTitle>
                        <DialogDescription>Previsualización con marco de 3 capas</DialogDescription>
                      </DialogHeader>
                      <div className="mt-4">
                        <FramePreview imageSrc={image.preview} imageId={image.id} aspectRatio={image.aspectRatio} />
                      </div>
                    </DialogContent>
                  </Dialog>

                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground truncate">{image.originalName}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 bg-transparent"
                      onClick={() => handleDownloadImage(image.id, image.originalName)}
                    >
                      <Download className="h-3 w-3" />
                      Descargar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Processing Details */}
        <Card>
          <CardHeader>
            <CardTitle>Detalles del Procesamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Imágenes</p>
                <p className="text-2xl font-bold">{mockProcessedImages.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Proporción</p>
                <p className="text-2xl font-bold">2:3</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Escaladas</p>
                <p className="text-2xl font-bold">{mockProcessedImages.filter((i) => i.processed).length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                  Listo
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

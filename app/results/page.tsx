"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, CheckCircle2, Package, Loader2 } from "lucide-react"
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
import { getBatchById, getImagesByBatchId } from "@/lib/supabase/queries"
import type { Database } from "@/lib/supabase/types"

type ImageRecord = Database['public']['Tables']['images']['Row']
type BatchRecord = Database['public']['Tables']['batches']['Row']

interface ProcessedImage {
  id: string
  originalName: string
  preview: string
  aspectRatio: number
  processed: boolean
  status: string
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const batchId = searchParams.get('batch')
  
  const [batch, setBatch] = useState<BatchRecord | null>(null)
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (batchId) {
      loadBatchData()
    } else {
      setIsLoading(false)
    }
  }, [batchId])

  const loadBatchData = async () => {
    if (!batchId) return
    
    try {
      console.log(`[Results] Cargando datos del batch: ${batchId}`)
      const [batchData, imagesData] = await Promise.all([
        getBatchById(batchId),
        getImagesByBatchId(batchId)
      ])
      
      console.log(`[Results] Batch:`, batchData)
      console.log(`[Results] Imágenes encontradas: ${imagesData.length}`)
      imagesData.forEach((img, i) => {
        console.log(`[Results] Imagen ${i + 1}: status=${img.status}, original_url=${img.original_url?.substring(0, 60)}..., processed_url=${img.processed_url || 'null'}`)
      })
      
      setBatch(batchData)
      
      // Transform images to display format
      const processedImages: ProcessedImage[] = imagesData.map((img, index) => ({
        id: img.id,
        originalName: `foto-${index + 1}.jpg`,
        preview: img.processed_url || img.original_url || "/placeholder.svg",
        aspectRatio: 2 / 3, // Default aspect ratio
        processed: img.status === 'completed',
        status: img.status
      }))
      
      setImages(processedImages)
    } catch (error) {
      console.error("Error cargando datos del lote:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadImage = async (imageId: string, imageName: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return
    
    console.log(`[Results] Descargando imagen ${imageId}: ${image.preview}`)
    
    try {
      const response = await fetch(image.preview)
      if (!response.ok) {
        console.error(`[Results] Error HTTP ${response.status}: ${response.statusText}`)
        throw new Error(`HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = imageName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Error descargando imagen:", error)
      alert("Error al descargar la imagen")
    }
  }

  const handleDownloadAll = async () => {
    setIsDownloading(true)

    try {
      // For now, download images one by one
      // In production, you'd want to create a ZIP on the server
      for (const image of images) {
        await handleDownloadImage(image.id, image.originalName)
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      console.error("Error descargando imágenes:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
      </div>
    )
  }

  if (!batchId || !batch) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto p-6 space-y-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Volver al Dashboard
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Lote no encontrado</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
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
                  {images.length} imágenes han sido procesadas y escaladas exitosamente
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
                <CardTitle className="font-mono text-sm">Lote {batchId?.slice(0, 8)}...</CardTitle>
                <CardDescription>Procesado el {new Date(batch.created_at).toLocaleDateString("es-ES")}</CardDescription>
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
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No hay imágenes en este lote</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
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
            )}
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
                <p className="text-2xl font-bold">{images.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Proporción</p>
                <p className="text-2xl font-bold">2:3</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Procesadas</p>
                <p className="text-2xl font-bold">{images.filter((i) => i.processed).length}</p>
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

function ResultsLoading() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsLoading />}>
      <ResultsContent />
    </Suspense>
  )
}

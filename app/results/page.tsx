"use client"

import { useState, useEffect, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardHeader } from "@/components/dashboard-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Download, CheckCircle2, Package, Loader2, Clock, AlertCircle, RefreshCw, FileText, ArrowRight } from "lucide-react"
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
import { useProcessingStatus } from "@/hooks/use-processing-status"
import JSZip from "jszip"
import { jsPDF } from "jspdf"

type BatchRecord = Database["public"]["Tables"]["batches"]["Row"]

interface ProcessedImage {
  id: string
  originalName: string
  preview: string
  aspectRatio: number
  processed: boolean
  status: "pending" | "processing" | "completed" | "failed"
  processedUrl: string | null
}

// Helper para extraer nombre de archivo de URL
function extractFileName(url: string | null, fallbackId: string): string {
  if (!url) return `imagen_${fallbackId.slice(0, 8)}`
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const fileName = pathname.split('/').pop() || `imagen_${fallbackId.slice(0, 8)}`
    // Decodificar y limpiar nombre
    return decodeURIComponent(fileName).replace(/^\d+-/, '') // Remover prefijo de timestamp si existe
  } catch {
    return `imagen_${fallbackId.slice(0, 8)}`
  }
}

function ResultsContent() {
  const searchParams = useSearchParams()
  const batchId = searchParams.get("batch")

  const [batch, setBatch] = useState<BatchRecord | null>(null)
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<ProcessedImage | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Hook para polling del estado de procesamiento
  const { status: processingStatus, isPolling, startPolling, stopPolling, refetch } = useProcessingStatus({
    batchId: batchId || "",
    enabled: !!batchId,
    pollingInterval: 5000,
    onComplete: () => {
      console.log("[Results] ✅ Procesamiento completado!")
      loadBatchData() // Recargar datos cuando termine
    },
  })

  // Determinar si hay procesamiento en curso
  const isProcessing = processingStatus.pending > 0 || processingStatus.processing > 0
  const allCompleted = processingStatus.total > 0 && processingStatus.isComplete

  const loadBatchData = useCallback(async () => {
    if (!batchId) return

    try {
      console.log(`[Results] Cargando datos del batch: ${batchId}`)
      const [batchData, imagesData] = await Promise.all([getBatchById(batchId), getImagesByBatchId(batchId)])

      console.log(`[Results] Batch:`, batchData)
      console.log(`[Results] Imágenes encontradas: ${imagesData.length}`)
      imagesData.forEach((img, i) => {
        console.log(
          `[Results] Imagen ${i + 1}: status=${img.status}, processed_url=${img.processed_url || "null"}`,
        )
      })

      setBatch(batchData)

      // Transform images to display format
      const processedImages: ProcessedImage[] = imagesData.map((img) => ({
        id: img.id,
        originalName: extractFileName(img.original_url, img.id),
        preview: img.processed_url || img.original_url || "",
        aspectRatio: 2 / 3, // Default 2:3 aspect ratio
        processed: img.status === "completed",
        status: img.status,
        processedUrl: img.processed_url,
      }))

      setImages(processedImages)
    } catch (error) {
      console.error(`[Results] Error cargando datos:`, error)
    } finally {
      setIsLoading(false)
    }
  }, [batchId])

  useEffect(() => {
    if (batchId) {
      loadBatchData()
    } else {
      setIsLoading(false)
    }
  }, [batchId, loadBatchData])

  // Iniciar polling si hay imágenes pendientes
  useEffect(() => {
    if (!isLoading && isProcessing && !isPolling) {
      console.log("[Results] Iniciando polling - hay imágenes en proceso")
      startPolling()
    }
  }, [isLoading, isProcessing, isPolling, startPolling])

  // Recargar imágenes periódicamente mientras hay procesamiento
  useEffect(() => {
    if (isPolling && !isLoading) {
      const interval = setInterval(() => {
        loadBatchData()
      }, 5000) // 5 segundos para reducir solicitudes
      return () => clearInterval(interval)
    }
  }, [isPolling, isLoading, loadBatchData])

  const handleDownloadImage = async (imageId: string, imageName: string) => {
    try {
      const image = images.find((img) => img.id === imageId)
      if (!image || !image.processedUrl) {
        console.error("Imagen no encontrada o no procesada:", imageId)
        return
      }

      console.log(`[Results] Descargando imagen ${imageId}: ${image.processedUrl}`)
      
      const response = await fetch(image.processedUrl)
      if (!response.ok) {
        throw new Error(`Error descargando imagen: ${response.status}`)
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = imageName.replace(/\.[^/.]+$/, "") + "_procesada.jpg"
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
    const completedImages = images.filter((img) => img.status === "completed" && img.processedUrl)
    
    if (completedImages.length === 0) {
      alert("No hay imágenes procesadas para descargar")
      return
    }

    setIsDownloading(true)
    setDownloadProgress(0)

    try {
      const zip = new JSZip()
      const folder = zip.folder("imagenes_procesadas")

      if (!folder) {
        throw new Error("Error creando carpeta ZIP")
      }

      // Descargar todas las imágenes y agregarlas al ZIP
      for (let i = 0; i < completedImages.length; i++) {
        const image = completedImages[i]
        console.log(`[Results] Agregando al ZIP: ${image.originalName}`)

        try {
          const response = await fetch(image.processedUrl!)
          if (!response.ok) {
            console.error(`Error descargando ${image.originalName}: ${response.status}`)
            continue
          }

          const blob = await response.blob()
          const arrayBuffer = await blob.arrayBuffer()
          
          // Nombre único para evitar duplicados
          const fileName = image.originalName.replace(/\.[^/.]+$/, "") + "_procesada.jpg"
          folder.file(fileName, arrayBuffer)

          // Actualizar progreso
          const progress = Math.round(((i + 1) / completedImages.length) * 100)
          setDownloadProgress(progress)
        } catch (err) {
          console.error(`Error procesando ${image.originalName}:`, err)
        }
      }

      // Generar y descargar el ZIP
      console.log("[Results] Generando archivo ZIP...")
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      })

      const url = window.URL.createObjectURL(zipBlob)
      const a = document.createElement("a")
      a.href = url
      a.download = `lote_${batchId?.slice(0, 8)}_procesado.zip`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log("[Results] ✅ ZIP descargado exitosamente")
    } catch (error) {
      console.error("Error creando ZIP:", error)
      alert("Error al crear el archivo ZIP")
    } finally {
      setIsDownloading(false)
      setDownloadProgress(0)
    }
  }

  const handleDownloadPdf = async () => {
    const completedImages = images.filter((img) => img.status === "completed" && img.processedUrl)
    
    if (completedImages.length === 0) {
      alert("No hay imágenes procesadas para generar el PDF")
      return
    }

    setIsGeneratingPdf(true)
    setDownloadProgress(0)

    try {
      // Crear PDF con páginas del tamaño exacto de las fotos
      // Proporción 3:2 horizontal (120x80cm → usamos mm para impresión)
      // Usamos tamaño A4 landscape adaptado a proporción 3:2
      const photoWidthMm = 297 // Ancho máximo práctico para impresión
      const photoHeightMm = photoWidthMm * (2/3) // Proporción 3:2 = 198mm
      
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [photoWidthMm, photoHeightMm], // Página exacta al tamaño de la foto
      })

      for (let i = 0; i < completedImages.length; i++) {
        const image = completedImages[i]
        console.log(`[Results] Agregando al PDF: ${image.originalName} (${i + 1}/${completedImages.length})`)

        try {
          // Agregar nueva página si no es la primera imagen
          if (i > 0) {
            pdf.addPage([photoWidthMm, photoHeightMm], "landscape")
          }

          // Descargar imagen y convertir a base64
          const response = await fetch(image.processedUrl!)
          if (!response.ok) {
            console.error(`Error descargando ${image.originalName}: ${response.status}`)
            continue
          }

          const blob = await response.blob()
          const base64 = await blobToBase64(blob)

          // Agregar imagen al PDF - ocupa toda la página
          pdf.addImage(
            base64,
            "JPEG",
            0,
            0,
            photoWidthMm,
            photoHeightMm
          )

          // Actualizar progreso
          const progress = Math.round(((i + 1) / completedImages.length) * 100)
          setDownloadProgress(progress)
        } catch (err) {
          console.error(`Error procesando ${image.originalName}:`, err)
        }
      }

      // Descargar el PDF
      console.log("[Results] Generando archivo PDF...")
      pdf.save(`lote_${batchId?.slice(0, 8)}_procesado.pdf`)

      console.log("[Results] ✅ PDF descargado exitosamente")
    } catch (error) {
      console.error("Error creando PDF:", error)
      alert("Error al crear el archivo PDF")
    } finally {
      setIsGeneratingPdf(false)
      setDownloadProgress(0)
    }
  }

  // Helper para convertir Blob a base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Componente para el estado de una imagen
  const ImageStatusBadge = ({ status }: { status: ProcessedImage["status"] }) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" />
            En cola
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="default" className="gap-1 bg-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            Procesando
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle2 className="h-3 w-3" />
            Listo
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Error
          </Badge>
        )
      default:
        return null
    }
  }

  // Componente skeleton para imagen en proceso
  const ImageSkeleton = () => (
    <div className="aspect-[2/3] bg-muted animate-pulse rounded-lg flex items-center justify-center">
      <div className="text-center p-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Procesando...</p>
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto p-4 md:p-6 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Cargando resultados...</p>
          </div>
        </main>
      </div>
    )
  }

  if (!batchId || !batch) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 -ml-2">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Volver al Dashboard</span>
              <span className="sm:hidden">Volver</span>
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

  const completedCount = images.filter((img) => img.status === "completed").length
  const processingCount = images.filter((img) => img.status === "processing").length
  const pendingCount = images.filter((img) => img.status === "pending").length

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

        {/* Status Banner - Cambia según el estado */}
        {isProcessing ? (
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-4 md:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="bg-blue-500/10 p-3 rounded-full shrink-0">
                  <Loader2 className="h-6 w-6 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base md:text-lg">Procesando imágenes...</h3>
                  <p className="text-sm text-muted-foreground">
                    {completedCount} de {images.length} completadas ({processingStatus.progress}%)
                  </p>
                  {/* Barra de progreso */}
                  <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${processingStatus.progress}%` }}
                    />
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => loadBatchData()} 
                  className="gap-2 w-full sm:w-auto shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-4 md:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="bg-green-500/10 p-3 rounded-full shrink-0">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-base md:text-lg">Procesamiento Completado</h3>
                  <p className="text-sm text-muted-foreground text-balance">
                    {completedCount} imágenes han sido procesadas y escaladas exitosamente
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={handleDownloadPdf} 
                    disabled={isGeneratingPdf || isDownloading || completedCount === 0} 
                    variant="outline"
                    className="gap-2 w-full sm:w-auto shrink-0"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="hidden sm:inline">Generando PDF... {downloadProgress}%</span>
                        <span className="sm:hidden">{downloadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Descargar PDF</span>
                        <span className="sm:hidden">PDF</span>
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={handleDownloadAll} 
                    disabled={isDownloading || isGeneratingPdf || completedCount === 0} 
                    className="gap-2 w-full sm:w-auto shrink-0"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="hidden sm:inline">Descargando... {downloadProgress}%</span>
                        <span className="sm:hidden">{downloadProgress}%</span>
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4" />
                        <span className="hidden sm:inline">Descargar Todo (ZIP)</span>
                        <span className="sm:hidden">ZIP</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Batch Information */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-xs sm:text-sm">Lote {batchId?.slice(0, 8)}...</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Procesado el {new Date(batch.created_at).toLocaleDateString("es-ES")}
                </CardDescription>
              </div>
              {allCompleted ? (
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 w-fit">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Completado
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 w-fit">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  En proceso
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Results Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Galería de Resultados</CardTitle>
            <CardDescription className="text-balance text-sm">
              {isProcessing 
                ? "Las imágenes se actualizarán automáticamente conforme se procesen"
                : "Haz clic en una imagen para ver la previsualización completa con marco"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground text-sm">No hay imágenes en este lote</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {images.map((image) => (
                  <div key={image.id} className="group relative">
                    {image.status === "completed" ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <button
                            className="w-full rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-colors"
                            onClick={() => setSelectedImage(image)}
                          >
                            <div className="aspect-[2/3] bg-muted relative">
                              <img
                                src={image.preview || "/placeholder.svg"}
                                alt={image.originalName}
                                className="w-full h-full object-cover"
                              />
                              {/* Overlay con badge de estado */}
                              <div className="absolute top-2 right-2">
                                <ImageStatusBadge status={image.status} />
                              </div>
                            </div>
                          </button>
                        </DialogTrigger>
                        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
                          <DialogHeader>
                            <DialogTitle className="text-sm sm:text-base">{image.originalName}</DialogTitle>
                            <DialogDescription className="text-xs sm:text-sm">
                              Previsualización con marco de 3 capas
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            <FramePreview imageSrc={image.preview} imageId={image.id} aspectRatio={image.aspectRatio} />
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <div className="w-full rounded-lg overflow-hidden border-2 border-border relative">
                        {image.status === "processing" || image.status === "pending" ? (
                          <ImageSkeleton />
                        ) : (
                          <div className="aspect-[2/3] bg-red-50 dark:bg-red-950 flex items-center justify-center">
                            <div className="text-center p-4">
                              <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                              <p className="text-xs text-red-500">Error al procesar</p>
                            </div>
                          </div>
                        )}
                        {/* Badge de estado */}
                        <div className="absolute top-2 right-2">
                          <ImageStatusBadge status={image.status} />
                        </div>
                      </div>
                    )}

                    <div className="mt-2 space-y-2">
                      <p className="text-xs text-muted-foreground truncate">{image.originalName}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 bg-transparent text-xs"
                        onClick={() => handleDownloadImage(image.id, image.originalName)}
                        disabled={image.status !== "completed"}
                      >
                        {image.status === "completed" ? (
                          <>
                            <Download className="h-3 w-3" />
                            Descargar
                          </>
                        ) : image.status === "processing" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Procesando...
                          </>
                        ) : image.status === "pending" ? (
                          <>
                            <Clock className="h-3 w-3" />
                            En cola
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Error
                          </>
                        )}
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
            <CardTitle className="text-lg md:text-xl">Detalles del Procesamiento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Total Imágenes</p>
                <p className="text-xl sm:text-2xl font-bold">{images.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Procesadas</p>
                <p className="text-xl sm:text-2xl font-bold text-green-600">{completedCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">En Proceso</p>
                <p className="text-xl sm:text-2xl font-bold text-blue-600">{processingCount + pendingCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground">Estado</p>
                {allCompleted ? (
                  <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Listo
                  </Badge>
                ) : (
                  <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 text-xs">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Procesando
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Finalize Button - Similar to checkout button in eCommerce */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <h3 className="font-semibold text-lg">¿Listo para continuar?</h3>
                <p className="text-sm text-muted-foreground">
                  {allCompleted 
                    ? "Todas las imágenes han sido procesadas exitosamente"
                    : `${completedCount} de ${images.length} imágenes procesadas`}
                </p>
              </div>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto gap-2 text-base px-8"
                  disabled={!allCompleted}
                >
                  Finalizar Lote
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
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
      <main className="container mx-auto p-4 md:p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando resultados...</p>
        </div>
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

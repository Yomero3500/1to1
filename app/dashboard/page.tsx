"use client"

import { useEffect, useState } from "react"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Calendar, Loader2, Eye } from "lucide-react"
import { ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { getBatches, getDashboardStats } from "@/lib/supabase/queries"

interface Batch {
  id: string
  user_id: string
  created_at: string
  photoCount: number
}

interface Stats {
  totalBatches: number
  totalPhotos: number
  processingCount: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [stats, setStats] = useState<Stats>({ totalBatches: 0, totalPhotos: 0, processingCount: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [batchesData, statsData] = await Promise.all([getBatches(), getDashboardStats()])
      setBatches(batchesData)
      setStats(statsData)
    } catch (error) {
      console.error("Error cargando datos:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const [isCreating, setIsCreating] = useState(false)

  const handleCreateBatch = () => {
    setIsCreating(true)
    // Small delay for animation before navigation
    setTimeout(() => {
      router.push("/upload")
    }, 300)
  }

  const handleViewBatch = (batchId: string) => {
    router.push(`/results?batch=${batchId}`)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lotes</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalBatches}</div>
              <p className="text-xs text-muted-foreground">Lotes procesados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Fotos</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalPhotos}</div>
              <p className="text-xs text-muted-foreground">Fotos procesadas</p>
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 md:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processingCount}</div>
              <p className="text-xs text-muted-foreground">Imágenes activas</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle>Lotes de Impresión</CardTitle>
                <CardDescription className="text-balance">
                  Gestiona y descarga tus lotes de fotos procesadas
                </CardDescription>
              </div>
              <Button
                onClick={handleCreateBatch}
                size="default"
                className={`gap-2 transition-all duration-300 w-full sm:w-auto ${isCreating ? "scale-95 opacity-70" : "hover:scale-105"}`}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {isCreating ? "Creando..." : "Crear Nuevo Lote"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No tienes lotes aún</p>
                <p className="text-sm text-muted-foreground">Crea tu primer lote para comenzar</p>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Lote</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cantidad de Fotos</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batches.map((batch) => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium font-mono text-xs">{batch.id.slice(0, 8)}...</TableCell>
                          <TableCell>{new Date(batch.created_at).toLocaleDateString("es-ES")}</TableCell>
                          <TableCell>{batch.photoCount} fotos</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewBatch(batch.id)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalles
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                  {batches.map((batch) => (
                    <Card key={batch.id} className="border-border">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <p className="text-xs text-muted-foreground">ID Lote</p>
                            <p className="font-medium font-mono text-xs">{batch.id.slice(0, 8)}...</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {batch.photoCount} fotos
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Fecha</p>
                            <p className="text-sm">{new Date(batch.created_at).toLocaleDateString("es-ES")}</p>
                          </div>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleViewBatch(batch.id)}
                            className="gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            Ver
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

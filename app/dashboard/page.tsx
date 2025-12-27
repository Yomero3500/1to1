"use client"

import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Download, Calendar } from "lucide-react"
import { ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"

// Mock data for print batches
const mockBatches = [
  {
    id: "LOTE-001",
    date: "2024-01-15",
    photoCount: 24,
    status: "completed",
  },
  {
    id: "LOTE-002",
    date: "2024-01-14",
    photoCount: 18,
    status: "completed",
  },
  {
    id: "LOTE-003",
    date: "2024-01-12",
    photoCount: 32,
    status: "completed",
  },
  {
    id: "LOTE-004",
    date: "2024-01-10",
    photoCount: 15,
    status: "processing",
  },
]

const statusColors = {
  completed: "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20",
  processing: "bg-accent/10 text-accent-foreground hover:bg-accent/20",
}

const statusLabels = {
  completed: "Completado",
  processing: "Procesando",
}

export default function DashboardPage() {
  const router = useRouter()

  const handleCreateBatch = () => {
    router.push("/upload")
  }

  const handleDownloadBatch = (batchId: string) => {
    console.log(`Downloading batch: ${batchId}`)
    // Simulate download
    alert(`Descargando lote ${batchId}...`)
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="container mx-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Lotes</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockBatches.length}</div>
              <p className="text-xs text-muted-foreground">Lotes procesados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Fotos</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockBatches.reduce((acc, batch) => acc + batch.photoCount, 0)}</div>
              <p className="text-xs text-muted-foreground">Fotos procesadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockBatches.filter((b) => b.status === "processing").length}</div>
              <p className="text-xs text-muted-foreground">Lotes activos</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Lotes de Impresión</CardTitle>
                <CardDescription>Gestiona y descarga tus lotes de fotos procesadas</CardDescription>
              </div>
              <Button onClick={handleCreateBatch} size="default" className="gap-2">
                <Plus className="h-4 w-4" />
                Crear Nuevo Lote
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Lote</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cantidad de Fotos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.id}</TableCell>
                    <TableCell>{new Date(batch.date).toLocaleDateString("es-ES")}</TableCell>
                    <TableCell>{batch.photoCount} fotos</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColors[batch.status as keyof typeof statusColors]}>
                        {statusLabels[batch.status as keyof typeof statusLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadBatch(batch.id)}
                        disabled={batch.status === "processing"}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Descargar ZIP
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

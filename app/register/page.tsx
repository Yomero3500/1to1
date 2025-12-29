"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react"
import { signUp } from "@/lib/supabase/auth"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setIsLoading(true)

    try {
      const { user, session } = await signUp(email, password, name)

      if (session) {
        // User is automatically signed in (email confirmation disabled)
        router.push("/dashboard")
        router.refresh()
      } else if (user) {
        // Email confirmation is required
        setSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || "Error al crear la cuenta. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center px-4 sm:px-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="bg-green-500 text-white p-2 rounded-lg">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl">¡Revisa tu correo!</CardTitle>
            <CardDescription className="text-sm text-balance">
              Hemos enviado un enlace de confirmación a <strong className="break-all">{email}</strong>. Por favor,
              revisa tu bandeja de entrada y haz clic en el enlace para activar tu cuenta.
            </CardDescription>
          </CardHeader>
          <CardFooter className="px-4 sm:px-6">
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full bg-transparent">
                Volver al inicio de sesión
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center px-4 sm:px-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="bg-primary text-primary-foreground p-2 rounded-lg">
              <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">FrameFix</h1>
          </div>
          <CardTitle className="text-xl sm:text-2xl">Crear Cuenta</CardTitle>
          <CardDescription className="text-sm text-balance">
            Completa el formulario para crear tu cuenta
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister}>
          <CardContent className="space-y-4 px-4 sm:px-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm">
                Nombre Completo
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
                className="text-base sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="text-base sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                minLength={6}
                className="text-base sm:text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">
                Confirmar Contraseña
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                className="text-base sm:text-sm"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 px-4 sm:px-6">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creando cuenta..." : "Registrarse"}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground text-center text-balance">
              {"¿Ya tienes cuenta? "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Inicia sesión aquí
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

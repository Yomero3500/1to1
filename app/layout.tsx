import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FrameFix - Procesamiento Profesional de Fotos para Enmarcado",
  description:
    "Aplicación SaaS profesional para procesar y preparar fotos para enmarcado personalizado. Recorta, analiza y optimiza tus imágenes con IA.",
  generator: "v0.app",
  applicationName: "FrameFix",
  keywords: ["enmarcado", "fotos", "procesamiento de imágenes", "recorte", "IA", "fotografía"],
  authors: [{ name: "FrameFix Team" }],
  creator: "FrameFix",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3d3d46" },
    { media: "(prefers-color-scheme: dark)", color: "#fdfcfd" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

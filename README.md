# 🖼️ FrameFix - Aplicación SaaS de Procesamiento de Fotos

Aplicación web profesional para el procesamiento automático de fotografías para impresión en cuadros. Analiza, mejora y enmarca fotos automáticamente usando inteligencia artificial.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=flat-square&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?style=flat-square&logo=tailwind-css)

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Uso](#-uso)
- [Pipeline de Procesamiento](#-pipeline-de-procesamiento)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [API y Endpoints](#-api-y-endpoints)
- [Despliegue](#-despliegue)

---

## ✨ Características

### Funcionalidades Principales
- **📤 Subida de Imágenes**: Arrastra y suelta múltiples imágenes o selecciónalas manualmente
- **✂️ Recorte Inteligente**: Editor de recorte con proporción 2:3 (vertical), rotación y volteo
- **🤖 Análisis con IA**: Google Gemini analiza cada imagen y sugiere ajustes de color
- **🔍 Upscaling con Topaz**: Mejora la resolución de las imágenes usando Topaz Gigapixel AI
- **🖼️ Enmarcado Automático**: Genera marcos con paspartú y borde blanco
- **📥 Descargas**: ZIP con todas las imágenes o PDF listo para imprimir
- **👤 Autenticación**: Sistema completo de registro e inicio de sesión

### Características Técnicas
- **Procesamiento en Background**: Jobs asíncronos con Inngest
- **Almacenamiento en la Nube**: Supabase Storage para imágenes
- **Polling en Tiempo Real**: Actualización automática del progreso
- **Diseño Responsive**: Optimizado para desktop y móvil
- **Tema Oscuro/Claro**: Soporte completo con next-themes

---

### Flujo de Procesamiento

1. **Usuario sube imagen** → Se guarda en Supabase Storage
2. **Inngest recibe evento** → Inicia pipeline de procesamiento
3. **Gemini analiza** → Determina ajustes de brillo, saturación, contraste
4. **Topaz upscale** → Mejora resolución (escala 4x)
5. **Sharp procesa** → Aplica ajustes de color y genera marco
6. **Resultado guardado** → Imagen final en Storage, URL en base de datos

---

## 🛠️ Tecnologías

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16.1.1 | Framework React con App Router |
| React | 19.2.0 | Biblioteca UI |
| TypeScript | 5.0 | Tipado estático |
| Tailwind CSS | 4.1.9 | Estilos utilitarios |
| Radix UI | - | Componentes accesibles |
| Lucide React | 0.454.0 | Iconos |
| react-easy-crop | 5.5.6 | Editor de recorte |

### Backend
| Tecnología | Uso |
|------------|-----|
| Next.js API Routes | Endpoints del servidor |
| Inngest | Procesamiento en background |
| Sharp | Manipulación de imágenes |
| Supabase | Base de datos PostgreSQL + Storage |

### IA y APIs Externas
| Servicio | Uso |
|----------|-----|
| Google Gemini 2.0 Flash | Análisis de imágenes y sugerencias |
| Topaz Gigapixel AI | Upscaling de alta calidad |

### Utilidades
| Librería | Uso |
|----------|-----|
| jsPDF | Generación de PDFs |
| JSZip | Compresión de archivos ZIP |
| Zod | Validación de esquemas |

---

## 📦 Requisitos Previos

- **Node.js** >= 18.0.0
- **pnpm** (recomendado) o npm
- **Cuenta de Supabase** con proyecto configurado
- **API Key de Google AI** (Gemini)
- **API Key de Topaz** (Gigapixel)

---

## 🚀 Instalación

### 1. Clonar el repositorio
\`\`\`bash
git clone https://github.com/tu-usuario/1to1.git
cd 1to1
\`\`\`

### 2. Instalar dependencias
\`\`\`bash
pnpm install
\`\`\`

### 3. Configurar variables de entorno
\`\`\`bash
cp .env.example .env.local
\`\`\`

### 4. Iniciar en desarrollo
\`\`\`bash
# Terminal 1: Next.js
pnpm dev

# Terminal 2: Inngest Dev Server
pnpm dev:inngest
\`\`\`

La aplicación estará disponible en `http://localhost:3000`

---

## ⚙️ Configuración

### Variables de Entorno (.env.local)

\`\`\`env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# Google AI (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=tu-api-key-de-google

# Topaz AI
TOPAZ_API_KEY=tu-api-key-de-topaz
TOPAZ_API_URL=https://api.topazlabs.com/v1

# Inngest (opcional para desarrollo local)
INNGEST_SIGNING_KEY=tu-signing-key
INNGEST_EVENT_KEY=tu-event-key
\`\`\`

### Configuración de Supabase

#### 1. Crear tablas
Ejecuta el SQL en `supabase/Supabase.SQL` en el editor SQL de Supabase.

#### 2. Configurar Storage
1. Crea un bucket llamado `images`
2. Configura las políticas de acceso en `supabase/storage-policies.sql`

#### 3. Habilitar Auth
1. Ve a Authentication > Providers
2. Habilita Email/Password

---

## 📖 Uso

### Flujo del Usuario

1. **Registro/Login**: Crea una cuenta o inicia sesión
2. **Dashboard**: Ve tus lotes procesados anteriores
3. **Subir Imágenes**:
   - Arrastra imágenes o usa el botón "Seleccionar Imágenes"
   - Recorta las imágenes a proporción 2:3 si es necesario
   - La IA analiza automáticamente cada imagen
4. **Procesar Lote**: Haz clic en "Procesar Lote"
5. **Resultados**:
   - Ve el progreso en tiempo real
   - Descarga imágenes individuales
   - Descarga todas como ZIP
   - Genera PDF para impresión

### Proporciones de Marco

El sistema genera marcos con proporción 2:3 (vertical):
- **Marco exterior**: Borde blanco 
- **Paspartú**: Imagen desenfocada como fondo 
- **Foto central**: Tu imagen procesada


---

## 🔄 Pipeline de Procesamiento

### Pasos del Pipeline (Inngest)

\`\`\`typescript
1. update-status       → Marca imagen como "processing"
2. analyze-with-gemini → IA analiza y sugiere ajustes
3. upscale-with-topaz  → Mejora resolución 2x
4. process-and-persist → Aplica ajustes, genera marco, guarda resultado
\`\`\`

### Ajustes de Color (Gemini)

El análisis de IA retorna:
- `brightness`: -100 a 100 (brillo)
- `saturation`: -100 a 100 (saturación)
- `contrast`: -100 a 100 (contraste)
- `warmth`: -100 a 100 (temperatura de color)
- `tint`: -100 a 100 (tinte verde/magenta)

### Manejo de Errores

- **Timeout de polling**: 10 minutos máximo
- **Reintentos automáticos**: Inngest reintenta en caso de fallo
- **Fallback**: Si Topaz falla, continúa con imagen original

---

## 📁 Estructura del Proyecto

\`\`\`
1to1/
├── app/                      # Next.js App Router
│   ├── api/
│   │   └── inngest/         # Endpoint de Inngest
│   ├── dashboard/           # Panel principal
│   ├── login/               # Inicio de sesión
│   ├── register/            # Registro
│   ├── results/             # Resultados del procesamiento
│   └── upload/              # Subida de imágenes
│
├── components/              # Componentes React
│   ├── ui/                  # Componentes base (shadcn/ui)
│   ├── dashboard-header.tsx
│   ├── frame-preview.tsx
│   ├── image-cropper.tsx
│   └── image-upload-zone.tsx
│
├── hooks/                   # Custom hooks
│   ├── use-batch-processing.ts
│   └── use-processing-status.ts
│
├── lib/                     # Lógica de negocio
│   ├── ai/                  # Integración con Gemini
│   ├── inngest/             # Jobs de background
│   │   ├── actions.ts       # Server actions
│   │   ├── client.ts        # Cliente Inngest
│   │   ├── frame-processing.ts  # Lógica de Sharp
│   │   ├── functions.ts     # Definición de jobs
│   │   ├── gemini-analysis.ts
│   │   └── topaz-upscale.ts
│   └── supabase/            # Cliente y queries
│
├── supabase/                # SQL y configuración
│   ├── storage-policies.sql
│   └── Supabase.SQL
│
└── public/                  # Archivos estáticos
\`\`\`

---

## 🔌 API y Endpoints

### Inngest Events

| Evento | Descripción |
|--------|-------------|
| `image/process.requested` | Inicia procesamiento de una imagen |

### Server Actions

| Acción | Archivo | Descripción |
|--------|---------|-------------|
| `startBatchProcessing` | `lib/inngest/actions.ts` | Inicia procesamiento del lote |
| `getBatchProcessingStatus` | `lib/inngest/actions.ts` | Obtiene estado del lote |

### Queries de Supabase

| Función | Descripción |
|---------|-------------|
| `createBatch` | Crea nuevo lote |
| `createImage` | Registra imagen en lote |
| `uploadImage` | Sube imagen a Storage |
| `getBatchById` | Obtiene info del lote |
| `getImagesByBatchId` | Lista imágenes del lote |

---

## 🚢 Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Despliega

### Inngest

1. Crea cuenta en [inngest.com](https://inngest.com)
2. Obtén tus keys de producción
3. Configura el webhook URL: `https://tu-dominio.com/api/inngest`

### Supabase

1. Asegúrate de que el proyecto esté en producción
2. Configura las políticas RLS correctamente
3. Habilita el dominio en CORS si es necesario

---

## 🔧 Scripts Disponibles

\`\`\`bash
pnpm dev          # Inicia servidor de desarrollo
pnpm dev:inngest  # Inicia Inngest Dev Server
pnpm build        # Construye para producción
pnpm start        # Inicia servidor de producción
pnpm lint         # Ejecuta ESLint
\`\`\`

---

## 📄 Licencia

Este proyecto es privado y confidencial.

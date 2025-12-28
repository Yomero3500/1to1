import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

/**
 * Handler de API para Inngest.
 * 
 * Este endpoint sirve para:
 * 1. Registrar las funciones de Inngest
 * 2. Recibir eventos y ejecutar las funciones correspondientes
 * 
 * Inngest Dev Server: npx inngest-cli@latest dev
 * Esto abrirá un dashboard en http://localhost:8288
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});

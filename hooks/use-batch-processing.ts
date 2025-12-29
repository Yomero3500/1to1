"use client";

import { useState } from "react";
import { startBatchProcessing } from "@/lib/inngest/actions";
import { useProcessingStatus } from "./use-processing-status";
import { useRouter } from "next/navigation";

interface UseBatchProcessingOptions {
  batchId: string;
  redirectOnComplete?: boolean;
}

/**
 * Hook para manejar el procesamiento completo de un batch.
 * Combina el inicio del procesamiento con el polling del estado.
 * 
 * @example
 * ```tsx
 * const { 
 *   startProcessing, 
 *   status, 
 *   isStarting, 
 *   isProcessing,
 *   error 
 * } = useBatchProcessing({ 
 *   batchId: "123",
 *   redirectOnComplete: true 
 * });
 * 
 * return (
 *   <Button 
 *     onClick={startProcessing}
 *     disabled={isStarting || isProcessing}
 *   >
 *     {isStarting ? "Iniciando..." : isProcessing ? `${status.progress}%` : "Procesar"}
 *   </Button>
 * );
 * ```
 */
export function useBatchProcessing({
  batchId,
  redirectOnComplete = true,
}: UseBatchProcessingOptions) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const { 
    status, 
    isPolling, 
    error: pollingError, 
    startPolling,
    refetch,
  } = useProcessingStatus({
    batchId,
    enabled: hasStarted,
    pollingInterval: 2000,
    onComplete: () => {
      if (redirectOnComplete) {
        router.push(`/results?batch=${batchId}`);
      }
    },
  });

  const startProcessing = async () => {
    console.log(`[BatchProcessing Hook] Iniciando procesamiento del batch: ${batchId}`);
    setIsStarting(true);
    setStartError(null);

    try {
      const result = await startBatchProcessing(batchId);
      console.log(`[BatchProcessing Hook] Resultado:`, result);

      if (!result.success) {
        console.error(`[BatchProcessing Hook] Error: ${result.errors.join(", ")}`);
        setStartError(result.errors.join(", ") || "Error al iniciar procesamiento");
        return;
      }

      console.log(`[BatchProcessing Hook] ✅ ${result.processedCount} imágenes enviadas a procesar`);
      setHasStarted(true);
      startPolling();

      // Refetch inmediato para mostrar estado actualizado
      await refetch();
    } catch (err) {
      console.error(`[BatchProcessing Hook] Error:`, err);
      setStartError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsStarting(false);
    }
  };

  return {
    startProcessing,
    status,
    isStarting,
    isProcessing: isPolling,
    hasStarted,
    error: startError || pollingError,
  };
}

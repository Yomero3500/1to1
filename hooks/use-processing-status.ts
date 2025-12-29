"use client";

import { useState, useEffect, useCallback } from "react";
import { getBatchProcessingStatus } from "@/lib/inngest/actions";

export interface ProcessingStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  isComplete: boolean;
  progress: number; // 0-100
}

interface UseProcessingStatusOptions {
  batchId: string;
  enabled?: boolean;
  pollingInterval?: number; // ms
  maxPollingTime?: number; // ms - tiempo máximo de polling antes de parar
  onComplete?: () => void;
  onTimeout?: () => void;
}

/**
 * Hook para hacer polling del estado de procesamiento de un batch.
 * 
 * @example
 * ```tsx
 * const { status, isPolling, startPolling, stopPolling } = useProcessingStatus({
 *   batchId: "123",
 *   pollingInterval: 3000,
 *   onComplete: () => console.log("¡Procesamiento completado!")
 * });
 * 
 * return (
 *   <div>
 *     <p>Progreso: {status.progress}%</p>
 *     <p>Completadas: {status.completed}/{status.total}</p>
 *   </div>
 * );
 * ```
 */
export function useProcessingStatus({
  batchId,
  enabled = true,
  pollingInterval = 3000,
  maxPollingTime = 600000, // 10 minutos por defecto
  onComplete,
  onTimeout,
}: UseProcessingStatusOptions) {
  const [status, setStatus] = useState<ProcessingStatus>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    isComplete: false,
    progress: 0,
  });
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const result = await getBatchProcessingStatus(batchId);
      console.log(`[ProcessingStatus] Estado batch ${batchId}:`, result);
      
      const progress = result.total > 0 
        ? Math.round((result.completed / result.total) * 100)
        : 0;
      
      const isComplete = result.total > 0 && 
        result.pending === 0 && 
        result.processing === 0;

      console.log(`[ProcessingStatus] Progreso: ${progress}%, Completo: ${isComplete}`);
      console.log(`[ProcessingStatus] Total: ${result.total}, Pending: ${result.pending}, Processing: ${result.processing}, Completed: ${result.completed}, Failed: ${result.failed}`);

      setStatus({
        ...result,
        isComplete,
        progress,
      });

      setError(null);

      return isComplete;
    } catch (err) {
      console.error(`[ProcessingStatus] Error:`, err);
      setError(err instanceof Error ? err.message : "Error desconocido");
      return false;
    }
  }, [batchId]);

  const startPolling = useCallback(() => {
    setPollingStartTime(Date.now());
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    setPollingStartTime(null);
  }, []);

  useEffect(() => {
    if (!enabled || !isPolling) return;

    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    const poll = async () => {
      if (isCancelled) return;

      // Verificar timeout
      if (pollingStartTime && Date.now() - pollingStartTime > maxPollingTime) {
        console.log(`[ProcessingStatus] ⏱️ Timeout alcanzado después de ${maxPollingTime / 1000}s`);
        setIsPolling(false);
        setPollingStartTime(null);
        onTimeout?.();
        return;
      }

      console.log(`[ProcessingStatus] Polling estado del batch ${batchId}...`);
      const isComplete = await fetchStatus();

      if (isComplete) {
        console.log(`[ProcessingStatus] ✅ Procesamiento completado!`);
        setIsPolling(false);
        setPollingStartTime(null);
        onComplete?.();
        return;
      }

      console.log(`[ProcessingStatus] Aún procesando, siguiente poll en ${pollingInterval}ms`);
      if (!isCancelled && isPolling) {
        timeoutId = setTimeout(poll, pollingInterval);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [enabled, isPolling, pollingInterval, maxPollingTime, pollingStartTime, fetchStatus, onComplete, onTimeout, batchId]);

  // Fetch inicial
  useEffect(() => {
    if (enabled && batchId) {
      fetchStatus();
    }
  }, [enabled, batchId, fetchStatus]);

  return {
    status,
    isPolling,
    error,
    startPolling,
    stopPolling,
    refetch: fetchStatus,
  };
}

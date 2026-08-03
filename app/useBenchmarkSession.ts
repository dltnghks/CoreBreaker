import { useCallback } from "react";
import type { HeadlessBenchmarkResult } from "./benchmark-headless";

export type BenchmarkWorkerMessage =
  | { type: "result"; result: HeadlessBenchmarkResult }
  | { type: "error"; message: string };

/** Owns creation and teardown of the benchmark Worker pool. */
export function useBenchmarkSession() {
  const createWorkers = useCallback((
    count: number,
    onMessage: (worker: Worker, message: BenchmarkWorkerMessage) => void,
    onError: (message: string) => void,
  ) => Array.from({ length: count }, () => {
    const worker = new Worker(new URL("./benchmark-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<BenchmarkWorkerMessage>) => onMessage(worker, event.data);
    worker.onerror = (event) => onError(event.message || "Worker execution failed");
    return worker;
  }), []);

  const stopWorkers = useCallback((workers: Worker[]) => {
    workers.forEach((worker) => worker.terminate());
  }, []);

  return { createWorkers, stopWorkers };
}

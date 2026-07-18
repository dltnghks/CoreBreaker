/// <reference lib="webworker" />

import { runHeadlessBenchmark, type HeadlessBenchmarkRequest } from "./benchmark-headless";

self.onmessage = (event: MessageEvent<HeadlessBenchmarkRequest>) => {
  try {
    self.postMessage({ type: "result", result: runHeadlessBenchmark(event.data) });
  } catch (error) {
    self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error), run: event.data.run });
  }
};

export {};

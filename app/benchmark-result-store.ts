const DATABASE_NAME = "core-breaker-benchmark";
// Version 3 is shared with balance-experiment-store. This opener only owns the
// legacy run store, while the experiment opener creates the additional stores.
const DATABASE_VERSION = 3;
const RUN_STORE = "runs";

type StoredRun = { id: string; benchmarkRuleset?: string | null; createdAt: number };

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function openBenchmarkDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(RUN_STORE)
        ? request.transaction!.objectStore(RUN_STORE)
        : database.createObjectStore(RUN_STORE, { keyPath: "id" });
      if (!store.indexNames.contains("benchmarkRuleset")) store.createIndex("benchmarkRuleset", "benchmarkRuleset", { unique: false });
      if (!store.indexNames.contains("createdAt")) store.createIndex("createdAt", "createdAt", { unique: false });
      const experiments = database.objectStoreNames.contains("experiments")
        ? request.transaction!.objectStore("experiments")
        : database.createObjectStore("experiments", { keyPath: "id" });
      if (!experiments.indexNames.contains("createdAt")) experiments.createIndex("createdAt", "createdAt");
      if (!experiments.indexNames.contains("status")) experiments.createIndex("status", "status");
      const candidates = database.objectStoreNames.contains("candidates")
        ? request.transaction!.objectStore("candidates")
        : database.createObjectStore("candidates", { keyPath: "id" });
      if (!candidates.indexNames.contains("experimentId")) candidates.createIndex("experimentId", "experimentId");
      if (!candidates.indexNames.contains("experimentEpoch")) candidates.createIndex("experimentEpoch", ["experimentId", "epoch"]);
      if (!candidates.indexNames.contains("configHash")) candidates.createIndex("configHash", "configHash");
      const experimentRuns = database.objectStoreNames.contains("experimentRuns")
        ? request.transaction!.objectStore("experimentRuns")
        : database.createObjectStore("experimentRuns", { keyPath: "experimentRunId" });
      if (!experimentRuns.indexNames.contains("experimentId")) experimentRuns.createIndex("experimentId", "experimentId");
      if (!experimentRuns.indexNames.contains("candidateId")) experimentRuns.createIndex("candidateId", "candidateId");
      if (!experimentRuns.indexNames.contains("candidateSeed")) experimentRuns.createIndex("candidateSeed", ["candidateId", "seed"], { unique: true });
      const summaries = database.objectStoreNames.contains("summaries")
        ? request.transaction!.objectStore("summaries")
        : database.createObjectStore("summaries", { keyPath: "candidateId" });
      if (!summaries.indexNames.contains("experimentId")) summaries.createIndex("experimentId", "experimentId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open benchmark database"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export async function putBenchmarkResults<T extends StoredRun>(results: T[]) {
  if (!results.length) return;
  const database = await openBenchmarkDatabase();
  try {
    const transaction = database.transaction(RUN_STORE, "readwrite");
    const store = transaction.objectStore(RUN_STORE);
    results.forEach((result) => store.put(result));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getBenchmarkResults<T extends StoredRun>(ruleset: string, limit = 5000) {
  const database = await openBenchmarkDatabase();
  try {
    const transaction = database.transaction(RUN_STORE, "readonly");
    const index = transaction.objectStore(RUN_STORE).index("benchmarkRuleset");
    const results = await requestResult(index.getAll(IDBKeyRange.only(ruleset))) as T[];
    return results.sort((a, b) => a.createdAt - b.createdAt).slice(-limit);
  } finally {
    database.close();
  }
}

export async function clearBenchmarkResults(ruleset: string) {
  const database = await openBenchmarkDatabase();
  try {
    const transaction = database.transaction(RUN_STORE, "readwrite");
    const index = transaction.objectStore(RUN_STORE).index("benchmarkRuleset");
    const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(ruleset)));
    const store = transaction.objectStore(RUN_STORE);
    keys.forEach((key) => store.delete(key));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

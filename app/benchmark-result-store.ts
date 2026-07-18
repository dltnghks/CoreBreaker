const DATABASE_NAME = "core-breaker-benchmark";
const DATABASE_VERSION = 1;
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

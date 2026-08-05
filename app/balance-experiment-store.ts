import type { BalanceCandidate, BalanceCandidateSummary, BalanceExperiment, BalanceExperimentRun } from "./balance-experiment";

const DATABASE_NAME = "core-breaker-benchmark";
const DATABASE_VERSION = 3;
const LEGACY_RUN_STORE = "runs";
const EXPERIMENT_STORE = "experiments";
const CANDIDATE_STORE = "candidates";
const EXPERIMENT_RUN_STORE = "experimentRuns";
const SUMMARY_STORE = "summaries";

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function createIndex(store: IDBObjectStore, name: string, keyPath: string | string[], options?: IDBIndexParameters) {
  if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}

function openExperimentDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const legacyRuns = database.objectStoreNames.contains(LEGACY_RUN_STORE)
        ? request.transaction!.objectStore(LEGACY_RUN_STORE)
        : database.createObjectStore(LEGACY_RUN_STORE, { keyPath: "id" });
      createIndex(legacyRuns, "benchmarkRuleset", "benchmarkRuleset");
      createIndex(legacyRuns, "createdAt", "createdAt");

      const experiments = database.objectStoreNames.contains(EXPERIMENT_STORE)
        ? request.transaction!.objectStore(EXPERIMENT_STORE)
        : database.createObjectStore(EXPERIMENT_STORE, { keyPath: "id" });
      createIndex(experiments, "createdAt", "createdAt");
      createIndex(experiments, "status", "status");

      const candidates = database.objectStoreNames.contains(CANDIDATE_STORE)
        ? request.transaction!.objectStore(CANDIDATE_STORE)
        : database.createObjectStore(CANDIDATE_STORE, { keyPath: "id" });
      createIndex(candidates, "experimentId", "experimentId");
      createIndex(candidates, "experimentEpoch", ["experimentId", "epoch"]);
      createIndex(candidates, "configHash", "configHash");

      const runs = database.objectStoreNames.contains(EXPERIMENT_RUN_STORE)
        ? request.transaction!.objectStore(EXPERIMENT_RUN_STORE)
        : database.createObjectStore(EXPERIMENT_RUN_STORE, { keyPath: "experimentRunId" });
      createIndex(runs, "experimentId", "experimentId");
      createIndex(runs, "candidateId", "candidateId");
      createIndex(runs, "candidateSeed", ["candidateId", "seed"], { unique: true });

      const summaries = database.objectStoreNames.contains(SUMMARY_STORE)
        ? request.transaction!.objectStore(SUMMARY_STORE)
        : database.createObjectStore(SUMMARY_STORE, { keyPath: "candidateId" });
      createIndex(summaries, "experimentId", "experimentId");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open balance experiment database"));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

async function putRecord<T>(storeName: string, record: T) {
  const database = await openExperimentDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export function putBalanceExperiment(experiment: BalanceExperiment) {
  return putRecord(EXPERIMENT_STORE, experiment);
}

export function putBalanceCandidate(candidate: BalanceCandidate) {
  return putRecord(CANDIDATE_STORE, candidate);
}

export function putBalanceCandidateSummary(summary: BalanceCandidateSummary) {
  return putRecord(SUMMARY_STORE, summary);
}

export async function putBalanceExperimentRuns(runs: BalanceExperimentRun[]) {
  if (!runs.length) return;
  const database = await openExperimentDatabase();
  try {
    const transaction = database.transaction(EXPERIMENT_RUN_STORE, "readwrite");
    const store = transaction.objectStore(EXPERIMENT_RUN_STORE);
    runs.forEach((run) => store.put(run));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function getByIndex<T>(storeName: string, indexName: string, key: IDBValidKey) {
  const database = await openExperimentDatabase();
  try {
    const transaction = database.transaction(storeName, "readonly");
    return await requestResult(transaction.objectStore(storeName).index(indexName).getAll(IDBKeyRange.only(key))) as T[];
  } finally {
    database.close();
  }
}

export async function getBalanceExperiments(limit = 100) {
  const database = await openExperimentDatabase();
  try {
    const transaction = database.transaction(EXPERIMENT_STORE, "readonly");
    const values = await requestResult(transaction.objectStore(EXPERIMENT_STORE).getAll()) as BalanceExperiment[];
    return values.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  } finally {
    database.close();
  }
}

export async function getBalanceExperiment(experimentId: string) {
  const database = await openExperimentDatabase();
  try {
    const transaction = database.transaction(EXPERIMENT_STORE, "readonly");
    return await requestResult(transaction.objectStore(EXPERIMENT_STORE).get(experimentId)) as BalanceExperiment | undefined;
  } finally {
    database.close();
  }
}

export function getBalanceCandidates(experimentId: string) {
  return getByIndex<BalanceCandidate>(CANDIDATE_STORE, "experimentId", experimentId);
}

export function getBalanceExperimentRuns(experimentId: string) {
  return getByIndex<BalanceExperimentRun>(EXPERIMENT_RUN_STORE, "experimentId", experimentId);
}

export function getBalanceCandidateRuns(candidateId: string) {
  return getByIndex<BalanceExperimentRun>(EXPERIMENT_RUN_STORE, "candidateId", candidateId);
}

export function getBalanceCandidateSummaries(experimentId: string) {
  return getByIndex<BalanceCandidateSummary>(SUMMARY_STORE, "experimentId", experimentId);
}

export async function getBalanceExperimentBundle(experimentId: string) {
  const [candidates, runs, summaries] = await Promise.all([
    getBalanceCandidates(experimentId),
    getBalanceExperimentRuns(experimentId),
    getBalanceCandidateSummaries(experimentId),
  ]);
  return { candidates, runs, summaries };
}

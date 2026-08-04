"use client";

const DATABASE_NAME = "nx-erp-field";
const DATABASE_VERSION = 1;

export type FieldCommandType = "CHECKIN" | "START" | "FINISH";

export interface FieldQueueCommand<TPayload = unknown> {
  id: string;
  type: FieldCommandType;
  visitId: string;
  userId: string;
  payload: TPayload;
  createdAt: string;
  attempts: number;
}

interface StoredDraft<T = unknown> {
  visitId: string;
  data: T;
  updatedAt: string;
}

interface StoredVisits<T = unknown> {
  userId: string;
  visits: T;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return reject(new Error("IndexedDB indisponível neste dispositivo."));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error || new Error("Não foi possível abrir a base local."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("drafts")) database.createObjectStore("drafts", { keyPath: "visitId" });
      if (!database.objectStoreNames.contains("queue")) database.createObjectStore("queue", { keyPath: "id" });
      if (!database.objectStoreNames.contains("visits")) database.createObjectStore("visits", { keyPath: "userId" });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Erro na base local."));
  });
}

async function put(storeName: string, value: unknown) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).put(value));
  } finally {
    database.close();
  }
}

async function remove(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, "readwrite");
    await requestResult(transaction.objectStore(storeName).delete(key));
  } finally {
    database.close();
  }
}

export async function saveFieldDraft<T>(visitId: string, data: T) {
  await put("drafts", { visitId, data, updatedAt: new Date().toISOString() } satisfies StoredDraft<T>);
}

export async function loadFieldDraft<T>(visitId: string) {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction("drafts").objectStore("drafts").get(visitId)) as StoredDraft<T> | undefined;
  } finally {
    database.close();
  }
}

export async function deleteFieldDraft(visitId: string) {
  await remove("drafts", visitId);
}

export async function enqueueFieldCommand<TPayload>(input: Omit<FieldQueueCommand<TPayload>, "id" | "createdAt" | "attempts">) {
  const command: FieldQueueCommand<TPayload> = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await put("queue", command);
  return command;
}

export async function listFieldCommands() {
  const database = await openDatabase();
  try {
    const commands = await requestResult(database.transaction("queue").objectStore("queue").getAll()) as FieldQueueCommand[];
    return commands.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    database.close();
  }
}

export async function updateFieldCommand(command: FieldQueueCommand) {
  await put("queue", command);
}

export async function removeFieldCommand(id: string) {
  await remove("queue", id);
}

export async function cacheTechnicianVisits<T>(userId: string, visits: T) {
  await put("visits", { userId, visits, updatedAt: new Date().toISOString() } satisfies StoredVisits<T>);
}

export async function loadCachedTechnicianVisits<T>(userId: string) {
  const database = await openDatabase();
  try {
    return await requestResult(database.transaction("visits").objectStore("visits").get(userId)) as StoredVisits<T> | undefined;
  } finally {
    database.close();
  }
}

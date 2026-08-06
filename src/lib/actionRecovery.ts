const MAX_DRAFT_AGE_MS = 2 * 60 * 60 * 1000;

export function isStaleServerActionError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /server action/i.test(message) && /(not found|failed to find|older or newer deployment|outdated deployment)/i.test(message);
}

export function preserveFormDraft<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
}

export function takePreservedFormDraft<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(key);
  sessionStorage.removeItem(key);
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as { savedAt?: number; data?: T };
    if (!stored.savedAt || Date.now() - stored.savedAt > MAX_DRAFT_AGE_MS || !stored.data) return null;
    return stored.data;
  } catch {
    return null;
  }
}


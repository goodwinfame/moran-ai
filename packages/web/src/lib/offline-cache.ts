/**
 * Offline Cache — IndexedDB wrapper for panel data persistence.
 * T8: packages/web/src/lib/offline-cache.ts
 *
 * Uses the `idb` library. Keeps panel data available during reconnects
 * so the UI doesn't show blank state.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "moran-panel-cache";
const DB_VERSION = 1;
const STORE_NAME = "panel-data";

interface PanelCacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
}

/** Open (or create) the IndexedDB database */
export async function openCache(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    },
  });
}

/**
 * Persist panel tab data to the cache.
 *
 * @param projectId - The project the data belongs to
 * @param tab       - Tab identifier (e.g. "characters", "outline")
 * @param data      - Serialisable panel data
 */
export async function cacheTabData(
  projectId: string,
  tab: string,
  data: unknown,
): Promise<void> {
  const db = await openCache();
  const entry: PanelCacheEntry = {
    key: `${projectId}:${tab}`,
    data,
    timestamp: Date.now(),
  };
  await db.put(STORE_NAME, entry);
}

/**
 * Retrieve cached panel tab data.
 *
 * @returns The cached data, or `null` if no entry exists.
 */
export async function getCachedTabData(
  projectId: string,
  tab: string,
): Promise<unknown | null> {
  const db = await openCache();
  const entry = await db.get(STORE_NAME, `${projectId}:${tab}`);
  return (entry as PanelCacheEntry | undefined)?.data ?? null;
}

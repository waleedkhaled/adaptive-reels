// One expo-sqlite database is the disk copy of the app (docs/PERFORMANCE.md
// section 3): an append-only events table and a one-row snapshot of the
// learner state. All writes go through one promise chain so order is kept and
// nothing touches the handle while a transaction is open.
import type { LearnerEvent } from '@reels/schemas';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

/** 2: the learner is the agent's LearnerState (older snapshots start over at onboarding). */
export const SNAPSHOT_VERSION = 2;

let db: SQLiteDatabase | null = null;
let chain: Promise<void> = Promise.resolve();

/** Open the database and read the snapshot: the only synchronous calls in the app, at startup. */
export function openStore(): { snapshot: unknown | null } {
  db = openDatabaseSync('reels.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 3000;
    CREATE TABLE IF NOT EXISTS events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      at INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      json TEXT NOT NULL
    );
  `);
  const row = db.getFirstSync<{ schema_version: number; json: string }>(
    'SELECT schema_version, json FROM snapshot WHERE id = 1',
  );
  if (!row || row.schema_version !== SNAPSHOT_VERSION) return { snapshot: null };
  try {
    return { snapshot: JSON.parse(row.json) };
  } catch {
    return { snapshot: null };
  }
}

function enqueue(task: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  const run = chain.then(() => (db ? task(db) : undefined));
  chain = run.catch((error) => {
    console.warn('db write failed', error);
  });
  return run;
}

/**
 * Write events and (optionally) the snapshot in one transaction. Callers usually
 * do not await it. One connection on purpose: writes are already serialised by
 * the chain, and the second connection of an exclusive transaction is what hit
 * "database is locked" after a reload.
 */
export function persist(events: LearnerEvent[], snapshot?: unknown): Promise<void> {
  if (events.length === 0 && snapshot === undefined) return chain;
  return enqueue((d) =>
    d.withTransactionAsync(async () => {
      const txn = d;
      for (const e of events) {
        await txn.runAsync('INSERT INTO events (at, session_id, type, json) VALUES (?, ?, ?, ?)', [
          e.at,
          e.session_id,
          e.type,
          JSON.stringify(e),
        ]);
      }
      if (snapshot !== undefined) {
        await txn.runAsync(
          'INSERT INTO snapshot (id, schema_version, updated_at, json) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET schema_version = excluded.schema_version, updated_at = excluded.updated_at, json = excluded.json',
          [SNAPSHOT_VERSION, Date.now(), JSON.stringify(snapshot)],
        );
      }
    }),
  );
}

/** Every event as JSON Lines, oldest first, for export. */
export async function exportEvents(): Promise<{ jsonl: string; count: number }> {
  await chain;
  if (!db) return { jsonl: '', count: 0 };
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM events ORDER BY seq');
  return {
    jsonl: rows.map((r) => r.json).join('\n') + (rows.length ? '\n' : ''),
    count: rows.length,
  };
}

/** Drop the learner snapshot (Reset progress). Events stay: they are the study record. */
export function clearSnapshot(): Promise<void> {
  return enqueue((d) => d.runAsync('DELETE FROM snapshot').then(() => undefined));
}

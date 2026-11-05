// Kullanıcının yüklediği datasheet PDF'leri.
//  - Misafir: tarayıcıda IndexedDB (yalnızca bu cihaz)
//  - Giriş yapmış kullanıcı: sunucuda R2 (functions/api/datasheets) + yerel önbellek
import { useAuth } from '../auth/store';

export interface Datasheet {
  id: string;
  /** Eleman tipi ya da model (ör. "npn" veya "npn:2N3904") */
  key: string;
  name: string;
  size: number;
  added: number;
  where: 'local' | 'cloud';
}

interface LocalRow extends Omit<Datasheet, 'where'> {
  blob: Blob;
}

const DB = 'ieeesim';
const STORE = 'datasheets';
export const MAX_SIZE = 20 * 1024 * 1024;

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB yok'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('key', 'key');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      }),
  );
}

const loggedIn = () => !!useAuth.getState().user;

async function listCloud(key: string): Promise<Datasheet[]> {
  if (!loggedIn()) return [];
  try {
    const r = await fetch(`/api/datasheets?key=${encodeURIComponent(key)}`, { credentials: 'include' });
    if (!r.ok) return [];
    const j = (await r.json()) as { items: Omit<Datasheet, 'where'>[] };
    return j.items.map((x) => ({ ...x, where: 'cloud' as const }));
  } catch {
    return [];
  }
}

export async function listDatasheets(key: string): Promise<Datasheet[]> {
  let local: Datasheet[] = [];
  try {
    const rows = await tx<LocalRow[]>('readonly', (s) => s.index('key').getAll(key));
    local = rows.map(({ blob: _b, ...r }) => ({ ...r, where: 'local' as const }));
  } catch {
    /* IndexedDB kullanılamıyor (gizli pencere vb.) */
  }
  const cloud = await listCloud(key);
  const ids = new Set(cloud.map((c) => c.id));
  return [...cloud, ...local.filter((l) => !ids.has(l.id))].sort((a, b) => b.added - a.added);
}

export async function addDatasheet(key: string, file: File): Promise<Datasheet> {
  if (file.size > MAX_SIZE) throw new Error('Dosya 20 MB’tan büyük.');
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Yalnızca PDF yüklenebilir.');
  const meta = { id: crypto.randomUUID(), key, name: file.name, size: file.size, added: Date.now() };
  if (loggedIn()) {
    try {
      const r = await fetch(`/api/datasheets?key=${encodeURIComponent(key)}&name=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/pdf' },
        body: file,
      });
      if (r.ok) {
        const j = (await r.json()) as Omit<Datasheet, 'where'>;
        return { ...j, where: 'cloud' };
      }
    } catch {
      /* sunucuya ulaşılamadı → yerelde tut */
    }
  }
  await tx('readwrite', (s) => s.put({ ...meta, blob: file } satisfies LocalRow));
  return { ...meta, where: 'local' };
}

export async function removeDatasheet(d: Datasheet): Promise<void> {
  if (d.where === 'cloud') {
    await fetch(`/api/datasheets/${d.id}`, { method: 'DELETE', credentials: 'include' });
    return;
  }
  await tx('readwrite', (s) => s.delete(d.id));
}

/** PDF'i yeni sekmede aç */
export async function openDatasheet(d: Datasheet): Promise<void> {
  if (d.where === 'cloud') {
    window.open(`/api/datasheets/${d.id}`, '_blank', 'noopener');
    return;
  }
  const row = await tx<LocalRow | undefined>('readonly', (s) => s.get(d.id));
  if (!row) return;
  const url = URL.createObjectURL(row.blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);

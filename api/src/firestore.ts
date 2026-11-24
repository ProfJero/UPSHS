// Minimal Firestore REST client (service-account authenticated).
// Plain JSON documents are converted to/from Firestore's typed value format.

import { getAccessToken, type ServiceAccount } from './google';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Doc = { id: string } & Record<string, Json>;

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } };

interface FsDocument { name: string; fields?: Record<string, FsValue>; createTime?: string; updateTime?: string }

function toValue(v: Json | undefined): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  return { mapValue: { fields: toFields(v) } };
}

function toFields(obj: Record<string, Json>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = toValue(v);
  return out;
}

function fromValue(v: FsValue): Json {
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('referenceValue' in v) return v.referenceValue;
  if ('geoPointValue' in v) return { lat: v.geoPointValue.latitude, lng: v.geoPointValue.longitude };
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function fromFields(fields: Record<string, FsValue>): Record<string, Json> {
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromValue(v);
  return out;
}

function toDoc(d: FsDocument): Doc {
  const id = d.name.split('/').pop() || '';
  return { ...fromFields(d.fields || {}), id };
}

export class Firestore {
  private base: string;
  constructor(private sa: ServiceAccount, projectId?: string) {
    this.base = `https://firestore.googleapis.com/v1/projects/${projectId || sa.project_id}/databases/(default)/documents`;
  }

  private async req(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await getAccessToken(this.sa);
    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    if (init.body) headers.set('content-type', 'application/json');
    return fetch(`${this.base}${path}`, { ...init, headers });
  }

  async get(collection: string, id: string): Promise<Doc | null> {
    const res = await this.req(`/${collection}/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore get failed (${res.status}): ${await res.text()}`);
    return toDoc((await res.json()) as FsDocument);
  }

  /** Lists every document in a collection (paged). Fine for school-sized collections. */
  async list(collection: string, max = 1000): Promise<Doc[]> {
    const docs: Doc[] = [];
    let pageToken = '';
    do {
      const qs = new URLSearchParams({ pageSize: '300' });
      if (pageToken) qs.set('pageToken', pageToken);
      const res = await this.req(`/${collection}?${qs}`);
      if (!res.ok) throw new Error(`Firestore list failed (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { documents?: FsDocument[]; nextPageToken?: string };
      docs.push(...(data.documents || []).map(toDoc));
      pageToken = data.nextPageToken || '';
    } while (pageToken && docs.length < max);
    return docs;
  }

  /** Equality query on one field — uses Firestore's automatic single-field index. */
  async where(collection: string, field: string, value: Json, limit = 500): Promise<Doc[]> {
    const res = await this.req(':runQuery', {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
          where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toValue(value) } },
          limit,
        },
      }),
    });
    if (!res.ok) throw new Error(`Firestore query failed (${res.status}): ${await res.text()}`);
    const rows = (await res.json()) as { document?: FsDocument }[];
    return rows.filter((r) => r.document).map((r) => toDoc(r.document!));
  }

  /** Creates or fully replaces a document. */
  async set(collection: string, id: string, data: Record<string, Json>): Promise<Doc> {
    const { id: _ignored, ...rest } = data as Record<string, Json> & { id?: Json };
    const res = await this.req(`/${collection}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ fields: toFields(rest) }) });
    if (!res.ok) throw new Error(`Firestore write failed (${res.status}): ${await res.text()}`);
    return toDoc((await res.json()) as FsDocument);
  }

  /** Updates only the given top-level fields. */
  async update(collection: string, id: string, data: Record<string, Json>): Promise<Doc> {
    const qs = new URLSearchParams();
    for (const k of Object.keys(data)) if (k !== 'id') qs.append('updateMask.fieldPaths', k);
    qs.set('currentDocument.exists', 'true');
    const { id: _ignored, ...rest } = data as Record<string, Json> & { id?: Json };
    const res = await this.req(`/${collection}/${encodeURIComponent(id)}?${qs}`, { method: 'PATCH', body: JSON.stringify({ fields: toFields(rest) }) });
    if (res.status === 404) throw new NotFoundError();
    if (!res.ok) throw new Error(`Firestore update failed (${res.status}): ${await res.text()}`);
    return toDoc((await res.json()) as FsDocument);
  }

  async delete(collection: string, id: string): Promise<void> {
    const res = await this.req(`/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Firestore delete failed (${res.status})`);
  }
}

export class NotFoundError extends Error {
  constructor() { super('Not found'); }
}

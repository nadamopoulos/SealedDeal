import type { Deal, DealAnalysis, Document, DocCategory } from '../types';

const API_BASE = '/api';

/** Safely parse JSON from a response, handling non-JSON error pages */
async function parseJsonResponse(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text.slice(0, 200) || `Server error (${res.status})`);
  }
}

// ─── Deal CRUD ───────────────────────────────────────────────

export async function fetchDeals(): Promise<{ deals: Deal[] }> {
  const res = await fetch(`${API_BASE}/deals`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to fetch deals');
  return data;
}

export async function fetchDeal(dealId: string): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`);
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to fetch deal');
  return data;
}

export async function createDealApi(params: {
  name: string;
  company: string;
  industry: string;
  dealSize: string;
  geography: string;
  stage: string;
}): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to create deal');
  return data;
}

export async function updateDealApi(
  dealId: string,
  updates: Partial<Deal>
): Promise<{ deal: Deal }> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to update deal');
  return data;
}

export async function deleteDealApi(dealId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/deals/${dealId}`, { method: 'DELETE' });
  const data = await parseJsonResponse(res);
  if (!res.ok) throw new Error(data.error || 'Failed to delete deal');
}

// ─── Upload ──────────────────────────────────────────────────

/** Size threshold: files above this go through Vercel Blob */
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB

export interface UploadedDoc {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  status: string;
  category: DocCategory;
  extractedText: string;
  blobUrl?: string;
}

export interface UploadResult {
  documents: UploadedDoc[];
}

/**
 * Upload a small file (≤ 4 MB) via direct XHR with upload progress.
 * Server extracts text and returns immediately.
 */
export function uploadSmallFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('files', file);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(xhr.responseText?.slice(0, 200) || `Server error (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    xhr.open('POST', `${API_BASE}/deals/${dealId}/upload`);
    xhr.send(formData);
  });
}

/**
 * Upload a large file (> 4 MB) to Vercel Blob and register it immediately
 * WITHOUT extraction. Returns doc metadata with blobUrl.
 *
 * Bypasses @vercel/blob SDK entirely on the client to avoid bundler/undici
 * issues that cause uploads to hang. Uses raw browser fetch + XHR:
 * 1. Get a client token from our server
 * 2. PUT the file directly to Vercel Blob API with XHR (for progress)
 * 3. Register the blob URL in our backend
 */
export async function uploadLargeFileToBlobAndRegister(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  // Step 1: Get a client token from our server
  const tokenRes = await fetch(`${API_BASE}/deals/${dealId}/blob-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname: file.name },
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get upload token for ${file.name}: ${err.slice(0, 200)}`);
  }

  const { clientToken } = await tokenRes.json();
  if (!clientToken) {
    throw new Error(`No client token returned for ${file.name}`);
  }

  if (onProgress) onProgress(5);

  // Step 2: Upload directly to Vercel Blob API using raw XHR (for progress tracking)
  const blobResult = await new Promise<{ url: string; pathname: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const params = new URLSearchParams({ pathname: file.name });
    xhr.open('PUT', `https://vercel.com/api/blob/?${params.toString()}`);
    xhr.setRequestHeader('authorization', `Bearer ${clientToken}`);
    xhr.setRequestHeader('x-api-version', '7');
    xhr.setRequestHeader('x-content-length', String(file.size));
    xhr.setRequestHeader('x-api-blob-request-id', `sdk:${Date.now()}:${Math.random().toString(16).slice(2)}`);
    if (file.type) {
      xhr.setRequestHeader('x-mimeType', file.type);
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        // Map upload progress to 5-85% range
        const pct = Math.round(5 + (e.loaded / e.total) * 80);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({ url: data.url, pathname: data.pathname });
        } catch {
          reject(new Error(`Blob upload returned invalid JSON for ${file.name}`));
        }
      } else {
        reject(new Error(`Blob upload failed (${xhr.status}) for ${file.name}: ${xhr.responseText?.slice(0, 200)}`));
      }
    };

    xhr.onerror = () => reject(new Error(`Network error uploading ${file.name} to Blob storage`));
    xhr.ontimeout = () => reject(new Error(`Upload timeout for ${file.name}`));
    xhr.timeout = 5 * 60 * 1000; // 5 minute timeout

    xhr.send(file);
  });

  if (onProgress) onProgress(90);

  // Step 3: Register in Redis immediately (no extraction) — fast
  const registerRes = await fetch(`${API_BASE}/deals/${dealId}/register-blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blobUrl: blobResult.url,
      fileName: file.name,
      fileSize: file.size,
    }),
  });

  const data = await parseJsonResponse(registerRes);
  if (!registerRes.ok) throw new Error(data.error || 'Failed to register upload');

  if (onProgress) onProgress(100);
  return data;
}

/**
 * Process a previously-uploaded blob: download, extract text, persist.
 * Called AFTER all uploads are done.
 */
export async function processUploadedBlob(
  dealId: string,
  doc: { blobUrl: string; fileName: string; fileSize: number }
): Promise<UploadResult> {
  const processRes = await fetch(`${API_BASE}/deals/${dealId}/process-blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc),
  });

  const data = await parseJsonResponse(processRes);
  if (!processRes.ok) throw new Error(data.error || 'Failed to process uploaded file');
  return data;
}

/**
 * Smart upload: routes to direct upload for small files, Blob for large files.
 * Small files get extracted inline. Large files are registered without extraction.
 */
export function uploadFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (file.size > DIRECT_UPLOAD_LIMIT) {
    return uploadLargeFileToBlobAndRegister(dealId, file, onProgress);
  }
  return uploadSmallFile(dealId, file, onProgress);
}

// ─── Analysis (server reads docs from Redis) ─────────────────

export async function analyzeDeal(params: {
  dealId: string;
  dealName: string;
  company: string;
  industry: string;
  dealSize: string;
  geography: string;
}): Promise<{ analysis: DealAnalysis }> {
  const res = await fetch(`${API_BASE}/deals/${params.dealId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || 'Analysis failed');
  }
  return data;
}

// ─── Q&A (server reads docs from Redis) ──────────────────────

export async function askDeal(params: {
  dealId: string;
  question: string;
  dealName: string;
  company: string;
  industry: string;
}): Promise<{ answer: string }> {
  const res = await fetch(`${API_BASE}/deals/${params.dealId}/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || 'Q&A failed');
  }
  return data;
}

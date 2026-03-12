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

// ─── Upload (small files direct via XHR, large files via Vercel Blob) ──

/** Size threshold: files above this go through Vercel Blob */
const DIRECT_UPLOAD_LIMIT = 4 * 1024 * 1024; // 4 MB

export interface UploadResult {
  documents: (Document & { extractedText: string; category: DocCategory })[];
}

/**
 * Upload a single file to the deal's upload endpoint using XMLHttpRequest
 * so we can track upload progress. For files ≤ 4 MB only.
 */
export function uploadSingleFile(
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
 * Upload a large file via Vercel Blob (bypasses serverless 4.5 MB limit).
 * 1. Uploads directly to Blob storage via the client SDK
 * 2. Calls process-blob endpoint to extract text and persist to Redis
 * 3. Blob is deleted after processing
 */
export async function uploadLargeFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  // Phase 1: Upload to Vercel Blob via XHR for progress tracking
  const blobResult = await new Promise<{ url: string }>((resolve, reject) => {
    // First, get a client token from our blob-upload endpoint
    fetch(`${API_BASE}/deals/${dealId}/blob-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: {
          callbackUrl: `${window.location.origin}${API_BASE}/deals/${dealId}/blob-upload`,
          clientPayload: JSON.stringify({ dealId }),
          pathname: file.name,
        },
      }),
    })
      .then(async (tokenRes) => {
        const tokenData = await parseJsonResponse(tokenRes);
        if (!tokenRes.ok) throw new Error(tokenData.error || 'Failed to get upload token');
        const clientToken = tokenData.clientToken;

        // Upload directly to Vercel Blob using XHR for progress
        const xhr = new XMLHttpRequest();

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
              reject(new Error(data.error || `Blob upload failed (${xhr.status})`));
            }
          } catch {
            reject(new Error(xhr.responseText?.slice(0, 200) || `Blob upload error (${xhr.status})`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during blob upload')));

        // Upload to Vercel Blob API
        xhr.open('PUT', `https://blob.vercel-storage.com/${file.name}`);
        xhr.setRequestHeader('authorization', `Bearer ${clientToken}`);
        xhr.setRequestHeader('x-content-type', file.type || 'application/octet-stream');
        xhr.setRequestHeader('x-cache-control-max-age', '300');
        xhr.send(file);
      })
      .catch(reject);
  });

  // Phase 2: Process the blob (extract text, store in Redis)
  const processRes = await fetch(`${API_BASE}/deals/${dealId}/process-blob`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blobUrl: blobResult.url,
      fileName: file.name,
      fileSize: file.size,
    }),
  });

  const data = await parseJsonResponse(processRes);
  if (!processRes.ok) throw new Error(data.error || 'Failed to process uploaded file');
  return data;
}

/**
 * Smart upload: routes to direct upload for small files, Blob for large files.
 */
export function uploadFile(
  dealId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  if (file.size > DIRECT_UPLOAD_LIMIT) {
    return uploadLargeFile(dealId, file, onProgress);
  }
  return uploadSingleFile(dealId, file, onProgress);
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

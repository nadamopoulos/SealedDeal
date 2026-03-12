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

// ─── Upload (one file at a time via XHR for progress tracking) ──

export interface UploadResult {
  documents: (Document & { extractedText: string; category: DocCategory })[];
}

/**
 * Upload a single file to the deal's upload endpoint using XMLHttpRequest
 * so we can track upload progress. Returns when the server responds.
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

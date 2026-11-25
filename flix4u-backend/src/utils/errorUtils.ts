import type { StreamFetchError } from '@/src/types/anime';

/**
 * Safely extracts a human-readable error message from any unknown error,
 * HTTP payload, Axios-style response.data, or Vercel error object.
 * Never returns "[object Object]".
 */
export function extractErrorMessage(
  err: unknown,
  fallback = 'Stream request failed.'
): string {
  const seen = new Set<unknown>();

  const walk = (val: unknown, depth = 0): string => {
    if (val == null || depth > 5) return '';

    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === '[object Object]') return '';
      // If a raw JSON string was passed in, try parsing its message
      if (
        (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))
      ) {
        try {
          const parsed = JSON.parse(trimmed);
          const nested = walk(parsed, depth + 1);
          if (nested) return nested;
        } catch {
          // keep trimmed string if not valid JSON
        }
      }
      return trimmed;
    }

    if (typeof val === 'number' || typeof val === 'boolean') {
      return String(val);
    }

    if (typeof val !== 'object') {
      return '';
    }

    if (seen.has(val)) return '';
    seen.add(val);

    if (Array.isArray(val)) {
      for (const item of val) {
        const msg = walk(item, depth + 1);
        if (msg) return msg;
      }
      return '';
    }

    const obj = val as Record<string, unknown>;

    // Check Axios/fetch wrapper response data first so server details take precedence over generic HTTP text
    const responseObj =
      obj.response && typeof obj.response === 'object'
        ? (obj.response as Record<string, unknown>)
        : null;

    const candidates: unknown[] = [
      responseObj?.data,
      obj.data,
      obj.upstreamError,
      obj.error,
      obj.message,
      obj.detail,
      obj.reason,
      obj.statusText,
      responseObj?.statusText,
      obj.cause,
    ];

    for (const candidate of candidates) {
      const msg = walk(candidate, depth + 1);
      if (msg) {
        // Avoid generic Axios/fetch wrapper messages if response data yielded nothing better,
        // wait: candidates ordered response.data BEFORE obj.message, so server message wins first!
        return msg;
      }
    }

    // Last resort for plain objects without standard message fields
    try {
      const serialized = JSON.stringify(obj);
      if (serialized && serialized !== '{}' && serialized !== '[]') {
        return serialized.slice(0, 240);
      }
    } catch {
      // ignore circular JSON errors
    }

    return '';
  };

  const extracted = walk(err, 0);
  return extracted || fallback;
}

export function extractErrorStatusCode(
  err: unknown,
  httpStatus?: number
): number | undefined {
  if (typeof httpStatus === 'number' && httpStatus >= 400) {
    return httpStatus;
  }
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const candidates = [
      obj.statusCode,
      obj.status,
      obj.code,
      (obj.response as Record<string, unknown> | undefined)?.status,
      (obj.upstreamError as Record<string, unknown> | undefined)?.statusCode,
      (obj.error as Record<string, unknown> | undefined)?.code,
    ];
    for (const c of candidates) {
      if (typeof c === 'number' && Number.isFinite(c) && c >= 100 && c < 600) {
        return c;
      }
      if (typeof c === 'string' && /^\d{3}$/.test(c.trim())) {
        return Number(c.trim());
      }
    }
  }
  return httpStatus;
}

export function extractErrorDetails(
  err: unknown,
  endpointUrl: string,
  httpStatus?: number,
  fallback = 'Stream request failed.'
): StreamFetchError {
  const statusCode = extractErrorStatusCode(err, httpStatus);
  const message = extractErrorMessage(err, fallback);

  let detail: string | undefined;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (obj.detail !== undefined) {
      const d = extractErrorMessage(obj.detail, '');
      if (d && d !== message) detail = d.slice(0, 300);
    } else if (obj.response && typeof obj.response === 'object') {
      const r = obj.response as Record<string, unknown>;
      if (r.data !== undefined) {
        const d = extractErrorMessage(r.data, '');
        if (d && d !== message) detail = d.slice(0, 300);
      }
    }
  }

  return {
    message,
    statusCode,
    endpointUrl,
    detail,
  };
}

export async function parseSafeJsonResponse<T = Record<string, unknown>>(
  res: Response
): Promise<{ ok: boolean; status: number; data: T | null; rawText: string }> {
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return { ok: res.ok, status: res.status, data: null, rawText: '' };
  }

  const trimmed = rawText.trim();
  if (!trimmed) {
    return { ok: res.ok, status: res.status, data: null, rawText: '' };
  }

  try {
    const parsed = JSON.parse(trimmed) as T;
    return { ok: res.ok, status: res.status, data: parsed, rawText };
  } catch {
    return { ok: res.ok, status: res.status, data: null, rawText };
  }
}

export function isPlayableStreamUrl(rawUrl: unknown): rawUrl is string {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/api/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

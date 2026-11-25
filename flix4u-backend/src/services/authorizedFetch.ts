import { CapacitorHttp } from '@capacitor/core';
import { getBackendApiOrigins, isNativeCapacitorRuntime } from '@/src/config/env';
import { auth } from '@/src/lib/firebase';

export const SESSION_EXPIRED_EVENT = 'flix4u:session-expired';

let lastExpiredDispatchAt = 0;

export function notifySessionExpired(
  message = 'Your session has expired. Please sign in again.'
): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastExpiredDispatchAt < 1500) return;
  lastExpiredDispatchAt = now;
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { message },
    })
  );
}

export function isBackendApiUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/api/')) return true;
  for (const origin of getBackendApiOrigins()) {
    if (url.startsWith(`${origin}/api/`)) return true;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    if (url.startsWith(`${window.location.origin}/api/`)) return true;
  }
  return false;
}

function buildBackendFailoverUrls(primaryUrl: string): string[] {
  const urls = [primaryUrl];
  const origins = getBackendApiOrigins();
  if (origins.length <= 1) return urls;
  for (const origin of origins) {
    if (primaryUrl.startsWith(`${origin}/api/`)) {
      const suffix = primaryUrl.slice(origin.length);
      for (const altOrigin of origins) {
        if (altOrigin !== origin) {
          const altUrl = `${altOrigin}${suffix}`;
          if (!urls.includes(altUrl)) urls.push(altUrl);
        }
      }
      break;
    }
  }
  return urls;
}

async function runNativeCapacitorRequest(
  targetUrl: string,
  method: string,
  headersRecord: Record<string, string>,
  body: RequestInit['body'],
  timeoutMs: number
): Promise<Response> {
  const upperMethod = (method || 'GET').toUpperCase();
  const payloadData =
    upperMethod === 'GET' || upperMethod === 'HEAD'
      ? undefined
      : typeof body === 'string'
        ? body
        : undefined;

  const nativeRes = await CapacitorHttp.request({
    url: targetUrl,
    method: upperMethod,
    headers: headersRecord,
    data: payloadData,
    connectTimeout: timeoutMs,
    readTimeout: timeoutMs,
    responseType: 'text',
  });

  const status = typeof nativeRes.status === 'number' && nativeRes.status > 0 ? nativeRes.status : 502;
  const responseHeaders = new Headers();
  if (nativeRes.headers && typeof nativeRes.headers === 'object') {
    for (const [k, v] of Object.entries(nativeRes.headers)) {
      const lowerKey = k.toLowerCase();
      if (lowerKey === 'content-encoding' || lowerKey === 'content-length') continue;
      if (typeof v === 'string') {
        responseHeaders.set(k, v);
      }
    }
  }

  if (status === 204 || status === 304) {
    return new Response(null, { status, headers: responseHeaders });
  }

  let bodyText: string;
  if (typeof nativeRes.data === 'string') {
    bodyText = nativeRes.data;
  } else if (nativeRes.data === undefined || nativeRes.data === null) {
    bodyText = '';
  } else {
    bodyText = JSON.stringify(nativeRes.data);
    if (!responseHeaders.has('Content-Type')) {
      responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    }
  }

  return new Response(bodyText, { status, headers: responseHeaders });
}

export async function getFreshFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  const currentUser = auth?.currentUser;
  if (!currentUser) return null;

  try {
    let token = await currentUser.getIdToken(forceRefresh);
    if (typeof token !== 'string' || token.split('.').length !== 3) {
      if (!forceRefresh) {
        token = await currentUser.getIdToken(true);
      }
    }
    return typeof token === 'string' && token.split('.').length === 3 ? token : null;
  } catch (err) {
    const code = (err as { code?: string } | null)?.code || '';
    if (
      code === 'auth/user-token-expired' ||
      code === 'auth/invalid-user-token' ||
      code === 'auth/user-disabled' ||
      code === 'auth/user-not-found' ||
      code === 'auth/requires-recent-login'
    ) {
      notifySessionExpired('Your session has expired. Please sign in again.');
      return null;
    }

    if (!forceRefresh) {
      try {
        const retried = await currentUser.getIdToken(true);
        return typeof retried === 'string' && retried.split('.').length === 3 ? retried : null;
      } catch (retryErr) {
        const retryCode = (retryErr as { code?: string } | null)?.code || '';
        if (
          retryCode === 'auth/user-token-expired' ||
          retryCode === 'auth/invalid-user-token' ||
          retryCode === 'auth/user-disabled' ||
          retryCode === 'auth/user-not-found'
        ) {
          notifySessionExpired('Your session has expired. Please sign in again.');
        }
        return null;
      }
    }
    return null;
  }
}

export async function authorizedApiFetch(
  url: string,
  options: RequestInit & { timeoutMs?: number; retries?: number } = {}
): Promise<Response> {
  const { timeoutMs = 15000, retries = 0, headers: callerHeaders, ...restInit } = options;

  const token = await getFreshFirebaseIdToken(false);
  if (!token) {
    notifySessionExpired('Please sign in to continue.');
    return new Response(
      JSON.stringify({
        error: 'Authentication required. Please sign in to access video content.',
        code: 'MISSING_TOKEN',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const callerSignal = restInit.signal;
  const method = (restInit.method || 'GET').toUpperCase();
  const isSafeIdempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = isSafeIdempotent ? Math.max(1, 1 + retries) : 1;
  const candidateUrls = buildBackendFailoverUrls(url);
  const isNative = isNativeCapacitorRuntime();

  const executeSingleTarget = async (targetUrl: string, bearerToken: string): Promise<Response> => {
    const headers = new Headers(callerHeaders || {});
    headers.set('Authorization', `Bearer ${bearerToken}`);
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    if (callerSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    let timedOut = false;

    const onCallerAbort = () => {
      controller.abort();
    };
    if (callerSignal) {
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      return await fetch(targetUrl, {
        ...restInit,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      if (callerSignal?.aborted) {
        throw err;
      }
      if (isNative) {
        try {
          const headerObj: Record<string, string> = {};
          headers.forEach((v, k) => {
            headerObj[k] = v;
          });
          return await runNativeCapacitorRequest(
            targetUrl,
            method,
            headerObj,
            restInit.body,
            timeoutMs
          );
        } catch {
          // fall through to throw timeout/network error
        }
      }
      if (timedOut) {
        throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s.`);
      }
      throw err;
    } finally {
      window.clearTimeout(timer);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }
  };

  const executeWithFailover = async (bearerToken: string): Promise<Response> => {
    let lastError: unknown;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      for (const targetUrl of candidateUrls) {
        if (callerSignal?.aborted) {
          throw new DOMException('Aborted', 'AbortError');
        }
        try {
          const res = await executeSingleTarget(targetUrl, bearerToken);
          lastResponse = res;
          if (res.status < 500 && res.status !== 429) {
            return res;
          }
        } catch (err) {
          lastError = err;
          if (err instanceof DOMException && err.name === 'AbortError' && callerSignal?.aborted) {
            throw err;
          }
        }
      }

      if (attempt + 1 < maxAttempts) {
        await new Promise((r) => window.setTimeout(r, 350));
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError instanceof Error ? lastError : new Error('Network request failed.');
  };

  let res = await executeWithFailover(token);

  if (res.status === 401) {
    const refreshedToken = await getFreshFirebaseIdToken(true);
    if (refreshedToken) {
      res = await executeWithFailover(refreshedToken);
    }
    if (res.status === 401) {
      notifySessionExpired('Your session has expired. Please sign in again.');
    }
  }

  return res;
}

import type { IncomingMessage, ServerResponse } from 'http';
import app from '../server.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.url) {
      const parsed = new URL(req.url, 'http://localhost');
      const rewrittenPath = parsed.searchParams.get('__kuro_path');
      if (rewrittenPath !== null) {
        parsed.searchParams.delete('__kuro_path');
        const cleanSubpath = rewrittenPath.replace(/^\/+/, '');
        const qs = parsed.searchParams.toString();
        req.url = `/api/${cleanSubpath}${qs ? `?${qs}` : ''}`;
      } else if (!parsed.pathname.startsWith('/api')) {
        const qs = parsed.searchParams.toString();
        req.url = `/api${parsed.pathname.startsWith('/') ? '' : '/'}${parsed.pathname}${qs ? `?${qs}` : ''}`;
      } else if (parsed.pathname === '/api' || parsed.pathname === '/api/') {
        req.url = '/api/health';
      }
    }

    const mutableReq = req as IncomingMessage & {
      originalUrl?: string;
      query?: Record<string, unknown>;
    };
    if (req.url) {
      mutableReq.originalUrl = req.url;
    }
    // Clear pre-populated Vercel query object containing __kuro_path so Express parses fresh req.url
    if (mutableReq.query && typeof mutableReq.query === 'object') {
      try {
        Object.defineProperty(mutableReq, 'query', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      } catch {
        delete mutableReq.query.__kuro_path;
      }
    }

    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Serverless API handler failure.';
    const code =
      err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : undefined;
    console.error('[Vercel Handler Error]', code || '', message);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          error: message,
          code,
          message,
        })
      );
    }
  }
}


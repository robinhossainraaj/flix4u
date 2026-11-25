import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import https from 'https';
import net from 'net';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import multer from 'multer';

const isVercelRuntime = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME
);

// Flix4U is permanently guest-only. No login mode exists in this build.
const PUBLIC_GUEST_MODE = true;

if (!isVercelRuntime) {
  try {
    dotenv.config();
  } catch {
    // ignore missing .env
  }
}

function resolveServerRootDir(): string {
  try {
    const metaUrl = typeof import.meta !== 'undefined' ? import.meta.url : undefined;
    if (typeof metaUrl === 'string' && metaUrl.startsWith('file:')) {
      return path.dirname(fileURLToPath(metaUrl));
    }
  } catch {
    // Fallback when bundled to CommonJS (e.g., Vercel @vercel/node)
  }
  try {
    if (typeof __dirname === 'string' && __dirname) {
      return __dirname;
    }
  } catch {
    // Fallback in strict ESM
  }
  return process.cwd();
}

const SERVER_ROOT_DIR = resolveServerRootDir();

const AUTHORIZED_ADMIN_EMAILS_SERVER = Array.from(
  new Set(
    [
      ...(process.env.ADMIN_EMAIL || '').split(','),
      'admin@example.com',
      'admin2@example.com',
    ]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )
);

function resolveWritableDataDir(): string {
  const candidates = isVercelRuntime
    ? [path.join(os.tmpdir(), 'flix4u-data')]
    : [path.resolve(SERVER_ROOT_DIR, '.flix4u-data'), path.join(os.tmpdir(), 'flix4u-data')];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(path.join(dir, 'uploads', 'banners'), { recursive: true });
      return dir;
    } catch {
      // Try next writable directory (Vercel /var/task is read-only)
    }
  }
  return path.join(os.tmpdir(), 'flix4u-data');
}

const DATA_DIR = resolveWritableDataDir();
const BANNER_UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'banners');
const ANALYTICS_FILE_PATH = path.join(DATA_DIR, 'analytics.json');
const XP_LEDGER_FILE_PATH = path.join(DATA_DIR, 'xp-ledger.json');

interface FirebaseProjectConfig {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId?: string;
  source: 'web' | 'android' | 'env';
}

function loadFirebaseAppletConfig(): FirebaseProjectConfig | null {
  const envJson = process.env.FIREBASE_CONFIG_JSON;
  if (envJson && envJson.trim()) {
    try {
      const parsed = JSON.parse(envJson) as Partial<FirebaseProjectConfig>;
      if (parsed.projectId && parsed.apiKey) {
        return {
          projectId: parsed.projectId,
          apiKey: parsed.apiKey,
          firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          source: 'env',
        };
      }
    } catch {
      // ignore malformed env json
    }
  }

  const candidatePaths = [
    path.resolve(SERVER_ROOT_DIR, 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  for (const configPath of candidatePaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<FirebaseProjectConfig>;
      if (parsed.projectId && parsed.apiKey) {
        return {
          projectId: parsed.projectId,
          apiKey: parsed.apiKey,
          firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          source: 'web',
        };
      }
    } catch {
      // try next path
    }
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_WEB_API_KEY) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_WEB_API_KEY,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
      source: 'env',
    };
  }

  return null;
}

function loadAndroidGoogleServicesConfig(): FirebaseProjectConfig | null {
  const envAndroidJson = process.env.FIREBASE_ANDROID_CONFIG_JSON;
  const rawSources: Array<{ label: string; raw?: string }> = [];
  if (envAndroidJson && envAndroidJson.trim()) {
    rawSources.push({ label: 'env', raw: envAndroidJson });
  }

  const candidatePaths = [
    path.resolve(SERVER_ROOT_DIR, 'android/app/google-services.json'),
    path.resolve(process.cwd(), 'android/app/google-services.json'),
    path.resolve(SERVER_ROOT_DIR, 'public/assets/aistudio/google-services_48e0edfe.json'),
    path.resolve(process.cwd(), 'public/assets/aistudio/google-services_48e0edfe.json'),
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        rawSources.push({ label: p, raw: fs.readFileSync(p, 'utf8') });
      }
    } catch {
      // try next path
    }
  }

  for (const entry of rawSources) {
    if (!entry.raw) continue;
    try {
      const parsed = JSON.parse(entry.raw) as {
        project_info?: { project_id?: string };
        client?: Array<{
          client_info?: { android_client_info?: { package_name?: string } };
          api_key?: Array<{ current_key?: string }>;
        }>;
      };
      const projectId = parsed.project_info?.project_id?.trim();
      const clients = Array.isArray(parsed.client) ? parsed.client : [];
      const matchingClient =
        clients.find(
          (c) => c.client_info?.android_client_info?.package_name === 'com.flix4u.rorax'
        ) || clients[0];
      const apiKey = matchingClient?.api_key?.find((k) => Boolean(k?.current_key))?.current_key?.trim();
      if (projectId && apiKey) {
        return {
          projectId,
          apiKey,
          firestoreDatabaseId: '(default)',
          source: 'android',
        };
      }
    } catch {
      // try next source
    }
  }

  return null;
}

const FIREBASE_CONFIG = loadFirebaseAppletConfig();
const ANDROID_FIREBASE_CONFIG = loadAndroidGoogleServicesConfig();

const FIREBASE_PROJECTS: FirebaseProjectConfig[] = [];
for (const cfg of [FIREBASE_CONFIG, ANDROID_FIREBASE_CONFIG]) {
  if (!cfg?.projectId || cfg.projectId === 'remixed-project-id') continue;
  if (!FIREBASE_PROJECTS.some((p) => p.projectId === cfg.projectId)) {
    FIREBASE_PROJECTS.push(cfg);
  }
}

type AdminAuthInstance = {
  verifyIdToken: (token: string, checkRevoked?: boolean) => Promise<{
    email?: string;
    uid?: string;
    sub?: string;
    aud?: string;
    email_verified?: boolean;
    admin?: boolean;
  }>;
  getUser: (uid: string) => Promise<{ customClaims?: Record<string, unknown> }>;
  setCustomUserClaims: (uid: string, claims: Record<string, unknown>) => Promise<void>;
};

const adminAuthByProject = new Map<string, AdminAuthInstance>();
const adminInitFailedProjects = new Set<string>();

function hasServiceAccountCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}

// Lazily load Firebase Admin SDK per Firebase project (Web + Android APK projects)
async function getLazyAdminAuth(projectId: string): Promise<AdminAuthInstance | null> {
  if (!projectId || projectId === 'remixed-project-id') return null;
  const cached = adminAuthByProject.get(projectId);
  if (cached) return cached;
  if (adminInitFailedProjects.has(projectId)) return null;

  try {
    const [{ cert, getApps, initializeApp: initAdminApp }, { getAuth: getAdminAuth }] =
      await Promise.all([
        import('firebase-admin/app'),
        import('firebase-admin/auth'),
      ]);
    const appName = `flix4u-admin-${projectId}`;
    let adminApp = getApps().find((a) => a.name === appName);
    if (!adminApp) {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (serviceAccountJson && serviceAccountJson.trim()) {
        const sa = JSON.parse(serviceAccountJson) as { project_id?: string };
        // Only bind service account cert to the matching Firebase project
        if (!sa.project_id || sa.project_id === projectId) {
          adminApp = initAdminApp(
            {
              credential: cert(sa as Parameters<typeof cert>[0]),
              projectId,
            },
            appName
          );
        } else {
          adminApp = initAdminApp({ projectId }, appName);
        }
      } else {
        adminApp = initAdminApp({ projectId }, appName);
      }
    }
    const authInstance = getAdminAuth(adminApp) as unknown as AdminAuthInstance;
    adminAuthByProject.set(projectId, authInstance);
    return authInstance;
  } catch {
    adminInitFailedProjects.add(projectId);
    // Falls back cleanly to Google Identity Toolkit REST token verification
    return null;
  }
}

interface DailyAnalyticsBucket {
  date: string;
  visits: number;
  activeClientIds: string[];
  activeUserIds: string[];
  guestClientIds: string[];
}

interface AnalyticsStore {
  totalWebsiteVisits: number;
  knownClientIds: string[];
  daily: Record<string, DailyAnalyticsBucket>;
}

function getTodayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function sanitizeIdToken(val: unknown, maxLen = 128): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim().slice(0, maxLen);
  return /^[a-zA-Z0-9_.\-:]+$/.test(trimmed) ? trimmed : '';
}

function loadAnalyticsStore(): AnalyticsStore {
  try {
    if (fs.existsSync(ANALYTICS_FILE_PATH)) {
      const raw = fs.readFileSync(ANALYTICS_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<AnalyticsStore>;
      return {
        totalWebsiteVisits:
          typeof parsed.totalWebsiteVisits === 'number' && parsed.totalWebsiteVisits >= 0
            ? parsed.totalWebsiteVisits
            : 0,
        knownClientIds: Array.isArray(parsed.knownClientIds) ? parsed.knownClientIds : [],
        daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
      };
    }
  } catch {
    // start fresh if analytics file is unreadable
  }
  return {
    totalWebsiteVisits: 0,
    knownClientIds: [],
    daily: {},
  };
}

const analyticsStore: AnalyticsStore = loadAnalyticsStore();
const knownClientsSet = new Set<string>(analyticsStore.knownClientIds);

interface ActivePresenceSession {
  sessionId: string;
  clientId: string;
  uid?: string;
  lastSeen: number;
}

const activePresenceSessions = new Map<string, ActivePresenceSession>();
const seenVisitSessions = new Map<string, number>();

let analyticsPersistTimer: NodeJS.Timeout | null = null;
function scheduleAnalyticsPersist() {
  if (analyticsPersistTimer || isVercelRuntime) return;
  analyticsPersistTimer = setTimeout(() => {
    analyticsPersistTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      analyticsStore.knownClientIds = Array.from(knownClientsSet).slice(-50000);
      // Prune daily buckets older than 90 days to keep disk usage bounded
      const keys = Object.keys(analyticsStore.daily).sort();
      if (keys.length > 90) {
        for (const oldKey of keys.slice(0, keys.length - 90)) {
          delete analyticsStore.daily[oldKey];
        }
      }
      const tmpPath = `${ANALYTICS_FILE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(analyticsStore, null, 2), 'utf8');
      fs.renameSync(tmpPath, ANALYTICS_FILE_PATH);
    } catch (err) {
      console.error('Failed to persist analytics store:', err);
    }
  }, 1000);
}

function getOrCreateDailyBucket(dateKey: string): DailyAnalyticsBucket {
  if (!analyticsStore.daily[dateKey]) {
    analyticsStore.daily[dateKey] = {
      date: dateKey,
      visits: 0,
      activeClientIds: [],
      activeUserIds: [],
      guestClientIds: [],
    };
  }
  const bucket = analyticsStore.daily[dateKey];
  if (!Array.isArray(bucket.activeClientIds)) bucket.activeClientIds = [];
  if (!Array.isArray(bucket.activeUserIds)) bucket.activeUserIds = [];
  if (!Array.isArray(bucket.guestClientIds)) bucket.guestClientIds = [];
  return bucket;
}

function recordActorActivity(clientId: string, uid?: string) {
  const today = getTodayDateKey();
  const bucket = getOrCreateDailyBucket(today);
  if (clientId) {
    knownClientsSet.add(clientId);
    if (!bucket.activeClientIds.includes(clientId)) {
      bucket.activeClientIds.push(clientId);
    }
  }
  if (uid) {
    if (!bucket.activeUserIds.includes(uid)) {
      bucket.activeUserIds.push(uid);
    }
    if (clientId) {
      // Remove this client from unauthenticated guest bucket once signed in today
      bucket.guestClientIds = bucket.guestClientIds.filter((c) => c !== clientId);
    }
  } else if (clientId && !bucket.guestClientIds.includes(clientId)) {
    bucket.guestClientIds.push(clientId);
  }
}

function pruneStalePresence(now = Date.now()): ActivePresenceSession[] {
  const active: ActivePresenceSession[] = [];
  for (const [sid, sess] of activePresenceSessions.entries()) {
    if (now - sess.lastSeen > 75_000) {
      activePresenceSessions.delete(sid);
    } else {
      active.push(sess);
    }
  }
  for (const [sid, ts] of seenVisitSessions.entries()) {
    if (now - ts > 12 * 60 * 60 * 1000) {
      seenVisitSessions.delete(sid);
    }
  }
  return active;
}

function peekJwtAudience(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      aud?: unknown;
    };
    return typeof payload.aud === 'string' && payload.aud.trim() ? payload.aud.trim() : null;
  } catch {
    return null;
  }
}

interface VerifiedFirebaseUserResult {
  ok: boolean;
  status: number;
  code?: string;
  error?: string;
  uid?: string;
  email?: string;
  isEmailVerified?: boolean;
  projectId?: string;
  hasAdminClaim?: boolean;
  claimSynced?: boolean;
}

const EPHEMERAL_STREAM_PROXY_SECRET = crypto.randomBytes(32);

function getStreamProxyHmacKey(): Buffer {
  const configured =
    process.env.STREAM_PROXY_SECRET?.trim() ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (configured) {
    return crypto.createHash('sha256').update(configured, 'utf8').digest();
  }
  return EPHEMERAL_STREAM_PROXY_SECRET;
}

const STREAM_SESSION_COOKIE_NAME = 'kuro_stream_sess';
const STREAM_SESSION_TTL_SEC = 4 * 60 * 60;

function signStreamSessionToken(uid: string, projectId: string): string {
  const exp = Math.floor(Date.now() / 1000) + STREAM_SESSION_TTL_SEC;
  const payloadB64 = Buffer.from(JSON.stringify({ uid, projectId, exp }), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getStreamProxyHmacKey()).update(payloadB64).digest('base64url');
  return `${payloadB64}.${sig}`;
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function verifyStreamSessionCookie(req: Request): { valid: boolean; uid?: string; projectId?: string } {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[STREAM_SESSION_COOKIE_NAME];
  if (!token) return { valid: false };
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return { valid: false };
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return { valid: false };

  const expectedSig = crypto
    .createHmac('sha256', getStreamProxyHmacKey())
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false };
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      uid?: unknown;
      projectId?: unknown;
      exp?: unknown;
    };
    const nowSec = Math.floor(Date.now() / 1000);
    if (
      typeof parsed.uid === 'string' &&
      parsed.uid &&
      typeof parsed.projectId === 'string' &&
      typeof parsed.exp === 'number' &&
      parsed.exp > nowSec
    ) {
      return { valid: true, uid: parsed.uid, projectId: parsed.projectId };
    }
  } catch {
    // invalid cookie payload
  }
  return { valid: false };
}

function getExtraAllowedOrigins(): string[] {
  const raw = [process.env.ALLOWED_ORIGINS || '', process.env.APP_URL || '']
    .filter(Boolean)
    .join(',');
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function isAllowedAppOrigin(req: Request, requestOrigin: string): boolean {
  if (!requestOrigin) return true;
  if (
    requestOrigin === 'https://localhost' ||
    requestOrigin === 'http://localhost' ||
    requestOrigin === 'capacitor://localhost' ||
    requestOrigin === 'ionic://localhost' ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(requestOrigin) ||
    /^(capacitor|ionic):\/\/localhost(:\d+)?$/i.test(requestOrigin) ||
    /^https:\/\/[a-z0-9.-]+\.(run\.app|vercel\.app|web\.app|firebaseapp\.com|googleusercontent\.com|usercontent\.goog)$/i.test(
      requestOrigin
    )
  ) {
    return true;
  }

  if (getExtraAllowedOrigins().includes(requestOrigin)) {
    return true;
  }

  const forwardedHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
    .toString()
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedHost) {
    try {
      if (new URL(requestOrigin).host.toLowerCase() === forwardedHost) {
        return true;
      }
    } catch {
      // ignore malformed Origin
    }
  }
  return false;
}

function applyProtectedCorsHeaders(
  req: Request,
  res: Response,
  options: { methods?: string; allowCredentials?: boolean } = {}
): void {
  const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
  if (requestOrigin && isAllowedAppOrigin(req, requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Vary', 'Origin');
    if (options.allowCredentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    options.methods || 'GET, HEAD, POST, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Range, If-Range, X-Requested-With'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, Content-Type, Content-Disposition'
  );
  res.setHeader('Access-Control-Max-Age', '3600');
}

async function verifyFirebaseUserRequest(req: Request): Promise<VerifiedFirebaseUserResult> {
  if (FIREBASE_PROJECTS.length === 0) {
    return { ok: false, status: 503, error: 'Firebase configuration is unavailable on server.' };
  }

  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return { ok: false, status: 401, code: 'MISSING_TOKEN', error: 'Authentication required. Missing Authorization Bearer token.' };
  }
  const idToken = match[1].trim();
  if (!idToken || idToken === 'undefined' || idToken === 'null' || idToken.split('.').length !== 3) {
    return {
      ok: false,
      status: 401,
      code: 'MALFORMED_TOKEN',
      error: 'Invalid or expired authentication token.',
    };
  }

  // Unverified aud hint is used strictly to select which configured project verifier to run;
  // full cryptographic signature/aud/iss/exp checks are performed by Firebase Admin SDK or Identity Toolkit.
  const hintedAud = peekJwtAudience(idToken);
  const candidateProjects = hintedAud
    ? FIREBASE_PROJECTS.filter((p) => p.projectId === hintedAud)
    : FIREBASE_PROJECTS;

  if (hintedAud && candidateProjects.length === 0) {
    console.warn('[FirebaseAuth] Rejected token with unrecognized Firebase project aud:', hintedAud);
    return {
      ok: false,
      status: 401,
      code: 'PROJECT_MISMATCH',
      error: 'Authentication token does not belong to an authorized Flix4U Firebase project.',
    };
  }

  let verifiedEmail: string | undefined;
  let verifiedUid: string | undefined;
  let isEmailVerified = false;
  let verifiedProjectId: string | undefined;
  let hasAdminClaim = false;
  let sawExpiredToken = false;

  for (const project of candidateProjects) {
    const adminAuth = await getLazyAdminAuth(project.projectId);

    // 1. Verify signature, expiry, issuer, and audience using Firebase Admin SDK
    if (adminAuth) {
      try {
        const useRevocationCheck = hasServiceAccountCredentials();
        const decoded = await adminAuth.verifyIdToken(idToken, useRevocationCheck);
        verifiedEmail = decoded.email;
        verifiedUid = decoded.uid || decoded.sub;
        isEmailVerified = decoded.email_verified === true;
        hasAdminClaim = decoded.admin === true;
        verifiedProjectId = project.projectId;
        break;
      } catch (err) {
        const fbCode =
          err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : '';
        if (fbCode === 'auth/id-token-expired' || fbCode === 'auth/id-token-revoked') {
          sawExpiredToken = true;
          break;
        }
        // Only fall through to Identity Toolkit if Admin SDK failed for environment/cert reasons
      }
    }

    // 2. Identity Toolkit REST fallback for this project's Web/Android API key
    try {
      const lookupRes = await fetchWithTimeout(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(project.apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        },
        6000
      );

      if (lookupRes.ok) {
        const lookupData = (await lookupRes.json()) as {
          users?: Array<{ localId?: string; email?: string; emailVerified?: boolean }>;
        };
        const account = lookupData.users?.[0];
        if (account?.localId && account?.email) {
          verifiedEmail = account.email;
          verifiedUid = account.localId;
          isEmailVerified = account.emailVerified === true;
          verifiedProjectId = project.projectId;
          break;
        }
      } else {
        const errJson = (await lookupRes.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const msg = errJson?.error?.message || '';
        if (msg.includes('TOKEN_EXPIRED')) {
          sawExpiredToken = true;
          break;
        }
      }
    } catch {
      // try next candidate project or report failure below
    }
  }

  if (sawExpiredToken) {
    return {
      ok: false,
      status: 401,
      code: 'TOKEN_EXPIRED',
      error: 'Authentication token expired. Please sign in again.',
    };
  }

  if (!verifiedUid || !verifiedEmail || !verifiedProjectId) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_TOKEN',
      error: 'Invalid or expired authentication token.',
    };
  }

  return {
    ok: true,
    status: 200,
    uid: verifiedUid,
    email: verifiedEmail,
    isEmailVerified,
    projectId: verifiedProjectId,
    hasAdminClaim,
  };
}

interface AuthenticatedRequest extends Request {
  firebaseUser?: VerifiedFirebaseUserResult;
}

async function requireFirebaseAuthStrict(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authCheck = await verifyFirebaseUserRequest(req);
  if (!authCheck.ok) {
    res.status(authCheck.status).json({
      success: false,
      error: authCheck.error,
      message: authCheck.error,
      code: authCheck.code,
    });
    return;
  }

  if (!authCheck.isEmailVerified) {
    res.status(401).json({
      success: false,
      error: 'Email verification is required to access streaming content.',
      message: 'Email verification is required to access streaming content.',
      code: 'EMAIL_UNVERIFIED',
    });
    return;
  }

  (req as AuthenticatedRequest).firebaseUser = authCheck;
  next();
}

const allowGuest: (req: Request, res: Response, next: NextFunction) => void = (_req, _res, next) => next();

// Existing route declarations keep the same name; in guest mode this becomes a no-op.
const requireFirebaseAuth: (req: Request, res: Response, next: NextFunction) => void | Promise<void> =
  PUBLIC_GUEST_MODE ? allowGuest : requireFirebaseAuthStrict;

async function verifyAdminRequest(req: Request): Promise<VerifiedFirebaseUserResult> {
  const authCheck = await verifyFirebaseUserRequest(req);
  if (!authCheck.ok) {
    return authCheck;
  }

  if (!authCheck.isEmailVerified) {
    return { ok: false, status: 403, code: 'EMAIL_UNVERIFIED', error: 'Verified email authentication is required.' };
  }

  const normalizedEmail = (authCheck.email || '').toLowerCase();
  const isAuthorizedAdmin =
    authCheck.hasAdminClaim === true || AUTHORIZED_ADMIN_EMAILS_SERVER.includes(normalizedEmail);

  if (!isAuthorizedAdmin) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      error: 'Access denied: Administrator authorization required.',
    };
  }

  let claimSynced = false;
  // Sync custom admin claim when a service account credential with IAM access is configured
  if (hasServiceAccountCredentials() && authCheck.projectId && authCheck.uid) {
    const adminAuth = await getLazyAdminAuth(authCheck.projectId);
    if (adminAuth) {
      try {
        const userRec = await adminAuth.getUser(authCheck.uid);
        if (!userRec.customClaims?.admin) {
          await adminAuth.setCustomUserClaims(authCheck.uid, {
            ...(userRec.customClaims || {}),
            admin: true,
          });
          claimSynced = true;
        }
      } catch {
        // non-fatal if IAM permissions do not allow modifying custom claims
      }
    }
  }

  return {
    ...authCheck,
    claimSynced,
  };
}

function detectVerifiedImageFormat(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }
  // GIF: GIF87a / GIF89a
  const header6 = buffer.subarray(0, 6).toString('ascii');
  if (header6 === 'GIF87a' || header6 === 'GIF89a') {
    return { mime: 'image/gif', ext: '.gif' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

const PORT = Number(process.env.PORT || 3000);
const DEFAULT_STREAMING_API = (
  process.env.VITE_STREAMING_API_BASE || 'https://ashanime-api.vercel.app'
).replace(/\/+$/, '');
const DEFAULT_MUNCHYROLL_CONSUMET_API = (
  process.env.CONSUMET_API_URL ||
  process.env.VITE_CONSUMET_API_URL ||
  'https://consumet-public.vercel.app'
).replace(/\/+$/, '');
const MUNCHYROLL_CORS_PROXY_URL = (
  process.env.CORS_PROXY_URL ||
  process.env.VITE_CORS_PROXY_URL ||
  ''
).replace(/\/+$/, '');
const ANILIST_API_URL = process.env.VITE_ANILIST_API_URL || 'https://graphql.anilist.co';
const TMDB_API_KEY = (process.env.TMDB_API_KEY || '').trim();
const TMDB_API_BASE = 'https://api.themoviedb.org/3';
const CINEPRO_BASE_URL = (process.env.CINEPRO_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
const CINEPRO_ENABLED = String(process.env.CINEPRO_ENABLED || 'true').toLowerCase() !== 'false';
const CINEPRO_TIMEOUT_MS = Math.min(
  45000,
  Math.max(3000, Number(process.env.CINEPRO_TIMEOUT_MS || 15000) || 15000)
);
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const ARCHIVE_API_BASE = 'https://archive.org';
const ANIYOMI_REPO_URL =
  'https://gitea.k3vinb5.dev/Backups/kohi-den-extensions/raw/branch/main/index.min.json';
const TACHIYOMI_REPO_URL =
  'https://gitea.k3vinb5.dev/Backups/keiyoushi-extensions/raw/branch/repo/index.min.json';
const ANIZIP_API_URL = 'https://api.ani.zip/mappings';
const ANISKIP_API_URL = 'https://api.aniskip.com/v2/skip-times';
const ANIMEWORLD_UPSTREAM = (
  process.env.ANIMEWORLD_UPSTREAM_URL || 'https://animesky.app'
).replace(/\/+$/, '');
const ANIMEWORLD_UPSTREAMS: string[] = Array.from(
  new Set(
    [
      ANIMEWORLD_UPSTREAM,
      ...(process.env.ANIMEWORLD_UPSTREAM_URLS || '').split(','),
      'https://animesky.app',
      'https://animesalt.cx',
    ]
      .map((u) => u.trim().replace(/\/+$/, ''))
      .filter((u) => /^https?:\/\//i.test(u))
  )
);
const ANIMEWORLD_INDIA_API_URL = (
  process.env.ANIMEWORLD_INDIA_API_URL || ''
)
  .trim()
  .replace(/\/+$/, '');

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface CacheEntry<T> {
  expiresAt: number;
  data: T;
}

const aniZipCache = new Map<number, CacheEntry<Record<string, unknown>>>();
const aniSkipCache = new Map<string, CacheEntry<Record<string, unknown>>>();
const audioAvailabilityCache = new Map<string, CacheEntry<Record<string, unknown>>>();
const cineproCache = new Map<string, CacheEntry<Record<string, unknown>>>();
const primaryUnavailableCache = new Map<
  string,
  CacheEntry<{ statusCode: number; message: string; detail?: string }>
>();
let extensionsCache: CacheEntry<Record<string, unknown>> | null = null;

const SUB_DUB_STREAM_SERVERS = [
  { name: 'vidstreaming' },
  { name: 'megacloud' },
  { name: 'streamsb' },
  { name: 'animepahe' },
  { name: 'aniwatchtv' },
  { name: 'hianime' },
  { name: 'kaido' },
  { name: 'munchyroll' },
];

const HINDI_STREAM_SERVERS = [{ name: 'animeworld-india' }];

const ALL_STREAM_SERVERS = [...SUB_DUB_STREAM_SERVERS];

interface ResolvedSource {
  url: string;
  quality: string;
  isM3U8: boolean;
  type: 'hls' | 'mp4' | 'embed';
}

interface ResolvedSubtitle {
  url: string;
  lang: string;
  label: string;
}

function normalizeUrl(raw: string): string {
  return raw.trim().replace(/^https:\/{3,}/i, 'https://').replace(/^http:\/{3,}/i, 'http://');
}

function isBlockedPrivateIp(ipRaw: string): boolean {
  const ip = ipRaw.trim().replace(/^\[|\]$/g, '').toLowerCase();
  const ver = net.isIP(ip);
  if (!ver) return false;
  if (ver === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')) return true;
  if (ip.startsWith('::ffff:')) {
    return isBlockedPrivateIp(ip.slice('::ffff:'.length));
  }
  return false;
}

function isBlockedPrivateHost(hostname: string): boolean {
  const h = hostname.trim().replace(/^\[|\]$/g, '').toLowerCase();
  if (
    !h ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    h === '0.0.0.0' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    return true;
  }
  if (net.isIP(h)) {
    return isBlockedPrivateIp(h);
  }
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) {
    return true;
  }
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function convertSrtToVtt(srt: string): string {
  const cleaned = srt.replace(/\r+/g, '').trim();
  const converted = cleaned.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );
  return `WEBVTT\n\n${converted}\n`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 7000
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function tmdbImageUrl(path: unknown, size: string): string {
  return typeof path === 'string' && path.startsWith('/')
    ? `${TMDB_IMAGE_BASE}/${size}${path}`
    : '';
}

function normalizeTmdbMedia(
  item: Record<string, unknown>,
  type: 'movie' | 'tv'
): Record<string, unknown> {
  const genreNames = Array.isArray(item.genres)
    ? item.genres
        .map((g) =>
          g && typeof g === 'object' ? String((g as { name?: unknown }).name || '') : ''
        )
        .filter(Boolean)
    : Array.isArray(item.genre_ids)
      ? item.genre_ids.map((g) => String(g))
      : [];
  const date =
    typeof item.release_date === 'string'
      ? item.release_date
      : typeof item.first_air_date === 'string'
        ? item.first_air_date
        : '';
  const year = date ? Number(date.slice(0, 4)) : undefined;

  return {
    id: `tmdb:${type}:${String(item.id ?? '')}`,
    type,
    title: String(item.title || item.name || 'Untitled'),
    poster: tmdbImageUrl(item.poster_path, 'w500'),
    backdrop: tmdbImageUrl(item.backdrop_path, 'w1280'),
    description: String(item.overview || ''),
    provider: 'tmdb',
    genres: genreNames,
    year: year && Number.isFinite(year) ? year : undefined,
    rating: typeof item.vote_average === 'number' ? item.vote_average : undefined,
  };
}

async function tmdbFetch(
  path: string,
  params: Record<string, string> = {}
): Promise<Record<string, unknown>> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not configured. Set it in Vercel environment variables.');
  }
  const url = new URL(`${TMDB_API_BASE}${path}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetchWithTimeout(
    url.toString(),
    { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
    8000
  );
  if (!res.ok) throw new Error(`TMDB returned HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

function cineproConfigured(): boolean {
  if (!CINEPRO_ENABLED || !CINEPRO_BASE_URL) return false;
  try {
    const url = new URL(CINEPRO_BASE_URL);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseCineproTmdbId(
  rawId: string,
  requestedType: string
): { id: number; type: 'movie' | 'tv' } | null {
  const clean = String(rawId || '').trim();
  const prefixed = clean.match(/^tmdb:(movie|tv):(\d+)$/i);
  if (prefixed) {
    const id = Number(prefixed[2]);
    if (Number.isSafeInteger(id) && id > 0) {
      return { id, type: prefixed[1].toLowerCase() === 'tv' ? 'tv' : 'movie' };
    }
    return null;
  }
  if (/^\d+$/.test(clean)) {
    const id = Number(clean);
    if (Number.isSafeInteger(id) && id > 0) {
      return { id, type: requestedType === 'tv' ? 'tv' : 'movie' };
    }
  }
  return null;
}

function cineproAbsoluteUrl(raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return normalizeUrl(value);
  try {
    return new URL(value, `${CINEPRO_BASE_URL}/`).toString();
  } catch {
    return '';
  }
}

function cineproProviderName(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';
  const provider = raw as Record<string, unknown>;
  return String(provider.name || provider.id || '').trim();
}

function cineproLanguage(raw: unknown): string {
  if (!Array.isArray(raw) || !raw.length) return 'Original';
  const first = raw[0];
  if (!first || typeof first !== 'object') return 'Original';
  const track = first as Record<string, unknown>;
  return String(track.label || track.language || 'Original').trim() || 'Original';
}

async function resolveCineproSources(
  tmdbId: number,
  type: 'movie' | 'tv',
  season: number,
  episode: number
): Promise<Record<string, unknown> | null> {
  if (!cineproConfigured()) return null;

  const cacheKey = `${type}:${tmdbId}:${season}:${episode}`;
  const cached = cineproCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const path =
    type === 'tv'
      ? `/v1/tv/${tmdbId}/seasons/${season}/episodes/${episode}`
      : `/v1/movies/${tmdbId}`;
  const url = new URL(path, `${CINEPRO_BASE_URL}/`).toString();
  const response = await fetchWithTimeout(
    url,
    {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
    },
    CINEPRO_TIMEOUT_MS
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as Record<string, unknown>;
  const rawSources = Array.isArray(payload.sources) ? payload.sources : [];
  const sources: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  for (const raw of rawSources) {
    if (!raw || typeof raw !== 'object') continue;
    const source = raw as Record<string, unknown>;
    const streamUrl = cineproAbsoluteUrl(source.url);
    if (!/^https?:\/\//i.test(streamUrl) || seen.has(streamUrl)) continue;
    seen.add(streamUrl);

    const provider = cineproProviderName(source.provider);
    const quality = String(source.quality || 'Auto').trim() || 'Auto';
    sources.push({
      url: streamUrl,
      quality: provider ? `${provider} · ${quality}` : quality,
      type: String(source.type || 'hls').trim() || 'hls',
      language: cineproLanguage(source.audioTracks),
    });
  }
  if (!sources.length) return null;

  const subtitles: Array<Record<string, unknown>> = [];
  const rawSubtitles = Array.isArray(payload.subtitles) ? payload.subtitles : [];
  for (const raw of rawSubtitles) {
    if (!raw || typeof raw !== 'object') continue;
    const subtitle = raw as Record<string, unknown>;
    const subtitleUrl = cineproAbsoluteUrl(subtitle.url);
    if (!/^https?:\/\//i.test(subtitleUrl)) continue;
    subtitles.push({
      url: subtitleUrl,
      label: String(subtitle.label || 'Subtitles').trim() || 'Subtitles',
    });
  }

  const result: Record<string, unknown> = {
    url: sources[0].url,
    quality: sources[0].quality,
    type: sources[0].type,
    referer: '',
    provider: 'cinepro',
    sources,
    subtitles,
  };

  let ttl = 60 * 60 * 1000;
  if (typeof payload.expiresAt === 'string') {
    const expiresAt = Date.parse(payload.expiresAt);
    if (Number.isFinite(expiresAt)) {
      ttl = Math.min(60 * 60 * 1000, Math.max(60 * 1000, expiresAt - Date.now()));
    }
  }
  cineproCache.set(cacheKey, { expiresAt: Date.now() + ttl, data: result });
  return result;
}

const ANILIST_CATALOG_QUERY = `query ($page: Int, $perPage: Int, $search: String, $id: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, search: $search, id: $id) {
      id
      title { romaji english native }
      coverImage { extraLarge large }
      bannerImage
      description
      genres
      seasonYear
      averageScore
    }
  }
}`;

async function anilistCatalogFetch(
  variables: Record<string, unknown>
): Promise<Array<Record<string, unknown>>> {
  const res = await fetchWithTimeout(
    ANILIST_API_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({ query: ANILIST_CATALOG_QUERY, variables }),
    },
    8000
  );
  if (!res.ok) throw new Error(`AniList returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: { Page?: { media?: Array<Record<string, unknown>> } };
  };
  const media = json.data?.Page?.media;
  return Array.isArray(media) ? media : [];
}

function normalizeAnilistMedia(item: Record<string, unknown>): Record<string, unknown> {
  const title = (item.title || {}) as Record<string, unknown>;
  const cover = (item.coverImage || {}) as Record<string, unknown>;
  const description =
    typeof item.description === 'string'
      ? item.description.replace(/<[^>]*>/g, '').trim()
      : '';
  return {
    id: `anilist:${String(item.id ?? '')}`,
    type: 'anime',
    title: String(title.romaji || title.english || title.native || 'Untitled'),
    poster:
      typeof cover.extraLarge === 'string'
        ? cover.extraLarge
        : typeof cover.large === 'string'
          ? cover.large
          : '',
    backdrop: typeof item.bannerImage === 'string' ? item.bannerImage : '',
    description,
    provider: 'anilist',
    genres: Array.isArray(item.genres) ? item.genres.map((g) => String(g)) : [],
    year: typeof item.seasonYear === 'number' ? item.seasonYear : undefined,
    rating: typeof item.averageScore === 'number' ? item.averageScore / 10 : undefined,
  };
}

async function catalogTrending(
  type: string,
  page = 1
): Promise<Array<Record<string, unknown>>> {
  if (type === 'anime') {
    const media = await anilistCatalogFetch({ page, perPage: 12, sort: ['TRENDING_DESC'] });
    return media.map(normalizeAnilistMedia);
  }
  const kind = type === 'tv' ? 'tv' : 'movie';
  if (!TMDB_API_KEY) return catalogTrendingFallback(type, page);
  try {
    const data = await tmdbFetch(`/${kind}/popular`, { page: String(page) });
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => normalizeTmdbMedia(r, kind));
  } catch {
    return catalogTrendingFallback(type, page);
  }
}

async function catalogSearch(
  query: string,
  type: string,
  page = 1
): Promise<Array<Record<string, unknown>>> {
  if (type === 'anime') {
    const media = await anilistCatalogFetch({ page, perPage: 20, search: query });
    return media.map(normalizeAnilistMedia);
  }
  const kind = type === 'tv' ? 'tv' : 'movie';
  if (!TMDB_API_KEY) return catalogSearchFallback(query, type, page);
  try {
    const data = await tmdbFetch(`/search/${kind}`, { query, page: String(page) });
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => normalizeTmdbMedia(r, kind));
  } catch {
    return catalogSearchFallback(query, type, page);
  }
}

function normalizeArchiveDoc(
  doc: Record<string, unknown>,
  type: 'movie' | 'tv'
): Record<string, unknown> {
  const identifier = String(doc.identifier || '');
  const subjects = Array.isArray(doc.subject) ? doc.subject.map((s) => String(s)) : [];
  return {
    id: `archive:${type}:${identifier}`,
    identifier,
    type,
    title: String(doc.title || identifier || 'Untitled'),
    poster: identifier ? `${ARCHIVE_API_BASE}/services/img/${encodeURIComponent(identifier)}` : '',
    backdrop: identifier ? `${ARCHIVE_API_BASE}/services/img/${encodeURIComponent(identifier)}` : '',
    description: String(doc.description || ''),
    provider: 'archive',
    genres: subjects.slice(0, 6),
    year: doc.year ? Number(doc.year) || undefined : undefined,
    rating: undefined,
  };
}

async function archiveSearch(
  query: string,
  type: 'movie' | 'tv',
  page = 1,
  rows = 12,
  sort = 'downloads desc'
): Promise<Array<Record<string, unknown>>> {
  const mediatype = type === 'tv' ? 'tv' : 'movies';
  const safeQuery = query.trim().replace(/["\\]/g, ' ');
  const q = safeQuery
    ? `${mediatype} AND (${safeQuery}) AND format:"MPEG4"`
    : `${mediatype} AND format:"MPEG4"`;
  const params = new URLSearchParams();
  params.append('q', q);
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  params.append('fl[]', 'description');
  params.append('fl[]', 'subject');
  params.append('fl[]', 'year');
  params.append('rows', String(rows));
  params.append('page', String(page));
  params.append('output', 'json');
  params.append('sort', sort);

  const res = await fetchWithTimeout(
    `${ARCHIVE_API_BASE}/advancedsearch.php?${params.toString()}`,
    { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
    9000
  );
  if (!res.ok) throw new Error(`Archive.org search returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    response?: { docs?: Array<Record<string, unknown>> };
  };
  const docs = json.response?.docs || [];
  return docs
    .filter((d) => Boolean(d) && typeof d === 'object')
    .map((d) => normalizeArchiveDoc(d, type));
}

async function archiveResolve(identifier: string): Promise<Record<string, unknown>> {
  if (!identifier || /[^a-zA-Z0-9_.\-]/.test(identifier)) {
    throw new Error('Invalid Archive.org identifier.');
  }
  const res = await fetchWithTimeout(
    `${ARCHIVE_API_BASE}/metadata/${encodeURIComponent(identifier)}`,
    { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
    9000
  );
  if (!res.ok) throw new Error(`Archive.org metadata returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    files?: Array<Record<string, unknown>>;
    metadata?: Record<string, unknown>;
  };
  const files = Array.isArray(json.files) ? json.files : [];

  const playable = files
    .filter((file) => {
      const name = typeof file.name === 'string' ? file.name : '';
      return /\.(mp4|m4v|webm|ogv)$/i.test(name);
    })
    .sort((a, b) => {
      const score = (file: Record<string, unknown>) => {
        const format = String(file.format || '').toLowerCase();
        const name = String(file.name || '').toLowerCase();
        let points = 0;
        if (format.includes('h.264')) points += 5;
        if (format.includes('mpeg4')) points += 4;
        if (name.endsWith('.mp4')) points += 3;
        if (name.includes('512kb')) points += 2;
        if (name.includes('720p')) points += 1;
        return points;
      };
      return score(b) - score(a);
    });

  if (playable.length === 0) {
    throw new Error('No playable video file was found for this Archive.org item.');
  }

  const chosen = playable[0];
  const fileName = String(chosen.name);
  const fileUrl = `${ARCHIVE_API_BASE}/download/${identifier}/${encodeURIComponent(fileName)}`;
  const bytes = typeof chosen.size === 'number' ? chosen.size : undefined;

  return {
    sources: [
      {
        url: fileUrl,
        quality: bytes ? `${(bytes / 1024 / 1024).toFixed(0)} MB · MP4` : 'Auto · MP4',
        type: 'mp4',
      },
    ],
    subtitles: [],
    headers: { Referer: `${ARCHIVE_API_BASE}/` },
    provider: 'archive',
    title: String(json.metadata && typeof json.metadata === 'object' ? (json.metadata as Record<string, unknown>).title || '' : ''),
  };
}

async function archiveDetail(
  identifier: string,
  type: 'movie' | 'tv'
): Promise<Record<string, unknown>> {
  if (!identifier || /[^a-zA-Z0-9_.\-]/.test(identifier)) {
    throw new Error('Invalid Archive.org identifier.');
  }
  const res = await fetchWithTimeout(
    `${ARCHIVE_API_BASE}/metadata/${encodeURIComponent(identifier)}`,
    { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
    9000
  );
  if (!res.ok) throw new Error(`Archive.org metadata returned HTTP ${res.status}`);
  const json = (await res.json()) as { metadata?: Record<string, unknown> };
  return normalizeArchiveDoc(
    { ...(json.metadata || {}), identifier },
    type
  );
}

async function catalogTrendingFallback(
  type: string,
  page: number
): Promise<Array<Record<string, unknown>>> {
  if (type === 'anime') {
    const media = await anilistCatalogFetch({ page, perPage: 12, sort: ['TRENDING_DESC'] });
    return media.map(normalizeAnilistMedia);
  }
  const kind = type === 'tv' ? 'tv' : 'movie';
  return archiveSearch('', kind, page, 12);
}

async function catalogSearchFallback(
  query: string,
  type: string,
  page: number
): Promise<Array<Record<string, unknown>>> {
  if (type === 'anime') {
    const media = await anilistCatalogFetch({ page, perPage: 20, search: query });
    return media.map(normalizeAnilistMedia);
  }
  const kind = type === 'tv' ? 'tv' : 'movie';
  return archiveSearch(query, kind, page, 20);
}

async function catalogSearchAll(
  query: string,
  page: number
): Promise<Array<Record<string, unknown>>> {
  const jobs: Array<Promise<Array<Record<string, unknown>>>> = [
    archiveSearch(query, 'movie', page, 10),
    archiveSearch(query, 'tv', page, 10),
    anilistCatalogFetch({ page, perPage: 10, search: query }).then((media) =>
      media.map(normalizeAnilistMedia)
    ),
  ];
  if (TMDB_API_KEY) {
    jobs.push(
      tmdbFetch('/search/multi', { query, page: String(page) })
        .then((data) => {
          const results = Array.isArray(data.results) ? data.results : [];
          return results
            .filter((r): r is Record<string, unknown> => {
              if (!r || typeof r !== 'object') return false;
              const mediaType = (r as { media_type?: unknown }).media_type;
              return mediaType === 'movie' || mediaType === 'tv';
            })
            .map((r) =>
              normalizeTmdbMedia(
                r,
                (r as { media_type?: string }).media_type === 'tv' ? 'tv' : 'movie'
              )
            );
        })
        .catch(() => [])
    );
  }
  const settled = await Promise.allSettled(jobs);
  const seen = new Set<string>();
  const items: Array<Record<string, unknown>> = [];
  for (const result of settled) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      const key = `${String(item.type || '')}:${String(item.id || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }
  return items;
}

async function resolveArchiveFromTitle(title: string): Promise<Record<string, unknown>> {
  const results = await archiveSearch(title, 'movie', 1, 12);
  for (const item of results) {
    const identifier = String(item.identifier || '').replace(/^archive:movie:/, '');
    if (!identifier) continue;
    try {
      return await archiveResolve(identifier);
    } catch {
      continue;
    }
  }
  throw new Error('No playable public copy was found for this title.');
}

async function resolveMalIdFromAnilist(anilistId: number): Promise<number | null> {
  if (!Number.isFinite(anilistId) || anilistId <= 0) return null;
  try {
    const res = await fetchWithTimeout(
      ANILIST_API_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `query ($id: Int) { Media(id: $id, type: ANIME) { id idMal } }`,
          variables: { id: anilistId },
        }),
      },
      5000
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { Media?: { idMal?: number | null } } };
    const idMal = json.data?.Media?.idMal;
    return typeof idMal === 'number' && idMal > 0 ? idMal : null;
  } catch {
    return null;
  }
}

async function fetchVerifiedStreamPlaylist(
  url: string,
  referer: string,
  timeoutMs = 3500
): Promise<{ reachable: boolean; playlistText: string; detectedType: 'hls' | 'mp4' | 'embed' }> {
  const lowerUrl = url.toLowerCase();
  const isLikelyMp4 = /\.(mp4|webm|mkv)(\?|$)/i.test(lowerUrl);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Referer: referer,
          'User-Agent': BROWSER_UA,
          Accept: '*/*',
          ...(isLikelyMp4 ? { Range: 'bytes=0-4095' } : {}),
        },
      },
      timeoutMs
    );
    if (!res.ok && res.status !== 206) {
      return { reachable: false, playlistText: '', detectedType: isLikelyMp4 ? 'mp4' : 'hls' };
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('video/mp4') || ct.includes('video/webm') || isLikelyMp4) {
      try {
        await res.body?.cancel();
      } catch {
        // ignore stream cancel error
      }
      return { reachable: true, playlistText: '', detectedType: 'mp4' };
    }
    if (
      lowerUrl.includes('.m3u8') ||
      lowerUrl.includes('.txt') ||
      ct.includes('mpegurl') ||
      ct.includes('text/plain')
    ) {
      const text = await res.text();
      if (text.includes('#EXTM3U')) {
        return { reachable: true, playlistText: text, detectedType: 'hls' };
      }
      if (lowerUrl.includes('.m3u8') || ct.includes('mpegurl')) {
        return { reachable: false, playlistText: '', detectedType: 'hls' };
      }
    }
    try {
      await res.body?.cancel();
    } catch {
      // ignore stream cancel error
    }
    return { reachable: true, playlistText: '', detectedType: 'hls' };
  } catch {
    return { reachable: false, playlistText: '', detectedType: isLikelyMp4 ? 'mp4' : 'hls' };
  }
}

async function verifyStreamPlaylistReachable(
  url: string,
  referer: string,
  timeoutMs = 3500
): Promise<boolean> {
  const result = await fetchVerifiedStreamPlaylist(url, referer, timeoutMs);
  return result.reachable;
}

async function fetchAniZipMetadata(anilistId: number): Promise<Record<string, unknown>> {
  const cached = aniZipCache.get(anilistId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const res = await fetchWithTimeout(
      `${ANIZIP_API_URL}?anilist_id=${encodeURIComponent(String(anilistId))}`,
      { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
      6500
    );
    if (!res.ok) {
      return {
        found: false,
        anilistId,
        mappings: {},
        episodeCount: 0,
        episodes: {},
        error: `AniZip returned HTTP ${res.status}`,
      };
    }

    const raw = (await res.json()) as {
      mappings?: Record<string, unknown>;
      episodeCount?: number;
      episodes?: Record<string, Record<string, unknown>>;
    };

    const rawMappings = raw.mappings || {};
    const mappings = {
      anilistId: typeof rawMappings.anilist_id === 'number' ? rawMappings.anilist_id : anilistId,
      malId: typeof rawMappings.mal_id === 'number' ? rawMappings.mal_id : null,
      anidbId: typeof rawMappings.anidb_id === 'number' ? rawMappings.anidb_id : null,
      thetvdbId: typeof rawMappings.thetvdb_id === 'number' ? rawMappings.thetvdb_id : null,
      kitsuId: typeof rawMappings.kitsu_id === 'number' ? rawMappings.kitsu_id : null,
      imdbId: typeof rawMappings.imdb_id === 'string' ? rawMappings.imdb_id : null,
      themoviedbId:
        rawMappings.themoviedb_id !== undefined && rawMappings.themoviedb_id !== null
          ? String(rawMappings.themoviedb_id)
          : null,
    };

    const episodes: Record<string, Record<string, unknown>> = {};
    const rawEpisodes = raw.episodes || {};
    for (const [key, epObj] of Object.entries(rawEpisodes)) {
      if (!/^\d+$/.test(key) || !epObj || typeof epObj !== 'object') continue;
      const epNum = Number(key);
      if (!Number.isFinite(epNum) || epNum <= 0) continue;

      const titleObj =
        epObj.title && typeof epObj.title === 'object'
          ? (epObj.title as Record<string, string>)
          : {};
      const preferredTitle =
        titleObj.en ||
        titleObj['x-jat'] ||
        titleObj.ja ||
        `Episode ${epNum}`;

      episodes[String(epNum)] = {
        episodeNumber: epNum,
        absoluteEpisodeNumber:
          typeof epObj.absoluteEpisodeNumber === 'number' ? epObj.absoluteEpisodeNumber : undefined,
        seasonNumber: typeof epObj.seasonNumber === 'number' ? epObj.seasonNumber : undefined,
        title: preferredTitle,
        nativeTitle: titleObj.ja || undefined,
        romajiTitle: titleObj['x-jat'] || undefined,
        overview:
          typeof epObj.overview === 'string'
            ? epObj.overview
            : typeof epObj.summary === 'string'
              ? epObj.summary
              : undefined,
        image: typeof epObj.image === 'string' ? epObj.image : null,
        airDate:
          typeof epObj.airDate === 'string'
            ? epObj.airDate
            : typeof epObj.airdate === 'string'
              ? epObj.airdate
              : null,
        runtime:
          typeof epObj.runtime === 'number'
            ? epObj.runtime
            : typeof epObj.length === 'number'
              ? epObj.length
              : null,
        rating: typeof epObj.rating === 'string' ? epObj.rating : null,
      };
    }

    const normalized = {
      found: Object.keys(episodes).length > 0 || Boolean(mappings.malId),
      anilistId,
      mappings,
      episodeCount:
        typeof raw.episodeCount === 'number' ? raw.episodeCount : Object.keys(episodes).length,
      episodes,
    };

    aniZipCache.set(anilistId, {
      expiresAt: Date.now() + 30 * 60 * 1000,
      data: normalized,
    });
    return normalized;
  } catch (err) {
    return {
      found: false,
      anilistId,
      mappings: {},
      episodeCount: 0,
      episodes: {},
      error: err instanceof Error ? err.message : 'Failed to query AniZip.',
    };
  }
}

async function fetchAniSkipTimestamps(
  malId: number,
  episodeNumber: number,
  episodeLength = 0
): Promise<{
  found: boolean;
  malId: number;
  episodeNumber: number;
  intro?: { start: number; end: number; type: string; source: 'aniskip' };
  outro?: { start: number; end: number; type: string; source: 'aniskip' };
  recap?: { start: number; end: number; type: string; source: 'aniskip' };
  skipTimes: Array<{ start: number; end: number; type: string; source: 'aniskip' }>;
}> {
  const cacheKey = `${malId}:${episodeNumber}`;
  const cached = aniSkipCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as ReturnType<typeof fetchAniSkipTimestamps> extends Promise<infer R> ? R : never;
  }

  try {
    const url =
      `${ANISKIP_API_URL}/${malId}/${episodeNumber}` +
      `?types[]=op&types[]=ed&types[]=mixed-op&types[]=mixed-ed&types[]=recap&episodeLength=${Math.max(
        0,
        Math.floor(episodeLength)
      )}`;
    const res = await fetchWithTimeout(
      url,
      { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
      5000
    );

    if (!res.ok) {
      const empty = { found: false, malId, episodeNumber, skipTimes: [] };
      aniSkipCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000, data: empty });
      return empty;
    }

    const json = (await res.json()) as {
      found?: boolean;
      results?: Array<{
        skipType?: string;
        interval?: { startTime?: number; endTime?: number };
      }>;
    };

    const skipTimes: Array<{ start: number; end: number; type: string; source: 'aniskip' }> = [];
    for (const item of json.results || []) {
      const start = item.interval?.startTime;
      const end = item.interval?.endTime;
      const type = item.skipType || 'op';
      if (typeof start === 'number' && typeof end === 'number' && end > start) {
        skipTimes.push({ start, end, type, source: 'aniskip' });
      }
    }

    const intro =
      skipTimes.find((s) => s.type === 'op') || skipTimes.find((s) => s.type === 'mixed-op');
    const outro =
      skipTimes.find((s) => s.type === 'ed') || skipTimes.find((s) => s.type === 'mixed-ed');
    const recap = skipTimes.find((s) => s.type === 'recap');

    const payload = {
      found: skipTimes.length > 0,
      malId,
      episodeNumber,
      intro,
      outro,
      recap,
      skipTimes,
    };

    aniSkipCache.set(cacheKey, {
      expiresAt: Date.now() + 30 * 60 * 1000,
      data: payload,
    });
    return payload;
  } catch {
    return { found: false, malId, episodeNumber, skipTimes: [] };
  }
}

interface RawRepoExt {
  name?: string;
  pkg?: string;
  apk?: string;
  lang?: string;
  code?: number;
  version?: string;
  nsfw?: number;
  sources?: Array<{ name?: string; lang?: string; id?: string; baseUrl?: string }>;
}

const ADAPTED_ANIYOMI_SOURCES: Record<string, { server: string; note: string }> = {
  'eu.kanade.tachiyomi.animeextension.en.zoro': {
    server: 'vidstreaming',
    note: 'Backend Node.js adapter enabled (HiAnime/Zoro → Vidstreaming/Megacloud HLS stream).',
  },
  'eu.kanade.tachiyomi.animeextension.en.aniwatch': {
    server: 'megacloud',
    note: 'Backend Node.js adapter enabled (AniWatch → Megacloud/Vidstreaming HLS stream).',
  },
  'eu.kanade.tachiyomi.animeextension.en.kaido': {
    server: 'vidstreaming',
    note: 'Backend Node.js adapter enabled (Kaido → Vidstreaming/Megacloud HLS stream).',
  },
  'eu.kanade.tachiyomi.animeextension.en.animepahe': {
    server: 'streamsb',
    note: 'Backend Node.js adapter enabled (AnimePahe → Streamsb/Megacloud HLS fallback).',
  },
  'eu.kanade.tachiyomi.animeextension.all.animeonsen': {
    server: 'vidstreaming',
    note: 'Backend Node.js adapter enabled (AnimeOnsen → Vidstreaming HLS stream).',
  },
  'eu.kanade.tachiyomi.animeextension.all.anizone': {
    server: 'megacloud',
    note: 'Backend Node.js adapter enabled (AniZone → Megacloud HLS stream).',
  },
};

async function fetchExtensionsCatalog(): Promise<Record<string, unknown>> {
  if (extensionsCache && extensionsCache.expiresAt > Date.now()) {
    return extensionsCache.data;
  }

  const [aniyomiResult, tachiyomiResult] = await Promise.allSettled([
    fetchWithTimeout(
      ANIYOMI_REPO_URL,
      { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
      10000
    ).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as RawRepoExt[];
    }),
    fetchWithTimeout(
      TACHIYOMI_REPO_URL,
      { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
      10000
    ).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as RawRepoExt[];
    }),
  ]);

  const extensions: Array<Record<string, unknown>> = [];

  const mapAniyomi = (items: RawRepoExt[]) => {
    let compatCount = 0;
    for (const item of items) {
      const pkg = String(item.pkg || '');
      const adapter = ADAPTED_ANIYOMI_SOURCES[pkg];
      const compatible = Boolean(adapter);
      if (compatible) compatCount += 1;

      extensions.push({
        id: `aniyomi:${pkg || item.name}`,
        repoType: 'aniyomi',
        repoLabel: 'Aniyomi (Kohi-den)',
        name: String(item.name || 'Unknown Aniyomi Extension').replace(/^Aniyomi:\s*/i, ''),
        pkg,
        apk: String(item.apk || ''),
        lang: String(item.lang || 'all'),
        code: Number(item.code || 0),
        version: String(item.version || '0.0'),
        nsfw: Number(item.nsfw || 0) === 1,
        sources: Array.isArray(item.sources)
          ? item.sources.map((s) => ({
              id: String(s.id || ''),
              name: String(s.name || ''),
              lang: String(s.lang || item.lang || 'all'),
              baseUrl: String(s.baseUrl || ''),
            }))
          : [],
        compatibility: compatible ? 'adapted' : 'android-runtime-required',
        compatible,
        adapterServer: adapter?.server,
        limitationReason: adapter
          ? adapter.note
          : 'Requires Android Aniyomi runtime (.apk); Dalvik/JVM extractors cannot execute directly in a web browser.',
      });
    }
    return compatCount;
  };

  const mapTachiyomi = (items: RawRepoExt[]) => {
    for (const item of items) {
      const pkg = String(item.pkg || '');
      extensions.push({
        id: `tachiyomi:${pkg || item.name}`,
        repoType: 'tachiyomi',
        repoLabel: 'Tachiyomi (Keiyoushi)',
        name: String(item.name || 'Unknown Tachiyomi Extension'),
        pkg,
        apk: String(item.apk || ''),
        lang: String(item.lang || 'all'),
        code: Number(item.code || 0),
        version: String(item.version || '0.0'),
        nsfw: Number(item.nsfw || 0) === 1,
        sources: Array.isArray(item.sources)
          ? item.sources.map((s) => ({
              id: String(s.id || ''),
              name: String(s.name || ''),
              lang: String(s.lang || item.lang || 'all'),
              baseUrl: String(s.baseUrl || ''),
            }))
          : [],
        compatibility: 'manga-incompatible',
        compatible: false,
        limitationReason:
          'Tachiyomi/Mihon Android manga extension (.apk); incompatible with browser anime video streaming.',
      });
    }
  };

  const aniyomiItems = aniyomiResult.status === 'fulfilled' && Array.isArray(aniyomiResult.value) ? aniyomiResult.value : [];
  const tachiyomiItems =
    tachiyomiResult.status === 'fulfilled' && Array.isArray(tachiyomiResult.value) ? tachiyomiResult.value : [];

  const aniyomiCompatCount = mapAniyomi(aniyomiItems);
  mapTachiyomi(tachiyomiItems);

  // Sort adapted extensions to the top for convenience
  extensions.sort((a, b) => {
    if (Boolean(a.compatible) !== Boolean(b.compatible)) {
      return a.compatible ? -1 : 1;
    }
    return String(a.name).localeCompare(String(b.name));
  });

  const payload = {
    repositories: [
      {
        id: 'aniyomi',
        name: 'Aniyomi Extensions (Kohi-den)',
        url: ANIYOMI_REPO_URL,
        status: aniyomiResult.status === 'fulfilled' ? 'ok' : 'error',
        totalCount: aniyomiItems.length,
        compatibleCount: aniyomiCompatCount,
        error:
          aniyomiResult.status === 'rejected'
            ? aniyomiResult.reason instanceof Error
              ? aniyomiResult.reason.message
              : 'Failed to load Aniyomi repository'
            : undefined,
      },
      {
        id: 'tachiyomi',
        name: 'Tachiyomi Extensions (Keiyoushi)',
        url: TACHIYOMI_REPO_URL,
        status: tachiyomiResult.status === 'fulfilled' ? 'ok' : 'error',
        totalCount: tachiyomiItems.length,
        compatibleCount: 0,
        error:
          tachiyomiResult.status === 'rejected'
            ? tachiyomiResult.reason instanceof Error
              ? tachiyomiResult.reason.message
              : 'Failed to load Tachiyomi repository'
            : undefined,
      },
    ],
    extensions,
    fetchedAt: new Date().toISOString(),
  };

  extensionsCache = {
    expiresAt: Date.now() + 15 * 60 * 1000,
    data: payload,
  };
  return payload;
}

function normalizeAnimeWorldImg(src?: string | null): string | null {
  if (!src) return null;
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('data:image/svg')) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

const AW_ALLOWED_IMAGE_HOST_PATTERNS: RegExp[] = [
  /^image\.tmdb\.org$/i,
  /^(?:[a-z0-9-]+\.)?tmdb\.org$/i,
  /^animesky\.app$/i,
  /^(?:[a-z0-9-]+\.)?animesky\.app$/i,
  /^animesalt\.cx$/i,
  /^(?:[a-z0-9-]+\.)?animesalt\.cx$/i,
  /^i[0-3]\.wp\.com$/i,
  /^wp\.com$/i,
  /^as-cdn\d+\.top$/i,
  /^s4\.anilist\.co$/i,
];

function isAllowedAwImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (isBlockedPrivateHost(parsed.hostname)) return false;
    return AW_ALLOWED_IMAGE_HOST_PATTERNS.some((re) => re.test(parsed.hostname));
  } catch {
    return false;
  }
}

function buildAnimeWorldProxyImageUrl(rawImg?: string | null): string | null {
  const normalized = normalizeAnimeWorldImg(rawImg);
  if (!normalized || !isAllowedAwImageUrl(normalized)) return null;
  return `/api/anime-world-india/v1/image.php?url=${encodeURIComponent(normalized)}`;
}

function extractSlugFromHref(href: string | undefined, segment: string): string | null {
  if (!href) return null;
  const match = href.match(new RegExp(`/${segment}/([^/?#]+)`, 'i'));
  return match ? match[1].trim() : null;
}

function parseAnimeWorldCards($: cheerio.CheerioAPI, root?: cheerio.Cheerio<any>) {
  const container = root || $.root();
  const items: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  const pushCardItem = (
    title: string,
    imgRaw: string | undefined,
    year: string | null,
    rating: string | null,
    seriesId: string | null,
    movieId: string | null
  ) => {
    const idKey = seriesId ? `series:${seriesId}` : movieId ? `movie:${movieId}` : '';
    if (!idKey || seen.has(idKey) || !title) return;
    seen.add(idKey);
    const image = normalizeAnimeWorldImg(imgRaw);
    const proxyImage = buildAnimeWorldProxyImageUrl(image);
    items.push({
      title,
      image,
      ...(proxyImage ? { proxyImage } : {}),
      year,
      rating,
      type: seriesId ? 'series' : 'movie',
      ...(seriesId ? { seriesId } : {}),
      ...(movieId ? { movieId } : {}),
    });
  };

  // 1. Primary AnimeSky Torofilm V2 markup
  container.find('article.tr-movie-card').each((_, el) => {
    const card = $(el);
    const linkEl = card.find('a.tr-movie-link').first();
    const href = linkEl.attr('href') || '';
    const seriesId = extractSlugFromHref(href, 'series');
    const movieId =
      extractSlugFromHref(href, 'movies') || extractSlugFromHref(href, 'movie');
    const imgEl = card.find('img').first();
    const imgRaw = imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
    const title = card.find('.tr-movie-title, h3, h2').first().text().trim();
    const year = card.find('.year, .tr-year').first().text().trim() || null;
    const rating = card.find('.vote, .tr-rating').first().text().trim() || null;
    pushCardItem(title, imgRaw, year, rating, seriesId, movieId);
  });

  // 2. Legacy / Mirror Torofilm markup (animesalt.cx `article.post.movies` & `ul.post-lst li`)
  if (items.length === 0) {
    container
      .find('article.post:not(.episodes), ul.post-lst li.status-publish, article.movies')
      .each((_, el) => {
        const node = $(el);
        const linkEl = node
          .find('a.lnk-blk, a[href*="/series/"], a[href*="/movies/"], a[href*="/movie/"]')
          .first();
        const href = linkEl.attr('href') || '';
        const seriesId = extractSlugFromHref(href, 'series');
        const movieId =
          extractSlugFromHref(href, 'movies') || extractSlugFromHref(href, 'movie');
        const imgEl = node.find('img').first();
        const imgRaw =
          imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src');
        const title = node.find('h2.entry-title, h3, h2, .entry-title').first().text().trim();
        const year = node.find('span.year, .year').first().text().trim() || null;
        const rating = node.find('span.vote, .vote').first().text().trim() || null;
        pushCardItem(title, imgRaw, year, rating, seriesId, movieId);
      });
  }

  return items;
}

function parseEpisodesFromAnimeWorldHtml(html: string) {
  const $ = cheerio.load(html);
  const episodes: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  // 1. Primary AnimeSky Torofilm V2 episode cards
  $('article.tr-episode-card').each((_, el) => {
    const card = $(el);
    const href = card.find('a.tr-episode-link').first().attr('href') || '';
    const episodeId = extractSlugFromHref(href, 'episode');
    if (!episodeId || seen.has(episodeId)) return;
    seen.add(episodeId);

    const epTitle = card.find('.tr-episode-title, h3, h2').first().text().trim() || episodeId;
    const epNumber = card.find('.tr-episode-number').first().text().trim() || '';
    const imgEl = card.find('img').first();
    const image = normalizeAnimeWorldImg(
      imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src')
    );
    const proxyImage = buildAnimeWorldProxyImageUrl(image);
    episodes.push({
      episodeId,
      title: epTitle,
      episodeNumber: epNumber,
      airDate: null,
      image,
      ...(proxyImage ? { proxyImage } : {}),
      overview: null,
    });
  });

  // 2. Classic Torofilm / Mirror (`article.episodes`, `ul#episode_by_temp li`)
  if (episodes.length === 0) {
    $('ul#episode_by_temp li, article.episodes, li.episodes').each((_, el) => {
      const node = $(el);
      const href =
        node.find('a.lnk-blk, a[href*="/episode/"]').first().attr('href') || '';
      const episodeId = extractSlugFromHref(href, 'episode');
      if (!episodeId || seen.has(episodeId)) return;
      seen.add(episodeId);

      const epTitle =
        node.find('h2.entry-title, .entry-title, h3, h2').first().text().trim() || episodeId;
      const rawNum = node.find('.num-epi, .num').first().text().trim() || '';
      const epNumber = rawNum
        ? /^\d+$/.test(rawNum)
          ? `EP ${rawNum}`
          : rawNum
        : '';
      const imgEl = node.find('img').first();
      const image = normalizeAnimeWorldImg(
        imgEl.attr('data-src') || imgEl.attr('data-lazy-src') || imgEl.attr('src')
      );
      const proxyImage = buildAnimeWorldProxyImageUrl(image);
      episodes.push({
        episodeId,
        title: epTitle,
        episodeNumber: epNumber,
        airDate: null,
        image,
        ...(proxyImage ? { proxyImage } : {}),
        overview: null,
      });
    });
  }

  return { $, episodes };
}

function classifyAnimeWorldStreamType(url: string): 'hls' | 'mp4' | 'embed' {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8')) return 'hls';
  if (/\.(mp4|webm|mkv)(\?|$)/i.test(lower)) return 'mp4';
  return 'embed';
}

function isGenuineMediaDownloadUrl(rawUrl?: string | null): rawUrl is string {
  if (!rawUrl || !isValidHttpUrl(rawUrl)) return false;
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const pathLower = parsed.pathname.toLowerCase();
    const fullLower = rawUrl.toLowerCase();
    // Never treat known iframe/embed players as direct downloadable media files
    if (
      host.includes('ravok.buzz') ||
      host.includes('abyssplayer.com') ||
      host.includes('megaplay.buzz') ||
      fullLower.includes('multi-lang-plyr') ||
      pathLower.includes('/embed') ||
      pathLower.includes('/video/')
    ) {
      return false;
    }
    return /\.(mp4|mkv|webm|m3u8)(\?|$)/i.test(fullLower);
  } catch {
    return false;
  }
}

function parseAnimeWorldPagination($: cheerio.CheerioAPI, page: number) {
  const pages: number[] = [];
  $('nav.pagination a.page-numbers, nav.pagination a.page-link, .pagination a, .nav-links a').each((_, el) => {
    const num = Number($(el).text().trim());
    if (Number.isFinite(num) && num > 0) pages.push(num);
  });
  const hasNextLink =
    $('a.next, .nav-links a').filter((_, el) => /next|›|»/i.test($(el).text().trim())).length > 0;
  const totalPages = pages.length > 0 ? Math.max(...pages, page) : hasNextLink ? page + 1 : page;
  return {
    current_page: page,
    total_pages: totalPages,
    has_next: page < totalPages || hasNextLink,
    has_prev: page > 1,
    pages: Array.from(new Set(pages)).sort((a, b) => a - b),
  };
}

function extractAnimeWorldPageMeta($: cheerio.CheerioAPI, fallbackTitle: string) {
  const title =
    $('h1.hero-title, h1.episode-title, h1.entry-title').first().text().trim() || fallbackTitle;
  const poster = normalizeAnimeWorldImg(
    $('.hero-poster img, .post-thumbnail img, article.TPost .Image img').first().attr('data-src') ||
      $('.hero-poster img, .post-thumbnail img, article.TPost .Image img').first().attr('src')
  );
  const ogImg = normalizeAnimeWorldImg($('meta[property="og:image"]').attr('content'));
  const backdropAttr = normalizeAnimeWorldImg(
    $('.hero-backdrop img, .backdrop img, .hero-bg img').first().attr('data-src') ||
      $('.hero-backdrop img, .backdrop img, .hero-bg img').first().attr('src')
  );
  const banner = backdropAttr || (ogImg && ogImg !== poster ? ogImg : null);
  const description =
    $('#overview-text p, .description p, .hero-description').first().text().trim() || null;

  const heroBadges: string[] = [];
  $('.hero-badge, .entry-meta .year, .entry-meta span').each((_, el) => {
    const txt = $(el).text().trim();
    if (txt) heroBadges.push(txt);
  });
  const year = heroBadges.find((b) => /^\d{4}$/.test(b)) || null;
  const ratingText =
    $('[class*="rating"], [class*="vote"], [class*="score"], .tmdb-rating')
      .first()
      .text()
      .trim() || null;
  const ratingMatch = ratingText ? ratingText.match(/(\d+(?:\.\d+)?)/) : null;
  const rating = ratingMatch ? ratingMatch[1] : null;

  const languages: string[] = [];
  $('a.language-tag, a[href*="/category/hindi"], a[href*="/category/english"], a[href*="/category/japanese"], a[href*="/category/tamil"], a[href*="/category/telugu"]').each((_, el) => {
    const lang = $(el).text().trim();
    if (lang && !languages.includes(lang)) languages.push(lang);
  });

  const genres: string[] = [];
  $('a[href*="/genre/"], .genres a, .hero-genres a').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  return { title, poster, banner, description, heroBadges, year, rating, languages, genres };
}

async function tryProxyAnimeWorldPhpApi(
  endpointFile: string,
  req: Request,
  res: Response
): Promise<boolean> {
  if (!ANIMEWORLD_INDIA_API_URL) return false;
  let baseUrl: URL;
  try {
    baseUrl = new URL(ANIMEWORLD_INDIA_API_URL);
    if ((baseUrl.protocol !== 'https:' && baseUrl.protocol !== 'http:') || isBlockedPrivateHost(baseUrl.hostname)) {
      res.status(500).json({
        success: false,
        error: 'Configured ANIMEWORLD_INDIA_API_URL is invalid or points to a blocked private host.',
      });
      return true;
    }
  } catch {
    res.status(500).json({
      success: false,
      error: 'Configured ANIMEWORLD_INDIA_API_URL is malformed.',
    });
    return true;
  }

  try {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string' && v.length > 0) qs.set(k, v);
    }
    const baseStr = baseUrl.toString().replace(/\/+$/, '');
    const target = `${baseStr}/${endpointFile}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const upstreamRes = await fetchWithTimeout(
      target,
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
      },
      15000
    );
    const text = await upstreamRes.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      res.status(502).json({
        success: false,
        error: `Hosted PHP API (${endpointFile}) returned non-JSON response (HTTP ${upstreamRes.status}).`,
      });
      return true;
    }
    res.status(upstreamRes.status).json(parsed);
    return true;
  } catch (err) {
    res.status(502).json({
      success: false,
      error:
        err instanceof Error
          ? `Failed to reach hosted AnimeWorld India PHP API: ${err.message}`
          : 'Failed to reach hosted AnimeWorld India PHP API.',
    });
    return true;
  }
}

interface AwHtmlResult {
  ok: boolean;
  status: number;
  html: string;
  upstream?: string;
  blockedByUpstream?: boolean;
}

const AW_HTML_CACHE_MAX = 120;
const awHtmlCache = new Map<string, { expiresAt: number; value: AwHtmlResult }>();
const awHtmlInFlight = new Map<string, Promise<AwHtmlResult>>();

const AW_PARSED_CACHE_MAX = 120;
const awParsedCache = new Map<
  string,
  { freshUntil: number; staleUntil: number; payload: Record<string, unknown> }
>();

function readAwParsedCache(
  key: string,
  allowStale = false
): Record<string, unknown> | null {
  const entry = awParsedCache.get(key);
  if (!entry) return null;
  const now = Date.now();
  if (now <= entry.freshUntil || (allowStale && now <= entry.staleUntil)) {
    return entry.payload;
  }
  if (now > entry.staleUntil) {
    awParsedCache.delete(key);
  }
  return null;
}

function writeAwParsedCache(
  key: string,
  payload: Record<string, unknown>,
  freshTtlMs = 120_000,
  staleTtlMs = 20 * 60_000
): void {
  if (awParsedCache.has(key)) {
    awParsedCache.delete(key);
  } else if (awParsedCache.size >= AW_PARSED_CACHE_MAX) {
    const oldest = awParsedCache.keys().next().value;
    if (oldest !== undefined) awParsedCache.delete(oldest);
  }
  const now = Date.now();
  awParsedCache.set(key, {
    freshUntil: now + freshTtlMs,
    staleUntil: now + freshTtlMs + staleTtlMs,
    payload,
  });
}

function getAwHtmlCacheTtlMs(url: string): number {
  const lower = url.toLowerCase();
  if (lower.includes('/?s=') || lower.includes('/search')) return 30_000;
  if (lower.includes('/series/') || lower.includes('/movies/')) return 180_000;
  return 90_000;
}

const dohIpCache = new Map<string, { expiresAt: number; ips: string[] }>();

async function resolvePublicHostnameViaDoh(hostname: string): Promise<string[]> {
  if (isBlockedPrivateHost(hostname)) return [];
  const cached = dohIpCache.get(hostname);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.ips;
  }

  const resolvers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
    `https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`,
  ];

  for (const endpoint of resolvers) {
    try {
      const res = await fetchWithTimeout(
        endpoint,
        { headers: { Accept: 'application/dns-json' } },
        4000
      );
      if (!res.ok) continue;
      const json = (await res.json()) as {
        Answer?: Array<{ type?: number; data?: string }>;
      };
      const ips = (json.Answer || [])
        .filter((a) => a.type === 1 && typeof a.data === 'string' && net.isIP(a.data) === 4)
        .map((a) => a.data as string)
        .filter((ip) => !isBlockedPrivateIp(ip));
      if (ips.length > 0) {
        dohIpCache.set(hostname, { expiresAt: Date.now() + 5 * 60_000, ips });
        return ips;
      }
    } catch {
      // try next DoH resolver
    }
  }
  return [];
}

async function httpsGetWithDirectIp(
  targetUrl: string,
  resolvedIp: string,
  headers: Record<string, string>,
  timeoutMs = 12000
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  if (isBlockedPrivateIp(resolvedIp)) {
    throw new Error('Refused connection to private IP address.');
  }
  const u = new URL(targetUrl);
  if (isBlockedPrivateHost(u.hostname)) {
    throw new Error('Refused connection to private hostname.');
  }
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: resolvedIp,
        port: u.port ? Number(u.port) : 443,
        path: `${u.pathname}${u.search}`,
        method: 'GET',
        servername: u.hostname,
        rejectUnauthorized: true,
        headers: {
          ...headers,
          Host: u.host,
          'Accept-Encoding': 'gzip, deflate, br',
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding.includes('br')) {
          stream = res.pipe(zlib.createBrotliDecompress());
        } else if (encoding.includes('gzip')) {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding.includes('deflate')) {
          stream = res.pipe(zlib.createInflate());
        }
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          const outHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === 'string') outHeaders[k.toLowerCase()] = v;
            else if (Array.isArray(v)) outHeaders[k.toLowerCase()] = v.join(', ');
          }
          resolve({
            status: res.statusCode || 502,
            headers: outHeaders,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
        stream.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`HTTPS DoH request timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

function buildAnimeWorldRequestHeaders(url: string, upstreamBase: string, isAjax = false): Record<string, string> {
  const referer = `${upstreamBase.replace(/\/+$/, '')}/`;
  if (isAjax) {
    return {
      'User-Agent': BROWSER_UA,
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: referer,
      Origin: upstreamBase.replace(/\/+$/, ''),
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
  }
  return {
    'User-Agent': BROWSER_UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: referer,
    'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
  };
}

function detectUpstreamBlock(
  status: number,
  cfMitigatedHeader: string,
  serverHeader: string,
  rawBody: string
): boolean {
  const lowerBody = rawBody.slice(0, 4000).toLowerCase();
  const hasCfChallengeMarker =
    lowerBody.includes('just a moment...') ||
    lowerBody.includes('cf_chl_opt') ||
    lowerBody.includes('cf-browser-verification') ||
    lowerBody.includes('attention required! | cloudflare');
  return (
    (status === 403 || status === 503) &&
    (cfMitigatedHeader.includes('challenge') ||
      serverHeader.includes('cloudflare') ||
      hasCfChallengeMarker)
  );
}

async function fetchAnimeWorldHtml(
  url: string,
  options?: { upstreamBase?: string; isAjax?: boolean; method?: 'GET' | 'POST'; body?: string }
): Promise<AwHtmlResult> {
  const method = options?.method || 'GET';
  const cacheKey = method === 'GET' ? url : '';

  if (cacheKey) {
    const cached = awHtmlCache.get(cacheKey);
    if (cached) {
      if (Date.now() <= cached.expiresAt) {
        awHtmlCache.delete(cacheKey);
        awHtmlCache.set(cacheKey, cached);
        return cached.value;
      }
      awHtmlCache.delete(cacheKey);
    }

    const existing = awHtmlInFlight.get(cacheKey);
    if (existing) return existing;
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(url);
    if (!['http:', 'https:'].includes(parsedTarget.protocol) || isBlockedPrivateHost(parsedTarget.hostname)) {
      return { ok: false, status: 403, html: '' };
    }
  } catch {
    return { ok: false, status: 400, html: '' };
  }

  const upstreamBase = (options?.upstreamBase || parsedTarget.origin).replace(/\/+$/, '');
  const isAjax = Boolean(options?.isAjax || url.includes('/wp-admin/admin-ajax.php'));
  const headers = buildAnimeWorldRequestHeaders(url, upstreamBase, isAjax);
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
  }

  const runAttempt = async (): Promise<AwHtmlResult> => {
    const timeoutMs = 13000;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(
          url,
          {
            method,
            headers,
            ...(method === 'POST' && options?.body ? { body: options.body } : {}),
            redirect: 'follow',
          },
          timeoutMs
        );
        const cfMitigated = (res.headers.get('cf-mitigated') || '').toLowerCase();
        const serverHeader = (res.headers.get('server') || '').toLowerCase();
        const rawBody = await res.text().catch(() => '');
        const blockedByUpstream = detectUpstreamBlock(res.status, cfMitigated, serverHeader, rawBody);

        if (res.ok && rawBody && !blockedByUpstream) {
          const result: AwHtmlResult = {
            ok: true,
            status: res.status,
            html: rawBody,
            upstream: upstreamBase,
            blockedByUpstream: false,
          };
          if (cacheKey) {
            if (awHtmlCache.has(cacheKey)) {
              awHtmlCache.delete(cacheKey);
            } else if (awHtmlCache.size >= AW_HTML_CACHE_MAX) {
              const oldest = awHtmlCache.keys().next().value;
              if (oldest !== undefined) awHtmlCache.delete(oldest);
            }
            awHtmlCache.set(cacheKey, { expiresAt: Date.now() + getAwHtmlCacheTtlMs(url), value: result });
          }
          return result;
        }

        const shouldRetryStatus = res.status >= 500 || res.status === 429;
        if (attempt === 0 && shouldRetryStatus && !blockedByUpstream) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }

        console.warn(
          `[AnimeWorld Diagnostic] Upstream request failed: URL=${url}, Status=${res.status} ${res.statusText}${
            blockedByUpstream ? ' (Cloudflare challenge)' : ''
          }`
        );
        return {
          ok: false,
          status: res.status,
          html: '',
          upstream: upstreamBase,
          blockedByUpstream,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        // On DNS resolution failure (or transient TLS/socket failure on first attempt), try DoH direct IP on GET HTTPS
        if (method === 'GET' && parsedTarget.protocol === 'https:') {
          try {
            const dohIps = await resolvePublicHostnameViaDoh(parsedTarget.hostname);
            for (const ip of dohIps.slice(0, 2)) {
              try {
                const dohRes = await httpsGetWithDirectIp(url, ip, headers, 12000);
                const blocked = detectUpstreamBlock(
                  dohRes.status,
                  dohRes.headers['cf-mitigated'] || '',
                  dohRes.headers['server'] || '',
                  dohRes.body
                );
                if (dohRes.status >= 200 && dohRes.status < 300 && dohRes.body && !blocked) {
                  const result: AwHtmlResult = {
                    ok: true,
                    status: dohRes.status,
                    html: dohRes.body,
                    upstream: upstreamBase,
                    blockedByUpstream: false,
                  };
                  if (cacheKey) {
                    awHtmlCache.set(cacheKey, {
                      expiresAt: Date.now() + getAwHtmlCacheTtlMs(url),
                      value: result,
                    });
                  }
                  return result;
                }
              } catch {
                // try next DoH IP
              }
            }
          } catch {
            // ignore DoH errors
          }
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 350));
          continue;
        }
        console.error(`[AnimeWorld Diagnostic] Upstream fetch error: URL=${url}, Error=${errMsg}`);
        return { ok: false, status: 502, html: '', upstream: upstreamBase };
      }
    }
    return { ok: false, status: 502, html: '', upstream: upstreamBase };
  };

  if (!cacheKey) {
    return runAttempt();
  }

  const task = runAttempt().finally(() => {
    awHtmlInFlight.delete(cacheKey);
  });

  awHtmlInFlight.set(cacheKey, task);
  return task;
}

async function fetchAnimeWorldPathWithMirrors(
  buildUrl: (upstreamBase: string) => string,
  options?: {
    isAjax?: boolean;
    validateHtml?: (html: string) => boolean;
  }
): Promise<AwHtmlResult> {
  let lastResult: AwHtmlResult = {
    ok: false,
    status: 502,
    html: '',
    upstream: ANIMEWORLD_UPSTREAM,
  };

  for (const base of ANIMEWORLD_UPSTREAMS) {
    const url = buildUrl(base);
    const result = await fetchAnimeWorldHtml(url, {
      upstreamBase: base,
      isAjax: options?.isAjax,
    });
    if (result.ok && result.html) {
      if (!options?.validateHtml || options.validateHtml(result.html)) {
        return { ...result, upstream: base };
      }
    }
    lastResult = { ...result, upstream: base };
    // Never fall back past an authentic 404 only when trying same-slug search; for catalogs/pages/403/5xx try mirror!
    if (result.status === 404 && url.includes('/?s=')) {
      break;
    }
  }

  return lastResult;
}

function formatAnimeWorldUpstreamError(status: number, blockedByUpstream?: boolean, context = 'request'): string {
  if (status === 403 || blockedByUpstream) {
    return `AnimeWorld India upstream (${ANIMEWORLD_UPSTREAM}) returned HTTP 403 (server/datacenter IP blocked by upstream Cloudflare protection). Switch to Vidstreaming, Megacloud, or Streamsb for playback.`;
  }
  return `AnimeWorld India ${context} returned HTTP ${status || 502}`;
}

interface RavokResolvedDetails {
  languages: string[];
  hlsUrl: string | null;
  refererOrigin: string;
}

const ravokDetailsCache = new Map<string, { expiresAt: number; details: RavokResolvedDetails }>();

async function resolveRavokStreamDetails(
  ravokUrl: string,
  upstreamReferer = `${ANIMEWORLD_UPSTREAM}/`
): Promise<RavokResolvedDetails> {
  const cached = ravokDetailsCache.get(ravokUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.details;
  }

  let parsedRavok: URL;
  try {
    parsedRavok = new URL(ravokUrl);
    if (!['http:', 'https:'].includes(parsedRavok.protocol) || isBlockedPrivateHost(parsedRavok.hostname)) {
      return { languages: [], hlsUrl: null, refererOrigin: `${ANIMEWORLD_UPSTREAM}/` };
    }
  } catch {
    return { languages: [], hlsUrl: null, refererOrigin: `${ANIMEWORLD_UPSTREAM}/` };
  }

  const ravokOrigin = parsedRavok.origin;
  const codeMap: Record<string, string> = {
    hin: 'Hindi',
    eng: 'English',
    jpn: 'Japanese',
    tam: 'Tamil',
    tel: 'Telugu',
    ben: 'Bengali',
    mal: 'Malayalam',
    mar: 'Marathi',
    kan: 'Kannada',
    kor: 'Korean',
  };

  let languages: string[] = [];
  let hlsUrl: string | null = null;

  const videoIdMatch = parsedRavok.pathname.match(/\/video\/([a-zA-Z0-9_-]+)/i);
  const videoId = videoIdMatch ? videoIdMatch[1] : '';

  const [pageResult, apiResult] = await Promise.allSettled([
    fetchWithTimeout(
      ravokUrl,
      {
        headers: {
          Referer: upstreamReferer,
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,*/*',
        },
      },
      5500
    ).then(async (res) => (res.ok ? res.text() : '')),
    videoId
      ? fetchWithTimeout(
          `${ravokOrigin}/player/index.php?data=${encodeURIComponent(videoId)}&do=getVideo`,
          {
            method: 'POST',
            headers: {
              'User-Agent': BROWSER_UA,
              Referer: ravokUrl,
              Origin: ravokOrigin,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              Accept: 'application/json, text/javascript, */*; q=0.01',
            },
            body: `hash=${encodeURIComponent(videoId)}&r=${encodeURIComponent(upstreamReferer)}`,
          },
          6000
        ).then(async (res) => (res.ok ? res.text() : ''))
      : Promise.resolve(''),
  ]);

  if (pageResult.status === 'fulfilled' && pageResult.value) {
    const html = pageResult.value;
    const match = html.match(/var\s+defaultAudio\s*=\s*(\[[^\]]+\])/);
    if (match) {
      try {
        const codes = JSON.parse(match[1]) as string[];
        languages = codes
          .map((c) => codeMap[c.toLowerCase()])
          .filter((x): x is string => Boolean(x));
      } catch {
        // ignore JSON parse error
      }
    }
  }

  if (apiResult.status === 'fulfilled' && apiResult.value) {
    try {
      const json = JSON.parse(apiResult.value) as {
        hls?: boolean;
        videoSource?: string;
        securedLink?: string;
      };
      const candidate = (json.videoSource || json.securedLink || '').trim();
      if (isValidHttpUrl(candidate)) {
        const parsedCandidate = new URL(candidate);
        if (!isBlockedPrivateHost(parsedCandidate.hostname)) {
          hlsUrl = candidate;
        }
      }
    } catch {
      // ignore non-JSON getVideo response
    }
  }

  const details: RavokResolvedDetails = {
    languages,
    hlsUrl,
    refererOrigin: `${ravokOrigin}/`,
  };

  if (languages.length > 0 || hlsUrl) {
    ravokDetailsCache.set(ravokUrl, {
      expiresAt: Date.now() + 45_000,
      details,
    });
  }

  return details;
}

async function verifyRavokAudioLanguages(ravokUrl: string): Promise<string[]> {
  const details = await resolveRavokStreamDetails(ravokUrl);
  return details.languages;
}

function isValidHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function logProviderDiagnostic(
  provider: string,
  stage: string,
  meta: Record<string, unknown>
): void {
  const safeParts = Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  console.info(`[ProviderDiag] provider=${provider} stage=${stage} ${safeParts}`);
}

function formatMegavidUnavailableMessage(
  rawMessage: string | undefined,
  serverLabel: string,
  category: 'sub' | 'dub',
  episodeNumber: number
): string {
  const langLabel = category === 'dub' ? 'English (DUB)' : 'Japanese (SUB)';
  const altLangLabel = category === 'dub' ? 'Japanese (SUB)' : 'English (DUB)';
  const cleaned = (rawMessage || '').trim();
  const isGenericMissing =
    !cleaned ||
    /couldn't find this episode/i.test(cleaned) ||
    /may not exist/i.test(cleaned) ||
    /not found on provider/i.test(cleaned);

  if (isGenericMissing) {
    return `${langLabel} stream is not available on ${serverLabel} for Episode ${episodeNumber}. Try switching to another server or ${altLangLabel}.`;
  }
  return cleaned;
}

async function resolveFromMegavid(
  malId: number,
  episodeNumber: number,
  category: 'sub' | 'dub' | 'hindi',
  requestedServer: string
): Promise<{
  ok: boolean;
  statusCode?: number;
  message?: string;
  payload?: Record<string, unknown>;
}> {
  if (category === 'hindi') {
    return {
      ok: false,
      statusCode: 404,
      message: `Hindi (DUB) audio track is not available on ${requestedServer || 'this server'}. Only Japanese (SUB) and English (DUB) streams exist here; switch to AnimeWorld-India for verified Hindi dubbed audio.`,
    };
  }

  const catToUse: 'sub' | 'dub' = category === 'dub' ? 'dub' : 'sub';
  const refererUrl = `https://megavid.buzz/mal/${malId}/${episodeNumber}/${catToUse}`;
  const baseSourceUrl = `${refererUrl}/source`;

  // Map each server cleanly to its primary query & verified fallback queries on megavid.buzz
  const serverLower = (requestedServer || 'vidstreaming').toLowerCase();
  const displayServer =
    serverLower === 'streamsb'
      ? 'Streamsb'
      : serverLower.includes('animepahe')
        ? 'AnimePahe'
        : serverLower === 'megacloud'
          ? 'Megacloud'
          : serverLower.includes('aniwatch')
            ? 'AniWatchtv'
            : serverLower.includes('kaido')
              ? 'Kaido'
              : serverLower.includes('hianime') || serverLower.includes('zoro')
                ? 'HiAnime'
                : 'Vidstreaming';

  const primaryCandidates: Array<{ qs: string; label: string }> =
    serverLower === 'streamsb' || serverLower.includes('animepahe')
      ? [
          { qs: 'axsv=sora', label: displayServer },
          { qs: 'noax=1', label: `${displayServer} · HLS` },
          { qs: 'axsv=loli', label: `${displayServer} · Mirror` },
        ]
      : serverLower === 'megacloud' || serverLower.includes('aniwatch')
        ? [
            { qs: 'axsv=nero', label: displayServer },
            { qs: 'noax=1', label: `${displayServer} · HLS` },
            { qs: 'axsv=loli', label: `${displayServer} · Mirror` },
          ]
        : serverLower.includes('kaido')
          ? [
              { qs: 'axsv=zuna', label: displayServer },
              { qs: 'noax=1', label: `${displayServer} · HLS` },
              { qs: 'axsv=loli', label: `${displayServer} · Mirror` },
            ]
          : serverLower.includes('hianime') || serverLower.includes('zoro')
            ? [
                { qs: 'noax=1', label: `${displayServer} · HLS` },
                { qs: 'axsv=yuki', label: displayServer },
                { qs: 'axsv=loli', label: `${displayServer} · Mirror` },
              ]
            : [
                { qs: 'noax=1', label: displayServer },
                { qs: 'axsv=loli', label: `${displayServer} · HLS` },
                { qs: 'axsv=yuki', label: `${displayServer} · Mirror` },
              ];

  const fallbackPool: Array<{ qs: string; label: string }> = [
    { qs: 'noax=1', label: `${displayServer} · HLS` },
    { qs: 'axsv=loli', label: `${displayServer} · Mirror` },
    { qs: 'axsv=nero', label: `${displayServer} · Alt` },
    { qs: 'axsv=sora', label: `${displayServer} · Alt 2` },
  ];

  const seenQs = new Set<string>();
  const candidateQueries: Array<{ qs: string; label: string }> = [];
  for (const item of [...primaryCandidates, ...fallbackPool]) {
    if (!seenQs.has(item.qs)) {
      seenQs.add(item.qs);
      candidateQueries.push(item);
    }
  }

  let lastMessage = formatMegavidUnavailableMessage(undefined, displayServer, catToUse, episodeNumber);
  let lastStatus = 404;

  for (const candidate of candidateQueries) {
    const started = Date.now();
    try {
      const targetUrl = `${baseSourceUrl}?${candidate.qs}`;
      const res = await fetchWithTimeout(
        targetUrl,
        {
          headers: {
            Referer: refererUrl,
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
          },
        },
        4000
      );

      if (!res.ok) {
        lastStatus = res.status;
        lastMessage = `${displayServer} upstream returned HTTP ${res.status}.`;
        logProviderDiagnostic('megavid', 'source', {
          server: requestedServer,
          candidate: candidate.qs,
          status: res.status,
          latencyMs: Date.now() - started,
          working: false,
        });
        continue;
      }

      const data = (await res.json()) as {
        status?: string;
        code?: number;
        message?: string;
        source?: string;
        type?: string;
        tracks?: Array<{ file?: string; label?: string; kind?: string; default?: boolean }>;
        chapters?: Array<{ title?: string; start?: number; end?: number }>;
      };

      if (data.status !== 'ok' || !data.source) {
        lastStatus = typeof data.code === 'number' ? data.code : 404;
        lastMessage = formatMegavidUnavailableMessage(
          data.message,
          displayServer,
          catToUse,
          episodeNumber
        );
        logProviderDiagnostic('megavid', 'source', {
          server: requestedServer,
          candidate: candidate.qs,
          status: lastStatus,
          apiStatus: data.status || 'missing',
          latencyMs: Date.now() - started,
          working: false,
        });
        continue;
      }

      const cleanSourceUrl = normalizeUrl(data.source);
      if (!isValidHttpUrl(cleanSourceUrl)) {
        lastStatus = 502;
        lastMessage = `${displayServer} returned a malformed stream URL.`;
        continue;
      }

      const verifiedPlaylist = await fetchVerifiedStreamPlaylist(
        cleanSourceUrl,
        'https://megavid.buzz/',
        3000
      );
      const isReachable = verifiedPlaylist.reachable;
      let sourceHost = '';
      try {
        sourceHost = new URL(cleanSourceUrl).hostname;
      } catch {
        // ignore
      }
      logProviderDiagnostic('megavid', 'playlist-verify', {
        server: requestedServer,
        candidate: candidate.qs,
        host: sourceHost,
        reachable: isReachable,
        detectedType: verifiedPlaylist.detectedType,
        latencyMs: Date.now() - started,
        working: isReachable,
      });
      if (!isReachable) {
        lastStatus = 502;
        lastMessage = `Stream CDN host (${sourceHost || 'unknown'}) on ${displayServer} is unreachable. Try another server or retry.`;
        continue;
      }

      const detectedType =
        data.type === 'mp4' || verifiedPlaylist.detectedType === 'mp4' ? 'mp4' : 'hls';
      const sources: ResolvedSource[] = [
        {
          url: cleanSourceUrl,
          quality:
            detectedType === 'mp4'
              ? `${candidate.label} · MP4`
              : `${candidate.label} · Auto HLS`,
          isM3U8: detectedType === 'hls',
          type: detectedType,
        },
      ];

      // Parse variant qualities from already-fetched master playlist
      if (verifiedPlaylist.playlistText) {
        const lines = verifiedPlaylist.playlistText.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('#EXT-X-STREAM-INF:')) {
            const resMatch = line.match(/RESOLUTION=\d+x(\d+)/i);
            const nextLine = (lines[i + 1] || '').trim();
            if (nextLine && !nextLine.startsWith('#')) {
              try {
                const variantUrl = new URL(nextLine, cleanSourceUrl).toString();
                sources.push({
                  url: variantUrl,
                  quality: resMatch ? `${resMatch[1]}p` : 'HD',
                  isM3U8: true,
                  type: 'hls',
                });
              } catch {
                // ignore invalid variant line
              }
            }
          }
        }
      }

      const subtitles: ResolvedSubtitle[] = (data.tracks || [])
        .filter((t) => {
          if (typeof t.file !== 'string' || !t.file.trim()) return false;
          const kind = (t.kind || '').toLowerCase();
          const fileLower = t.file.toLowerCase();
          if (kind === 'thumbnails' || fileLower.includes('thumbnails.vtt')) return false;
          return true;
        })
        .map((t) => {
          const trackUrl = normalizeUrl(t.file!);
          const label = t.label?.trim() || 'Subtitles';
          const needsProxy =
            trackUrl.includes('megavid.buzz/sub/') ||
            trackUrl.toLowerCase().endsWith('.srt') ||
            !trackUrl.includes('cp.megavid.buzz');
          return {
            url: needsProxy
              ? `/api/anime/proxy?url=${encodeURIComponent(trackUrl)}&referer=${encodeURIComponent(
                  'https://megavid.buzz/'
                )}`
              : trackUrl,
            lang: label,
            label,
          };
        });

      const introChapter = (data.chapters || []).find((c) =>
        c.title?.toLowerCase().includes('intro')
      );
      const outroChapter = (data.chapters || []).find((c) =>
        c.title?.toLowerCase().includes('outro')
      );

      return {
        ok: true,
        payload: {
          sources,
          subtitles,
          servers: SUB_DUB_STREAM_SERVERS,
          headers: { Referer: 'https://megavid.buzz/' },
          hasHindiAudio: false,
          audioLanguages: [catToUse === 'dub' ? 'English' : 'Japanese'],
          requestedLanguage: catToUse,
          intro:
            typeof introChapter?.start === 'number' && typeof introChapter?.end === 'number'
              ? { start: introChapter.start, end: introChapter.end }
              : undefined,
          outro:
            typeof outroChapter?.start === 'number' && typeof outroChapter?.end === 'number'
              ? { start: outroChapter.start, end: outroChapter.end }
              : undefined,
          providerMeta: {
            source: 'megavid',
            activeServer: requestedServer || 'vidstreaming',
            resolvedCandidate: candidate.qs,
            resolvedHost: sourceHost,
            category: catToUse,
          },
        },
      };
    } catch (err) {
      lastMessage =
        err instanceof Error && err.name === 'AbortError'
          ? `${displayServer} request timed out. Try switching servers or retry.`
          : err instanceof Error
            ? err.message
            : 'Failed to reach streaming resolver.';
    }
  }

  return {
    ok: false,
    statusCode: lastStatus,
    message: lastMessage,
  };
}

function resolveSafeConsumetBase(rawOverride?: unknown): {
  ok: true;
  url: string;
} | {
  ok: false;
  message: string;
} {
  const candidate =
    typeof rawOverride === 'string' && rawOverride.trim()
      ? rawOverride.trim().replace(/\/+$/, '')
      : DEFAULT_MUNCHYROLL_CONSUMET_API;

  if (!candidate) {
    return {
      ok: false,
      message: 'Munchyroll Consumet API URL is not configured (set CONSUMET_API_URL).',
    };
  }
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedPrivateHost(parsed.hostname)) {
      return {
        ok: false,
        message: 'Invalid or blocked Munchyroll Consumet API base URL.',
      };
    }
    return { ok: true, url: candidate };
  } catch {
    return {
      ok: false,
      message: 'Malformed Munchyroll Consumet API base URL.',
    };
  }
}

function formatConsumetHttpError(base: string, status: number, bodyText: string, endpointUrl: string): string {
  const vercelErr = bodyText.includes('DEPLOYMENT_DISABLED') ? 'DEPLOYMENT_DISABLED' : '';
  if (status === 402 || vercelErr === 'DEPLOYMENT_DISABLED') {
    return `Munchyroll Consumet backend (${base}) returned HTTP 402 (DEPLOYMENT_DISABLED). Configure CONSUMET_API_URL with a live Consumet API backend to use Munchyroll.`;
  }
  if (status === 451) {
    return `Munchyroll Consumet backend (${base}) returned HTTP 451 (Unavailable For Legal Reasons).`;
  }
  return `Munchyroll Consumet backend returned HTTP ${status} from ${endpointUrl}${
    bodyText ? `: ${bodyText.slice(0, 140)}` : ''
  }`;
}

interface ConsumetEpisodeEntry {
  id: string;
  number: number;
  title?: string;
  isFiller?: boolean;
  isDubbed?: boolean;
}

async function fetchMunchyrollConsumetEpisodes(options: {
  consumetBase: string;
  anilistId: number;
  category: 'sub' | 'dub';
}): Promise<{
  ok: boolean;
  statusCode: number;
  endpointUrl: string;
  episodes: ConsumetEpisodeEntry[];
  providerUsed: 'zoro' | 'default';
  message?: string;
}> {
  const { consumetBase, anilistId, category } = options;
  const dubQuery = category === 'dub' ? '&dub=true' : '';
  const zoroUrl = `${consumetBase}/meta/anilist/episodes/${encodeURIComponent(
    String(anilistId)
  )}?provider=zoro${dubQuery}`;
  const defaultUrl = `${consumetBase}/meta/anilist/episodes/${encodeURIComponent(String(anilistId))}${
    category === 'dub' ? '?dub=true' : ''
  }`;
  const dataFallbackUrl = `${consumetBase}/meta/anilist/data/${encodeURIComponent(
    String(anilistId)
  )}?provider=zoro${dubQuery}`;

  const tryFetchEpisodes = async (url: string): Promise<{
    ok: boolean;
    status: number;
    episodes: ConsumetEpisodeEntry[];
    errorMsg?: string;
  }> => {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
      },
      7500
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        ok: false,
        status: res.status,
        episodes: [],
        errorMsg: formatConsumetHttpError(consumetBase, res.status, text, url),
      };
    }
    const json = (await res.json()) as unknown;
    const rawList = Array.isArray(json)
      ? json
      : json && typeof json === 'object' && Array.isArray((json as { episodes?: unknown }).episodes)
        ? ((json as { episodes: unknown[] }).episodes)
        : [];
    const parsed: ConsumetEpisodeEntry[] = rawList
      .map((item): ConsumetEpisodeEntry | null => {
        if (!item || typeof item !== 'object') return null;
        const ep = item as Record<string, unknown>;
        const id = typeof ep.id === 'string' ? ep.id.trim() : '';
        if (!id) return null;
        const number = typeof ep.number === 'number' ? ep.number : Number(ep.number || 0);
        if (!Number.isFinite(number) || number <= 0) return null;
        return {
          id,
          number,
          title: typeof ep.title === 'string' ? ep.title : undefined,
          isFiller: Boolean(ep.isFiller),
          isDubbed: typeof ep.isDubbed === 'boolean' ? ep.isDubbed : undefined,
        };
      })
      .filter((x): x is ConsumetEpisodeEntry => Boolean(x));

    return { ok: true, status: res.status, episodes: parsed };
  };

  try {
    // 1. Primary Munchyroll call: /meta/anilist/episodes/${id}?provider=zoro
    const first = await tryFetchEpisodes(zoroUrl);
    if (first.ok && first.episodes.length > 0) {
      return {
        ok: true,
        statusCode: 200,
        endpointUrl: zoroUrl,
        episodes: first.episodes,
        providerUsed: 'zoro',
      };
    }

    // 2. If Consumet returned empty for ?provider=zoro, Munchyroll falls back to /meta/anilist/episodes/${id}
    if (first.ok && first.episodes.length === 0) {
      const second = await tryFetchEpisodes(defaultUrl);
      if (second.ok && second.episodes.length > 0) {
        return {
          ok: true,
          statusCode: 200,
          endpointUrl: defaultUrl,
          episodes: second.episodes,
          providerUsed: 'default',
        };
      }
      const third = await tryFetchEpisodes(dataFallbackUrl);
      if (third.ok && third.episodes.length > 0) {
        return {
          ok: true,
          statusCode: 200,
          endpointUrl: dataFallbackUrl,
          episodes: third.episodes,
          providerUsed: 'zoro',
        };
      }
      return {
        ok: false,
        statusCode: third.ok ? 404 : third.status,
        endpointUrl: defaultUrl,
        episodes: [],
        providerUsed: 'default',
        message:
          third.errorMsg ||
          `Munchyroll Consumet returned no ${category === 'dub' ? 'English (DUB)' : 'Japanese (SUB)'} episodes for AniList ID ${anilistId}.`,
      };
    }

    return {
      ok: false,
      statusCode: first.status || 502,
      endpointUrl: zoroUrl,
      episodes: [],
      providerUsed: 'zoro',
      message: first.errorMsg || 'Munchyroll Consumet episode lookup failed.',
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: err instanceof Error && err.name === 'AbortError' ? 504 : 502,
      endpointUrl: zoroUrl,
      episodes: [],
      providerUsed: 'zoro',
      message:
        err instanceof Error
          ? `Munchyroll Consumet request failed: ${err.message}`
          : 'Unable to reach Munchyroll Consumet API backend.',
    };
  }
}

async function resolveFromMunchyroll(options: {
  consumetBase: string;
  anilistId: number;
  malId?: number;
  episodeId: string;
  episodeNumber: number;
  category: 'sub' | 'dub' | 'hindi';
}): Promise<{
  ok: boolean;
  statusCode: number;
  endpointUrl: string;
  message?: string;
  payload?: Record<string, unknown>;
}> {
  const { consumetBase, anilistId, malId, episodeId, episodeNumber, category } = options;

  if (category === 'hindi') {
    return {
      ok: false,
      statusCode: 404,
      endpointUrl: `${consumetBase}/meta/anilist/watch`,
      message:
        'Hindi (DUB) audio track is not available on Munchyroll. Munchyroll serves Japanese (SUB) and English (DUB) streams via Consumet (Zoro / Gogoanime); switch to AnimeWorld-India for Hindi DUB.',
    };
  }

  let consumetEpisodeId = '';
  let resolvedEndpointUrl = '';

  // Use incoming ID directly only if it is already a Consumet Zoro ID (contains "$") or Gogoanime slug
  const trimmedIncoming = (episodeId || '').trim();
  const isNativeConsumetZoroId =
    trimmedIncoming.includes('$episode$') &&
    (category === 'sub' ? !trimmedIncoming.includes('$dub') : trimmedIncoming.includes('$dub') || trimmedIncoming.includes('$both'));

  if (isNativeConsumetZoroId) {
    consumetEpisodeId = trimmedIncoming;
  } else if (anilistId > 0) {
    const epLookup = await fetchMunchyrollConsumetEpisodes({
      consumetBase,
      anilistId,
      category,
    });
    resolvedEndpointUrl = epLookup.endpointUrl;
    if (!epLookup.ok) {
      return {
        ok: false,
        statusCode: epLookup.statusCode,
        endpointUrl: epLookup.endpointUrl,
        message: epLookup.message || 'Munchyroll Consumet episode lookup failed.',
      };
    }

    const matchedEp =
      epLookup.episodes.find((ep) => ep.number === episodeNumber) ||
      (epLookup.episodes.length === 1 && episodeNumber === 1 ? epLookup.episodes[0] : undefined);

    if (!matchedEp) {
      return {
        ok: false,
        statusCode: 404,
        endpointUrl: epLookup.endpointUrl,
        message: `Episode ${episodeNumber} (${category === 'dub' ? 'English DUB' : 'Japanese SUB'}) was not found on Munchyroll Consumet.`,
      };
    }
    if (category === 'dub' && matchedEp.isDubbed === false) {
      return {
        ok: false,
        statusCode: 404,
        endpointUrl: epLookup.endpointUrl,
        message: `English (DUB) audio is not available for Episode ${episodeNumber} on Munchyroll.`,
      };
    }
    consumetEpisodeId = matchedEp.id;
  } else {
    return {
      ok: false,
      statusCode: 400,
      endpointUrl: `${consumetBase}/meta/anilist/watch`,
      message: 'Missing AniList ID for Munchyroll Consumet episode resolution.',
    };
  }

  // Exact Munchyroll provider switch from VideoPlayer.jsx: "$" -> zoro, else gogoanime
  const watchProvider: 'zoro' | 'gogoanime' = consumetEpisodeId.includes('$') ? 'zoro' : 'gogoanime';
  const watchUrl = `${consumetBase}/meta/anilist/watch/${encodeURIComponent(
    consumetEpisodeId
  )}?provider=${watchProvider}`;
  resolvedEndpointUrl = watchUrl;

  try {
    const watchRes = await fetchWithTimeout(
      watchUrl,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
      },
      9000
    );

    if (!watchRes.ok) {
      const bodyText = await watchRes.text().catch(() => '');
      return {
        ok: false,
        statusCode: watchRes.status,
        endpointUrl: watchUrl,
        message: formatConsumetHttpError(consumetBase, watchRes.status, bodyText, watchUrl),
      };
    }

    const data = (await watchRes.json()) as {
      headers?: Record<string, string>;
      sources?: Array<{ url?: string; quality?: string; isM3U8?: boolean }>;
      subtitles?: Array<{ url?: string; lang?: string }>;
      intro?: { start?: number; end?: number };
      outro?: { start?: number; end?: number };
      download?: string;
    };

    const rawSources = Array.isArray(data.sources) ? data.sources : [];
    const parsedSources: ResolvedSource[] = [];
    for (const src of rawSources) {
      if (!src || typeof src.url !== 'string') continue;
      const cleanUrl = normalizeUrl(src.url);
      if (!isValidHttpUrl(cleanUrl)) continue;
      const isM3U8 = Boolean(src.isM3U8 ?? cleanUrl.toLowerCase().includes('.m3u8'));
      const quality =
        typeof src.quality === 'string' && src.quality.trim()
          ? src.quality.trim()
          : isM3U8
            ? 'Auto HLS'
            : 'Default';
      parsedSources.push({
        url: MUNCHYROLL_CORS_PROXY_URL
          ? `${MUNCHYROLL_CORS_PROXY_URL}/${cleanUrl}`
          : cleanUrl,
        quality,
        isM3U8,
        type: isM3U8 ? 'hls' : /\.(mp4|webm|mkv)(\?|$)/i.test(cleanUrl) ? 'mp4' : 'hls',
      });
    }

    if (parsedSources.length === 0) {
      return {
        ok: false,
        statusCode: 404,
        endpointUrl: watchUrl,
        message: 'Munchyroll Consumet API returned no playable video sources for this episode.',
      };
    }

    // Mirror Munchyroll VideoPlayer.jsx default selection: put "default" or "auto" first while preserving all qualities
    parsedSources.sort((a, b) => {
      const score = (q: string) => {
        const lower = q.toLowerCase();
        if (lower === 'default' || lower === 'auto' || lower === 'auto hls') return 0;
        if (lower.includes('1080')) return 1;
        if (lower.includes('720')) return 2;
        if (lower.includes('480')) return 3;
        return 4;
      };
      return score(a.quality) - score(b.quality);
    });

    const upstreamReferer =
      data.headers && typeof data.headers === 'object'
        ? data.headers.Referer || data.headers.referer || ''
        : '';
    const proxyRefererParam = upstreamReferer.startsWith('http') ? upstreamReferer : 'none';

    const rawSubtitles = Array.isArray(data.subtitles) ? data.subtitles : [];
    const parsedSubtitles: ResolvedSubtitle[] = rawSubtitles
      .filter((t) => {
        if (!t || typeof t.url !== 'string' || !t.url.trim()) return false;
        const langLower = (t.lang || '').trim().toLowerCase();
        if (langLower === 'thumbnails' || t.url.toLowerCase().includes('thumbnails.vtt')) {
          return false;
        }
        return true;
      })
      .map((t) => {
        const cleanSubUrl = normalizeUrl(t.url!);
        const lang = (t.lang || 'Subtitles').trim();
        return {
          url: `/api/anime/proxy?url=${encodeURIComponent(cleanSubUrl)}&referer=${encodeURIComponent(
            proxyRefererParam
          )}`,
          lang,
          label: lang,
        };
      })
      .sort((a, b) => {
        const aEn = a.lang.toLowerCase().includes('english') ? 0 : 1;
        const bEn = b.lang.toLowerCase().includes('english') ? 0 : 1;
        return aEn - bEn;
      });

    let downloadUrl = typeof data.download === 'string' && isValidHttpUrl(data.download)
      ? data.download
      : undefined;

    if (!downloadUrl && watchProvider === 'gogoanime') {
      try {
        const gogoExtRes = await fetchWithTimeout(
          `${consumetBase}/anime/gogoanime/watch/${encodeURIComponent(consumetEpisodeId)}?server=gogocdn`,
          { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
          4000
        );
        if (gogoExtRes.ok) {
          const gogoJson = (await gogoExtRes.json()) as { download?: string };
          if (typeof gogoJson.download === 'string' && isValidHttpUrl(gogoJson.download)) {
            downloadUrl = gogoJson.download;
          }
        }
      } catch {
        // optional download link lookup non-fatal
      }
    }

    type SkipIntervalEntry = { start: number; end: number; type?: string; source?: string };
    let intro: SkipIntervalEntry | undefined =
      data.intro &&
      typeof data.intro.start === 'number' &&
      typeof data.intro.end === 'number' &&
      data.intro.end > data.intro.start
        ? { start: data.intro.start, end: data.intro.end, type: 'op', source: 'provider' }
        : undefined;
    let outro: SkipIntervalEntry | undefined =
      data.outro &&
      typeof data.outro.start === 'number' &&
      typeof data.outro.end === 'number' &&
      data.outro.end > data.outro.start
        ? { start: data.outro.start, end: data.outro.end, type: 'ed', source: 'provider' }
        : undefined;
    let recap: SkipIntervalEntry | undefined;

    if ((!intro || !outro) && malId && malId > 0) {
      const aniSkip = await fetchAniSkipTimestamps(malId, episodeNumber);
      if (!intro && aniSkip.intro) intro = aniSkip.intro;
      if (!outro && aniSkip.outro) outro = aniSkip.outro;
      if (aniSkip.recap) recap = aniSkip.recap;
    }

    logProviderDiagnostic('munchyroll', 'watch', {
      provider: watchProvider,
      consumetBase,
      episodeId: consumetEpisodeId,
      sourcesCount: parsedSources.length,
      subtitlesCount: parsedSubtitles.length,
      working: true,
    });

    return {
      ok: true,
      statusCode: 200,
      endpointUrl: watchUrl,
      payload: {
        source: 'munchyroll',
        sources: parsedSources,
        subtitles: parsedSubtitles,
        servers: SUB_DUB_STREAM_SERVERS,
        headers: upstreamReferer ? { Referer: upstreamReferer } : undefined,
        download: downloadUrl,
        intro,
        outro,
        recap,
        hasHindiAudio: false,
        audioLanguages: [category === 'dub' ? 'English' : 'Japanese'],
        requestedLanguage: category,
        providerMeta: {
          source: 'munchyroll',
          activeServer: 'munchyroll',
          consumetProvider: watchProvider,
          consumetBase,
          consumetEpisodeId,
        },
      },
    };
  } catch (err) {
    return {
      ok: false,
      statusCode: err instanceof Error && err.name === 'AbortError' ? 504 : 502,
      endpointUrl: resolvedEndpointUrl || watchUrl,
      message:
        err instanceof Error
          ? `Munchyroll Consumet watch request failed: ${err.message}`
          : 'Unable to reach Munchyroll Consumet watch endpoint.',
    };
  }
}

async function checkMegavidAudioAvailability(
  malId: number,
  episodeNumber: number,
  category: 'sub' | 'dub'
): Promise<{ available: boolean; verified: boolean; reason?: string }> {
  const refererUrl = `https://megavid.buzz/mal/${malId}/${episodeNumber}/${category}`;
  for (const qs of ['noax=1', 'axsv=loli']) {
    try {
      const res = await fetchWithTimeout(
        `${refererUrl}/source?${qs}`,
        {
          headers: {
            Referer: refererUrl,
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
          },
        },
        3500
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { status?: string; source?: string; message?: string };
      if (data.status === 'ok' && isValidHttpUrl(data.source)) {
        const cleanUrl = normalizeUrl(data.source);
        const reachable = await verifyStreamPlaylistReachable(cleanUrl, 'https://megavid.buzz/', 2500);
        if (reachable) {
          return { available: true, verified: true };
        }
      } else if (data.message) {
        return {
          available: false,
          verified: true,
          reason:
            category === 'dub'
              ? 'English (DUB) stream is not available for this episode.'
              : data.message,
        };
      }
    } catch {
      // try next candidate
    }
  }
  return {
    available: false,
    verified: true,
    reason:
      category === 'dub'
        ? 'English (DUB) stream was not found for this episode.'
        : 'Japanese (SUB) stream was not found for this episode.',
  };
}

async function probeAnimeWorldHindiAvailability(options: {
  title?: string;
  romajiTitle?: string;
  format?: string;
  episodeNumber: number;
}): Promise<{
  available: boolean;
  verified: boolean;
  blockedByCloudflare?: boolean;
  languages?: string[];
  reason?: string;
}> {
  const queryTitle = (options.title || options.romajiTitle || '').trim();
  if (!queryTitle) {
    return { available: false, verified: false, reason: 'Missing anime title for Hindi lookup.' };
  }

  const cleanedQuery = queryTitle
    .replace(/:\s*(the\s+)?final\s+season.*$/i, '')
    .replace(/\s*[-–:]\s*season\s*\d+.*$/i, '')
    .replace(/\s+\d+(?:st|nd|rd|th)\s+season.*$/i, '')
    .replace(/^crayon\s+shin[\s-]*chan$/i, 'Shinchan')
    .trim();

  const searchRes = await fetchAnimeWorldHtml(
    `${ANIMEWORLD_UPSTREAM}/?s=${encodeURIComponent(cleanedQuery || queryTitle)}`
  );
  if (!searchRes.ok || !searchRes.html) {
    if (searchRes.status === 403 || searchRes.blockedByUpstream) {
      return {
        available: false,
        verified: false,
        blockedByCloudflare: true,
        reason: `AnimeWorld India (${ANIMEWORLD_UPSTREAM}) returned HTTP 403 Cloudflare protection on server IP.`,
      };
    }
    return {
      available: false,
      verified: false,
      reason: `AnimeWorld India search returned HTTP ${searchRes.status || 502}.`,
    };
  }

  const $ = cheerio.load(searchRes.html);
  const cards = parseAnimeWorldCards($);
  if (cards.length === 0) {
    return {
      available: false,
      verified: true,
      reason: `"${queryTitle}" was not found on AnimeWorld India.`,
    };
  }

  const isMovie = (options.format || '').toUpperCase() === 'MOVIE';
  if (!isMovie && cards.length >= 10 && !cards.some((c) => Boolean(c.seriesId))) {
    const page2Res = await fetchAnimeWorldHtml(
      `${ANIMEWORLD_UPSTREAM}/page/2/?s=${encodeURIComponent(cleanedQuery || queryTitle)}`
    );
    if (page2Res.ok && page2Res.html) {
      const $2 = cheerio.load(page2Res.html);
      cards.push(...parseAnimeWorldCards($2));
    }
  }
  const targetNorm = (cleanedQuery || queryTitle).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  let best = cards[0];
  let bestScore = -1;
  for (const c of cards) {
    const titleNorm = String(c.title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
    let score = 0;
    if (titleNorm === targetNorm) score += 100;
    else if (titleNorm.includes(targetNorm) || targetNorm.includes(titleNorm)) score += 60;
    if (isMovie && c.movieId) score += 20;
    if (!isMovie && c.seriesId) score += 20;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  let targetEpisodeUrl = '';
  if (best.movieId && (isMovie || !best.seriesId)) {
    targetEpisodeUrl = `${ANIMEWORLD_UPSTREAM}/movies/${encodeURIComponent(String(best.movieId))}/`;
  } else if (best.seriesId) {
    const seriesRes = await fetchAnimeWorldHtml(
      `${ANIMEWORLD_UPSTREAM}/series/${encodeURIComponent(String(best.seriesId))}/`
    );
    if (!seriesRes.ok || !seriesRes.html) {
      return {
        available: false,
        verified: false,
        blockedByCloudflare: seriesRes.status === 403 || seriesRes.blockedByUpstream,
        reason: `AnimeWorld India series lookup returned HTTP ${seriesRes.status}.`,
      };
    }
    const $s = cheerio.load(seriesRes.html);
    let epSlug = '';
    $s('article.tr-episode-card').each((_, el) => {
      if (epSlug) return;
      const card = $s(el);
      const href = card.find('a.tr-episode-link').first().attr('href') || '';
      const numText = card.find('.tr-episode-number').first().text().trim();
      const numMatch = numText.match(/(\d+)/);
      const num = numMatch ? Number(numMatch[1]) : null;
      if (num === options.episodeNumber) {
        epSlug = extractSlugFromHref(href, 'episode') || '';
      }
    });
    if (!epSlug) {
      const firstHref = $s('article.tr-episode-card a.tr-episode-link').first().attr('href') || '';
      if (options.episodeNumber === 1) {
        epSlug = extractSlugFromHref(firstHref, 'episode') || '';
      }
    }
    if (!epSlug) {
      return {
        available: false,
        verified: true,
        reason: `Episode ${options.episodeNumber} was not found on AnimeWorld India.`,
      };
    }
    targetEpisodeUrl = `${ANIMEWORLD_UPSTREAM}/episode/${encodeURIComponent(epSlug)}/`;
  }

  if (!targetEpisodeUrl) {
    return { available: false, verified: true, reason: 'No matching AnimeWorld India entry found.' };
  }

  const epRes = await fetchAnimeWorldHtml(targetEpisodeUrl);
  if (!epRes.ok || !epRes.html) {
    return {
      available: false,
      verified: false,
      blockedByCloudflare: epRes.status === 403 || epRes.blockedByUpstream,
      reason: `AnimeWorld India episode returned HTTP ${epRes.status}.`,
    };
  }

  const $e = cheerio.load(epRes.html);
  const iframeSrcs: string[] = [];
  $e('#aa-options iframe, .video-player iframe, .video-embed iframe').each((_, el) => {
    const s = ($e(el).attr('src') || $e(el).attr('data-src') || '').trim();
    if (s && s.startsWith('http') && !iframeSrcs.includes(s)) iframeSrcs.push(s);
  });

  const detectedLangs: string[] = [];
  let hasHindi = false;

  for (const src of iframeSrcs) {
    if (src.includes('multi-lang-plyr.php') && src.includes('data=')) {
      try {
        const rawData = new URL(src).searchParams.get('data');
        if (rawData) {
          const entries = JSON.parse(Buffer.from(rawData, 'base64').toString('utf8')) as Array<{
            language?: string;
            link?: string;
          }>;
          for (const entry of entries) {
            const lang = (entry.language || '').trim();
            if (!lang || !entry.link) continue;
            if (!detectedLangs.includes(lang)) detectedLangs.push(lang);
            if (lang.toLowerCase() === 'hindi' || lang.toLowerCase() === 'hin') hasHindi = true;
          }
        }
      } catch {
        // ignore malformed payload
      }
    } else if (src.includes('ravok.buzz')) {
      const ravokLangs = await verifyRavokAudioLanguages(src);
      for (const l of ravokLangs) {
        if (!detectedLangs.includes(l)) detectedLangs.push(l);
        if (l.toLowerCase() === 'hindi') hasHindi = true;
      }
    }
  }

  return hasHindi
    ? { available: true, verified: true, languages: detectedLangs }
    : {
        available: false,
        verified: true,
        languages: detectedLangs,
        reason:
          detectedLangs.length > 0
            ? `No Hindi audio stream found on AnimeWorld India (only ${detectedLangs.join(', ')} available).`
            : 'No verified Hindi audio stream found for this episode.',
      };
}

export function createExpressApp() {
  const app = express();
  const rawJsonParser = express.json({ limit: '8mb' });

  // Handle pre-parsed JSON bodies on Vercel @vercel/node without hanging on consumed streams
  const jsonParser = (req: Request, res: Response, next: NextFunction) => {
    if (
      req.body !== undefined &&
      req.body !== null &&
      typeof req.body === 'object' &&
      !Buffer.isBuffer(req.body)
    ) {
      next();
      return;
    }
    if (req.readableEnded) {
      req.body = {};
      next();
      return;
    }
    rawJsonParser(req, res, next);
  };

  // CORS policy for /api routes: explicit origin allowlist on all authenticated endpoints
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const isAuthenticatedRoute =
      req.path.startsWith('/admin') ||
      req.path.startsWith('/anime') ||
      req.path.startsWith('/munchyroll') ||
      req.path.startsWith('/anilist') ||
      req.path.startsWith('/extensions') ||
      req.path.startsWith('/streaming');

    if (isAuthenticatedRoute) {
      applyProtectedCorsHeaders(req, res, { allowCredentials: true });
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Range, If-Range');
      res.setHeader(
        'Access-Control-Expose-Headers',
        'Content-Length, Content-Range, Accept-Ranges, Content-Type'
      );
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (
      /\bgzip\b/i.test(acceptEncoding) &&
      !req.path.startsWith('/anime/proxy') &&
      !req.path.startsWith('/admin/popup-banners/media')
    ) {
      const origJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (res.headersSent) {
          return res;
        }
        try {
          const jsonStr = JSON.stringify(body);
          if (jsonStr.length >= 1024) {
            const gz = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'));
            res.setHeader('Content-Encoding', 'gzip');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Vary', 'Accept-Encoding');
            res.setHeader('Content-Length', String(gz.length));
            return res.send(gz);
          }
        } catch {
          // Fall back cleanly to uncompressed JSON response
        }
        return origJson(body);
      }) as Response['json'];
    }

    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      platform: isVercelRuntime ? 'vercel' : 'node',
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      providers: {
        consumetBase: DEFAULT_STREAMING_API,
        munchyrollConsumetBase: DEFAULT_MUNCHYROLL_CONSUMET_API,
        animeWorldUpstream: ANIMEWORLD_UPSTREAM,
        anilistUrl: ANILIST_API_URL,
        cineproBase: CINEPRO_BASE_URL,
        cineproConfigured: cineproConfigured(),
      },
      firebaseConfigured: FIREBASE_PROJECTS.length > 0,
      firebaseProjects: FIREBASE_PROJECTS.map((p) => p.projectId),
      guestMode: PUBLIC_GUEST_MODE,
      app: 'Flix4U',
    });
  });

  // Short-lived HttpOnly stream session cookie for native <video src> MP4 / Safari HLS playback
  app.post('/api/anime/stream-session', async (req: Request, res: Response) => {
    let sessionUid: string;
    let sessionProjectId: string;

    if (PUBLIC_GUEST_MODE) {
      sessionUid = `guest_${crypto.randomBytes(8).toString('hex')}`;
      sessionProjectId = 'guest';
    } else {
      const authCheck = await verifyFirebaseUserRequest(req);
      if (!authCheck.ok || !authCheck.uid || !authCheck.projectId) {
        res.status(authCheck.status || 401).json({
          success: false,
          error: authCheck.error || 'Authentication required.',
          code: authCheck.code || 'MISSING_TOKEN',
        });
        return;
      }
      if (!authCheck.isEmailVerified) {
        res.status(401).json({
          success: false,
          error: 'Email verification is required to access streaming content.',
          code: 'EMAIL_UNVERIFIED',
        });
        return;
      }
      sessionUid = authCheck.uid;
      sessionProjectId = authCheck.projectId;
    }

    const token = signStreamSessionToken(sessionUid, sessionProjectId);
    const forwardedProto = (req.headers['x-forwarded-proto'] || req.protocol || 'http')
      .toString()
      .split(',')[0]
      .trim()
      .toLowerCase();
    const requestOrigin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    const isSecure = forwardedProto === 'https' || req.secure || requestOrigin.startsWith('https://');
    const isCrossOrigin =
      Boolean(requestOrigin) &&
      (requestOrigin.startsWith('capacitor://') ||
        requestOrigin.startsWith('ionic://') ||
        requestOrigin === 'https://localhost');
    const sameSite = isCrossOrigin && isSecure ? 'None' : 'Lax';
    const parts = [
      `${STREAM_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      'Path=/api/anime/proxy',
      `Max-Age=${STREAM_SESSION_TTL_SEC}`,
      'HttpOnly',
      `SameSite=${sameSite}`,
    ];
    if (isSecure) {
      parts.push('Secure');
    }
    res.setHeader('Set-Cookie', parts.join('; '));
    res.json({ ok: true, expiresIn: STREAM_SESSION_TTL_SEC });
  });

  app.get('/api/streaming/diagnostics', requireFirebaseAuth, async (req: Request, res: Response) => {
    const malId = Math.max(1, Number(req.query.malId || 20));
    const ep = Math.max(1, Number(req.query.ep || 1));
    const searchQuery =
      typeof req.query.query === 'string' && req.query.query.trim()
        ? req.query.query.trim()
        : 'naruto';

    const probeUrl = async (
      name: string,
      url: string,
      init: RequestInit = {},
      timeoutMs = 4500
    ) => {
      const started = Date.now();
      try {
        const response = await fetchWithTimeout(url, init, timeoutMs);
        const latencyMs = Date.now() - started;
        return {
          name,
          url,
          ok: response.ok,
          status: response.status,
          latencyMs,
          response,
        };
      } catch (err) {
        return {
          name,
          url,
          ok: false,
          status: 0,
          latencyMs: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
          response: null as globalThis.Response | null,
        };
      }
    };

    const [
      consumetRes,
      munchyrollConsumetRes,
      megavidPrimaryRes,
      megavidSoraRes,
      megavidNeroRes,
      animeWorldRes,
      anilistRes,
      aniZipRes,
      aniSkipRes,
    ] = await Promise.all([
      probeUrl(
        'consumet-primary',
        `${DEFAULT_STREAMING_API}/meta/anilist/info/20`,
        { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
        4000
      ),
      probeUrl(
        'munchyroll-consumet',
        `${DEFAULT_MUNCHYROLL_CONSUMET_API}/meta/anilist/episodes/21?provider=zoro`,
        { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
        4000
      ),
      probeUrl(
        'megavid-vidstreaming',
        `https://megavid.buzz/mal/${malId}/${ep}/sub/source?noax=1`,
        {
          headers: {
            Referer: `https://megavid.buzz/mal/${malId}/${ep}/sub`,
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
          },
        },
        4500
      ),
      probeUrl(
        'megavid-streamsb',
        `https://megavid.buzz/mal/${malId}/${ep}/sub/source?axsv=sora`,
        {
          headers: {
            Referer: `https://megavid.buzz/mal/${malId}/${ep}/sub`,
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
          },
        },
        4500
      ),
      probeUrl(
        'megavid-megacloud',
        `https://megavid.buzz/mal/${malId}/${ep}/sub/source?axsv=nero`,
        {
          headers: {
            Referer: `https://megavid.buzz/mal/${malId}/${ep}/sub`,
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
          },
        },
        4500
      ),
      probeUrl(
        'animeworld-india',
        `${ANIMEWORLD_UPSTREAM}/?s=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            Referer: `${ANIMEWORLD_UPSTREAM}/`,
          },
        },
        5000
      ),
      probeUrl(
        'anilist',
        ANILIST_API_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: `query ($id: Int) { Media(id: $id, type: ANIME) { id idMal } }`,
            variables: { id: 20 },
          }),
        },
        4000
      ),
      probeUrl(
        'anizip',
        `${ANIZIP_API_URL}?anilist_id=20`,
        { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
        4000
      ),
      probeUrl(
        'aniskip',
        `${ANISKIP_API_URL}/${malId}/${ep}?types[]=op&episodeLength=0`,
        { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
        4000
      ),
    ]);

    const [
      vidstreamingSub,
      megacloudSub,
      streamsbSub,
      animepaheSub,
      aniwatchtvSub,
      hianimeSub,
      kaidoSub,
      vidstreamingDub,
    ] = await Promise.all([
      resolveFromMegavid(malId, ep, 'sub', 'vidstreaming'),
      resolveFromMegavid(malId, ep, 'sub', 'megacloud'),
      resolveFromMegavid(malId, ep, 'sub', 'streamsb'),
      resolveFromMegavid(malId, ep, 'sub', 'animepahe'),
      resolveFromMegavid(malId, ep, 'sub', 'aniwatchtv'),
      resolveFromMegavid(malId, ep, 'sub', 'hianime'),
      resolveFromMegavid(malId, ep, 'sub', 'kaido'),
      resolveFromMegavid(malId, ep, 'dub', 'vidstreaming'),
    ]);

    const summarizeMegavidDiag = (
      probe: typeof megavidPrimaryRes | null,
      resolved: Awaited<ReturnType<typeof resolveFromMegavid>>
    ) => {
      const payload = resolved.payload as
        | {
            sources?: Array<{ url: string; quality: string; type: string }>;
            providerMeta?: { resolvedCandidate?: string; resolvedHost?: string };
          }
        | undefined;
      const firstSource = payload?.sources?.[0];
      const resolvedHost = payload?.providerMeta?.resolvedHost || '';
      const resolvedCandidate = payload?.providerMeta?.resolvedCandidate || '';
      return {
        status: resolved.ok ? 200 : resolved.statusCode || probe?.status || 502,
        ok: Boolean(resolved.ok && firstSource?.url),
        working: Boolean(resolved.ok && firstSource?.url),
        latencyMs: probe?.latencyMs,
        resolvedCandidate: resolvedCandidate || undefined,
        resolvedHost: resolvedHost || undefined,
        verifiedStreamType: firstSource?.type || undefined,
        verifiedQualities: payload?.sources?.map((s) => s.quality) || [],
        error: resolved.ok ? undefined : resolved.message || probe?.error || `HTTP ${probe?.status}`,
      };
    };

    const [
      vidstreamingDiag,
      streamsbDiag,
      megacloudDiag,
      animepaheDiag,
      aniwatchtvDiag,
      hianimeDiag,
      kaidoDiag,
      englishDubDiag,
    ] = [
      summarizeMegavidDiag(megavidPrimaryRes, vidstreamingSub),
      summarizeMegavidDiag(megavidSoraRes, streamsbSub),
      summarizeMegavidDiag(megavidNeroRes, megacloudSub),
      summarizeMegavidDiag(megavidSoraRes, animepaheSub),
      summarizeMegavidDiag(megavidNeroRes, aniwatchtvSub),
      summarizeMegavidDiag(megavidPrimaryRes, hianimeSub),
      summarizeMegavidDiag(megavidPrimaryRes, kaidoSub),
      summarizeMegavidDiag(null, vidstreamingDub),
    ];

    const consumetVercelErr = consumetRes.response?.headers.get('x-vercel-error') || undefined;
    const awCfMitigated = animeWorldRes.response?.headers.get('cf-mitigated') || undefined;
    let awResultCount = 0;
    let awPlayableVerified = false;
    let awSampleStreamType: string | undefined;
    let awSampleLanguages: string[] = [];
    let awHasHindiAudio = false;
    let awSampleError: string | undefined;

    if (animeWorldRes.response && animeWorldRes.ok) {
      try {
        const html = await animeWorldRes.response.text();
        const $ = cheerio.load(html);
        const cards = parseAnimeWorldCards($);
        awResultCount = cards.length;

        const firstSeries = cards.find((c) => typeof c.seriesId === 'string' && c.seriesId);
        if (firstSeries?.seriesId) {
          const seriesHtmlRes = await fetchAnimeWorldHtml(
            `${ANIMEWORLD_UPSTREAM}/series/${encodeURIComponent(String(firstSeries.seriesId))}/`
          );
          if (seriesHtmlRes.ok && seriesHtmlRes.html) {
            const $s = cheerio.load(seriesHtmlRes.html);
            const epHref = $s('article.tr-episode-card a.tr-episode-link').first().attr('href') || '';
            const epSlug = extractSlugFromHref(epHref, 'episode');
            if (epSlug) {
              const epHtmlRes = await fetchAnimeWorldHtml(
                `${ANIMEWORLD_UPSTREAM}/episode/${encodeURIComponent(epSlug)}/`
              );
              if (epHtmlRes.ok && epHtmlRes.html) {
                const $e = cheerio.load(epHtmlRes.html);
                const iframes: string[] = [];
                $e('#aa-options iframe, .video-player iframe, .video-embed iframe').each((_, el) => {
                  const s = ($e(el).attr('src') || $e(el).attr('data-src') || '').trim();
                  if (isValidHttpUrl(s) && !iframes.includes(s)) iframes.push(s);
                });
                const iframeSrc = iframes[0] || '';
                if (iframeSrc) {
                  awPlayableVerified = true;
                  awSampleStreamType = classifyAnimeWorldStreamType(iframeSrc);
                  for (const src of iframes) {
                    if (src.includes('ravok.buzz')) {
                      const rl = await verifyRavokAudioLanguages(src);
                      for (const l of rl) {
                        if (!awSampleLanguages.includes(l)) awSampleLanguages.push(l);
                        if (l.toLowerCase() === 'hindi') awHasHindiAudio = true;
                      }
                    } else if (src.includes('multi-lang-plyr.php') && src.includes('data=')) {
                      try {
                        const rawData = new URL(src).searchParams.get('data');
                        if (rawData) {
                          const entries = JSON.parse(
                            Buffer.from(rawData, 'base64').toString('utf8')
                          ) as Array<{ language?: string }>;
                          for (const e of entries) {
                            const l = (e.language || '').trim();
                            if (l && !awSampleLanguages.includes(l)) awSampleLanguages.push(l);
                            if (l.toLowerCase() === 'hindi') awHasHindiAudio = true;
                          }
                        }
                      } catch {
                        // ignore
                      }
                    }
                  }
                } else {
                  awSampleError = 'Episode page had no valid stream/embed URL.';
                }
              } else {
                awSampleError = `Episode fetch returned HTTP ${epHtmlRes.status}`;
              }
            } else {
              awSampleError = 'No episode link found on sample series page.';
            }
          } else {
            awSampleError = `Series page returned HTTP ${seriesHtmlRes.status}`;
          }
        }
      } catch (err) {
        awSampleError = err instanceof Error ? err.message : 'Failed to verify AnimeWorld sample stream.';
      }
    } else {
      awSampleError =
        animeWorldRes.status === 403
          ? 'Upstream Cloudflare WAF blocks server/datacenter IPs with HTTP 403.'
          : animeWorldRes.error || `Upstream returned HTTP ${animeWorldRes.status}`;
    }

    const awWorking = Boolean(animeWorldRes.ok && awResultCount > 0 && awPlayableVerified);

    logProviderDiagnostic('diagnostics', 'summary', {
      consumetStatus: consumetRes.status,
      vidstreamingWorking: vidstreamingDiag.working,
      megacloudWorking: megacloudDiag.working,
      streamsbWorking: streamsbDiag.working,
      animepaheWorking: animepaheDiag.working,
      aniwatchtvWorking: aniwatchtvDiag.working,
      hianimeWorking: hianimeDiag.working,
      kaidoWorking: kaidoDiag.working,
      animeWorldWorking: awWorking,
      animeWorldStatus: animeWorldRes.status,
    });

    res.json({
      timestamp: new Date().toISOString(),
      platform: isVercelRuntime ? 'vercel' : 'node',
      testParams: { malId, episode: ep, searchQuery },
      providers: {
        consumetPrimary: {
          baseUrl: DEFAULT_STREAMING_API,
          status: consumetRes.status,
          ok: consumetRes.ok,
          working: consumetRes.ok,
          latencyMs: consumetRes.latencyMs,
          upstreamHeaderError: consumetVercelErr,
          note: !consumetRes.ok
            ? 'Consumet primary host is unavailable; Flix4U resolves streams via verified Megavid + AniZip + AniSkip.'
            : undefined,
        },
        munchyroll: {
          consumetBase: DEFAULT_MUNCHYROLL_CONSUMET_API,
          status: munchyrollConsumetRes.status,
          ok: munchyrollConsumetRes.ok,
          working: munchyrollConsumetRes.ok,
          latencyMs: munchyrollConsumetRes.latencyMs,
          upstreamHeaderError:
            munchyrollConsumetRes.response?.headers.get('x-vercel-error') || undefined,
          error: !munchyrollConsumetRes.ok
            ? munchyrollConsumetRes.status === 402
              ? 'Configured Consumet backend returned HTTP 402 (DEPLOYMENT_DISABLED). Set CONSUMET_API_URL to a live Consumet instance.'
              : munchyrollConsumetRes.error || `HTTP ${munchyrollConsumetRes.status}`
            : undefined,
        },
        animeWorldIndia: {
          upstream: ANIMEWORLD_UPSTREAM,
          status: animeWorldRes.status,
          ok: awWorking,
          working: awWorking,
          latencyMs: animeWorldRes.latencyMs,
          parsedCards: awResultCount,
          playableStreamVerified: awPlayableVerified,
          sampleStreamType: awSampleStreamType,
          hasHindiAudio: awHasHindiAudio,
          audioLanguages: awSampleLanguages,
          blockedByCloudflare: animeWorldRes.status === 403 || Boolean(awCfMitigated),
          error: awWorking ? undefined : awSampleError,
          note:
            animeWorldRes.status === 403
              ? 'Upstream Cloudflare WAF blocks server/datacenter IPs with HTTP 403. Other providers remain operational.'
              : undefined,
        },
        vidstreaming: vidstreamingDiag,
        megacloud: megacloudDiag,
        streamsb: streamsbDiag,
        animepahe: animepaheDiag,
        aniwatchtv: aniwatchtvDiag,
        hianime: hianimeDiag,
        kaido: kaidoDiag,
        audioVerification: {
          japaneseSub: vidstreamingDiag.working,
          englishDub: englishDubDiag.working,
          hindiDub: awWorking && awHasHindiAudio,
        },
        anilist: {
          status: anilistRes.status,
          ok: anilistRes.ok,
          latencyMs: anilistRes.latencyMs,
        },
        anizip: {
          status: aniZipRes.status,
          ok: aniZipRes.ok,
          latencyMs: aniZipRes.latencyMs,
        },
        aniskip: {
          status: aniSkipRes.status,
          ok: aniSkipRes.ok,
          latencyMs: aniSkipRes.latencyMs,
        },
      },
    });
  });

  // Real website visit tracking (session-deduplicated so route navigation does not inflate visits)
  app.post('/api/analytics/visit', jsonParser, (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const sessionId = sanitizeIdToken(body.sessionId, 128);
    const clientId = sanitizeIdToken(body.clientId, 128);
    const uid = sanitizeIdToken(body.uid, 128) || undefined;

    if (!sessionId || !clientId) {
      res.status(400).json({ error: 'Missing valid sessionId or clientId.' });
      return;
    }

    const now = Date.now();
    const today = getTodayDateKey();
    const bucket = getOrCreateDailyBucket(today);

    let countedNewVisit = false;
    if (!seenVisitSessions.has(sessionId)) {
      seenVisitSessions.set(sessionId, now);
      analyticsStore.totalWebsiteVisits += 1;
      bucket.visits += 1;
      countedNewVisit = true;
    }

    recordActorActivity(clientId, uid);
    activePresenceSessions.set(sessionId, { sessionId, clientId, uid, lastSeen: now });
    scheduleAnalyticsPersist();

    res.json({ ok: true, countedNewVisit });
  });

  // Real heartbeat presence tracking
  app.post('/api/analytics/heartbeat', jsonParser, (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const sessionId = sanitizeIdToken(body.sessionId, 128);
    const clientId = sanitizeIdToken(body.clientId, 128);
    const uid = sanitizeIdToken(body.uid, 128) || undefined;

    if (!sessionId || !clientId) {
      res.status(400).json({ error: 'Missing valid sessionId or clientId.' });
      return;
    }

    const now = Date.now();
    activePresenceSessions.set(sessionId, { sessionId, clientId, uid, lastSeen: now });
    recordActorActivity(clientId, uid);
    scheduleAnalyticsPersist();

    res.json({ ok: true, serverTime: now });
  });

  // Immediate offline signal on tab close / pagehide
  app.post('/api/analytics/offline', jsonParser, (req: Request, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const sessionId = sanitizeIdToken(body.sessionId, 128);
    if (sessionId) {
      activePresenceSessions.delete(sessionId);
    }
    res.status(204).end();
  });

  // Secure Firebase Admin authorization verification for signed-in users (no client email hardcoding)
  app.get('/api/auth/admin-status', async (req: Request, res: Response) => {
    const userCheck = await verifyFirebaseUserRequest(req);
    if (!userCheck.ok) {
      res.status(userCheck.status).json({
        isAdmin: false,
        role: 'guest',
        error: userCheck.error,
        code: userCheck.code,
      });
      return;
    }

    if (!userCheck.isEmailVerified) {
      res.json({
        isAdmin: false,
        role: 'user',
        claimSynced: false,
      });
      return;
    }

    const adminCheck = await verifyAdminRequest(req);
    if (!adminCheck.ok) {
      res.json({
        isAdmin: false,
        role: 'user',
        claimSynced: false,
      });
      return;
    }

    res.json({
      isAdmin: true,
      role: 'admin',
      claimSynced: Boolean(adminCheck.claimSynced),
    });
  });

  // Protected Admin User & Visit Analytics endpoint
  app.get('/api/admin/stats', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error, code: authCheck.code });
      return;
    }

    const activeList = pruneStalePresence();
    const onlineActors = new Set<string>();
    const onlineRegisteredUids = new Set<string>();
    const onlineGuestClients = new Set<string>();

    for (const s of activeList) {
      if (s.uid) {
        onlineActors.add(`u:${s.uid}`);
        onlineRegisteredUids.add(s.uid);
      } else {
        onlineActors.add(`c:${s.clientId}`);
        onlineGuestClients.add(s.clientId);
      }
    }

    const today = getTodayDateKey();
    const todayBucket = getOrCreateDailyBucket(today);

    // Last 7 days & 90 days real activity series (oldest -> newest)
    const dailySeries: Array<{
      date: string;
      visits: number;
      activeUsers: number;
      registeredActive: number;
    }> = [];
    const dailySeries90: Array<{
      date: string;
      visits: number;
      activeUsers: number;
      registeredActive: number;
    }> = [];

    const wauActors = new Set<string>();
    const mauActors = new Set<string>();

    for (let offset = 89; offset >= 0; offset -= 1) {
      const d = new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);
      const bucket = analyticsStore.daily[d];
      const actorIds = bucket
        ? [
            ...(bucket.activeUserIds || []).map((id) => `u:${id}`),
            ...(bucket.guestClientIds || []).map((id) => `c:${id}`),
          ]
        : [];
      const uniqueDay = new Set(actorIds).size;

      if (offset < 7) {
        actorIds.forEach((id) => wauActors.add(id));
      }
      if (offset < 30) {
        actorIds.forEach((id) => mauActors.add(id));
      }

      const point = {
        date: d,
        visits: bucket?.visits || 0,
        activeUsers: uniqueDay,
        registeredActive: bucket?.activeUserIds?.length || 0,
      };
      dailySeries90.push(point);
      if (offset < 7) {
        dailySeries.push(point);
      }
    }

    const todayCombinedActors = new Set([
      ...(todayBucket.activeUserIds || []).map((id) => `u:${id}`),
      ...(todayBucket.guestClientIds || []).map((id) => `c:${id}`),
    ]).size;

    res.json({
      currentlyOnlineUsers: onlineActors.size,
      onlineRegisteredUsers: onlineRegisteredUids.size,
      onlineGuestUsers: onlineGuestClients.size,
      usersActiveToday: todayCombinedActors,
      registeredActiveToday: todayBucket.activeUserIds.length,
      guestActiveToday: todayBucket.guestClientIds.length,
      wau: wauActors.size,
      mau: mauActors.size,
      totalWebsiteVisits: analyticsStore.totalWebsiteVisits,
      visitsToday: todayBucket.visits,
      totalUniqueVisitors: knownClientsSet.size,
      dailySeries,
      dailySeries90,
      updatedAt: new Date().toISOString(),
    });
  });

  // ==========================================
  // USER LEVEL & XP BACKEND VALIDATION SYSTEM
  // ==========================================
  type ServerXpActionType =
    | 'first_episode'
    | 'episode_complete'
    | 'daily_goal'
    | 'daily_login'
    | 'streak_milestone';

  const XP_REWARDS_TABLE: Record<Exclude<ServerXpActionType, 'streak_milestone'>, number> = {
    first_episode: 20,
    episode_complete: 10,
    daily_goal: 15,
    daily_login: 5,
  };

  const STREAK_MILESTONE_XP: Record<number, number> = {
    3: 25,
    7: 50,
    15: 100,
    30: 200,
    100: 500,
  };

  const xpRequiredForLevelServer = (level: number): number => {
    if (level <= 1) return 0;
    let total = 0;
    for (let l = 2; l <= level; l++) {
      total += Math.round(35 + 15 * (l - 2) + 0.65 * Math.pow(l - 2, 2));
    }
    return total;
  };

  const getLevelTitleServer = (level: number): string => {
    if (level >= 50) return 'Flix4U Elite';
    if (level >= 30) return 'Anime Legend';
    if (level >= 20) return 'Anime Master';
    if (level >= 10) return 'Otaku';
    if (level >= 5) return 'Anime Fan';
    return 'Beginner';
  };

  const computeLevelFromXpServer = (xp: number): { level: number; title: string } => {
    const safeXp = Math.max(0, Math.floor(xp));
    let lvl = 1;
    while (lvl < 99 && safeXp >= xpRequiredForLevelServer(lvl + 1)) {
      lvl += 1;
    }
    return { level: lvl, title: getLevelTitleServer(lvl) };
  };

  interface XpLedgerStore {
    claimedKeys: Record<string, number>;
    lastRateWindow: Record<string, number[]>;
  }

  const loadXpLedger = (): XpLedgerStore => {
    try {
      if (fs.existsSync(XP_LEDGER_FILE_PATH)) {
        const raw = fs.readFileSync(XP_LEDGER_FILE_PATH, 'utf8');
        const parsed = JSON.parse(raw) as Partial<XpLedgerStore>;
        return {
          claimedKeys: parsed.claimedKeys && typeof parsed.claimedKeys === 'object' ? parsed.claimedKeys : {},
          lastRateWindow: {},
        };
      }
    } catch {
      // start fresh
    }
    return { claimedKeys: {}, lastRateWindow: {} };
  };

  const xpLedgerStore = loadXpLedger();
  let xpLedgerSaveTimer: NodeJS.Timeout | null = null;
  const scheduleXpLedgerPersist = () => {
    if (xpLedgerSaveTimer || isVercelRuntime) return;
    xpLedgerSaveTimer = setTimeout(() => {
      xpLedgerSaveTimer = null;
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        const entries = Object.entries(xpLedgerStore.claimedKeys);
        if (entries.length > 50000) {
          entries.sort((a, b) => a[1] - b[1]);
          xpLedgerStore.claimedKeys = Object.fromEntries(entries.slice(-40000));
        }
        const tmp = `${XP_LEDGER_FILE_PATH}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ claimedKeys: xpLedgerStore.claimedKeys }), 'utf8');
        fs.renameSync(tmp, XP_LEDGER_FILE_PATH);
      } catch {
        // non-fatal
      }
    }, 1000);
  };

  app.post('/api/xp/award', jsonParser, requireFirebaseAuth, (req: Request, res: Response) => {
    const authUser = (req as AuthenticatedRequest).firebaseUser;
    if (!authUser?.uid) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const actionType = typeof body.actionType === 'string' ? body.actionType : '';
    const rawEventKey = typeof body.eventKey === 'string' ? body.eventKey.trim().slice(0, 120) : '';
    const watchedSeconds = Math.max(0, Number(body.watchedSeconds) || 0);
    const durationSeconds = Math.max(0, Number(body.durationSeconds) || 0);
    const progressSeconds = Math.max(0, Number(body.progressSeconds) || 0);
    const todayWatchSeconds = Math.max(0, Number(body.todayWatchSeconds) || 0);
    const streakDays = Math.max(0, Math.floor(Number(body.streakDays) || 0));
    const milestoneDays = Math.max(0, Math.floor(Number(body.milestoneDays) || 0));
    const currentTotalXp = Math.max(0, Math.floor(Number(body.currentTotalXp) || 0));

    const validActions: ServerXpActionType[] = [
      'first_episode',
      'episode_complete',
      'daily_goal',
      'daily_login',
      'streak_milestone',
    ];
    if (!validActions.includes(actionType as ServerXpActionType) || !rawEventKey) {
      res.status(400).json({ ok: false, awarded: false, error: 'Invalid XP claim parameters.' });
      return;
    }

    const sanitizedKey = rawEventKey.replace(/[^a-zA-Z0-9_.\-:]/g, '_');
    const claimId = `${authUser.uid}:${sanitizedKey}`;

    if (xpLedgerStore.claimedKeys[claimId]) {
      res.json({
        ok: true,
        awarded: false,
        duplicate: true,
        xpDelta: 0,
        nextTotalXp: currentTotalXp,
        ...computeLevelFromXpServer(currentTotalXp),
        reason: 'Reward already claimed.',
      });
      return;
    }

    // Per-user anti-spam rate window: max 30 XP claims per 10 minutes
    const now = Date.now();
    const recentTimestamps = (xpLedgerStore.lastRateWindow[authUser.uid] || []).filter(
      (t) => now - t < 10 * 60 * 1000
    );
    if (recentTimestamps.length >= 30) {
      res.status(429).json({
        ok: false,
        awarded: false,
        error: 'XP claim rate limit exceeded. Please continue watching naturally.',
      });
      return;
    }

    let xpDelta = 0;
    let reason = '';

    if (actionType === 'first_episode' || actionType === 'episode_complete') {
      const hasMinimumDuration =
        watchedSeconds >= 45 ||
        (durationSeconds > 0 && progressSeconds >= Math.max(30, durationSeconds * 0.65)) ||
        (durationSeconds > 0 && durationSeconds <= 90 && watchedSeconds >= 20);
      if (!hasMinimumDuration) {
        res.status(400).json({
          ok: false,
          awarded: false,
          error: 'Insufficient verified playback time to claim episode completion XP.',
        });
        return;
      }
      xpDelta = XP_REWARDS_TABLE[actionType];
      reason =
        actionType === 'first_episode'
          ? 'Completed first anime episode'
          : 'Completed anime episode';
    } else if (actionType === 'daily_goal') {
      if (todayWatchSeconds < 900) {
        res.status(400).json({
          ok: false,
          awarded: false,
          error: 'Daily watch goal (15 minutes) not reached yet.',
        });
        return;
      }
      xpDelta = XP_REWARDS_TABLE.daily_goal;
      reason = 'Completed daily watch goal (15m+)';
    } else if (actionType === 'daily_login') {
      xpDelta = XP_REWARDS_TABLE.daily_login;
      reason = 'Daily login bonus';
    } else if (actionType === 'streak_milestone') {
      const bonus = STREAK_MILESTONE_XP[milestoneDays];
      if (!bonus || streakDays < milestoneDays) {
        res.status(400).json({
          ok: false,
          awarded: false,
          error: 'Streak milestone criteria not met.',
        });
        return;
      }
      xpDelta = bonus;
      reason = `${milestoneDays}-day watch streak milestone bonus`;
    }

    recentTimestamps.push(now);
    xpLedgerStore.lastRateWindow[authUser.uid] = recentTimestamps;
    xpLedgerStore.claimedKeys[claimId] = now;
    scheduleXpLedgerPersist();

    const nextTotalXp = currentTotalXp + xpDelta;
    const prevLvl = computeLevelFromXpServer(currentTotalXp);
    const nextLvl = computeLevelFromXpServer(nextTotalXp);

    res.json({
      ok: true,
      awarded: true,
      duplicate: false,
      eventKey: sanitizedKey,
      actionType,
      xpDelta,
      reason,
      nextTotalXp,
      level: nextLvl.level,
      levelTitle: nextLvl.title,
      leveledUp: nextLvl.level > prevLvl.level,
      issuedAt: now,
    });
  });

  const bannerMultipartUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 8 * 1024 * 1024,
      files: 1,
    },
  }).fields([
    { name: 'image', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]);

  const runBannerMultipartMiddleware = (req: Request, res: Response): Promise<void> =>
    new Promise((resolve, reject) => {
      bannerMultipartUpload(req, res, (err: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  const runJsonParserMiddleware = (req: Request, res: Response): Promise<void> =>
    new Promise((resolve, reject) => {
      jsonParser(req, res, (err?: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });

  // Protected Admin Banner Image Upload (supports multipart/form-data and JSON base64 fallback; validated magic bytes + size <= 8 MB)
  app.post('/api/admin/banners/upload', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error, code: authCheck.code });
      return;
    }

    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    let buffer: Buffer | null = null;
    let declaredMime = '';

    if (contentType.includes('multipart/form-data')) {
      try {
        await runBannerMultipartMiddleware(req, res);
      } catch (err) {
        if (err instanceof multer.MulterError) {
          const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          const message =
            err.code === 'LIMIT_FILE_SIZE'
              ? 'Banner image must not exceed 8 MB.'
              : `Invalid upload payload (${err.message}).`;
          res.status(status).json({ error: message, code: err.code });
          return;
        }
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to parse multipart image upload.',
        });
        return;
      }

      const uploadedFiles = req.files as Record<string, Express.Multer.File[]> | undefined;
      const uploadedFile = uploadedFiles?.image?.[0] || uploadedFiles?.file?.[0];
      if (!uploadedFile || !uploadedFile.buffer) {
        res.status(400).json({ error: 'Missing image file in multipart form upload.' });
        return;
      }
      buffer = uploadedFile.buffer;
      declaredMime = String(uploadedFile.mimetype || '').trim().toLowerCase();
    } else {
      try {
        await runJsonParserMiddleware(req, res);
      } catch (err) {
        res.status(400).json({
          error: err instanceof Error ? err.message : 'Invalid JSON upload payload.',
        });
        return;
      }

      const body = (req.body || {}) as Record<string, unknown>;
      const rawData = typeof body.dataBase64 === 'string' ? body.dataBase64.trim() : '';
      declaredMime = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';

      if (!rawData) {
        res.status(400).json({ error: 'Missing image data.' });
        return;
      }

      const cleanedBase64 = rawData.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '');
      try {
        buffer = Buffer.from(cleanedBase64, 'base64');
      } catch {
        res.status(400).json({ error: 'Invalid base64 image payload.' });
        return;
      }
    }

    const allowedMimes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/pjpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/octet-stream',
    ]);
    if (declaredMime && !allowedMimes.has(declaredMime)) {
      res.status(400).json({ error: 'Unsupported image format. Allowed: JPG, PNG, WebP, GIF.' });
      return;
    }

    if (!buffer || buffer.length === 0 || buffer.length > 8 * 1024 * 1024) {
      res.status(400).json({ error: 'Banner image must be between 1 byte and 8 MB.' });
      return;
    }

    const verified = detectVerifiedImageFormat(buffer);
    if (!verified) {
      res.status(400).json({ error: 'Invalid or corrupted image file. Allowed: JPG, PNG, WebP, GIF.' });
      return;
    }

    const safeFileName = `banner_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${verified.ext}`;
    const resolvedUploadsDir = path.resolve(BANNER_UPLOADS_DIR);
    const destPath = path.resolve(resolvedUploadsDir, safeFileName);
    if (!destPath.startsWith(resolvedUploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid upload destination path.' });
      return;
    }

    try {
      fs.mkdirSync(resolvedUploadsDir, { recursive: true });
      fs.writeFileSync(destPath, buffer);
    } catch (err) {
      res.status(507).json({
        error: err instanceof Error ? err.message : 'Unable to store banner image on server.',
      });
      return;
    }

    res.json({
      imageUrl: `/api/banners/image/${safeFileName}`,
      mimeType: verified.mime,
      size: buffer.length,
    });
  });

  // Publicly serve validated banner image uploads safely
  app.get('/api/banners/image/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      res.status(400).json({ error: 'Invalid banner filename.' });
      return;
    }

    const resolvedUploadsDir = path.resolve(BANNER_UPLOADS_DIR);
    const targetPath = path.resolve(resolvedUploadsDir, filename);
    if (!targetPath.startsWith(resolvedUploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid banner path.' });
      return;
    }
    if (!fs.existsSync(targetPath)) {
      res.status(404).json({ error: 'Banner image not found.' });
      return;
    }

    const ext = path.extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(targetPath).pipe(res);
  });

  // Protected Admin cleanup for local uploaded banner images
  app.delete('/api/admin/banners/image/:filename', async (req: Request, res: Response) => {
    const authCheck = await verifyAdminRequest(req);
    if (!authCheck.ok) {
      res.status(authCheck.status).json({ error: authCheck.error, code: authCheck.code });
      return;
    }

    const filename = String(req.params.filename || '');
    if (!/^[a-zA-Z0-9_\-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      res.status(400).json({ error: 'Invalid banner filename.' });
      return;
    }

    const resolvedUploadsDir = path.resolve(BANNER_UPLOADS_DIR);
    const targetPath = path.resolve(resolvedUploadsDir, filename);
    if (!targetPath.startsWith(resolvedUploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid banner path.' });
      return;
    }
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    } catch {
      // ignore ephemeral cleanup error
    }
    res.json({ ok: true });
  });

  app.get('/api/extensions/repos', requireFirebaseAuth, async (_req: Request, res: Response) => {
    try {
      const catalog = await fetchExtensionsCatalog();
      res.json(catalog);
    } catch (err) {
      res.status(502).json({
        repositories: [],
        extensions: [],
        error: err instanceof Error ? err.message : 'Failed to load extension repositories.',
      });
    }
  });

  // Actual AnimeWorld India PHP API v1 endpoints (protected by Firebase authentication)
  app.get('/api/anime-world-india/v1/home.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('home.php', req, res)) return;
    const cacheKey = 'aw:home';
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) => `${base}/`);
      if (!ok || !html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(status || 502).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, 'homepage'),
        });
        return;
      }
      const $ = cheerio.load(html);
      const allCards = parseAnimeWorldCards($);
      const latest_series = allCards.filter((item) => item.type === 'series');
      const latest_movies = allCards.filter((item) => item.type === 'movie');
      const payload = {
        success: true,
        source: upstream || ANIMEWORLD_UPSTREAM,
        latest_series,
        latest_movies,
      };
      if (latest_series.length > 0 || latest_movies.length > 0) {
        writeAwParsedCache(cacheKey, payload, 120_000, 20 * 60_000);
      }
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to load AnimeWorld India homepage.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/series.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('series.php', req, res)) return;
    const page = Math.max(1, Number(req.query.p || 1));
    const cacheKey = `aw:series:${page}`;
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) =>
          page > 1 ? `${base}/series/page/${page}/` : `${base}/series/`
        );
      if (!ok || !html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, 'series list'),
        });
        return;
      }
      const $ = cheerio.load(html);
      const series = parseAnimeWorldCards($).filter((x) => x.seriesId);
      const pagination = parseAnimeWorldPagination($, page);
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;
      const payload = {
        success: true,
        source: `${usedBase}/series`,
        ...pagination,
        total_results: series.length,
        series,
      };
      if (series.length > 0) {
        writeAwParsedCache(cacheKey, payload, 120_000, 20 * 60_000);
      }
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch series list.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/movie.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('movie.php', req, res)) return;
    const page = Math.max(1, Number(req.query.p || 1));
    const cacheKey = `aw:movie:${page}`;
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) =>
          page > 1 ? `${base}/movies/page/${page}/` : `${base}/movies/`
        );
      if (!ok || !html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, 'movies list'),
        });
        return;
      }
      const $ = cheerio.load(html);
      const movies = parseAnimeWorldCards($).filter((x) => x.movieId || x.type === 'movie');
      const pagination = parseAnimeWorldPagination($, page);
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;
      const payload = {
        success: true,
        source: `${usedBase}/movies`,
        ...pagination,
        total_results: movies.length,
        movies,
      };
      if (movies.length > 0) {
        writeAwParsedCache(cacheKey, payload, 120_000, 20 * 60_000);
      }
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch movies list.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/a2z.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('a2z.php', req, res)) return;
    const rawLetter = typeof req.query.letter === 'string' ? req.query.letter.trim().toUpperCase() : 'A';
    const letter = rawLetter === '0-9' || /^[A-Z]$/.test(rawLetter) ? rawLetter : 'A';
    const page = Math.max(1, Number(req.query.p || 1));
    const cacheKey = `aw:a2z:${letter}:${page}`;
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) =>
          page > 1
            ? `${base}/letter/${encodeURIComponent(letter)}/page/${page}/`
            : `${base}/letter/${encodeURIComponent(letter)}/`
        );
      if (!ok || !html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, `A-Z letter "${letter}"`),
        });
        return;
      }
      const $ = cheerio.load(html);
      const results = parseAnimeWorldCards($);
      const pagination = parseAnimeWorldPagination($, page);
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;
      const payload = {
        success: true,
        letter,
        source: `${usedBase}/letter/${letter}`,
        ...pagination,
        total_results: results.length,
        results,
      };
      if (results.length > 0) {
        writeAwParsedCache(cacheKey, payload, 180_000, 20 * 60_000);
      }
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch A-Z list.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/search.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('search.php', req, res)) return;
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const page = Math.max(1, Number(req.query.p || 1));
    if (!query) {
      res.status(400).json({ success: false, error: 'Missing query parameter' });
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) =>
          page > 1
            ? `${base}/page/${page}/?s=${encodeURIComponent(query)}`
            : `${base}/?s=${encodeURIComponent(query)}`
        );
      if (!ok || !html) {
        res.status(status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, 'search'),
        });
        return;
      }
      const $ = cheerio.load(html);
      const results = parseAnimeWorldCards($);
      const pagination = parseAnimeWorldPagination($, page);
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;
      res.json({
        success: true,
        query,
        currentPage: page,
        ...pagination,
        total_results: results.length,
        source: `${usedBase}/search`,
        results,
      });
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to search AnimeWorld India.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/seasons.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('seasons.php', req, res)) return;
    const seriesID =
      typeof req.query.seriesID === 'string'
        ? req.query.seriesID.trim()
        : typeof req.query.seriesId === 'string'
          ? req.query.seriesId.trim()
          : '';
    if (!seriesID) {
      res.status(400).json({ success: false, error: 'Missing seriesID parameter' });
      return;
    }
    const cacheKey = `aw:seasons:${seriesID}`;
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }
    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors(
          (base) => `${base}/series/${encodeURIComponent(seriesID)}/`
        );
      if (!ok || !html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, `series "${seriesID}"`),
        });
        return;
      }
      const $ = cheerio.load(html);
      const meta = extractAnimeWorldPageMeta($, seriesID);

      const seasons: Array<Record<string, unknown>> = [];
      let summedEpisodes = 0;
      $('a.season-btn.sel-temp, .sel-temp a[data-post], a[data-post][data-season]').each((_, el) => {
        const btn = $(el);
        const postId = btn.attr('data-post') || '';
        const seasonNum = btn.attr('data-season') || '1';
        const rawText = btn.text().trim().replace(/\s+/g, ' ');
        const seasonName =
          btn.find('.season-label').text().trim() ||
          rawText.split('•')[0]?.trim() ||
          `Season ${seasonNum}`;
        const episodesText =
          btn.find('.season-episodes').text().trim() ||
          rawText.split('•')[1]?.trim() ||
          '';
        const parenMatch = episodesText.match(/\((\d+)\)/);
        const countMatch = parenMatch || episodesText.match(/^(\d+)/);
        if (countMatch) {
          summedEpisodes += Number(countMatch[1]) || 0;
        }
        const isSubOnly = btn.hasClass('non-regional');
        const seasonId = postId
          ? `${seriesID}__post-${postId}__season-${seasonNum}`
          : `${seriesID}-season-${seasonNum}`;
        if (!seasons.some((s) => s.seasonId === seasonId)) {
          seasons.push({
            seasonNumber: seasonNum,
            seasonName,
            episodes: episodesText,
            seasonId,
            postId,
            isSubOnly,
          });
        }
      });

      // Fallback if single-season series has no season selector buttons
      if (seasons.length === 0) {
        const epCount = $('article.tr-episode-card, ul#episode_by_temp li, article.episodes').length;
        summedEpisodes = epCount;
        seasons.push({
          seasonNumber: '1',
          seasonName: 'Season 1',
          episodes: `${epCount} Episodes`,
          seasonId: `${seriesID}__season-1`,
          isSubOnly: false,
        });
      }

      const epsBadge = meta.heroBadges.find((b) => /\d+\s*Eps?/i.test(b));
      const badgeEpNum = epsBadge ? Number(epsBadge.match(/(\d+)/)?.[1] || 0) : 0;
      const totalEpisodes = badgeEpNum > 0 ? badgeEpNum : summedEpisodes;
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;

      const payload = {
        success: true,
        source: `${usedBase}/series`,
        series: {
          seriesId: seriesID,
          title: meta.title,
          poster: meta.poster,
          ...(meta.poster ? { proxyPoster: buildAnimeWorldProxyImageUrl(meta.poster) } : {}),
          banner: meta.banner,
          ...(meta.banner ? { proxyBanner: buildAnimeWorldProxyImageUrl(meta.banner) } : {}),
          year: meta.year,
          rating: meta.rating,
          totalSeasons: String(seasons.length),
          totalEpisodes: String(totalEpisodes),
          languages: meta.languages,
          genres: meta.genres,
          description: meta.description,
        },
        seasons,
      };
      writeAwParsedCache(cacheKey, payload, 180_000, 20 * 60_000);
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to load seasons.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/episodes.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('episodes.php', req, res)) return;
    const seasonId = typeof req.query.seasonId === 'string' ? req.query.seasonId.trim() : '';
    if (!seasonId) {
      res.status(400).json({ success: false, error: 'Missing seasonId parameter' });
      return;
    }

    const cacheKey = `aw:episodes:${seasonId}`;
    const fresh = readAwParsedCache(cacheKey, false);
    if (fresh) {
      res.json(fresh);
      return;
    }

    try {
      const encodedMatch = seasonId.match(/^(.+?)__post-(\d+)__season-(\d+)$/);
      if (encodedMatch) {
        const [, seriesSlug, postId, seasonNum] = encodedMatch;
        // Try GET then POST on primary upstream first
        let primaryUsedBase = ANIMEWORLD_UPSTREAM;
        const primaryAjaxUrl = `${primaryUsedBase}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(
          seasonNum
        )}&post=${encodeURIComponent(postId)}`;
        let ajaxRes = await fetchAnimeWorldHtml(primaryAjaxUrl, {
          upstreamBase: primaryUsedBase,
          isAjax: true,
        });
        let episodes = ajaxRes.ok && ajaxRes.html ? parseEpisodesFromAnimeWorldHtml(ajaxRes.html).episodes : [];

        // If GET failed or returned empty, retry with POST admin-ajax.php
        if (episodes.length === 0) {
          const postRes = await fetchAnimeWorldHtml(`${primaryUsedBase}/wp-admin/admin-ajax.php`, {
            upstreamBase: primaryUsedBase,
            isAjax: true,
            method: 'POST',
            body: `action=action_select_season&season=${encodeURIComponent(seasonNum)}&post=${encodeURIComponent(postId)}`,
          });
          if (postRes.ok && postRes.html) {
            const parsedPost = parseEpisodesFromAnimeWorldHtml(postRes.html).episodes;
            if (parsedPost.length > 0) {
              ajaxRes = postRes;
              episodes = parsedPost;
            }
          }
        }

        // If primary still failed or had 0 episodes, load series page via mirror(s) to resolve mirror postId cleanly
        if (episodes.length === 0) {
          const seriesMirror = await fetchAnimeWorldPathWithMirrors(
            (base) => `${base}/series/${encodeURIComponent(seriesSlug)}/`
          );
          if (seriesMirror.ok && seriesMirror.html) {
            const mirrorBase = seriesMirror.upstream || ANIMEWORLD_UPSTREAM;
            const $series = cheerio.load(seriesMirror.html);
            const mirrorBtn = $series(
              `a.season-btn.sel-temp[data-season="${seasonNum}"], a[data-post][data-season="${seasonNum}"]`
            ).first();
            const mirrorPostId = mirrorBtn.attr('data-post') || postId;
            if (seasonNum === '1') {
              const inlineEps = parseEpisodesFromAnimeWorldHtml(seriesMirror.html).episodes;
              if (inlineEps.length > 0) {
                primaryUsedBase = mirrorBase;
                episodes = inlineEps;
                ajaxRes = { ok: true, status: 200, html: seriesMirror.html, upstream: mirrorBase };
              }
            }
            if (episodes.length === 0 && mirrorPostId) {
              const mAjaxUrl = `${mirrorBase}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(
                seasonNum
              )}&post=${encodeURIComponent(mirrorPostId)}`;
              const mRes = await fetchAnimeWorldHtml(mAjaxUrl, {
                upstreamBase: mirrorBase,
                isAjax: true,
              });
              if (mRes.ok && mRes.html) {
                const parsedM = parseEpisodesFromAnimeWorldHtml(mRes.html).episodes;
                if (parsedM.length > 0) {
                  primaryUsedBase = mirrorBase;
                  episodes = parsedM;
                  ajaxRes = mRes;
                }
              }
            }
          }
        }

        if ((!ajaxRes.ok || episodes.length === 0) && !ajaxRes.html) {
          const stale = readAwParsedCache(cacheKey, true);
          if (stale) {
            res.json({ ...stale, stale: true });
            return;
          }
          res.status(ajaxRes.status || 404).json({
            success: false,
            blockedByCloudflare: Boolean(ajaxRes.blockedByUpstream || ajaxRes.status === 403),
            error: formatAnimeWorldUpstreamError(
              ajaxRes.status,
              ajaxRes.blockedByUpstream,
              'episodes endpoint'
            ),
          });
          return;
        }

        const payload = {
          success: true,
          source: `${primaryUsedBase}/season`,
          season: {
            seasonId,
            animeTitle: seriesSlug,
            seasonName: `Season ${seasonNum}`,
            totalEpisodes: String(episodes.length),
          },
          episodes,
        };
        if (episodes.length > 0) {
          writeAwParsedCache(cacheKey, payload, 180_000, 20 * 60_000);
        }
        res.json(payload);
        return;
      }

      // Support slug-style seasonId like "<seriesSlug>__season-<N>" or "<seriesSlug>-season-<N>"
      const slugMatch = seasonId.match(/^(.+?)(?:__|-)season-(\d+)$/i);
      const seriesSlug = slugMatch ? slugMatch[1] : seasonId;
      const targetSeasonNum = slugMatch ? slugMatch[2] : '1';
      const seriesPage = await fetchAnimeWorldPathWithMirrors(
        (base) => `${base}/series/${encodeURIComponent(seriesSlug)}/`
      );
      if (!seriesPage.ok || !seriesPage.html) {
        const stale = readAwParsedCache(cacheKey, true);
        if (stale) {
          res.json({ ...stale, stale: true });
          return;
        }
        res.status(seriesPage.status || 404).json({
          success: false,
          blockedByCloudflare: Boolean(seriesPage.blockedByUpstream || seriesPage.status === 403),
          error: formatAnimeWorldUpstreamError(
            seriesPage.status,
            seriesPage.blockedByUpstream,
            `season "${seasonId}"`
          ),
        });
        return;
      }

      const usedBase = seriesPage.upstream || ANIMEWORLD_UPSTREAM;
      const $series = cheerio.load(seriesPage.html);
      const animeTitle = $series('h1.hero-title, h1.entry-title').first().text().trim() || seriesSlug;
      const matchingBtn = $series(
        `a.season-btn.sel-temp[data-season="${targetSeasonNum}"], a[data-post][data-season="${targetSeasonNum}"]`
      ).first();
      const postId = matchingBtn.attr('data-post');

      let episodes: Array<Record<string, unknown>> = [];
      if (postId && targetSeasonNum !== '1') {
        const ajaxUrl = `${usedBase}/wp-admin/admin-ajax.php?action=action_select_season&season=${encodeURIComponent(
          targetSeasonNum
        )}&post=${encodeURIComponent(postId)}`;
        const ajaxRes = await fetchAnimeWorldHtml(ajaxUrl, {
          upstreamBase: usedBase,
          isAjax: true,
        });
        if (ajaxRes.ok && ajaxRes.html) {
          episodes = parseEpisodesFromAnimeWorldHtml(ajaxRes.html).episodes;
        }
      } else {
        episodes = parseEpisodesFromAnimeWorldHtml(seriesPage.html).episodes;
      }

      const payload = {
        success: true,
        source: `${usedBase}/season`,
        season: {
          seasonId,
          animeTitle,
          seasonName: `Season ${targetSeasonNum}`,
          totalEpisodes: String(episodes.length),
        },
        episodes,
      };
      if (episodes.length > 0) {
        writeAwParsedCache(cacheKey, payload, 180_000, 20 * 60_000);
      }
      res.json(payload);
    } catch (err) {
      const stale = readAwParsedCache(cacheKey, true);
      if (stale) {
        res.json({ ...stale, stale: true });
        return;
      }
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch episodes.',
      });
    }
  });

  app.get('/api/anime-world-india/v1/stream.php', requireFirebaseAuth, async (req: Request, res: Response) => {
    if (await tryProxyAnimeWorldPhpApi('stream.php', req, res)) return;
    const episodeId = typeof req.query.episodeId === 'string' ? req.query.episodeId.trim() : '';
    const movieId = typeof req.query.movieId === 'string' ? req.query.movieId.trim() : '';
    const requestedLang = typeof req.query.lang === 'string' ? req.query.lang.trim().toLowerCase() : 'hindi';

    if (!episodeId && !movieId) {
      res.status(400).json({ success: false, error: 'Missing episodeId or movieId' });
      return;
    }

    const type = episodeId ? 'episode' : 'movie';
    const pathSegment = episodeId
      ? `/episode/${encodeURIComponent(episodeId)}/`
      : `/movies/${encodeURIComponent(movieId)}/`;

    try {
      const { ok, status, html, upstream, blockedByUpstream } =
        await fetchAnimeWorldPathWithMirrors((base) => `${base}${pathSegment}`);
      const usedBase = upstream || ANIMEWORLD_UPSTREAM;
      const targetUrl = `${usedBase}${pathSegment}`;
      if (!ok || !html) {
        res.status(status === 404 ? 404 : status || 502).json({
          success: false,
          blockedByCloudflare: Boolean(blockedByUpstream || status === 403),
          error: formatAnimeWorldUpstreamError(status, blockedByUpstream, 'stream endpoint'),
        });
        return;
      }

      const $ = cheerio.load(html);
      const pageMeta = extractAnimeWorldPageMeta($, episodeId || movieId);
      const iframeSrcs: string[] = [];
      $('#aa-options iframe, .video-player iframe, .video-embed iframe, .VideoPlayer iframe').each((_, el) => {
        const s = ($(el).attr('src') || $(el).attr('data-src') || '').trim();
        if (s && s.startsWith('http') && !iframeSrcs.includes(s)) {
          iframeSrcs.push(s);
        }
      });

      const rawDownloadCandidate =
        $('.archive-link-wrap a, a[download], a.btn-download').first().attr('href') || null;
      const downloadLink = isGenuineMediaDownloadUrl(rawDownloadCandidate)
        ? rawDownloadCandidate
        : null;

      const streams: Array<{
        language: string;
        url: string;
        type: 'hls' | 'mp4' | 'embed';
        label: string;
      }> = [];
      const audioLanguages: string[] = [];
      let hindiStreamLink: string | null = null;
      let englishStreamLink: string | null = null;
      let japaneseStreamLink: string | null = null;
      let directMultiHlsLink: string | null = null;
      let directMultiReferer: string | null = null;
      let hasHindiAudio = false;

      // 1. Parse multi-lang-plyr.php?data=<base64 JSON> or plyr/player.php?data=<base64 JSON>
      for (const src of iframeSrcs) {
        if ((src.includes('multi-lang-plyr.php') || src.includes('plyr/player.php')) && src.includes('data=')) {
          try {
            const parsedUrl = new URL(src);
            const rawData = parsedUrl.searchParams.get('data');
            if (rawData) {
              const entries = JSON.parse(Buffer.from(rawData, 'base64').toString('utf8')) as Array<{
                language?: string;
                link?: string;
              }>;
              for (const entry of entries) {
                const lang = (entry.language || '').trim();
                const link = (entry.link || '').trim();
                if (!lang || !link) continue;
                if (!audioLanguages.includes(lang)) audioLanguages.push(lang);
                const lowerLang = lang.toLowerCase();
                if (lowerLang === 'hindi' || lowerLang === 'hin') {
                  hasHindiAudio = true;
                  if (!hindiStreamLink) hindiStreamLink = link;
                } else if (lowerLang === 'english' || lowerLang === 'eng') {
                  if (!englishStreamLink) englishStreamLink = link;
                } else if (lowerLang === 'japanese' || lowerLang === 'jpn') {
                  if (!japaneseStreamLink) japaneseStreamLink = link;
                }
                streams.push({
                  language: lang,
                  url: link,
                  type: classifyAnimeWorldStreamType(link),
                  label: `AnimeWorld India · ${lang} Embed`,
                });
              }
            }
          } catch {
            // ignore malformed base64 payload
          }
        }
      }

      // 2. Inspect non-multi-lang iframes (ravok.buzz direct multi-audio HLS + embed, or megaplay)
      let ravokUrl: string | null = null;
      for (const src of iframeSrcs) {
        if (src.includes('multi-lang-plyr.php') || src.includes('plyr/player.php')) continue;
        if (src.includes('ravok.buzz')) {
          ravokUrl = src;
          const ravokDetails = await resolveRavokStreamDetails(src, `${usedBase}/`);
          const ravokLangs = ravokDetails.languages;
          for (const l of ravokLangs) {
            if (!audioLanguages.includes(l)) audioLanguages.push(l);
          }
          const ravokHasHindi = ravokLangs.some((l) => l.toLowerCase() === 'hindi');
          if (ravokHasHindi) {
            hasHindiAudio = true;
          }
          if (ravokDetails.hlsUrl) {
            directMultiHlsLink = ravokDetails.hlsUrl;
            directMultiReferer = ravokDetails.refererOrigin;
            streams.unshift({
              language: ravokHasHindi ? 'Multi-Audio (Hindi)' : ravokLangs[0] || 'Multi-Audio',
              url: ravokDetails.hlsUrl,
              type: 'hls',
              label:
                ravokLangs.length > 0
                  ? `AnimeWorld India · Direct Multi-Audio HLS (${ravokLangs.join(', ')})`
                  : 'AnimeWorld India · Direct HLS Stream',
            });
          }
          streams.push({
            language: ravokHasHindi ? 'Multi-Audio (Hindi)' : ravokLangs[0] || 'Multi-Audio',
            url: src,
            type: 'embed',
            label: ravokHasHindi
              ? 'AnimeWorld India · PlayX Embed (Hindi Verified)'
              : ravokLangs.length > 0
                ? `AnimeWorld India · PlayX Embed (${ravokLangs.join(', ')})`
                : 'AnimeWorld India · PlayX Embed',
          });
        } else if (src.includes('megaplay.buzz')) {
          const isDub = src.toLowerCase().includes('/dub');
          const lang = isDub ? 'English' : 'Japanese';
          if (!audioLanguages.includes(lang)) audioLanguages.push(lang);
          if (isDub && !englishStreamLink) englishStreamLink = src;
          if (!isDub && !japaneseStreamLink) japaneseStreamLink = src;
          streams.push({
            language: lang,
            url: src,
            type: 'embed',
            label: isDub ? 'AnimeWorld India · English Dub' : 'AnimeWorld India · Japanese Sub',
          });
        } else {
          streams.push({
            language: 'Unknown',
            url: src,
            type: classifyAnimeWorldStreamType(src),
            label: 'AnimeWorld India · Mirror',
          });
        }
      }

      // Keep only verified HTTP(S) URLs and prioritize direct HLS over blocked external iframes!
      const validStreams = streams.filter((s) => isValidHttpUrl(s.url));
      const priorityFor = (item: { language: string; type: string }) => {
        if (item.type === 'hls') return -1;
        const lower = item.language.toLowerCase();
        if (requestedLang === 'dub' || requestedLang === 'english') {
          return lower.includes('english') ? 0 : lower.includes('multi-audio') ? 1 : 2;
        }
        if (requestedLang === 'sub' || requestedLang === 'japanese') {
          return lower.includes('japanese') ? 0 : lower.includes('multi-audio') ? 1 : 2;
        }
        return lower.includes('hindi') ? 0 : 1;
      };
      validStreams.sort((a, b) => priorityFor(a) - priorityFor(b));

      let primaryCandidate: string | null = null;
      if (directMultiHlsLink) {
        if (
          (requestedLang === 'hindi' && hasHindiAudio) ||
          (requestedLang === 'dub' && audioLanguages.some((l) => l.toLowerCase() === 'english')) ||
          (requestedLang === 'sub' && audioLanguages.some((l) => l.toLowerCase() === 'japanese')) ||
          audioLanguages.length === 0
        ) {
          primaryCandidate = directMultiHlsLink;
        }
      }
      if (!primaryCandidate) {
        if (requestedLang === 'dub' || requestedLang === 'english') {
          primaryCandidate = englishStreamLink || validStreams[0]?.url || downloadLink || null;
        } else if (requestedLang === 'sub' || requestedLang === 'japanese') {
          primaryCandidate = japaneseStreamLink || validStreams[0]?.url || downloadLink || null;
        } else {
          primaryCandidate =
            hindiStreamLink || (hasHindiAudio && ravokUrl) || validStreams[0]?.url || downloadLink || null;
        }
      }
      const primaryLink = isValidHttpUrl(primaryCandidate) ? primaryCandidate : validStreams[0]?.url || null;

      logProviderDiagnostic('animeworld-india', 'stream', {
        id: episodeId || movieId,
        type,
        requestedLang,
        streamCount: validStreams.length,
        hasDirectHls: Boolean(directMultiHlsLink),
        hasHindiAudio,
        audioLanguages,
        hasPrimaryLink: Boolean(primaryLink),
      });

      if (!primaryLink) {
        res.status(404).json({
          success: false,
          error: 'AnimeWorld India returned no playable stream link for this item.',
        });
        return;
      }

      res.json({
        success: true,
        type,
        source: targetUrl,
        title: pageMeta.title,
        poster: pageMeta.poster,
        banner: pageMeta.banner,
        year: pageMeta.year,
        rating: pageMeta.rating,
        description: pageMeta.description,
        hasHindiAudio,
        audioLanguages,
        ...(directMultiReferer ? { headers: { Referer: directMultiReferer } } : {}),
        stream: {
          streamLink: primaryLink,
          file: downloadLink,
          type: classifyAnimeWorldStreamType(primaryLink),
        },
        streams: validStreams,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load AnimeWorld India stream.';
      logProviderDiagnostic('animeworld-india', 'stream-error', {
        id: episodeId || movieId,
        error: msg,
      });
      res.status(502).json({
        success: false,
        error: msg,
      });
    }
  });

  // Safe image proxy fallback for ISP-blocked poster/thumbnail hosts (e.g. image.tmdb.org without VPN)
  app.get('/api/anime-world-india/v1/image.php', async (req: Request, res: Response) => {
    applyProtectedCorsHeaders(req, res, { methods: 'GET, HEAD, OPTIONS', allowCredentials: true });
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl || !isAllowedAwImageUrl(rawUrl)) {
      res.status(403).json({ success: false, error: 'Image host is not in allowlist.' });
      return;
    }

    try {
      let currentUrl = new URL(normalizeUrl(rawUrl));
      let upstream: globalThis.Response | null = null;
      for (let hop = 0; hop < 4; hop++) {
        if (!isAllowedAwImageUrl(currentUrl.toString())) {
          res.status(403).json({ success: false, error: 'Redirect image host blocked.' });
          return;
        }
        const r = await fetchWithTimeout(
          currentUrl.toString(),
          {
            method: 'GET',
            redirect: 'manual',
            headers: {
              'User-Agent': BROWSER_UA,
              Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
              Referer: `${ANIMEWORLD_UPSTREAM}/`,
            },
          },
          10000
        );
        if (r.status >= 300 && r.status < 400) {
          const loc = r.headers.get('location');
          if (!loc) break;
          currentUrl = new URL(loc, currentUrl);
          continue;
        }
        upstream = r;
        break;
      }

      if (!upstream || !upstream.ok) {
        res.status(upstream?.status || 502).end();
        return;
      }

      const contentLen = Number(upstream.headers.get('content-length') || 0);
      if (contentLen > 6 * 1024 * 1024) {
        res.status(413).end();
        return;
      }

      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length > 6 * 1024 * 1024) {
        res.status(413).end();
        return;
      }

      const verified = detectVerifiedImageFormat(buffer);
      if (!verified) {
        res.status(415).end();
        return;
      }

      res.setHeader('Content-Type', verified.mime);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(buffer);
    } catch {
      if (!res.headersSent) {
        res.status(502).end();
      }
    }
  });

  app.post('/api/anilist', requireFirebaseAuth, jsonParser, async (req: Request, res: Response) => {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const variables =
      body.variables && typeof body.variables === 'object' ? body.variables : {};

    if (!query || query.length > 20000) {
      res.status(400).json({ errors: [{ message: 'Invalid AniList GraphQL query.' }] });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const upstream = await fetch(ANILIST_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      const rawText = await upstream.text();
      res.status(upstream.status);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(rawText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AniList upstream request failed.';
      res.status(502).json({ errors: [{ message: msg }] });
    } finally {
      clearTimeout(timer);
    }
  });

  app.get('/api/anime/anizip/:anilistId', requireFirebaseAuth, async (req: Request, res: Response) => {
    const anilistId = Number(req.params.anilistId);
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      res.status(400).json({ found: false, error: 'Invalid AniList ID.' });
      return;
    }
    const data = await fetchAniZipMetadata(anilistId);
    res.json(data);
  });

  app.get('/api/anime/skip/:malId/:episodeNumber', requireFirebaseAuth, async (req: Request, res: Response) => {
    const malId = Number(req.params.malId);
    const episodeNumber = Number(req.params.episodeNumber);
    const episodeLength = Number(req.query.length || 0);
    if (!Number.isFinite(malId) || malId <= 0 || !Number.isFinite(episodeNumber) || episodeNumber <= 0) {
      res.status(400).json({ found: false, skipTimes: [] });
      return;
    }
    const data = await fetchAniSkipTimestamps(malId, episodeNumber, episodeLength);
    res.json(data);
  });

  app.get('/api/anime/info/:id', requireFirebaseAuth, async (req: Request, res: Response) => {
    const anilistId = req.params.id;
    const base =
      typeof req.query.base === 'string' && req.query.base.startsWith('http')
        ? req.query.base.replace(/\/+$/, '')
        : DEFAULT_STREAMING_API;
    const dub = req.query.dub === 'true' ? '?dub=true' : '';
    const upstreamUrl = `${base}/meta/anilist/info/${encodeURIComponent(anilistId)}${dub}`;

    const cachedDown = primaryUnavailableCache.get(base);
    if (cachedDown && cachedDown.expiresAt > Date.now()) {
      res.status(200).json({
        episodes: [],
        upstreamError: {
          statusCode: cachedDown.data.statusCode,
          endpointUrl: upstreamUrl,
          message: cachedDown.data.message,
          detail: cachedDown.data.detail,
        },
      });
      return;
    }

    try {
      const upstream = await fetchWithTimeout(
        upstreamUrl,
        {
          headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
        },
        3500
      );

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        const msg =
          upstream.status === 402
            ? 'Configured external streaming API returned HTTP 402 (Deployment Disabled).'
            : `External streaming info API returned HTTP ${upstream.status}.`;
        if (upstream.status === 402 || upstream.status === 502 || upstream.status === 503) {
          primaryUnavailableCache.set(base, {
            expiresAt: Date.now() + 3 * 60 * 1000,
            data: { statusCode: upstream.status, message: msg, detail: text.slice(0, 200) },
          });
        }
        res.status(200).json({
          episodes: [],
          upstreamError: {
            statusCode: upstream.status,
            endpointUrl: upstreamUrl,
            message: msg,
            detail: text.slice(0, 200),
          },
        });
        return;
      }

      const json = await upstream.json();
      res.json(json);
    } catch (err) {
      res.status(200).json({
        episodes: [],
        upstreamError: {
          endpointUrl: upstreamUrl,
          message: err instanceof Error ? err.message : 'Upstream info request failed.',
        },
      });
    }
  });

  app.get('/api/anime/audio-availability', requireFirebaseAuth, async (req: Request, res: Response) => {
    const anilistId = Number(req.query.anilistId || 0);
    let malId = Number(req.query.malId || 0);
    const ep = Math.max(1, Number(req.query.ep || 1));
    const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
    const romajiTitle = typeof req.query.romajiTitle === 'string' ? req.query.romajiTitle.trim() : '';
    const format = typeof req.query.format === 'string' ? req.query.format.trim() : '';

    const cacheKey = `${anilistId || malId}:${ep}:${(title || romajiTitle).toLowerCase()}`;
    const cached = audioAvailabilityCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    if (!malId && anilistId > 0) {
      const resolved = await resolveMalIdFromAnilist(anilistId);
      if (resolved) {
        malId = resolved;
      } else {
        const aniZip = await fetchAniZipMetadata(anilistId);
        const zipMal = (aniZip.mappings as { malId?: number | null } | undefined)?.malId;
        if (typeof zipMal === 'number' && zipMal > 0) malId = zipMal;
      }
    }

    const [subStatus, dubStatus, hindiStatus] = await Promise.all([
      malId > 0
        ? checkMegavidAudioAvailability(malId, ep, 'sub')
        : Promise.resolve({
            available: false,
            verified: false,
            reason: 'Missing MyAnimeList ID for SUB lookup.',
          }),
      malId > 0
        ? checkMegavidAudioAvailability(malId, ep, 'dub')
        : Promise.resolve({
            available: false,
            verified: false,
            reason: 'Missing MyAnimeList ID for English DUB lookup.',
          }),
      probeAnimeWorldHindiAvailability({ title, romajiTitle, format, episodeNumber: ep }),
    ]);

    const payload = {
      anilistId: anilistId || undefined,
      malId: malId || null,
      episodeNumber: ep,
      sub: subStatus,
      dub: dubStatus,
      hindi: hindiStatus,
      checkedAt: new Date().toISOString(),
    };

    audioAvailabilityCache.set(cacheKey, {
      expiresAt: Date.now() + 5 * 60 * 1000,
      data: payload,
    });
    res.json(payload);
  });

  app.get('/api/anime/servers/:episodeId', requireFirebaseAuth, async (req: Request, res: Response) => {
    const episodeId = req.params.episodeId;
    const base =
      typeof req.query.base === 'string' && req.query.base.startsWith('http')
        ? req.query.base.replace(/\/+$/, '')
        : DEFAULT_STREAMING_API;
    const upstreamUrl = `${base}/meta/anilist/servers/${encodeURIComponent(episodeId)}`;

    const cachedDown = primaryUnavailableCache.get(base);
    if (!cachedDown || cachedDown.expiresAt <= Date.now()) {
      try {
        const upstream = await fetchWithTimeout(
          upstreamUrl,
          { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
          3000
        );
        if (upstream.ok) {
          const data = await upstream.json();
          if (Array.isArray(data) && data.length > 0) {
            const filtered = data.filter((s) => {
              const name =
                typeof s === 'string'
                  ? s
                  : s && typeof s === 'object' && typeof (s as { name?: unknown }).name === 'string'
                    ? (s as { name: string }).name
                    : '';
              return !name.toLowerCase().includes('animeworld');
            });
            const hasMunchyroll = filtered.some((s) => {
              const name =
                typeof s === 'string'
                  ? s
                  : s && typeof s === 'object' && typeof (s as { name?: unknown }).name === 'string'
                    ? (s as { name: string }).name
                    : '';
              return name.toLowerCase() === 'munchyroll';
            });
            const resultList = hasMunchyroll ? filtered : [...filtered, { name: 'munchyroll' }];
            res.json(resultList.length > 0 ? resultList : SUB_DUB_STREAM_SERVERS);
            return;
          }
        } else if (upstream.status === 402 || upstream.status === 502 || upstream.status === 503) {
          primaryUnavailableCache.set(base, {
            expiresAt: Date.now() + 3 * 60 * 1000,
            data: {
              statusCode: upstream.status,
              message: `Primary endpoint (${base}) returned HTTP ${upstream.status}.`,
            },
          });
        }
      } catch {
        // fall through to standard provider list
      }
    }

    res.json(SUB_DUB_STREAM_SERVERS);
  });

  app.get('/api/munchyroll/search', requireFirebaseAuth, async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const count = Math.min(25, Math.max(1, Number(req.query.perPage || 10)));
    if (!query) {
      res.status(400).json({ message: 'Query parameter "q" is required.' });
      return;
    }
    const baseRes = resolveSafeConsumetBase(req.query.consumetBase);
    if (!baseRes.ok) {
      res.status(400).json({ message: baseRes.message });
      return;
    }
    const searchUrl = `${baseRes.url}/meta/anilist/${encodeURIComponent(query)}?page=1&perPage=${count}`;
    try {
      const upstream = await fetchWithTimeout(
        searchUrl,
        { headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA } },
        7500
      );
      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '');
        res.status(upstream.status).json({
          message: formatConsumetHttpError(baseRes.url, upstream.status, text, searchUrl),
          endpointUrl: searchUrl,
        });
        return;
      }
      res.json(await upstream.json());
    } catch (err) {
      res.status(502).json({
        message: err instanceof Error ? err.message : 'Munchyroll search failed.',
        endpointUrl: searchUrl,
      });
    }
  });

  app.get('/api/munchyroll/episodes/:anilistId', requireFirebaseAuth, async (req: Request, res: Response) => {
    const anilistId = Number(req.params.anilistId || 0);
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      res.status(400).json({ message: 'A valid numeric AniList ID is required.' });
      return;
    }
    const baseRes = resolveSafeConsumetBase(req.query.consumetBase);
    if (!baseRes.ok) {
      res.status(400).json({ message: baseRes.message });
      return;
    }
    const category = req.query.dub === 'true' || req.query.category === 'dub' ? 'dub' : 'sub';
    const lookup = await fetchMunchyrollConsumetEpisodes({
      consumetBase: baseRes.url,
      anilistId,
      category,
    });
    if (!lookup.ok) {
      res.status(lookup.statusCode || 502).json({
        message: lookup.message,
        endpointUrl: lookup.endpointUrl,
        episodes: [],
      });
      return;
    }
    res.json({
      source: 'munchyroll',
      provider: lookup.providerUsed,
      endpointUrl: lookup.endpointUrl,
      episodes: lookup.episodes,
    });
  });

  app.get('/api/munchyroll/watch', requireFirebaseAuth, async (req: Request, res: Response) => {
    const baseRes = resolveSafeConsumetBase(req.query.consumetBase);
    if (!baseRes.ok) {
      res.status(400).json({ message: baseRes.message });
      return;
    }
    const anilistId = Number(req.query.anilistId || 0);
    const malId = Number(req.query.malId || 0) || undefined;
    const episodeId = typeof req.query.episodeId === 'string' ? req.query.episodeId : '';
    const episodeNumber = Math.max(1, Number(req.query.ep || 1));
    const category: 'sub' | 'dub' | 'hindi' =
      req.query.category === 'hindi' ? 'hindi' : req.query.category === 'dub' ? 'dub' : 'sub';

    const result = await resolveFromMunchyroll({
      consumetBase: baseRes.url,
      anilistId,
      malId,
      episodeId,
      episodeNumber,
      category,
    });

    if (!result.ok || !result.payload) {
      res.status(result.statusCode || 502).json({
        message: result.message || 'Munchyroll stream unavailable.',
        endpointUrl: result.endpointUrl,
      });
      return;
    }
    res.json(result.payload);
  });

  app.get('/api/anime/watch/:episodeId', requireFirebaseAuth, async (req: Request, res: Response) => {
    const episodeId = (req.params.episodeId || '').trim();
    if (!episodeId || episodeId === 'EPISODE_ID') {
      res.status(400).json({
        message: 'A valid episodeId is required instead of the placeholder EPISODE_ID.',
      });
      return;
    }

    const base =
      typeof req.query.base === 'string' && req.query.base.startsWith('http')
        ? req.query.base.replace(/\/+$/, '')
        : DEFAULT_STREAMING_API;
    const server = typeof req.query.server === 'string' ? req.query.server.trim() : 'vidstreaming';
    const category: 'sub' | 'dub' | 'hindi' = req.query.category === 'hindi' ? 'hindi' : req.query.category === 'dub' ? 'dub' : 'sub';
    const epQuery = Number(req.query.ep || 0);
    const anilistId = Number(req.query.anilistId || 0);
    let malId = Number(req.query.malId || 0);

    const serverLower = server.toLowerCase();
    if (serverLower === 'animeworld-india') {
      res.status(400).json({
        message:
          'AnimeWorld-India uses /api/anime-world-india/v1/ (search.php, seasons.php, episodes.php, stream.php) with native AnimeWorld IDs rather than AniList IDs.',
      });
      return;
    }

    if (category === 'hindi') {
      res.status(404).json({
        message: `Hindi (DUB) audio track is not available on ${server || 'this server'}. Only Japanese (SUB) and English (DUB) are served here — switch to AnimeWorld-India for verified Hindi audio, or choose Japanese (SUB) / English (DUB).`,
      });
      return;
    }

    if (serverLower === 'munchyroll') {
      const baseRes = resolveSafeConsumetBase(req.query.consumetBase);
      if (!baseRes.ok) {
        res.status(400).json({ message: baseRes.message });
        return;
      }
      const epMatch = episodeId.match(/(?:episode|ep)[-_]?(\d+)/i);
      const episodeNumber = epQuery > 0 ? epQuery : epMatch ? Number(epMatch[1]) : 1;
      const munchRes = await resolveFromMunchyroll({
        consumetBase: baseRes.url,
        anilistId,
        malId: malId > 0 ? malId : undefined,
        episodeId,
        episodeNumber,
        category,
      });
      if (munchRes.ok && munchRes.payload) {
        res.json(munchRes.payload);
        return;
      }
      res.status(munchRes.statusCode || 502).json({
        message: munchRes.message || 'Munchyroll Consumet stream unavailable.',
        endpointUrl: munchRes.endpointUrl,
        source: 'munchyroll',
      });
      return;
    }

    // 1. Try primary configured Consumet-compatible endpoint first (skip immediately if recently returned 402/502/503)
    const params = new URLSearchParams();
    if (server) params.set('server', server);
    params.set('category', category);
    const primaryUrl = `${base}/meta/anilist/watch/${encodeURIComponent(episodeId)}?${params.toString()}`;

    let primaryErrorMsg = '';
    let primaryStatus = 0;

    const cachedDown = primaryUnavailableCache.get(base);
    if (cachedDown && cachedDown.expiresAt > Date.now()) {
      primaryStatus = cachedDown.data.statusCode;
      primaryErrorMsg = cachedDown.data.message;
    } else {
      try {
        const upstream = await fetchWithTimeout(
          primaryUrl,
          {
            headers: {
              Accept: 'application/json',
              'User-Agent': BROWSER_UA,
            },
          },
          3500
        );

        if (upstream.ok) {
          const data = (await upstream.json()) as Record<string, unknown>;
          const sources = Array.isArray(data.sources) ? data.sources : [];
          if (sources.length > 0) {
            res.json(data);
            return;
          }
          primaryStatus = 404;
          primaryErrorMsg = 'Primary streaming API returned no playable sources.';
        } else {
          primaryStatus = upstream.status;
          const body = await upstream.text().catch(() => '');
          primaryErrorMsg =
            upstream.status === 402
              ? `Primary endpoint (${base}) returned HTTP 402 (DEPLOYMENT_DISABLED).`
              : `Primary endpoint returned HTTP ${upstream.status}: ${body.slice(0, 120)}`;
          if (upstream.status === 402 || upstream.status === 502 || upstream.status === 503) {
            primaryUnavailableCache.set(base, {
              expiresAt: Date.now() + 3 * 60 * 1000,
              data: { statusCode: upstream.status, message: primaryErrorMsg, detail: body.slice(0, 200) },
            });
          }
        }
      } catch (err) {
        primaryErrorMsg =
          err instanceof Error ? err.message : 'Primary streaming endpoint unreachable.';
      }
    }

    // 2. Fallback to verified MAL-indexed stream resolver when primary Consumet endpoint is disabled/unavailable
    if (!malId && anilistId > 0) {
      const resolved = await resolveMalIdFromAnilist(anilistId);
      if (resolved) {
        malId = resolved;
      } else {
        const aniZip = await fetchAniZipMetadata(anilistId);
        const zipMal = (aniZip.mappings as { malId?: number | null } | undefined)?.malId;
        if (typeof zipMal === 'number' && zipMal > 0) {
          malId = zipMal;
        }
      }
    }

    const epMatch = episodeId.match(/(?:episode|ep)[-_]?(\d+)/i);
    const episodeNumber = epQuery > 0 ? epQuery : epMatch ? Number(epMatch[1]) : 1;

    if (malId > 0 && episodeNumber > 0) {
      const [fallback, aniSkip] = await Promise.all([
        resolveFromMegavid(malId, episodeNumber, category, server),
        fetchAniSkipTimestamps(malId, episodeNumber),
      ]);

      if (fallback.ok && fallback.payload) {
        const payload = { ...fallback.payload } as Record<string, unknown>;
        if (!payload.intro && aniSkip.intro) payload.intro = aniSkip.intro;
        if (!payload.outro && aniSkip.outro) payload.outro = aniSkip.outro;
        if (!payload.recap && aniSkip.recap) payload.recap = aniSkip.recap;

        res.json({
          ...payload,
          malId,
          primaryEndpointNotice: primaryErrorMsg || undefined,
        });
        return;
      }

      res.status(fallback.statusCode || 404).json({
        message: fallback.message || primaryErrorMsg || 'Episode stream unavailable.',
        endpointUrl: primaryUrl,
        primaryStatus,
      });
      return;
    }

    res.status(primaryStatus || 502).json({
      message:
        primaryErrorMsg ||
        'Unable to resolve episode stream. Missing MyAnimeList ID for fallback resolver.',
      endpointUrl: primaryUrl,
      primaryStatus,
    });
  });

  app.options('/api/anime/proxy', (req: Request, res: Response) => {
    applyProtectedCorsHeaders(req, res, { methods: 'GET, HEAD, OPTIONS', allowCredentials: true });
    res.status(204).end();
  });

  const handleProxyRequest = async (req: Request, res: Response) => {
    applyProtectedCorsHeaders(req, res, { methods: 'GET, HEAD, OPTIONS', allowCredentials: true });

    let isAuthorizedProxyCaller = PUBLIC_GUEST_MODE;
    let proxyAuthStatus = 401;
    let proxyAuthCode = 'MISSING_TOKEN';
    let proxyAuthError = 'Authentication required for video stream access.';

    if (req.headers.authorization) {
      const bearerCheck = await verifyFirebaseUserRequest(req);
      if (bearerCheck.ok && bearerCheck.isEmailVerified) {
        isAuthorizedProxyCaller = true;
      } else {
        proxyAuthStatus = bearerCheck.ok ? 401 : bearerCheck.status;
        proxyAuthCode = bearerCheck.ok ? 'EMAIL_UNVERIFIED' : bearerCheck.code || 'INVALID_TOKEN';
        proxyAuthError = bearerCheck.ok
          ? 'Email verification is required to access streaming content.'
          : bearerCheck.error || 'Invalid or expired authentication token.';
      }
    } else {
      const cookieSession = verifyStreamSessionCookie(req);
      if (cookieSession.valid) {
        isAuthorizedProxyCaller = true;
      }
    }

    if (!isAuthorizedProxyCaller) {
      res.status(proxyAuthStatus).json({
        success: false,
        error: proxyAuthError,
        message: proxyAuthError,
        code: proxyAuthCode,
      });
      return;
    }

    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const rawReferer = typeof req.query.referer === 'string' ? req.query.referer.trim() : '';
    const expectMedia = req.query.expectMedia === '1' || req.query.expectMedia === 'true';
    const disableReferer = rawReferer.toLowerCase() === 'none';
    const referer = disableReferer
      ? ''
      : rawReferer.startsWith('http')
        ? rawReferer
        : 'https://megavid.buzz/';

    if (!rawUrl) {
      res.status(400).json({ message: 'Missing url parameter.' });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizeUrl(rawUrl));
    } catch {
      res.status(400).json({ message: 'Invalid url parameter.' });
      return;
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol) || isBlockedPrivateHost(parsedUrl.hostname)) {
      res.status(403).json({ message: 'Blocked upstream host.' });
      return;
    }

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      Accept: '*/*',
    };
    if (referer) {
      upstreamHeaders.Referer = referer;
    }
    if (typeof req.headers.range === 'string' && req.headers.range.trim()) {
      upstreamHeaders.Range = req.headers.range;
    }
    if (typeof req.headers['if-range'] === 'string' && req.headers['if-range'].trim()) {
      upstreamHeaders['If-Range'] = req.headers['if-range'];
    }

    const fetchFollowingSafeRedirects = async (
      initialUrl: URL,
      method: 'GET' | 'HEAD'
    ): Promise<{ upstream: globalThis.Response; finalUrl: URL }> => {
      let currentUrl = initialUrl;
      for (let hop = 0; hop < 6; hop++) {
        const response = await fetchWithTimeout(
          currentUrl.toString(),
          {
            method,
            redirect: 'manual',
            headers: upstreamHeaders,
          },
          25000
        );

        const isRedirect = response.status >= 300 && response.status < 400;
        const locationHeader = response.headers.get('location');
        if (!isRedirect || !locationHeader) {
          return { upstream: response, finalUrl: currentUrl };
        }

        let nextUrl: URL;
        try {
          nextUrl = new URL(locationHeader, currentUrl);
        } catch {
          throw new Error('Upstream returned a malformed redirect location.');
        }

        if (!['http:', 'https:'].includes(nextUrl.protocol) || isBlockedPrivateHost(nextUrl.hostname)) {
          const blockedErr = new Error('Redirect target host is blocked by security policy.') as Error & {
            statusCode?: number;
          };
          blockedErr.statusCode = 403;
          throw blockedErr;
        }
        currentUrl = nextUrl;
      }
      throw new Error('Upstream proxy exceeded maximum redirect hops.');
    };

    try {
      const method = req.method === 'HEAD' ? 'HEAD' : 'GET';
      const { upstream, finalUrl } = await fetchFollowingSafeRedirects(parsedUrl, method);

      if (!upstream.ok && upstream.status !== 206) {
        res.status(upstream.status).send(`Upstream proxy error: HTTP ${upstream.status}`);
        return;
      }

      const lowerPath = finalUrl.pathname.toLowerCase();
      let contentType = upstream.headers.get('content-type') || 'application/octet-stream';
      const lowerCt = contentType.toLowerCase();

      if (expectMedia && (lowerCt.includes('text/html') || lowerCt.includes('application/xhtml+xml'))) {
        res.status(415).json({
          success: false,
          error: 'Upstream URL returned an HTML player/page instead of a downloadable media file.',
          message: 'Upstream URL returned an HTML player/page instead of a downloadable media file.',
          contentType,
        });
        return;
      }

      if (
        lowerPath.endsWith('.ts') &&
        (!contentType || lowerCt.includes('linguist') || lowerCt.includes('octet-stream'))
      ) {
        contentType = 'video/mp2t';
      } else if (lowerPath.endsWith('.m4s') && lowerCt.includes('octet-stream')) {
        contentType = 'video/iso.segment';
      } else if (lowerPath.endsWith('.mp4') && lowerCt.includes('octet-stream')) {
        contentType = 'video/mp4';
      } else if (lowerPath.endsWith('.webm') && lowerCt.includes('octet-stream')) {
        contentType = 'video/webm';
      }

      if (req.method === 'HEAD') {
        res.status(upstream.status);
        res.setHeader('Content-Type', contentType);
        const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
        res.setHeader('Accept-Ranges', acceptRanges);
        const len = upstream.headers.get('content-length');
        if (len && !upstream.headers.get('content-encoding')) {
          res.setHeader('Content-Length', len);
        }
        const disp = upstream.headers.get('content-disposition');
        if (disp) res.setHeader('Content-Disposition', disp);
        res.end();
        return;
      }

      if (lowerPath.endsWith('.srt') || lowerCt.includes('subrip')) {
        const srtText = await upstream.text();
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.send(convertSrtToVtt(srtText));
        return;
      }

      const maybePlaylist =
        lowerCt.includes('mpegurl') ||
        lowerPath.endsWith('.m3u8') ||
        lowerPath.endsWith('.m3u') ||
        lowerPath.endsWith('.txt');

      if (maybePlaylist) {
        const textBody = await upstream.text();
        if (textBody.includes('#EXTM3U')) {
          const rawForwardedHost = (req.headers['x-forwarded-host'] || req.headers.host || '')
            .toString()
            .split(',')[0]
            .trim();
          const forwardedHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(rawForwardedHost)
            ? rawForwardedHost
            : '';
          let forwardedProto = (req.headers['x-forwarded-proto'] || req.protocol || 'https')
            .toString()
            .split(',')[0]
            .trim()
            .toLowerCase();
          if (forwardedProto !== 'http' && forwardedProto !== 'https') {
            forwardedProto = 'https';
          }
          if (
            forwardedHost &&
            (forwardedHost.endsWith('.vercel.app') || forwardedHost.endsWith('.run.app'))
          ) {
            forwardedProto = 'https';
          }
          const proxyOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : '';
          const proxyHref = (target: string) => {
            const absolute = new URL(target, finalUrl).toString();
            return `${proxyOrigin}/api/anime/proxy?url=${encodeURIComponent(absolute)}&referer=${encodeURIComponent(
              referer || 'none'
            )}`;
          };
          const rewritten = textBody
            .split(/\r?\n/)
            .map((line) => {
              const trimmed = line.trim();
              if (!trimmed) return line;
              if (trimmed.startsWith('#')) {
                return line.replace(/URI="([^"]+)"/gi, (_m, uri: string) => `URI="${proxyHref(uri)}"`);
              }
              return proxyHref(trimmed);
            })
            .join('\n');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache');
          res.send(rewritten);
          return;
        }
        if (expectMedia && textBody.trimStart().startsWith('<')) {
          res.status(415).json({
            success: false,
            error: 'Upstream URL returned HTML markup instead of a video stream.',
            message: 'Upstream URL returned HTML markup instead of a video stream.',
          });
          return;
        }
        res.setHeader('Content-Type', contentType);
        res.send(textBody);
        return;
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';
      res.setHeader('Accept-Ranges', acceptRanges);

      const hasCompression = Boolean(upstream.headers.get('content-encoding'));
      const passthroughHeaders = hasCompression
        ? ['content-range', 'content-disposition', 'cache-control', 'etag', 'last-modified']
        : ['content-range', 'content-length', 'content-disposition', 'cache-control', 'etag', 'last-modified'];
      for (const h of passthroughHeaders) {
        const val = upstream.headers.get(h);
        if (val) res.setHeader(h, val);
      }

      if (upstream.body) {
        const nodeStream = Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]);
        nodeStream.on('error', () => {
          if (!res.headersSent) {
            res.status(502).end();
          } else {
            res.destroy();
          }
        });
        res.on('close', () => {
          if (!nodeStream.destroyed) nodeStream.destroy();
        });
        nodeStream.pipe(res);
      } else {
        const buffer = Buffer.from(await upstream.arrayBuffer());
        res.send(buffer);
      }
    } catch (err) {
      if (!res.headersSent) {
        const status =
          err && typeof err === 'object' && 'statusCode' in err && typeof (err as { statusCode?: unknown }).statusCode === 'number'
            ? (err as { statusCode: number }).statusCode
            : 502;
        res.status(status).send(err instanceof Error ? err.message : 'Proxy fetch failed.');
      }
    }
  };

  app.get('/api/anime/proxy', handleProxyRequest);
  app.head('/api/anime/proxy', handleProxyRequest);

  // Public Flix4U catalog. No auth, no user state, no Firebase.
  app.get('/api/catalog/home', async (_req: Request, res: Response) => {
    const jobs: Array<[string, Promise<Array<Record<string, unknown>>>]> = [
      ['trending', archiveSearch('', 'movie', 1, 16)],
      ['freeMovies', archiveSearch('', 'movie', 1, 16)],
      ['classicMovies', archiveSearch('classic OR vintage OR silent', 'movie', 1, 16)],
      ['adventure', archiveSearch('adventure OR action OR comedy', 'movie', 1, 16)],
      ['movies', catalogTrending('movie', 1)],
      ['webSeries', catalogTrending('tv', 1)],
      ['classicSeries', archiveSearch('', 'tv', 1, 16)],
      ['documentarySeries', archiveSearch('series OR documentary', 'tv', 1, 16)],
      ['anime', catalogTrending('anime', 1)],
      [
        'popularAnime',
        anilistCatalogFetch({ page: 1, perPage: 16, sort: ['POPULARITY_DESC'] }).then(
          (media) => media.map(normalizeAnilistMedia)
        ),
      ],
    ];
    const settled = await Promise.allSettled(jobs.map((job) => job[1]));
    const payload: Record<string, Array<Record<string, unknown>>> = {};
    settled.forEach((result, index) => {
      payload[jobs[index][0]] = result.status === 'fulfilled' ? result.value : [];
    });
    res.json(payload);
  });

  app.get('/api/catalog/trending', async (req: Request, res: Response) => {
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const page = Math.max(1, Number(req.query.page || 1));
    try {
      res.json({ items: await catalogTrending(type, page) });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Trending request failed.',
      });
    }
  });

  app.get('/api/catalog/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const rawType = typeof req.query.type === 'string' ? req.query.type : 'all';
    const type = rawType === 'anime' ? 'anime' : rawType === 'tv' ? 'tv' : rawType === 'movie' ? 'movie' : 'all';
    const page = Math.max(1, Number(req.query.page || 1));
    if (!query) {
      res.status(400).json({ error: 'Query parameter "q" is required.' });
      return;
    }
    try {
      const items = type === 'all'
        ? await catalogSearchAll(query, page)
        : await catalogSearch(query, type, page);
      res.json({ items });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Search request failed.',
      });
    }
  });

  app.get('/api/catalog/detail/:type/:id', async (req: Request, res: Response) => {
    const rawId = req.params.id || '';
    const parts = rawId.split(':');
    const last = parts[parts.length - 1];
    const type = req.params.type || 'movie';
    try {
      if (type === 'anime' || parts[0] === 'anilist') {
        const anilistId = Number(last);
        if (!Number.isFinite(anilistId) || anilistId <= 0) {
          res.status(400).json({ error: 'A valid AniList ID is required.' });
          return;
        }
        const media = await anilistCatalogFetch({ id: anilistId, perPage: 1 });
        res.json(media.length > 0 ? normalizeAnilistMedia(media[0]) : {});
        return;
      }

      const kind = type === 'tv' || parts[1] === 'tv' ? 'tv' : 'movie';
      if (parts[0] === 'archive') {
        res.json(await archiveDetail(last, kind));
        return;
      }
      if (!TMDB_API_KEY) {
        const fallback = await archiveSearch(
          String(rawId).replace(/^tmdb:(movie|tv):/, ''),
          kind,
          1,
          1
        );
        res.json(fallback[0] || {});
        return;
      }
      try {
        const data = await tmdbFetch(`/${kind}/${encodeURIComponent(last)}`, {
          append_to_response: 'credits,videos',
        });
        res.json(normalizeTmdbMedia(data, kind));
      } catch {
        const fallback = await archiveSearch(
          String(rawId).replace(/^tmdb:(movie|tv):/, ''),
          kind,
          1,
          1
        );
        res.json(fallback[0] || {});
      }
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Detail request failed.',
      });
    }
  });

  app.get('/api/stream/resolve', async (req: Request, res: Response) => {
    const rawId = typeof req.query.id === 'string' ? req.query.id : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'movie';
    const episode = Math.max(1, Math.floor(Number(req.query.episode || 1) || 1));
    const season = Math.max(
      1,
      Math.min(99, Math.floor(Number(req.query.season || 1) || 1))
    );

    if (type !== 'anime') {
      const parsedTmdb = parseCineproTmdbId(rawId, type);
      if (parsedTmdb) {
        try {
          const cinepro = await resolveCineproSources(
            parsedTmdb.id,
            parsedTmdb.type,
            season,
            episode
          );
          if (cinepro) {
            res.json(cinepro);
            return;
          }
        } catch (error) {
          console.warn(
            `[CinePro] resolve failed for ${parsedTmdb.type}:${parsedTmdb.id}: ` +
              (error instanceof Error ? error.message : 'unknown error')
          );
        }
      }
    }

    if (rawId.startsWith('archive:')) {
      try {
        res.json(await archiveResolve(rawId.split(':').pop() || ''));
      } catch (error) {
        res.status(502).json({
          error: error instanceof Error ? error.message : 'Archive stream resolve failed.',
        });
      }
      return;
    }

    if (type !== 'anime' && !rawId.startsWith('anilist:')) {
      try {
        let title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
        if (!title && rawId.startsWith('tmdb:') && TMDB_API_KEY) {
          const kind = rawId.startsWith('tmdb:tv:') ? 'tv' : 'movie';
          const detail = await tmdbFetch(`/${kind}/${encodeURIComponent(rawId.split(':').pop() || '')}`);
          title = String(detail.title || detail.name || '');
        }
        if (!title) {
          res.status(400).json({
            error: 'TITLE_REQUIRED',
            message: 'A title is required to find a public stream.',
          });
          return;
        }
        res.json(await resolveArchiveFromTitle(title));
      } catch (error) {
        res.status(502).json({
          error: error instanceof Error ? error.message : 'Movie/TV stream resolve failed.',
        });
      }
      return;
    }

    const anilistId = Number(rawId.replace(/^anilist:/, ''));
    if (!Number.isFinite(anilistId) || anilistId <= 0) {
      res.status(400).json({ error: 'A valid AniList ID is required.' });
      return;
    }

    try {
      let malId = await resolveMalIdFromAnilist(anilistId);
      if (!malId) {
        const zip = await fetchAniZipMetadata(anilistId);
        const mapped = (zip.mappings as { malId?: number | null } | undefined)?.malId;
        if (typeof mapped === 'number' && mapped > 0) malId = mapped;
      }
      if (!malId) {
        res.status(404).json({ error: 'No MyAnimeList mapping found for this anime.' });
        return;
      }

      const result = await resolveFromMegavid(malId, episode, 'sub', 'vidstreaming');
      if (!result.ok || !result.payload) {
        res.status(result.statusCode || 502).json({
          error: result.message || 'Stream unavailable.',
        });
        return;
      }
      res.json(result.payload);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Stream resolve failed.',
      });
    }
  });

  // Ensure unknown /api/* paths always return structured JSON (never HTML)
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Express /api JSON error boundary
  app.use('/api', (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Internal API server error.';
    console.error(`[API Error] ${req.method} ${req.originalUrl}: ${message}`);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: message,
        message,
      });
    }
  });

  return app;
}

export const app = createExpressApp();
export default app;

export async function startStandaloneServer() {
  const httpServer = http.createServer(app);
  const disableHmr = process.env.DISABLE_HMR === 'true';

  if (!isVercelRuntime && process.env.NODE_ENV !== 'production') {
    const vitePkg = ['vi', 'te'].join('');
    const { createServer: createViteServer } = await import(vitePkg);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(SERVER_ROOT_DIR, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          const normalized = filePath.replace(/\\/g, '/');
          if (normalized.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (normalized.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  return httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Flix4U server listening on http://0.0.0.0:${PORT}`);
  });
}

const isDirectEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  path.basename(process.argv[1]).startsWith('server');

if (!isVercelRuntime && (isDirectEntry || process.env.START_SERVER === 'true')) {
  startStandaloneServer();
}


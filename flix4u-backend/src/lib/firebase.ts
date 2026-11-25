import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { isNativeCapacitorRuntime } from '../config/env';
import webFirebaseConfig from '../../firebase-applet-config.json';

interface GoogleServicesOAuthClient {
  client_id?: string;
  client_type?: number;
}

interface GoogleServicesClient {
  client_info?: {
    mobilesdk_app_id?: string;
    android_client_info?: {
      package_name?: string;
    };
  };
  oauth_client?: GoogleServicesOAuthClient[];
  api_key?: Array<{ current_key?: string }>;
  services?: {
    appinvite_service?: {
      other_platform_oauth_client?: GoogleServicesOAuthClient[];
    };
  };
}

interface GoogleServicesJson {
  project_info?: {
    project_number?: string;
    firebase_url?: string;
    project_id?: string;
    storage_bucket?: string;
  };
  client?: GoogleServicesClient[];
}

interface ResolvedFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  databaseURL?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  firestoreDatabaseId?: string;
  oAuthClientId: string;
  source: 'google-services.json' | 'firebase-applet-config.json';
}

const androidGoogleServicesModules = import.meta.glob<GoogleServicesJson>(
  '../../android/app/google-services.json',
  { eager: true, import: 'default' }
);

function buildAndroidConfigFromGoogleServices(
  gs: GoogleServicesJson | undefined
): ResolvedFirebaseConfig | null {
  if (!gs?.project_info?.project_id) return null;
  const clients = Array.isArray(gs.client) ? gs.client : [];
  const matchingClient =
    clients.find(
      (c) => c.client_info?.android_client_info?.package_name === 'com.flix4u.rorax'
    ) || clients[0];

  if (!matchingClient) return null;

  const projectId = gs.project_info.project_id;
  const apiKey = matchingClient.api_key?.find((k) => Boolean(k?.current_key))?.current_key || '';
  const appId = matchingClient.client_info?.mobilesdk_app_id || '';
  if (!apiKey || !appId) return null;

  const directWebClient = matchingClient.oauth_client?.find(
    (c) => c.client_type === 3 && Boolean(c.client_id)
  )?.client_id;
  const appInviteWebClient =
    matchingClient.services?.appinvite_service?.other_platform_oauth_client?.find(
      (c) => c.client_type === 3 && Boolean(c.client_id)
    )?.client_id;

  return {
    projectId,
    appId,
    apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    databaseURL: gs.project_info.firebase_url || undefined,
    storageBucket: gs.project_info.storage_bucket || undefined,
    messagingSenderId: gs.project_info.project_number || undefined,
    firestoreDatabaseId:
      webFirebaseConfig.firestoreDatabaseId || 'ai-studio-406f5425-8cb6-4bfc-aadf-2a0ce7c524b3',
    oAuthClientId: directWebClient || appInviteWebClient || '',
    source: 'google-services.json',
  };
}

function resolveRuntimeFirebaseConfig(): ResolvedFirebaseConfig {
  const isNative = isNativeCapacitorRuntime();
  if (isNative) {
    const gs = Object.values(androidGoogleServicesModules)[0];
    const androidConfig = buildAndroidConfigFromGoogleServices(gs);
    if (androidConfig) {
      return androidConfig;
    }
    console.warn(
      '[Flix4U Firebase] Running on native Capacitor without android/app/google-services.json; falling back to firebase-applet-config.json.'
    );
  }

  return {
    projectId: webFirebaseConfig.projectId || '',
    appId: webFirebaseConfig.appId || '',
    apiKey: webFirebaseConfig.apiKey || '',
    authDomain: webFirebaseConfig.authDomain || '',
    storageBucket: webFirebaseConfig.storageBucket || undefined,
    messagingSenderId: webFirebaseConfig.messagingSenderId || undefined,
    firestoreDatabaseId:
      webFirebaseConfig.firestoreDatabaseId || 'ai-studio-406f5425-8cb6-4bfc-aadf-2a0ce7c524b3',
    oAuthClientId:
      typeof (webFirebaseConfig as { oAuthClientId?: unknown }).oAuthClientId === 'string'
        ? (webFirebaseConfig as { oAuthClientId: string }).oAuthClientId
        : '',
    source: 'firebase-applet-config.json',
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const resolvedFirebaseConfig = resolveRuntimeFirebaseConfig();

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let authInitStatus = 'uninitialized';

export const firebaseOAuthClientId = resolvedFirebaseConfig.oAuthClientId;
export const activeFirebaseProjectId = resolvedFirebaseConfig.projectId;

export const isFirebaseConfigured = Boolean(
  resolvedFirebaseConfig.apiKey &&
    resolvedFirebaseConfig.projectId &&
    resolvedFirebaseConfig.appId &&
    resolvedFirebaseConfig.projectId !== 'remixed-project-id'
);

if (isFirebaseConfigured) {
  const sdkOptions: Record<string, string> = {
    apiKey: resolvedFirebaseConfig.apiKey,
    authDomain: resolvedFirebaseConfig.authDomain,
    projectId: resolvedFirebaseConfig.projectId,
    appId: resolvedFirebaseConfig.appId,
  };
  if (resolvedFirebaseConfig.databaseURL) {
    sdkOptions.databaseURL = resolvedFirebaseConfig.databaseURL;
  }
  if (resolvedFirebaseConfig.storageBucket) {
    sdkOptions.storageBucket = resolvedFirebaseConfig.storageBucket;
  }
  if (resolvedFirebaseConfig.messagingSenderId) {
    sdkOptions.messagingSenderId = resolvedFirebaseConfig.messagingSenderId;
  }

  app = initializeApp(sdkOptions);
  try {
    db = resolvedFirebaseConfig.firestoreDatabaseId
      ? getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (dbErr) {
    console.warn('[Flix4U Firebase] getFirestore fallback error:', dbErr);
    db = getFirestore(app);
  }

  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
    authInitStatus = 'initialized(indexedDB+localStorage)';
  } catch {
    try {
      auth = initializeAuth(app, {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
      authInitStatus = 'initialized(localStorage-fallback)';
    } catch {
      auth = getAuth(app);
      authInitStatus = 'initialized(getAuth-fallback)';
    }
  }

  googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });
} else {
  authInitStatus = 'disabled(missing-config)';
}

export const firebaseDiagnostics = {
  runtime: isNativeCapacitorRuntime() ? 'capacitor-native' : 'web',
  configSource: resolvedFirebaseConfig.source,
  projectId: resolvedFirebaseConfig.projectId || '(none)',
  appId: resolvedFirebaseConfig.appId || '(none)',
  firestoreDatabaseId: resolvedFirebaseConfig.firestoreDatabaseId || '(default)',
  hasOAuthClientId: Boolean(firebaseOAuthClientId),
  authInitialized: Boolean(auth),
  authInitStatus,
  authProjectId: auth?.app?.options?.projectId || '(none)',
};

console.info('[Flix4U Firebase Init]', firebaseDiagnostics);

export { app, auth, db, googleProvider };

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo = logFirestoreError(error, operationType, path);
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export const testFirestoreConnection = testConnection;

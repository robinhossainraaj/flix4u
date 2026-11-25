import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';

export interface AppUpdateConfig {
  id: 'latest';
  enabled: boolean;
  latestVersion: string;
  versionCode: number;
  apkUrl: string;
  title: string;
  description?: string;
  releaseNotes?: string;
  buttonText?: string;
  mandatory: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export const DEFAULT_APP_UPDATE_CONFIG: AppUpdateConfig = {
  id: 'latest',
  enabled: false,
  latestVersion: 'v2.1.0',
  versionCode: 210,
  apkUrl: 'https://github.com/yourname/Flix4U/releases/latest/download/flix4u-v1.0.0.apk',
  title: 'Flix4U v2.1.0 Update Available',
  description: 'Performance enhancements, faster WebP/AVIF banner loading, and new Daily Watch Activity features.',
  releaseNotes: '- Optimized WebP/AVIF banner image caching\n- Enhanced Daily Watch Activity Calendar\n- Improved streaming reliability and speed',
  buttonText: 'Update Now',
  mandatory: false,
};

export const CURRENT_CLIENT_VERSION_CODE = 200; // Client app version code for comparison

export async function fetchAppUpdateConfig(): Promise<AppUpdateConfig> {
  if (!db) return DEFAULT_APP_UPDATE_CONFIG;
  try {
    const docRef = doc(db, 'app_updates', 'latest');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<AppUpdateConfig>;
      return {
        ...DEFAULT_APP_UPDATE_CONFIG,
        ...data,
        id: 'latest',
      };
    }
    return DEFAULT_APP_UPDATE_CONFIG;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'app_updates/latest');
    return DEFAULT_APP_UPDATE_CONFIG;
  }
}

export function subscribeAppUpdateConfig(
  onUpdate: (config: AppUpdateConfig) => void,
  onError?: (err: unknown) => void
): () => void {
  if (!db) {
    onUpdate(DEFAULT_APP_UPDATE_CONFIG);
    return () => {};
  }
  const docRef = doc(db, 'app_updates', 'latest');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<AppUpdateConfig>;
        onUpdate({
          ...DEFAULT_APP_UPDATE_CONFIG,
          ...data,
          id: 'latest',
        });
      } else {
        onUpdate(DEFAULT_APP_UPDATE_CONFIG);
      }
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'app_updates/latest');
    }
  );
}

export async function saveAppUpdateConfig(
  config: Omit<AppUpdateConfig, 'id' | 'updatedAt'>,
  userId?: string
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized.');
  const docRef = doc(db, 'app_updates', 'latest');
  const payload: Record<string, unknown> = {
    id: 'latest',
    enabled: Boolean(config.enabled),
    latestVersion: String(config.latestVersion || 'v2.1.0').trim().slice(0, 40),
    versionCode: Math.max(1, Number(config.versionCode) || 200),
    apkUrl: String(config.apkUrl || '').trim().slice(0, 500),
    title: String(config.title || 'Update Available').trim().slice(0, 160),
    description: String(config.description || '').trim().slice(0, 1000),
    releaseNotes: String(config.releaseNotes || '').trim().slice(0, 2000),
    buttonText: String(config.buttonText || 'Update Now').trim().slice(0, 60),
    mandatory: Boolean(config.mandatory),
    updatedAt: serverTimestamp(),
  };
  if (userId) payload.updatedBy = userId;
  await setDoc(docRef, payload, { merge: true });
}

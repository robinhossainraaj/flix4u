import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  Edit3,
  Eye,
  Film,
  Filter,
  Globe,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Link2,
  Loader2,
  Lock,
  Megaphone,
  Plus,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Unlock,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PopupBannerCard } from '@/src/components/PopupBannerModal';
import { AppUpdateModal } from '@/src/components/AppUpdateModal';
import { AdminAdvancedAnalyticsSection } from '@/src/components/AdminAdvancedAnalyticsSection';
import { AdminNotificationsSection } from '@/src/components/AdminNotificationsSection';
import { AdminWatchAnalyticsSection } from '@/src/components/AdminWatchAnalyticsSection';
import { useAuth } from '@/src/context/AuthContext';
import {
  fetchAppUpdateConfig,
  saveAppUpdateConfig,
  DEFAULT_APP_UPDATE_CONFIG,
  type AppUpdateConfig,
} from '@/src/services/updateService';
import {
  AdminApiError,
  createPopupBanner,
  deletePopupBanner,
  fetchAdminRegisteredUsersStats,
  fetchAdminServerStats,
  getBannerStatus,
  isValidDestinationUrl,
  subscribeAllBannersForAdmin,
  updatePopupBanner,
  uploadBannerImage,
} from '@/src/services/adminService';
import {
  BANNER_CATEGORIES,
  CURATED_PROFILE_BANNERS,
  DEFAULT_CUSTOMIZATION_SETTINGS,
  addCustomProfileBanner,
  deleteProfileBanner,
  isAvatarUnlocked,
  isBannerUnlocked,
  normalizeBannerCategory,
  setGlobalAvatarsUnlocked,
  setGlobalBannersUnlocked,
  subscribeCustomizationSettings,
  subscribeProfileBanners,
  toggleAvatarLock,
  toggleBannerLock,
  updateProfileBanner,
  type CustomizationSettings,
  type ProfileBanner,
  type ProfileBannerInput,
} from '@/src/services/bannerService';
import { OptimizedBannerImage } from '@/src/components/OptimizedBannerImage';
import type {
  AdminServerStats,
  BannerFrequency,
  PopupBanner,
  PopupBannerInput,
  RegisteredUsersStats,
} from '@/src/types/anime';

const EMPTY_POPUP_FORM: PopupBannerInput = {
  title: '',
  description: '',
  imageUrl: '',
  buttonText: '',
  destinationUrl: '',
  openInNewTab: false,
  enabled: true,
  startAt: '',
  expiresAt: '',
  frequency: 'once_per_session',
};

const FREQUENCY_LABELS: Record<BannerFrequency, string> = {
  once_per_session: 'Once per session',
  once_per_day: 'Once per day',
  once_per_user: 'Once per user',
  always_on_launch: 'Every launch',
};

const POPULAR_AVATARS_FOR_MANAGEMENT = [
  { id: '1', name: 'Gojo Satoru', anime: 'Jujutsu Kaisen', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b127993-219PZz9XfL6s.png' },
  { id: '2', name: 'Naruto Uzumaki', anime: 'Naruto', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b17-7ZXjOIscvCQn.png' },
  { id: '3', name: 'Monkey D. Luffy', anime: 'One Piece', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b40-Qf5pM3v116e9.png' },
  { id: '4', name: 'Tanjiro Kamado', anime: 'Demon Slayer', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b126071-S6Y6V5QdOQ8W.png' },
  { id: '5', name: 'Sung Jin-Woo', anime: 'Solo Leveling', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b163832-tB1VfK5N1Z5s.png' },
  { id: '6', name: 'Levi Ackerman', anime: 'Attack on Titan', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b45627-Vp2776c7s05h.png' },
  { id: '7', name: 'Sasuke Uchiha', anime: 'Naruto', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b13-8x25j8uXkG8h.png' },
  { id: '8', name: 'Roronoa Zoro', anime: 'One Piece', imageUrl: 'https://s4.anilist.co/file/anilistcdn/media/character/large/b62-p704Y9k4M2w2.png' },
];

function formatDateShort(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[1]}/${parts[2]}`;
}

export const AdminDashboardSection: React.FC = () => {
  const { user, authReady, isAdmin, getIdToken, openAuthModal } = useAuth();

  const [adminActiveTab, setAdminActiveTab] = useState<
    | 'watch-analytics'
    | 'advanced-analytics'
    | 'notifications'
    | 'customization'
    | 'analytics'
    | 'popups'
    | 'updates'
  >('watch-analytics');

  // App Update Manager State
  const [updateForm, setUpdateForm] = useState<AppUpdateConfig>(DEFAULT_APP_UPDATE_CONFIG);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [showUpdatePreview, setShowUpdatePreview] = useState(false);

  useEffect(() => {
    if (!authReady || !isAdmin) return;
    fetchAppUpdateConfig()
      .then((cfg) => setUpdateForm(cfg))
      .catch(() => {});
  }, [authReady, isAdmin]);

  const handleSaveAppUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setSavingUpdate(true);
    setUpdateNotice(null);
    setUpdateError(null);
    try {
      await saveAppUpdateConfig(updateForm, user?.uid);
      setUpdateNotice('App update notification configuration published successfully to Firebase.');
      window.setTimeout(() => setUpdateNotice(null), 3500);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to save app update configuration.');
    } finally {
      setSavingUpdate(false);
    }
  };

  // ==========================================
  // 1. PROFILE BANNERS & AVATARS MANAGEMENT
  // ==========================================
  const [profileBanners, setProfileBanners] = useState<ProfileBanner[]>(CURATED_PROFILE_BANNERS);
  const [customizationSettings, setCustomizationSettings] = useState<CustomizationSettings | null>(null);
  const [pbForm, setPbForm] = useState<{
    category: string;
    enabled: boolean;
    isLocked: boolean;
  }>({
    category: 'Naruto',
    enabled: true,
    isLocked: false,
  });
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [editingPbId, setEditingPbId] = useState<string | null>(null);
  const [editingPbTitle, setEditingPbTitle] = useState<string>('');
  const [pbUploadMethod, setPbUploadMethod] = useState<'mobile' | 'url'>('mobile');
  const [pbSelectedFile, setPbSelectedFile] = useState<File | null>(null);
  const [pbLocalPreviewUrl, setPbLocalPreviewUrl] = useState<string>('');
  const [pbUploadedImageUrl, setPbUploadedImageUrl] = useState<string>('');
  const [pbUrlInput, setPbUrlInput] = useState<string>('');
  const [pbUploadProgress, setPbUploadProgress] = useState<number>(0);
  const [pbUploading, setPbUploading] = useState(false);
  const [pbUploadError, setPbUploadError] = useState<string | null>(null);
  const [pbPreviewError, setPbPreviewError] = useState(false);
  const [pbSaving, setPbSaving] = useState(false);
  const [pbNotice, setPbNotice] = useState<string | null>(null);
  const [pbError, setPbError] = useState<string | null>(null);
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<string>('All');
  const [adminBannerSearch, setAdminBannerSearch] = useState<string>('');
  const [confirmDeletePbId, setConfirmDeletePbId] = useState<string | null>(null);
  const pbFileInputRef = useRef<HTMLInputElement>(null);
  const pbPreviewObjectUrlRef = useRef<string>('');

  // ==========================================
  // 2. ANALYTICS & STATS STATE
  // ==========================================
  const [serverStats, setServerStats] = useState<AdminServerStats | null>(null);
  const [registeredStats, setRegisteredStats] = useState<RegisteredUsersStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);

  // ==========================================
  // 3. POPUP BANNER STATE
  // ==========================================
  const [popupBanners, setPopupBanners] = useState<PopupBanner[]>([]);
  const [popupBannersError, setPopupBannersError] = useState<string | null>(null);
  const [popupForm, setPopupForm] = useState<PopupBannerInput>(EMPTY_POPUP_FORM);
  const [editingPopupId, setEditingPopupId] = useState<string | null>(null);
  const [uploadingPopupImage, setUploadingPopupImage] = useState(false);
  const [popupUploadError, setPopupUploadError] = useState<string | null>(null);
  const [savingPopup, setSavingPopup] = useState(false);
  const [popupSaveNotice, setPopupSaveNotice] = useState<string | null>(null);
  const [popupFormError, setPopupFormError] = useState<string | null>(null);
  const [showPopupLivePreview, setShowPopupLivePreview] = useState(false);
  const [confirmDeletePopupId, setConfirmDeletePopupId] = useState<string | null>(null);
  const popupFileInputRef = useRef<HTMLInputElement>(null);

  const runWithFreshAdminToken = useCallback(
    async <T,>(operation: (idToken: string) => Promise<T>): Promise<T> => {
      let token = await getIdToken(false);
      if (!token) {
        token = await getIdToken(true);
      }
      if (!token) {
        setSessionExpired(true);
        throw new AdminApiError(
          'Your administrator session has expired. Please sign in again.',
          401,
          'SESSION_EXPIRED'
        );
      }

      try {
        const result = await operation(token);
        setSessionExpired(false);
        return result;
      } catch (err) {
        if (err instanceof AdminApiError && err.status === 401) {
          const refreshedToken = await getIdToken(true);
          if (refreshedToken) {
            try {
              const retriedResult = await operation(refreshedToken);
              setSessionExpired(false);
              return retriedResult;
            } catch (retryErr) {
              if (retryErr instanceof AdminApiError && retryErr.status === 401) {
                setSessionExpired(true);
              }
              throw retryErr;
            }
          }
          setSessionExpired(true);
        }
        throw err;
      }
    },
    [getIdToken]
  );

  // Load Real-time Subscriptions for Profile Banners & Customization Settings
  useEffect(() => {
    if (!authReady || !isAdmin || !user) return;
    const unsubBanners = subscribeProfileBanners(
      (list) => setProfileBanners(list),
      (err) => console.warn('Admin: banners subscription err:', err)
    );
    const unsubSettings = subscribeCustomizationSettings(
      (settings) => setCustomizationSettings(settings),
      (err) => console.warn('Admin: settings subscription err:', err)
    );
    return () => {
      unsubBanners();
      unsubSettings();
    };
  }, [authReady, isAdmin, user]);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    if (!authReady || !isAdmin || !user) return;
    setStatsError(null);
    try {
      const [srvOutcome, regOutcome] = await Promise.allSettled([
        runWithFreshAdminToken((token) => fetchAdminServerStats(token)),
        fetchAdminRegisteredUsersStats(),
      ]);

      if (srvOutcome.status === 'fulfilled') {
        setServerStats(srvOutcome.value);
      }
      if (regOutcome.status === 'fulfilled') {
        setRegisteredStats(regOutcome.value);
      }

      if (srvOutcome.status === 'rejected') {
        throw srvOutcome.reason;
      }
      if (regOutcome.status === 'rejected') {
        throw regOutcome.reason;
      }
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : 'Failed to load admin analytics.');
    } finally {
      setStatsLoading(false);
    }
  }, [authReady, isAdmin, user, runWithFreshAdminToken]);

  useEffect(() => {
    if (!authReady || !isAdmin || !user || adminActiveTab !== 'analytics') return;

    const runIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void loadAnalytics();
      }
    };

    runIfVisible();
    const timer = window.setInterval(runIfVisible, 20000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadAnalytics();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authReady, isAdmin, user, adminActiveTab, loadAnalytics]);

  // Load Popup Banners
  useEffect(() => {
    if (!authReady || !isAdmin || !user) return;
    const unsub = subscribeAllBannersForAdmin(
      (list) => {
        setPopupBanners(list);
        setPopupBannersError(null);
      },
      (msg) => setPopupBannersError(msg)
    );
    return () => unsub();
  }, [authReady, isAdmin, user]);

  useEffect(() => {
    return () => {
      if (pbPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(pbPreviewObjectUrlRef.current);
        pbPreviewObjectUrlRef.current = '';
      }
    };
  }, []);

  if (!isAdmin) {
    return (
      <section className="kuro-glass rounded-3xl p-8 text-center border border-white/[0.08]">
        <ShieldCheck className="mx-auto h-10 w-10 text-rose-400" />
        <h2 className="mt-3 text-lg font-bold text-white">Restricted Administrator Area</h2>
        <p className="mt-1 text-sm text-slate-400">
          You do not have permission to view Flix4U admin statistics or manage banners.
        </p>
      </section>
    );
  }

  // ==========================================
  // PROFILE BANNERS & UNLOCK HANDLERS
  // ==========================================
  const clearMobileUploadState = () => {
    if (pbPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(pbPreviewObjectUrlRef.current);
      pbPreviewObjectUrlRef.current = '';
    }
    setPbSelectedFile(null);
    setPbLocalPreviewUrl('');
    setPbUploadedImageUrl('');
    setPbUploadProgress(0);
    setPbUploadError(null);
    setPbPreviewError(false);
    if (pbFileInputRef.current) {
      pbFileInputRef.current.value = '';
    }
  };

  const clearUrlUploadState = () => {
    setPbUrlInput('');
    setPbPreviewError(false);
  };

  const resetProfileBannerForm = () => {
    clearMobileUploadState();
    clearUrlUploadState();
    setPbUploadMethod('mobile');
    setEditingPbId(null);
    setEditingPbTitle('');
    setPbForm({
      category: 'Naruto',
      enabled: true,
      isLocked: false,
    });
    setCustomCategoryInput('');
    setPbError(null);
  };

  const handleSelectPbUploadMethod = (method: 'mobile' | 'url') => {
    setPbError(null);
    setPbNotice(null);
    if (method === 'mobile') {
      clearUrlUploadState();
      setPbUploadMethod('mobile');
    } else {
      if (pbUploading) return;
      clearMobileUploadState();
      setPbUploadMethod('url');
    }
  };

  const performMobileFileUpload = async (file: File) => {
    setPbUploading(true);
    setPbUploadError(null);
    setPbError(null);
    setPbNotice(null);
    setPbUploadedImageUrl('');
    setPbUploadProgress(5);

    try {
      const uploadOutcome = await runWithFreshAdminToken((token) =>
        uploadBannerImage(token, file, (pct) => setPbUploadProgress(pct))
      );
      setPbUploadedImageUrl(uploadOutcome.imageUrl);
      setPbUploadProgress(100);
      setPbNotice('Image uploaded to server! Review the preview below and click publish.');
      window.setTimeout(() => setPbNotice(null), 4000);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to upload selected image to server. Please try again.';
      setPbUploadedImageUrl('');
      setPbUploadProgress(0);
      setPbUploadError(msg);
    } finally {
      setPbUploading(false);
    }
  };
  const handleSaveProfileBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPbError(null);
    setPbNotice(null);

    if (!user) {
      setPbError('Signed-in administrator session required.');
      return;
    }

    if (pbForm.category === 'Custom' && !customCategoryInput.trim()) {
      setPbError('Please enter a custom category name.');
      return;
    }

    const effectiveCategory =
      pbForm.category === 'Custom' && customCategoryInput.trim()
        ? customCategoryInput.trim()
        : pbForm.category;
    const normalizedCategory = normalizeBannerCategory(effectiveCategory);
    const internalTitle =
      editingPbId && editingPbTitle.trim() ? editingPbTitle.trim() : `${normalizedCategory} Banner`;

    let finalImageUrl = '';

    if (pbUploadMethod === 'mobile') {
      if (pbUploading) {
        setPbError('Please wait for the mobile image upload to finish.');
        return;
      }
      const serverPath = pbUploadedImageUrl.trim();
      if (!serverPath) {
        setPbError(pbUploadError || 'Please select and upload an image from your device first.');
        return;
      }
      if (/^(blob:|data:|file:|content:)/i.test(serverPath)) {
        setPbError('Local temporary image cannot be published directly. Please upload it to the server.');
        return;
      }
      finalImageUrl = serverPath;
    } else {
      const enteredUrl = pbUrlInput.trim();
      if (!enteredUrl) {
        setPbError('Please enter a valid banner image URL.');
        return;
      }
      if (/^(blob:|data:|file:|content:)/i.test(enteredUrl)) {
        setPbError('Please paste an image web URL (https:// or http://), or switch to Upload From Mobile.');
        return;
      }
      if (!enteredUrl.startsWith('/api/banners/image/')) {
        try {
          const parsed = new URL(enteredUrl);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
            setPbError('Image URL must start with https:// or http://.');
            return;
          }
        } catch {
          setPbError('Please enter a valid image URL starting with https:// or http://.');
          return;
        }
      }
      finalImageUrl = enteredUrl;
    }

    const bannerPayload: ProfileBannerInput = {
      title: internalTitle,
      category: normalizedCategory,
      imageUrl: finalImageUrl,
      enabled: pbForm.enabled,
      isLocked: pbForm.isLocked,
    };

    setPbSaving(true);
    try {
      if (editingPbId) {
        await updateProfileBanner(editingPbId, bannerPayload);
        setPbNotice(`${normalizedCategory} banner updated successfully.`);
      } else {
        await addCustomProfileBanner(user.uid, bannerPayload);
        setPbNotice(`New ${normalizedCategory} banner published to gallery!`);
      }

      resetProfileBannerForm();
      window.setTimeout(() => setPbNotice(null), 3500);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to save profile banner.');
    } finally {
      setPbSaving(false);
    }
  };

  const handleProfileBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    // Mutual exclusion: selecting a local mobile image immediately clears any URL input
    clearUrlUploadState();
    setPbUploadMethod('mobile');

    if (pbPreviewObjectUrlRef.current) {
      URL.revokeObjectURL(pbPreviewObjectUrlRef.current);
    }
    const localObjUrl = URL.createObjectURL(file);
    pbPreviewObjectUrlRef.current = localObjUrl;

    setPbSelectedFile(file);
    setPbLocalPreviewUrl(localObjUrl);
    setPbPreviewError(false);

    await performMobileFileUpload(file);
  };

  const handleBannerUrlInputChange = (rawUrl: string) => {
    // Mutual exclusion: entering a URL immediately clears any selected local file upload
    if (pbSelectedFile || pbLocalPreviewUrl || pbUploadedImageUrl || pbUploadError) {
      clearMobileUploadState();
    }
    setPbUploadMethod('url');
    setPbUrlInput(rawUrl);
    setPbPreviewError(false);
    setPbError(null);
  };

  const handleStartEditProfileBanner = (banner: ProfileBanner) => {
    clearMobileUploadState();
    clearUrlUploadState();

    setEditingPbId(banner.id);
    setEditingPbTitle(banner.title || '');
    const normalized = normalizeBannerCategory(banner.category);
    const isCuratedCat = (BANNER_CATEGORIES as readonly string[]).includes(normalized);
    setPbForm({
      category: isCuratedCat ? normalized : 'Custom',
      enabled: banner.enabled,
      isLocked: banner.isLocked,
    });
    if (!isCuratedCat) {
      setCustomCategoryInput(banner.category);
    } else {
      setCustomCategoryInput('');
    }

    if (banner.imageUrl.startsWith('/api/banners/image/')) {
      setPbUploadMethod('mobile');
      setPbUploadedImageUrl(banner.imageUrl);
      setPbUploadProgress(100);
    } else {
      setPbUploadMethod('url');
      setPbUrlInput(banner.imageUrl);
    }

    setPbError(null);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleTogglePbLock = async (banner: ProfileBanner) => {
    if (!user) return;
    const isCurrentlyLocked = !isBannerUnlocked(banner, customizationSettings, false);
    try {
      await toggleBannerLock(
        user.uid,
        banner,
        !isCurrentlyLocked,
        customizationSettings || DEFAULT_CUSTOMIZATION_SETTINGS
      );
      setPbNotice(
        `Banner "${banner.category}" is now ${!isCurrentlyLocked ? 'Locked 🔒' : 'Unlocked 🔓'}.`
      );
      window.setTimeout(() => setPbNotice(null), 3000);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to toggle banner lock.');
    }
  };

  const handleTogglePbEnabled = async (banner: ProfileBanner) => {
    if (banner.isCustom) {
      try {
        await updateProfileBanner(banner.id, { enabled: !banner.enabled });
      } catch (err) {
        setPbError(err instanceof Error ? err.message : 'Failed to toggle status.');
      }
    } else {
      setProfileBanners((prev) =>
        prev.map((b) => (b.id === banner.id ? { ...b, enabled: !b.enabled } : b))
      );
    }
  };

  const handleDeletePb = async (banner: ProfileBanner) => {
    if (banner.isCustom) {
      try {
        await deleteProfileBanner(banner.id);
        setConfirmDeletePbId(null);
        if (editingPbId === banner.id) {
          resetProfileBannerForm();
        }
        setPbNotice('Banner deleted from Firestore.');
        window.setTimeout(() => setPbNotice(null), 3000);
      } catch (err) {
        setPbError(err instanceof Error ? err.message : 'Failed to delete banner.');
      }
    } else {
      setProfileBanners((prev) => prev.filter((b) => b.id !== banner.id));
      setConfirmDeletePbId(null);
    }
  };

  // 1-Click Global Unlock Handlers
  const handleUnlockAllBanners = async () => {
    if (!user) return;
    try {
      await setGlobalBannersUnlocked(user.uid, true);
      setPbNotice('All Profile Banners are now Globally Unlocked! 🎉');
      window.setTimeout(() => setPbNotice(null), 3500);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to unlock banners.');
    }
  };

  const handleLockAllBanners = async () => {
    if (!user) return;
    try {
      await setGlobalBannersUnlocked(user.uid, false);
      setPbNotice('All Profile Banners are now Globally Locked for non-admins.');
      window.setTimeout(() => setPbNotice(null), 3500);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to lock banners.');
    }
  };

  const handleUnlockAllAvatars = async () => {
    if (!user) return;
    try {
      await setGlobalAvatarsUnlocked(user.uid, true);
      setPbNotice('All Anime Avatars are now Globally Unlocked! 🎉');
      window.setTimeout(() => setPbNotice(null), 3500);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to unlock avatars.');
    }
  };

  const handleLockAllAvatars = async () => {
    if (!user) return;
    try {
      await setGlobalAvatarsUnlocked(user.uid, false);
      setPbNotice('All Anime Avatars are now Globally Locked for non-admins.');
      window.setTimeout(() => setPbNotice(null), 3500);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to lock avatars.');
    }
  };

  const handleToggleAvatarLock = async (avatarId: string | number) => {
    if (!user) return;
    const isCurrentlyLocked = !isAvatarUnlocked(avatarId, customizationSettings, false);
    try {
      await toggleAvatarLock(
        user.uid,
        avatarId,
        !isCurrentlyLocked,
        customizationSettings || DEFAULT_CUSTOMIZATION_SETTINGS
      );
      setPbNotice(`Avatar ${avatarId} is now ${!isCurrentlyLocked ? 'Locked 🔒' : 'Unlocked 🔓'}.`);
      window.setTimeout(() => setPbNotice(null), 3000);
    } catch (err) {
      setPbError(err instanceof Error ? err.message : 'Failed to toggle avatar lock.');
    }
  };

  // Filtered Admin Banners
  const filteredAdminBanners = profileBanners.filter((b) => {
    if (adminCategoryFilter !== 'All' && b.category !== adminCategoryFilter) return false;
    if (adminBannerSearch.trim()) {
      const q = adminBannerSearch.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
    }
    return true;
  });

  // ==========================================
  // POPUP BANNER HANDLERS
  // ==========================================
  const handlePopupImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPopupUploadError(null);
    setUploadingPopupImage(true);
    try {
      const result = await runWithFreshAdminToken((token) => uploadBannerImage(token, file));
      setPopupForm((prev) => ({ ...prev, imageUrl: result.imageUrl }));
    } catch (err) {
      setPopupUploadError(err instanceof Error ? err.message : 'Failed to upload image.');
    } finally {
      setUploadingPopupImage(false);
    }
  };

  const handleSavePopupBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setPopupFormError(null);
    setPopupSaveNotice(null);

    if (!user) {
      setPopupFormError('Signed-in admin session is required.');
      return;
    }
    if (!popupForm.title.trim()) {
      setPopupFormError('Banner title is required.');
      return;
    }
    if (!popupForm.imageUrl.trim()) {
      setPopupFormError('Please upload a banner image or enter an image URL.');
      return;
    }
    if (popupForm.destinationUrl && !isValidDestinationUrl(popupForm.destinationUrl)) {
      setPopupFormError('Destination URL must be an internal /path or start with https:// or http://.');
      return;
    }

    setSavingPopup(true);
    try {
      if (editingPopupId) {
        await updatePopupBanner(editingPopupId, popupForm);
        setPopupSaveNotice('Popup banner updated.');
      } else {
        await createPopupBanner(user.uid, popupForm);
        setPopupSaveNotice('Popup banner published.');
      }
      setPopupForm(EMPTY_POPUP_FORM);
      setEditingPopupId(null);
      window.setTimeout(() => setPopupSaveNotice(null), 3000);
    } catch (err) {
      setPopupFormError(err instanceof Error ? err.message : 'Failed to save popup banner.');
    } finally {
      setSavingPopup(false);
    }
  };

  const handleStartEditPopup = (banner: PopupBanner) => {
    setEditingPopupId(banner.id);
    setPopupForm({
      title: banner.title,
      description: banner.description,
      imageUrl: banner.imageUrl,
      buttonText: banner.buttonText || '',
      destinationUrl: banner.destinationUrl || '',
      openInNewTab: banner.openInNewTab,
      enabled: banner.enabled,
      startAt: banner.startAt || '',
      expiresAt: banner.expiresAt || '',
      frequency: banner.frequency,
    });
    setPopupFormError(null);
  };

  const handleTogglePopupEnabled = async (banner: PopupBanner) => {
    try {
      await updatePopupBanner(banner.id, { enabled: !banner.enabled });
    } catch (err) {
      setPopupBannersError(err instanceof Error ? err.message : 'Unable to toggle status.');
    }
  };

  const handleDeletePopupBanner = async (banner: PopupBanner) => {
    try {
      const token = await getIdToken(false);
      await deletePopupBanner(banner, token);
      if (editingPopupId === banner.id) {
        setEditingPopupId(null);
        setPopupForm(EMPTY_POPUP_FORM);
      }
      setConfirmDeletePopupId(null);
    } catch (err) {
      setPopupBannersError(err instanceof Error ? err.message : 'Failed to delete popup banner.');
    }
  };

  // Analytics helpers
  const series = serverStats?.dailySeries || [];
  const maxChartValue = Math.max(1, ...series.map((d) => Math.max(d.visits, d.activeUsers)));
  const onlineRegPct =
    serverStats && serverStats.currentlyOnlineUsers > 0
      ? Math.round((serverStats.onlineRegisteredUsers / serverStats.currentlyOnlineUsers) * 100)
      : 0;
  const activeRetentionPct =
    registeredStats && registeredStats.totalRegisteredUsers > 0
      ? Math.min(
          100,
          Math.round((registeredStats.registeredLast7Days / registeredStats.totalRegisteredUsers) * 100)
        )
      : 0;
  const combinedUsersActiveToday = useMemo(() => {
    const srvToday = serverStats?.usersActiveToday || 0;
    const regToday = registeredStats?.registeredActiveToday || 0;
    const guestToday = serverStats?.guestActiveToday || 0;
    return Math.max(srvToday, regToday + guestToday);
  }, [serverStats, registeredStats]);

  const globalBannersUnlocked = customizationSettings?.globalBannersUnlocked ?? true;
  const globalAvatarsUnlocked = customizationSettings?.globalAvatarsUnlocked ?? true;

  return (
    <div className="space-y-6">
      {/* Top Admin Navigation Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-3xl border border-white/[0.08] bg-[#0c0e18]/90 p-5 backdrop-blur-xl shadow-2xl">
        <div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-600/15 px-3 py-1 text-xs font-semibold text-violet-300">
            <ShieldCheck className="h-4 w-4 text-violet-400" />
            <span>Flix4U Command Center</span>
          </div>
          <h1 className="mt-2 text-xl sm:text-2xl font-black text-white">
            Admin Management Dashboard
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">
            Signed in as <span className="font-semibold text-violet-300">{user?.email}</span> (Full Superadmin Access)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="kuro-segment-track flex flex-wrap rounded-2xl p-1 gap-1 border border-white/[0.08] bg-black/40">
          <button
            type="button"
            onClick={() => setAdminActiveTab('watch-analytics')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'watch-analytics'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <Film className="h-4 w-4 text-violet-400" />
            <span>User Watch Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('customization')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'customization'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="h-4 w-4 text-fuchsia-400" />
            <span>Profile Banners &amp; Avatars</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('analytics')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'analytics'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            <span>Live Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('popups')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'popups'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <Megaphone className="h-4 w-4 text-amber-400" />
            <span>Announcement Popups</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('advanced-analytics')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'advanced-analytics'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-sky-400" />
            <span>Advanced Analytics</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('notifications')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'notifications'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="h-4 w-4 text-violet-300" />
            <span>Notification Center</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminActiveTab('updates')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              adminActiveTab === 'updates'
                ? 'kuro-segment-active text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                : 'kuro-segment-idle text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="h-4 w-4 text-cyan-400" />
            <span>App Update Manager</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          USER WATCH ANALYTICS SYSTEM
          ======================================================== */}
      {adminActiveTab === 'watch-analytics' && (
        <AdminWatchAnalyticsSection onRefreshParent={loadAnalytics} />
      )}

      {/* ========================================================
          ADVANCED ADMIN ANALYTICS
          ======================================================== */}
      {adminActiveTab === 'advanced-analytics' && <AdminAdvancedAnalyticsSection />}

      {/* ========================================================
          ADMIN NOTIFICATION CENTER
          ======================================================== */}
      {adminActiveTab === 'notifications' && <AdminNotificationsSection />}

      {/* ========================================================
          TAB 1: PROFILE BANNERS & AVATARS MANAGEMENT (REQUESTED)
          ======================================================== */}
      {adminActiveTab === 'customization' && (
        <div className="space-y-6">
          {/* 1-Click Global Unlock Controls & Status Card */}
          <div className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                  <span>1-Click Customization Unlock Controls</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Instantly unlock or lock all banners and avatars for regular users across the entire platform.
                </p>
              </div>

              {/* Status Pills */}
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${
                    globalBannersUnlocked
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {globalBannersUnlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  Banners: {globalBannersUnlocked ? 'Unlocked' : 'Locked'}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-bold ${
                    globalAvatarsUnlocked
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {globalAvatarsUnlocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  Avatars: {globalAvatarsUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
            </div>

            {/* Notification messages */}
            {(pbNotice || pbError) && (
              <div>
                {pbNotice && (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-2.5 text-xs text-emerald-200">
                    <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{pbNotice}</span>
                  </div>
                )}
                {pbError && (
                  <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-4 py-2.5 text-xs text-rose-200">
                    {pbError}
                  </div>
                )}
              </div>
            )}

            {/* Quick 1-Click Action Buttons */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
              <button
                type="button"
                onClick={handleUnlockAllBanners}
                className="kuro-btn-glass flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-600/20 transition-all"
              >
                <Unlock className="h-4 w-4 text-emerald-400" />
                <span>Unlock All Banners</span>
              </button>
              <button
                type="button"
                onClick={handleLockAllBanners}
                className="kuro-btn-glass flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold text-amber-300 hover:border-amber-400/50 hover:bg-amber-600/20 transition-all"
              >
                <Lock className="h-4 w-4 text-amber-400" />
                <span>Lock All Banners</span>
              </button>
              <button
                type="button"
                onClick={handleUnlockAllAvatars}
                className="kuro-btn-glass flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-600/20 transition-all"
              >
                <Unlock className="h-4 w-4 text-emerald-400" />
                <span>Unlock All Avatars</span>
              </button>
              <button
                type="button"
                onClick={handleLockAllAvatars}
                className="kuro-btn-glass flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs font-bold text-amber-300 hover:border-amber-400/50 hover:bg-amber-600/20 transition-all"
              >
                <Lock className="h-4 w-4 text-amber-400" />
                <span>Lock All Avatars</span>
              </button>
            </div>
          </div>

          {/* Add / Edit Profile Banner Form */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-violet-400" />
                  <span>{editingPbId ? 'Edit Profile Banner' : 'Add New Profile Banner'}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Add wide landscape banner artwork from your mobile gallery or via image URL.
                </p>
              </div>

              {editingPbId && (
                <button
                  type="button"
                  onClick={resetProfileBannerForm}
                  className="kuro-btn-glass rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 shrink-0"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveProfileBanner} className="space-y-5">
              {/* Category Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Category (15 Anime Collections) *
                  </label>
                  <select
                    value={pbForm.category}
                    onChange={(e) => setPbForm((p) => ({ ...p, category: e.target.value }))}
                    className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs sm:text-sm text-white focus:border-violet-500 focus:outline-none"
                  >
                    {BANNER_CATEGORIES.slice(1).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Custom">+ Custom Category</option>
                  </select>
                </div>

                {pbForm.category === 'Custom' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                      Custom Category Name *
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      placeholder="e.g. Mecha Classics"
                      className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-xs sm:text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Mutually Exclusive Upload Method Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  Choose Upload Method (Select One) *
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSelectPbUploadMethod('mobile')}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all min-h-[56px] ${
                      pbUploadMethod === 'mobile'
                        ? 'border-violet-400 bg-violet-600/20 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                        : 'border-white/[0.08] bg-[#07080d]/80 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        pbUploadMethod === 'mobile'
                          ? 'bg-violet-500/30 text-violet-200'
                          : 'bg-white/[0.05] text-slate-400'
                      }`}
                    >
                      <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold leading-tight">Upload From Mobile</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Pick from Android gallery or files
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={pbUploading}
                    onClick={() => handleSelectPbUploadMethod('url')}
                    className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all min-h-[56px] ${
                      pbUploadMethod === 'url'
                        ? 'border-violet-400 bg-violet-600/20 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                        : 'border-white/[0.08] bg-[#07080d]/80 text-slate-300 hover:border-white/20 hover:bg-white/[0.04]'
                    } disabled:opacity-50`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        pbUploadMethod === 'url'
                          ? 'bg-violet-500/30 text-violet-200'
                          : 'bg-white/[0.05] text-slate-400'
                      }`}
                    >
                      <Globe className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold leading-tight">Upload Using Image URL</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Paste a direct landscape image link
                      </div>
                    </div>
                  </button>
                </div>

                {/* Hidden File Input for Mobile Gallery / File Manager */}
                <input
                  ref={pbFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileBannerFileUpload}
                  className="hidden"
                />

                {/* Option A: Upload From Mobile Panel */}
                {pbUploadMethod === 'mobile' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#07080d]/90 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white">
                          {pbSelectedFile
                            ? pbSelectedFile.name
                            : pbUploadedImageUrl
                              ? 'Uploaded Server Banner Image'
                              : 'Select a landscape image from your phone gallery or file manager'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {pbSelectedFile
                            ? `${(pbSelectedFile.size / (1024 * 1024)).toFixed(2)} MB · JPG, PNG, WebP, or GIF (max 8 MB)`
                            : 'No URL required. Uploaded directly to Flix4U server storage.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => pbFileInputRef.current?.click()}
                          disabled={pbUploading}
                          className="kuro-btn-primary inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold shadow-md disabled:opacity-60"
                        >
                          {pbUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          <span>
                            {pbUploading
                              ? 'Uploading...'
                              : pbSelectedFile || pbUploadedImageUrl
                                ? 'Choose Different Image'
                                : 'Select From Phone'}
                          </span>
                        </button>

                        {(pbSelectedFile || pbUploadedImageUrl) && !pbUploading && (
                          <button
                            type="button"
                            onClick={clearMobileUploadState}
                            aria-label="Clear selected image"
                            className="kuro-btn-glass inline-flex min-h-[42px] items-center justify-center rounded-xl px-3 text-xs font-semibold text-rose-300 hover:text-rose-200"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Real Upload Progress Bar */}
                    {(pbUploading || pbUploadProgress > 0) && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={pbUploadedImageUrl ? 'text-emerald-300 font-semibold' : 'text-violet-300 font-semibold'}>
                            {pbUploading
                              ? 'Uploading image to server...'
                              : pbUploadedImageUrl
                                ? 'Upload complete — ready to publish'
                                : 'Upload status'}
                          </span>
                          <span className="font-mono text-slate-300">{pbUploadProgress}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              pbUploadedImageUrl
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-500'
                            }`}
                            style={{ width: `${pbUploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Real Upload Error Message & Retry */}
                    {pbUploadError && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-rose-500/40 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                          <span>{pbUploadError}</span>
                        </div>
                        {pbSelectedFile && (
                          <button
                            type="button"
                            onClick={() => performMobileFileUpload(pbSelectedFile)}
                            disabled={pbUploading}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-500/30 shrink-0"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>Retry Upload</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Option B: Upload Using Image URL Panel */}
                {pbUploadMethod === 'url' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-[#07080d]/90 p-4 space-y-2">
                    <label className="block text-xs font-semibold text-slate-200">
                      Image URL *
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Link2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type="url"
                          value={pbUrlInput}
                          onChange={(e) => handleBannerUrlInputChange(e.target.value)}
                          placeholder="https://example.com/anime-banner.webp"
                          className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#0c0e18] pl-10 pr-3.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                      {pbUrlInput && (
                        <button
                          type="button"
                          onClick={clearUrlUploadState}
                          aria-label="Clear URL"
                          className="kuro-btn-glass inline-flex h-11 items-center justify-center rounded-xl px-3 text-xs font-semibold text-slate-300 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Paste a direct landscape image URL (no local file upload needed).
                    </p>
                  </div>
                )}
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={pbForm.enabled}
                    onChange={(e) => setPbForm((p) => ({ ...p, enabled: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-[#07080d] text-violet-500 focus:ring-violet-500"
                  />
                  <span>Enabled for Users</span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={pbForm.isLocked}
                    onChange={(e) => setPbForm((p) => ({ ...p, isLocked: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-[#07080d] text-violet-500 focus:ring-violet-500"
                  />
                  <span>Locked (Only Admins / Unlocked users)</span>
                </label>
              </div>

              {/* Show Image Preview Before Publishing */}
              {(pbUploadMethod === 'mobile' ? pbUploadedImageUrl || pbLocalPreviewUrl : pbUrlInput.trim()) && (
                <div className="rounded-2xl border border-violet-500/30 bg-[#0a0c16] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-violet-300 flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" /> Image Preview Before Publishing
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {pbUploadMethod === 'mobile'
                        ? pbUploadedImageUrl
                          ? 'Server Stored · Ready'
                          : 'Local Preview'
                        : 'External Image URL'}
                    </span>
                  </div>
                  <div className="relative aspect-[16/9] w-full max-w-md overflow-hidden rounded-xl border border-white/[0.1] bg-[#141728]">
                    <OptimizedBannerImage
                      src={
                        pbUploadMethod === 'mobile'
                          ? pbUploadedImageUrl || pbLocalPreviewUrl
                          : pbUrlInput.trim()
                      }
                      alt={
                        pbForm.category === 'Custom' && customCategoryInput
                          ? customCategoryInput
                          : pbForm.category
                      }
                      onLoad={() => setPbPreviewError(false)}
                      onError={() => setPbPreviewError(true)}
                      className="h-full w-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-violet-300 backdrop-blur-md border border-white/[0.08]">
                        {pbForm.category === 'Custom' && customCategoryInput
                          ? customCategoryInput
                          : pbForm.category}
                      </span>
                      {pbForm.isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-950/70 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      )}
                    </div>
                  </div>
                  {pbPreviewError && (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>Preview image could not be loaded. Check the image file or URL before publishing.</span>
                    </p>
                  )}
                </div>
              )}

              {/* Submit Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
                <span className="text-xs text-slate-400">
                  {pbUploadMethod === 'mobile'
                    ? pbUploadedImageUrl
                      ? 'Uploaded image is ready to publish to gallery'
                      : 'Select an image from your phone to upload'
                    : pbUrlInput.trim()
                      ? 'Review URL preview artwork above before publishing'
                      : 'Enter an image URL above to preview and publish'}
                </span>

                <button
                  type="submit"
                  disabled={
                    pbSaving ||
                    pbUploading ||
                    (pbUploadMethod === 'mobile' ? !pbUploadedImageUrl.trim() : !pbUrlInput.trim())
                  }
                  className="kuro-btn-primary inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl px-6 py-2 text-xs sm:text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pbSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span>{editingPbId ? 'Update Banner' : 'Add Banner to Gallery'}</span>
                </button>
              </div>
            </form>
          </section>

          {/* Manage Existing Banners Grid */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-violet-400" />
                  <span>Existing Profile Banners ({filteredAdminBanners.length})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Manage lock states, enable/disable status, edit details, or remove banners.
                </p>
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={adminBannerSearch}
                  onChange={(e) => setAdminBannerSearch(e.target.value)}
                  placeholder="Filter banners..."
                  className="h-9 w-full rounded-xl border border-white/[0.1] bg-[#10121d] pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              {BANNER_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAdminCategoryFilter(cat)}
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    adminCategoryFilter === cat
                      ? 'border border-violet-400 bg-violet-600/40 text-white shadow'
                      : 'border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Banners Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAdminBanners.map((banner) => {
                const unlocked = isBannerUnlocked(banner, customizationSettings, false);

                return (
                  <div
                    key={banner.id}
                    className="flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0e18] p-3 space-y-3"
                  >
                    {/* Top Aspect Preview using OptimizedBannerImage */}
                    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#141728]">
                      <OptimizedBannerImage
                        src={banner.imageUrl}
                        thumbnailUrl={banner.thumbnailUrl}
                        alt={banner.title}
                        className="h-full w-full"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-violet-300 backdrop-blur-md border border-white/[0.08]">
                          {banner.category}
                        </span>

                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold backdrop-blur-md border ${
                            unlocked
                              ? 'border-emerald-500/40 bg-emerald-950/70 text-emerald-300'
                              : 'border-amber-500/40 bg-amber-950/70 text-amber-300'
                          }`}
                        >
                          {unlocked ? 'Unlocked' : 'Locked 🔒'}
                        </span>
                      </div>

                      <div className="absolute bottom-2 left-2 right-2">
                        <p className="truncate text-xs font-bold text-white drop-shadow">
                          {banner.title}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-white/[0.06]">
                      <div className="flex items-center gap-1.5">
                        {/* Lock / Unlock Toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePbLock(banner)}
                          className={`kuro-btn-glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                            unlocked ? 'text-amber-300 hover:text-amber-200' : 'text-emerald-300 hover:text-emerald-200'
                          }`}
                        >
                          {unlocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          <span>{unlocked ? 'Lock' : 'Unlock'}</span>
                        </button>

                        {/* Enable / Disable Toggle */}
                        <button
                          type="button"
                          onClick={() => handleTogglePbEnabled(banner)}
                          className={`kuro-btn-glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                            banner.enabled ? 'text-slate-300' : 'text-rose-400'
                          }`}
                        >
                          <Power className="h-3 w-3" />
                          <span>{banner.enabled ? 'Enabled' : 'Disabled'}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleStartEditProfileBanner(banner)}
                          className="kuro-btn-glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-violet-300"
                        >
                          <Edit3 className="h-3 w-3" />
                          <span>Edit</span>
                        </button>

                        {confirmDeletePbId === banner.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeletePb(banner)}
                              className="rounded-lg bg-rose-600/30 border border-rose-500/50 px-2 py-0.5 text-[10px] font-bold text-rose-200"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePbId(null)}
                              className="rounded-lg bg-white/[0.08] px-1.5 py-0.5 text-[10px] text-slate-300"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePbId(banner.id)}
                            className="kuro-btn-glass inline-flex items-center rounded-xl p-1.5 text-rose-400 hover:text-rose-200"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Manage Popular Avatars Lock Section */}
          <section className="kuro-glass rounded-3xl p-5 sm:p-6 border border-white/[0.08] space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <User className="h-5 w-5 text-fuchsia-400" />
                <span>Anime Avatars Individual Unlock Management</span>
              </h3>
              <p className="text-xs text-slate-400">
                Click on any popular anime character avatar below to lock or unlock it individually for non-admin users.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3 pt-2">
              {POPULAR_AVATARS_FOR_MANAGEMENT.map((char) => {
                const unlocked = isAvatarUnlocked(char.id, customizationSettings, false);
                return (
                  <div
                    key={char.id}
                    onClick={() => handleToggleAvatarLock(char.id)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-2 flex flex-col items-center text-center transition-all ${
                      unlocked
                        ? 'border-white/[0.08] bg-[#0c0e18] hover:border-violet-500/50'
                        : 'border-amber-500/40 bg-amber-950/20'
                    }`}
                  >
                    <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-violet-500/50 bg-[#121422] mb-1.5">
                      <img
                        src={char.imageUrl}
                        alt={char.name}
                        className="h-full w-full object-cover object-top"
                      />
                      {!unlocked && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Lock className="h-4 w-4 text-amber-400" />
                        </div>
                      )}
                    </div>

                    <p className="truncate w-full text-[11px] font-bold text-white">{char.name}</p>
                    <p className="truncate w-full text-[9px] text-slate-400">{char.anime}</p>

                    <span
                      className={`mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                        unlocked
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {unlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================
          TAB 2: USER ANALYTICS & LIVE PRESENCE
          ======================================================== */}
      {adminActiveTab === 'analytics' && (
        <section className="kuro-glass rounded-3xl p-5 sm:p-6 space-y-6 border border-white/[0.08]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300">
                <Activity className="h-3.5 w-3.5" />
                <span>Live Audience Telemetry</span>
              </div>
              <h2 className="mt-2 text-lg sm:text-xl font-bold text-white">
                User Statistics &amp; Real-Time Presence
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                Real-time heartbeat presence and persisted Firestore user records. Auto-refreshes every 20s.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              {serverStats?.updatedAt && (
                <span className="text-[11px] text-slate-400 tabular-nums">
                  Updated {new Date(serverStats.updatedAt).toLocaleTimeString()}
                </span>
              )}
              <button
                type="button"
                onClick={loadAnalytics}
                disabled={statsLoading}
                className="kuro-btn-glass inline-flex min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {(statsError || sessionExpired) && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-xs sm:text-sm text-rose-200">
              <span>{statsError || 'Your administrator session expired. Please sign in again.'}</span>
              {sessionExpired && (
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="kuro-btn-primary inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-xl px-3.5 py-1.5 text-xs font-semibold"
                >
                  Sign In Again
                </button>
              )}
            </div>
          )}

          {/* 5 Real-Data KPI Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <StatKpiCard
              icon={<Users className="h-4.5 w-4.5 text-violet-300" />}
              label="Total Registered Users"
              value={registeredStats ? String(registeredStats.totalRegisteredUsers) : '—'}
              subtext={
                registeredStats
                  ? `${registeredStats.registeredLast7Days} active in last 7 days`
                  : 'Loading Firestore...'
              }
            />
            <StatKpiCard
              icon={<UserCheck className="h-4.5 w-4.5 text-fuchsia-300" />}
              label="Total Active Users"
              value={registeredStats ? String(registeredStats.totalActiveRegisteredUsers || 0) : '—'}
              subtext={
                serverStats
                  ? `${serverStats.totalUniqueVisitors} unique visitors recorded`
                  : 'Verified user accounts'
              }
            />
            <StatKpiCard
              icon={<Activity className="h-4.5 w-4.5 text-emerald-400" />}
              label="Currently Online Users"
              value={serverStats ? String(serverStats.currentlyOnlineUsers) : '—'}
              liveDot
              subtext={
                serverStats
                  ? `${serverStats.onlineRegisteredUsers} signed-in · ${serverStats.onlineGuestUsers} guests`
                  : 'Active heartbeat sessions'
              }
            />
            <StatKpiCard
              icon={<CalendarClock className="h-4.5 w-4.5 text-sky-300" />}
              label="Users Active Today"
              value={serverStats || registeredStats ? String(combinedUsersActiveToday) : '—'}
              subtext={
                serverStats
                  ? `${Math.max(serverStats.registeredActiveToday, registeredStats?.registeredActiveToday || 0)} registered · ${serverStats.guestActiveToday} guests`
                  : 'UTC daily active count'
              }
            />
            <StatKpiCard
              icon={<Globe className="h-4.5 w-4.5 text-amber-300" />}
              label="Total Website Visits"
              value={serverStats ? String(serverStats.totalWebsiteVisits) : '—'}
              subtext={serverStats ? `${serverStats.visitsToday} visits today` : 'Session-deduplicated'}
            />
          </div>

          {/* Real-Data Charts Grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {/* 7-Day Real Visits & Active Users Chart */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.08] bg-[#090b12]/80 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-400" />
                  <h3 className="text-sm font-semibold text-white">
                    7-Day Website Visits &amp; Daily Active Users
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />
                    Visits
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-fuchsia-400" />
                    Active Users
                  </span>
                </div>
              </div>

              {series.length === 0 ? (
                <div className="flex h-44 items-center justify-center text-xs text-slate-500">
                  No recorded traffic buckets yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-7 gap-2 items-end h-44 pt-4">
                    {series.map((point, idx) => {
                      const visitPct = Math.round((point.visits / maxChartValue) * 100);
                      const activePct = Math.round((point.activeUsers / maxChartValue) * 100);
                      const isHovered = hoveredDayIndex === idx;
                      return (
                        <div
                          key={point.date}
                          onMouseEnter={() => setHoveredDayIndex(idx)}
                          onMouseLeave={() => setHoveredDayIndex(null)}
                          className="relative flex h-full flex-col items-center justify-end gap-1.5"
                        >
                          {isHovered && (
                            <div className="pointer-events-none absolute -top-3 z-10 whitespace-nowrap rounded-xl border border-violet-400/35 bg-[#121526] px-2.5 py-1 text-[10px] font-medium text-white shadow-xl">
                              {point.date}: {point.visits} visits · {point.activeUsers} active
                            </div>
                          )}
                          <div className="flex w-full max-w-[44px] flex-1 items-end justify-center gap-1 rounded-xl bg-white/[0.02] px-1 pt-2">
                            <div
                              className="w-1/2 rounded-t-md bg-gradient-to-t from-violet-700 to-violet-400 transition-all duration-300"
                              style={{ height: `${Math.max(point.visits > 0 ? 8 : 2, visitPct)}%` }}
                              title={`${point.date}: ${point.visits} visits`}
                            />
                            <div
                              className="w-1/2 rounded-t-md bg-gradient-to-t from-fuchsia-700 to-fuchsia-400 transition-all duration-300"
                              style={{ height: `${Math.max(point.activeUsers > 0 ? 8 : 2, activePct)}%` }}
                              title={`${point.date}: ${point.activeUsers} active users`}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-slate-400 tabular-nums">
                            {formatDateShort(point.date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Audience & Retention Breakdown */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#090b12]/80 p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Real Audience Composition</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Computed directly from live presence and Firestore user timestamps.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300">Online Signed-In Share</span>
                    <span className="font-semibold text-white tabular-nums">{onlineRegPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${onlineRegPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {serverStats?.onlineRegisteredUsers || 0} signed-in /{' '}
                    {serverStats?.currentlyOnlineUsers || 0} online
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-300">7-Day Registered Activity Rate</span>
                    <span className="font-semibold text-white tabular-nums">{activeRetentionPct}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 transition-all duration-300"
                      style={{ width: `${activeRetentionPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {registeredStats?.registeredLast7Days || 0} of{' '}
                    {registeredStats?.totalRegisteredUsers || 0} registered users
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[11px] text-slate-300 tabular-nums">
                Active Today Breakdown:{' '}
                <span className="font-semibold text-white">
                  {Math.max(
                    serverStats?.registeredActiveToday || 0,
                    registeredStats?.registeredActiveToday || 0
                  )}{' '}
                  registered
                </span>{' '}
                + <span className="font-semibold text-white">{serverStats?.guestActiveToday || 0} guests</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 3: POPUP BANNER SYSTEM
          ======================================================== */}
      {adminActiveTab === 'popups' && (
        <section className="kuro-glass rounded-3xl p-5 sm:p-6 space-y-6 border border-white/[0.08]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-300">
                <Megaphone className="h-3.5 w-3.5" />
                <span>Popup Banner System</span>
              </div>
              <h2 className="mt-2 text-lg sm:text-xl font-bold text-white">
                {editingPopupId ? 'Edit Popup Banner' : 'Create & Manage Popup Banners'}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                Upload promotional artwork, schedule start/expiry windows, preview live, and control display frequency.
              </p>
            </div>

            {popupForm.imageUrl && (
              <button
                type="button"
                onClick={() => setShowPopupLivePreview(true)}
                className="kuro-btn-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold"
              >
                <Eye className="h-4 w-4 text-violet-300" />
                <span>Preview Popup</span>
              </button>
            )}
          </div>

          {(popupFormError || popupUploadError || popupSaveNotice || popupBannersError) && (
            <div className="space-y-2">
              {popupSaveNotice && (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-950/35 px-4 py-3 text-xs sm:text-sm text-emerald-200">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{popupSaveNotice}</span>
                </div>
              )}
              {(popupFormError || popupUploadError || popupBannersError) && (
                <div className="rounded-2xl border border-rose-500/35 bg-rose-950/35 px-4 py-3 text-xs sm:text-sm text-rose-200">
                  {popupFormError || popupUploadError || popupBannersError}
                </div>
              )}
            </div>
          )}

          {/* Create / Edit Banner Form */}
          <form
            onSubmit={handleSavePopupBanner}
            className="grid grid-cols-1 gap-6 rounded-2xl border border-white/[0.08] bg-[#090b12]/80 p-4 sm:p-5 lg:grid-cols-5"
          >
            {/* Left Column: Image Upload + Thumbnail */}
            <div className="lg:col-span-2 space-y-3">
              <label className="block text-xs font-semibold text-slate-200">
                Banner Image (JPG, PNG, WebP, GIF · max 5 MB)
              </label>

              <input
                ref={popupFileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePopupImageFileSelect}
                className="hidden"
              />

              <div className="relative overflow-hidden rounded-2xl border border-dashed border-violet-400/35 bg-[#0e111d]">
                {popupForm.imageUrl ? (
                  <div className="relative aspect-[16/9] w-full">
                    <img
                      src={popupForm.imageUrl}
                      alt="Banner preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => popupFileInputRef.current?.click()}
                        disabled={uploadingPopupImage}
                        className="kuro-btn-glass inline-flex min-h-[34px] items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Replace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPopupForm((p) => ({ ...p, imageUrl: '' }))}
                        className="kuro-btn-glass inline-flex min-h-[34px] items-center rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-300"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => popupFileInputRef.current?.click()}
                    disabled={uploadingPopupImage}
                    className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 p-6 text-center transition-colors hover:bg-violet-500/5"
                  >
                    {uploadingPopupImage ? (
                      <>
                        <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
                        <span className="text-xs font-medium text-slate-300">
                          Uploading &amp; validating image...
                        </span>
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-7 w-7 text-violet-400" />
                        <span className="text-xs font-semibold text-white">Click to Upload Banner Image</span>
                        <span className="text-[11px] text-slate-400">16:9 recommended · Max 5 MB</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Or paste external image URL
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={popupForm.imageUrl}
                  onChange={(e) => setPopupForm((p) => ({ ...p, imageUrl: e.target.value }))}
                  placeholder="https://... or /api/admin/banners/image/..."
                  className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Right Column: Fields & Scheduling */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Banner Title *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={popupForm.title}
                    onChange={(e) => setPopupForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g. Solo Leveling Season 2 Now Streaming in Hindi!"
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Banner Description
                  </label>
                  <textarea
                    rows={2}
                    maxLength={1000}
                    value={popupForm.description}
                    onChange={(e) => setPopupForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Short announcement or callout shown inside the popup..."
                    className="w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Button Text (optional)
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={popupForm.buttonText || ''}
                    onChange={(e) => setPopupForm((p) => ({ ...p, buttonText: e.target.value }))}
                    placeholder="e.g. Watch Now"
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Destination URL (optional)
                  </label>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      maxLength={500}
                      value={popupForm.destinationUrl || ''}
                      onChange={(e) => setPopupForm((p) => ({ ...p, destinationUrl: e.target.value }))}
                      placeholder="/anime/151807 or https://..."
                      className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] pl-8 pr-3 text-sm text-white focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Display Frequency
                  </label>
                  <select
                    value={popupForm.frequency}
                    onChange={(e) =>
                      setPopupForm((p) => ({ ...p, frequency: e.target.value as BannerFrequency }))
                    }
                    className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3 text-xs text-white focus:border-violet-500 focus:outline-none"
                  >
                    <option value="once_per_session">Once per session</option>
                    <option value="once_per_day">Once per day</option>
                    <option value="once_per_user">Once per user</option>
                    <option value="always_on_launch">Always on site launch</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={popupForm.enabled}
                      onChange={(e) => setPopupForm((p) => ({ ...p, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded border-white/20 bg-[#07080d] text-violet-500 focus:ring-violet-500"
                    />
                    <span>Banner Enabled</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-white/[0.06] pt-4">
                {editingPopupId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPopupId(null);
                      setPopupForm(EMPTY_POPUP_FORM);
                      setPopupFormError(null);
                    }}
                    className="kuro-btn-glass inline-flex min-h-[42px] items-center rounded-2xl px-4 py-2 text-xs font-semibold"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPopupLivePreview(true)}
                  className="kuro-btn-glass inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-semibold"
                >
                  <Eye className="h-4 w-4 text-violet-300" />
                  <span>Live Preview</span>
                </button>
                <button
                  type="submit"
                  disabled={savingPopup || uploadingPopupImage}
                  className="kuro-btn-primary inline-flex min-h-[42px] items-center gap-1.5 rounded-2xl px-5 py-2 text-xs sm:text-sm font-semibold"
                >
                  {savingPopup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingPopupId ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{editingPopupId ? 'Save Changes' : 'Publish Popup Banner'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Existing Popup Banners List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">
              Published &amp; Scheduled Popups ({popupBanners.length})
            </h3>

            {popupBanners.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-[#090b12]/60 p-8 text-center">
                <Sparkles className="mx-auto h-7 w-7 text-violet-400/70" />
                <p className="mt-2 text-sm font-medium text-slate-200">No popup banners created yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                {popupBanners.map((banner) => {
                  const status = getBannerStatus(banner);
                  return (
                    <div
                      key={banner.id}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#090b12]/80 p-3.5"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#141728]">
                          <img
                            src={banner.imageUrl}
                            alt={banner.title}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border-emerald-500/30 bg-emerald-500/10">
                            {status}
                          </span>
                          <p className="mt-1 truncate text-sm font-semibold text-white">{banner.title}</p>
                          {banner.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                              {banner.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-2.5">
                        <button
                          type="button"
                          onClick={() => handleTogglePopupEnabled(banner)}
                          className="kuro-btn-glass rounded-xl px-3 py-1 text-xs font-semibold text-slate-300"
                        >
                          <Power className="h-3.5 w-3.5 mr-1 inline" />
                          <span>{banner.enabled ? 'Disable' : 'Enable'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditPopup(banner)}
                          className="kuro-btn-glass rounded-xl px-3 py-1 text-xs font-semibold text-violet-300"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1 inline" />
                          <span>Edit</span>
                        </button>
                        {confirmDeletePopupId === banner.id ? (
                          <button
                            type="button"
                            onClick={() => handleDeletePopupBanner(banner)}
                            className="rounded-xl border border-rose-500/40 bg-rose-600/25 px-3 py-1 text-xs font-semibold text-rose-200"
                          >
                            Confirm Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePopupId(banner.id)}
                            className="kuro-btn-glass rounded-xl px-3 py-1 text-xs font-semibold text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1 inline" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ========================================================
          TAB 4: APP UPDATE MANAGER
          ======================================================== */}
      {adminActiveTab === 'updates' && (
        <form onSubmit={handleSaveAppUpdate} className="kuro-glass rounded-3xl p-6 sm:p-8 border border-white/[0.08] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/20 text-cyan-300">
                  <Smartphone className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">App Update Manager</h2>
                  <p className="text-xs text-slate-400">
                    Control Android APK update notifications, version codes, release notes, and download links
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/[0.1] bg-[#070912] px-4 py-2 text-xs font-semibold text-white">
                <input
                  type="checkbox"
                  checked={updateForm.enabled}
                  onChange={(e) => setUpdateForm((p) => ({ ...p, enabled: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-[#07080d] text-cyan-500 focus:ring-cyan-500"
                />
                <span>Notifications Enabled</span>
              </label>
            </div>
          </div>

          {updateNotice && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-xs font-semibold text-emerald-200">
              {updateNotice}
            </div>
          )}

          {updateError && (
            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 p-4 text-xs font-semibold text-rose-200">
              {updateError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Latest Version Name (e.g. v2.1.0)
              </label>
              <input
                type="text"
                maxLength={40}
                required
                value={updateForm.latestVersion}
                onChange={(e) => setUpdateForm((p) => ({ ...p, latestVersion: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Version Code (Numeric integer)
              </label>
              <input
                type="number"
                min={1}
                required
                value={updateForm.versionCode}
                onChange={(e) => setUpdateForm((p) => ({ ...p, versionCode: Number(e.target.value) || 200 }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Update Type
              </label>
              <select
                value={updateForm.mandatory ? 'mandatory' : 'optional'}
                onChange={(e) => setUpdateForm((p) => ({ ...p, mandatory: e.target.value === 'mandatory' }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="optional">Optional Update (Shows Later button)</option>
                <option value="mandatory">Mandatory Update (Hides Later button)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              APK Download URL (`apkUrl`)
            </label>
            <input
              type="url"
              maxLength={500}
              required
              value={updateForm.apkUrl}
              onChange={(e) => setUpdateForm((p) => ({ ...p, apkUrl: e.target.value }))}
              placeholder="https://github.com/.../flix4u-v1.0.0.apk"
              className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Update Title Bar
              </label>
              <input
                type="text"
                maxLength={160}
                required
                value={updateForm.title}
                onChange={(e) => setUpdateForm((p) => ({ ...p, title: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Update Now Button Text
              </label>
              <input
                type="text"
                maxLength={60}
                required
                value={updateForm.buttonText}
                onChange={(e) => setUpdateForm((p) => ({ ...p, buttonText: e.target.value }))}
                className="h-11 w-full rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Short Summary Description
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={updateForm.description || ''}
              onChange={(e) => setUpdateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full rounded-xl border border-white/[0.1] bg-[#07080d] p-3 text-sm text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Release Notes (Changelog items separated by lines)
            </label>
            <textarea
              rows={4}
              maxLength={2000}
              value={updateForm.releaseNotes || ''}
              onChange={(e) => setUpdateForm((p) => ({ ...p, releaseNotes: e.target.value }))}
              placeholder="- Enhanced performance&#10;- Bug fixes"
              className="w-full rounded-xl border border-white/[0.1] bg-[#07080d] p-3 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.08] pt-5">
            <button
              type="button"
              onClick={() => setShowUpdatePreview(true)}
              className="kuro-btn-glass inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-semibold text-cyan-200"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Popup</span>
            </button>
            <button
              type="submit"
              disabled={savingUpdate}
              className="kuro-btn-primary inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-6 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-cyan-950/50"
            >
              {savingUpdate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Publish Update Config</span>
            </button>
          </div>
        </form>
      )}

      {/* Preview Modal */}
      {showUpdatePreview && (
        <AppUpdateModal
          previewConfig={updateForm}
          onClosePreview={() => setShowUpdatePreview(false)}
        />
      )}

      {/* Live Preview Modal for Popup */}
      {showPopupLivePreview && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPopupLivePreview(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <PopupBannerCard
            banner={popupForm}
            previewBadge="Admin Live Preview"
            onClose={() => setShowPopupLivePreview(false)}
          />
        </div>
      )}
    </div>
  );
};

interface StatKpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  liveDot?: boolean;
}

const StatKpiCard: React.FC<StatKpiCardProps> = ({
  icon,
  label,
  value,
  subtext,
  liveDot,
}) => (
  <div className="rounded-2xl border border-white/[0.08] bg-[#090b12]/85 p-4 flex flex-col justify-between gap-2.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
        {icon}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-extrabold tracking-tight text-white tabular-nums">
        {value}
      </span>
      {liveDot && (
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
      )}
    </div>
    <p className="text-[11px] text-slate-400 truncate tabular-nums">{subtext}</p>
  </div>
);

export default AdminDashboardSection;

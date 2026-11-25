import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Image as ImageIcon,
  Loader2,
  Lock,
  Search,
  Sparkles,
  Upload,
  User,
  X,
} from 'lucide-react';
import { AnimeImage } from '@/src/components/AnimeImage';
import { OptimizedBannerImage } from '@/src/components/OptimizedBannerImage';
import { ASSETS } from '@/src/config/env';
import { useAuth } from '@/src/context/AuthContext';
import {
  ANIME_SERIES_FILTERS,
  fetchCharacterGalleryPage,
  type CharacterCategoryFilter,
} from '@/src/services/charactersApi';
import {
  BANNER_CATEGORIES,
  CURATED_PROFILE_BANNERS,
  isAvatarUnlocked,
  isBannerUnlocked,
  normalizeBannerCategory,
  subscribeCustomizationSettings,
  subscribeProfileBanners,
  type BannerCategory,
  type CustomizationSettings,
  type ProfileBanner,
} from '@/src/services/bannerService';
import { generateClientThumbnail } from '@/src/services/imageCacheService';
import type { AnimeCharacterAvatar } from '@/src/types/anime';

export const ProfileEditPage: React.FC = () => {
  const { user, isAdmin, preferences, updatePreferences, openAuthModal } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'avatars' | 'banners'>('banners');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState(
    preferences.photoURL || ASSETS.defaultAvatar
  );
  const [selectedBannerUrl, setSelectedBannerUrl] = useState(
    preferences.bannerURL || CURATED_PROFILE_BANNERS[0].imageUrl
  );
  const [displayNameInput, setDisplayNameInput] = useState(preferences.displayName || 'Flix4U User');
  const [isEditingName, setIsEditingName] = useState(false);

  // Custom input states
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [customBannerInput, setCustomBannerInput] = useState('');
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Real-time custom profile banners & customization settings from Firestore
  const [banners, setBanners] = useState<ProfileBanner[]>(CURATED_PROFILE_BANNERS);
  const [customizationSettings, setCustomizationSettings] = useState<CustomizationSettings | null>(null);
  const [selectedBannerCategory, setSelectedBannerCategory] = useState<string>('All');
  const [bannerSearchQuery, setBannerSearchQuery] = useState('');

  // Progressive loading / pagination state (optimizes mobile/low-end device memory)
  const [visibleBannerCount, setVisibleBannerCount] = useState<number>(12);
  const bannerSentinelRef = useRef<HTMLDivElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // Save states
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lockNotice, setLockNotice] = useState<string | null>(null);

  // Avatar Character Gallery state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [seriesId, setSeriesId] = useState<string>('all');
  const [category, setCategory] = useState<CharacterCategoryFilter>('ALL');
  const [characters, setCharacters] = useState<AnimeCharacterAvatar[]>([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [loadingMoreCharacters, setLoadingMoreCharacters] = useState(false);
  const [characterError, setCharacterError] = useState<string | null>(null);

  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial preferences
  useEffect(() => {
    if (preferences.photoURL) setSelectedPhotoUrl(preferences.photoURL);
    if (preferences.bannerURL) setSelectedBannerUrl(preferences.bannerURL);
    if (preferences.displayName) setDisplayNameInput(preferences.displayName);
  }, [preferences]);

  // Subscribe to real-time banners and unlock settings
  useEffect(() => {
    const unsubBanners = subscribeProfileBanners(
      (list) => {
        setBanners(list);
      },
      (err) => {
        console.warn('Failed to subscribe to profile banners:', err);
      }
    );

    const unsubSettings = subscribeCustomizationSettings(
      (settings) => {
        setCustomizationSettings(settings);
      },
      (err) => {
        console.warn('Failed to subscribe to customization settings:', err);
      }
    );

    return () => {
      unsubBanners();
      unsubSettings();
    };
  }, []);

  // Debounced avatar search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load avatar characters
  const loadCharacters = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMoreCharacters(true);
      } else {
        setLoadingCharacters(true);
        setCharacterError(null);
      }
      try {
        const res = await fetchCharacterGalleryPage({
          search: debouncedSearch,
          seriesId,
          category,
          page: targetPage,
          perPage: 24,
        });
        setCharacters((prev) => {
          if (!append) return res.characters;
          const seen = new Set(prev.map((c) => c.id));
          const merged = [...prev];
          for (const item of res.characters) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return merged;
        });
        setPage(res.currentPage);
        setHasNextPage(res.hasNextPage);
      } catch (err) {
        setCharacterError(err instanceof Error ? err.message : 'Unable to load anime characters.');
      } finally {
        setLoadingCharacters(false);
        setLoadingMoreCharacters(false);
      }
    },
    [debouncedSearch, seriesId, category]
  );

  useEffect(() => {
    if (activeTab === 'avatars') {
      loadCharacters(1, false);
    }
  }, [activeTab, loadCharacters]);

  // Reset pagination on filter or category change
  useEffect(() => {
    setVisibleBannerCount(12);
  }, [selectedBannerCategory, bannerSearchQuery]);

  // Filtered banners
  const filteredBanners = banners.filter((b) => {
    if (b.enabled === false && !isAdmin) return false;
    const normalizedCat = normalizeBannerCategory(b.category);
    if (selectedBannerCategory !== 'All' && normalizedCat !== selectedBannerCategory) {
      return false;
    }
    if (bannerSearchQuery.trim()) {
      const q = bannerSearchQuery.toLowerCase();
      return b.title.toLowerCase().includes(q) || normalizedCat.toLowerCase().includes(q);
    }
    return true;
  });

  // Progressive scroll sentinel (intersection observer)
  useEffect(() => {
    if (!bannerSentinelRef.current) return;
    const el = bannerSentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleBannerCount((prev) => Math.min(prev + 12, filteredBanners.length));
        }
      },
      { rootMargin: '250px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filteredBanners.length]);

  const displayedBanners = filteredBanners.slice(0, visibleBannerCount);
  const hasMoreBanners = visibleBannerCount < filteredBanners.length;

  // Category horizontal scroll buttons
  const scrollCategories = (direction: 'left' | 'right') => {
    if (!categoryScrollRef.current) return;
    const scrollAmount = 320;
    categoryScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Handle banner selection
  const handleSelectBanner = (banner: ProfileBanner) => {
    const unlocked = isBannerUnlocked(banner, customizationSettings, isAdmin);
    if (!unlocked) {
      setLockNotice(`"${banner.title}" is currently locked. Admins can unlock it in the Admin Dashboard.`);
      window.setTimeout(() => setLockNotice(null), 4000);
      return;
    }
    setLockNotice(null);
    setSelectedBannerUrl(banner.imageUrl);
  };

  // Handle avatar selection
  const handleSelectAvatar = (ch: AnimeCharacterAvatar) => {
    const unlocked = isAvatarUnlocked(ch.id, customizationSettings, isAdmin);
    if (!unlocked) {
      setLockNotice(`"${ch.name}" avatar is currently locked by the admin.`);
      window.setTimeout(() => setLockNotice(null), 4000);
      return;
    }
    setLockNotice(null);
    setSelectedPhotoUrl(ch.imageUrl);
  };

  // File upload for Banner with WebP optimization
  const handleBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFileUploadError('Banner file size must be less than 8 MB.');
      return;
    }
    setFileUploadError(null);
    setIsUploadingBanner(true);

    try {
      // Generate optimized WebP landscape image client-side for immediate performance
      const optimizedWebP = await generateClientThumbnail(file, 1600, 900);
      setSelectedBannerUrl(optimizedWebP);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedBannerUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  // File upload for Avatar
  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFileUploadError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFileUploadError('Avatar file size must be less than 3 MB.');
      return;
    }
    setFileUploadError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSelectedPhotoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save changes to Firestore
  const handleSaveAll = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updatePreferences({
        photoURL: selectedPhotoUrl,
        bannerURL: selectedBannerUrl,
        displayName: displayNameInput.trim() || preferences.displayName || 'Flix4U User',
      });
      setSaveSuccess(true);
      window.setTimeout(() => {
        setSaveSuccess(false);
        navigate('/profile');
      }, 1200);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 pb-24">
      {/* 1. Large Customizable Banner with Live Preview */}
      <div className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden bg-[#121422]">
        <OptimizedBannerImage
          src={selectedBannerUrl}
          alt="Profile Banner Live Preview"
          priority
          className="h-full w-full object-cover filter brightness-95 transition-all duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080d] via-black/40 to-black/20 pointer-events-none" />

        {/* Top Header Controls */}
        <div
          className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-8"
          style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
        >
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Back to profile"
            className="kuro-btn-glass flex h-11 w-11 items-center justify-center rounded-2xl text-white backdrop-blur-2xl transition-transform hover:scale-105 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('banners')}
              className={`kuro-btn-glass inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold backdrop-blur-2xl transition-all ${
                activeTab === 'banners' ? 'border-violet-400/80 bg-violet-600/30 text-white' : 'text-slate-200'
              }`}
            >
              <ImageIcon className="h-4 w-4 text-violet-300" />
              <span>Change Banner</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('avatars')}
              className={`kuro-btn-glass inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold backdrop-blur-2xl transition-all ${
                activeTab === 'avatars' ? 'border-violet-400/80 bg-violet-600/30 text-white' : 'text-slate-200'
              }`}
            >
              <Camera className="h-4 w-4 text-fuchsia-300" />
              <span>Change Avatar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Info Header overlapping Banner */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="relative -mt-20 sm:-mt-24 flex flex-col items-center text-center">
          {/* Avatar with glowing purple neon border */}
          <div className="relative group">
            <div className="relative h-32 w-32 sm:h-40 sm:w-40 overflow-hidden rounded-full border-4 border-violet-500 bg-[#121422] shadow-[0_0_35px_rgba(168,85,247,0.75)] ring-4 ring-violet-500/25 transition-transform duration-200 group-hover:scale-105">
              <AnimeImage
                src={selectedPhotoUrl}
                alt={displayNameInput}
                variant="avatar"
                className="h-full w-full object-cover object-top"
              />
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('avatars')}
              aria-label="Change Avatar"
              className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#07080d] bg-violet-600 text-white shadow-lg transition-transform hover:scale-110 active:scale-95"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          {/* Profile Name & Edit Name */}
          <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-md">
            {isEditingName ? (
              <div className="flex w-full items-center gap-2">
                <input
                  type="text"
                  maxLength={60}
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-violet-500/60 bg-[#10121c] px-4 text-center text-base font-bold text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="kuro-btn-primary h-11 rounded-xl px-4 text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-white">{displayNameInput}</h1>
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.08] px-2.5 py-1 text-xs font-semibold text-violet-300 hover:bg-white/[0.14] transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit Name</span>
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">
              {user?.email || 'Guest Profile'} ·{' '}
              {isAdmin && (
                <span className="font-semibold text-violet-400">Administrator (All Customizations Unlocked)</span>
              )}
            </p>
          </div>
        </div>

        {/* Action Save Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/[0.1] bg-[#10121d]/90 p-4 backdrop-blur-xl shadow-xl">
          <div className="text-xs text-slate-300">
            {saveSuccess ? (
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Profile updated successfully! Redirecting...
              </span>
            ) : saveError ? (
              <span className="font-semibold text-rose-400">{saveError}</span>
            ) : lockNotice ? (
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> {lockNotice}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Live preview active. Tap any avatar or banner to preview, then save changes.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              disabled={saving}
              className="kuro-btn-glass rounded-xl px-4 py-2 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={saving}
              className="kuro-btn-primary inline-flex min-h-[42px] items-center gap-2 rounded-xl px-6 py-2 text-xs sm:text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.5)] transition-transform hover:scale-[1.02] active:scale-95"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Tabs: Banners / Avatars */}
        <div className="mt-8 space-y-6">
          <div className="flex justify-center">
            <div className="kuro-segment-track inline-flex rounded-2xl p-1 gap-1 border border-white/[0.08] bg-black/40 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setActiveTab('banners')}
                className={`flex items-center gap-2 rounded-xl px-7 py-3 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'banners'
                    ? 'kuro-segment-active shadow-[0_0_20px_rgba(168,85,247,0.4)] text-white'
                    : 'kuro-segment-idle text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="h-4 w-4 text-violet-400" />
                <span>Anime Banners ({banners.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('avatars')}
                className={`flex items-center gap-2 rounded-xl px-7 py-3 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'avatars'
                    ? 'kuro-segment-active shadow-[0_0_20px_rgba(168,85,247,0.4)] text-white'
                    : 'kuro-segment-idle text-slate-400 hover:text-white'
                }`}
              >
                <User className="h-4 w-4 text-fuchsia-400" />
                <span>Anime Avatars</span>
              </button>
            </div>
          </div>

          {/* TAB 1: BANNERS GALLERY */}
          {activeTab === 'banners' && (
            <div className="space-y-6">
              {/* Category Filters Bar & Search */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" />
                      <span>Anime Banner Gallery</span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      High-resolution WebP landscape banners across 15 popular anime collections.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={bannerSearchQuery}
                      onChange={(e) => setBannerSearchQuery(e.target.value)}
                      placeholder="Search anime banners..."
                      className="h-9 w-full rounded-xl border border-white/[0.1] bg-[#10121d] pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 15 Category Filter Pills with Smooth Left/Right Navigation */}
                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => scrollCategories('left')}
                    aria-label="Scroll categories left"
                    className="hidden sm:flex z-10 mr-1 h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#10121d] text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div
                    ref={categoryScrollRef}
                    className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none scroll-smooth flex-1"
                  >
                    {BANNER_CATEGORIES.map((cat) => {
                      const isSelected = selectedBannerCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedBannerCategory(cat)}
                          className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                            isSelected
                              ? 'border border-violet-400 bg-violet-600/40 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                              : 'border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollCategories('right')}
                    aria-label="Scroll categories right"
                    className="hidden sm:flex z-10 ml-1 h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#10121d] text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Upload & Custom URL Section */}
              <div className="kuro-glass rounded-2xl p-4 sm:p-5 border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Custom Banner Upload &amp; Image Link
                  </h3>
                  {fileUploadError && (
                    <span className="text-xs font-medium text-rose-400">{fileUploadError}</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={bannerFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBannerFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => bannerFileInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="kuro-btn-glass w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-violet-300 hover:text-white"
                  >
                    {isUploadingBanner ? (
                      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{isUploadingBanner ? 'Optimizing WebP...' : 'Upload From Device'}</span>
                  </button>

                  <div className="flex-1 flex w-full gap-2">
                    <input
                      type="url"
                      value={customBannerInput}
                      onChange={(e) => setCustomBannerInput(e.target.value)}
                      placeholder="Or paste external banner image URL..."
                      className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customBannerInput.trim()) {
                          setSelectedBannerUrl(customBannerInput.trim());
                          setCustomBannerInput('');
                        }
                      }}
                      className="kuro-btn-primary rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Banner Cards Grid: Progressive Loading, Optimized WebP Image, Glowing Purple Border on Selection */}
              {filteredBanners.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.08] bg-[#0a0c16] p-10 text-center">
                  <ImageIcon className="mx-auto h-8 w-8 text-slate-500" />
                  <p className="mt-2 text-sm font-semibold text-slate-300">No banners found</p>
                  <p className="text-xs text-slate-500">
                    Try selecting another category or clear your search query.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {displayedBanners.map((banner) => {
                      const isSelected = selectedBannerUrl === banner.imageUrl;
                      const unlocked = isBannerUnlocked(banner, customizationSettings, isAdmin);

                      return (
                        <div
                          key={banner.id}
                          onClick={() => handleSelectBanner(banner)}
                          className={`group relative aspect-[16/9] cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 ${
                            isSelected
                              ? 'border-violet-400 ring-2 ring-violet-500 shadow-[0_0_25px_rgba(168,85,247,0.7)] scale-[1.02]'
                              : 'border-white/[0.08] bg-[#121422] hover:border-violet-400/60 hover:shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                          }`}
                        >
                          {/* Optimized Thumbnail-First WebP Banner Loader */}
                          <OptimizedBannerImage
                            src={banner.imageUrl}
                            thumbnailUrl={banner.thumbnailUrl}
                            alt={banner.title}
                            className="h-full w-full"
                          />

                          {/* Dark gradient overlay for text readability */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />

                          {/* Top Badges: Category & Lock Status */}
                          <div className="absolute left-2.5 top-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                            <span className="rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-violet-300 backdrop-blur-md border border-white/[0.08]">
                              {normalizeBannerCategory(banner.category)}
                            </span>

                            {!unlocked && (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-950/70 px-2 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur-md">
                                <Lock className="h-3 w-3" />
                                <span>Locked</span>
                              </span>
                            )}
                          </div>

                          {/* Title & Selected indicator at bottom */}
                          <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2 pointer-events-none">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs sm:text-sm font-bold text-white drop-shadow-md">
                                {banner.title}
                              </p>
                            </div>

                            {isSelected && (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_0_12px_rgba(168,85,247,0.8)] border border-violet-300">
                                <Check className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Progressive Scroll Sentinel & Load More */}
                  {hasMoreBanners && (
                    <div ref={bannerSentinelRef} className="pt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleBannerCount((prev) => prev + 12)}
                        className="kuro-btn-glass rounded-2xl px-6 py-2.5 text-xs font-semibold text-slate-300 hover:text-white"
                      >
                        Show More Banners ({filteredBanners.length - visibleBannerCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ANIME AVATARS */}
          {activeTab === 'avatars' && (
            <div className="space-y-6">
              {/* Search & Series Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search characters (Gojo, Naruto, Luffy, Tanjiro)..."
                    className="h-10 w-full rounded-2xl border border-white/[0.1] bg-[#10121d] pl-10 pr-4 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {ANIME_SERIES_FILTERS.slice(0, 7).map((series) => (
                    <button
                      key={series.id}
                      type="button"
                      onClick={() => setSeriesId(series.id)}
                      className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                        seriesId === series.id
                          ? 'border border-violet-400 bg-violet-600/40 text-white'
                          : 'kuro-btn-glass text-slate-300'
                      }`}
                    >
                      {series.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Avatar Upload & URL */}
              <div className="kuro-glass rounded-2xl p-4 sm:p-5 border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Custom Avatar Upload &amp; Image Link
                  </h3>
                  {fileUploadError && (
                    <span className="text-xs font-medium text-rose-400">{fileUploadError}</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="kuro-btn-glass w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-fuchsia-300 hover:text-white"
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Avatar</span>
                  </button>

                  <div className="flex-1 flex w-full gap-2">
                    <input
                      type="url"
                      value={customAvatarInput}
                      onChange={(e) => setCustomAvatarInput(e.target.value)}
                      placeholder="Or paste external avatar image URL..."
                      className="h-10 flex-1 rounded-xl border border-white/[0.1] bg-[#07080d] px-3.5 text-xs text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customAvatarInput.trim()) {
                          setSelectedPhotoUrl(customAvatarInput.trim());
                          setCustomAvatarInput('');
                        }
                      }}
                      className="kuro-btn-primary rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              {/* Characters Grid */}
              {loadingCharacters ? (
                <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/[0.06]" />
                  ))}
                </div>
              ) : characterError ? (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center text-xs text-rose-300">
                  {characterError}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                    {characters.map((ch) => {
                      const isSelected = selectedPhotoUrl === ch.imageUrl;
                      const unlocked = isAvatarUnlocked(ch.id, customizationSettings, isAdmin);

                      return (
                        <div
                          key={ch.id}
                          onClick={() => handleSelectAvatar(ch)}
                          className={`group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border transition-all duration-200 ${
                            isSelected
                              ? 'border-violet-400 ring-2 ring-violet-500 shadow-[0_0_20px_rgba(168,85,247,0.7)] scale-105'
                              : 'border-white/[0.08] bg-[#121422] hover:border-violet-400/50 hover:scale-[1.03]'
                          }`}
                        >
                          <img
                            src={ch.imageUrl}
                            alt={ch.name}
                            loading="lazy"
                            className="h-full w-full object-cover object-top transition-transform duration-200 group-hover:scale-105"
                            referrerPolicy="no-referrer"
                          />

                          {/* Gradient shadow for name */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                          <p className="absolute bottom-1 inset-x-1 truncate text-[10px] font-semibold text-white text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {ch.name}
                          </p>

                          {!unlocked && (
                            <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-950/90 text-amber-300 border border-amber-400/40 shadow pointer-events-none">
                              <Lock className="h-2.5 w-2.5" />
                            </span>
                          )}

                          {isSelected && (
                            <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shadow border border-violet-300 pointer-events-none">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {hasNextPage && (
                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => loadCharacters(page + 1, true)}
                        disabled={loadingMoreCharacters}
                        className="kuro-btn-glass rounded-2xl px-6 py-2.5 text-xs font-semibold text-slate-200"
                      >
                        {loadingMoreCharacters ? (
                          <span className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading more...
                          </span>
                        ) : (
                          'Load More Characters'
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProfileEditPage;

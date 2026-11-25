import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';

const KUROSTREAM_LOGO_SRC =
  '/assets/aistudio/file_000000004ebc8211a223cbd3b7d37859_6ea9f159.png';

interface LoginParticle {
  id: number;
  left: string;
  bottom: string;
  size: number;
  delay: string;
  duration: string;
  driftX: string;
  tone: 'purple' | 'crimson' | 'violet';
}

const LOGIN_PARTICLES: LoginParticle[] = [
  { id: 1, left: '10%', bottom: '12%', size: 3, delay: '0.0s', duration: '5.4s', driftX: '10px', tone: 'purple' },
  { id: 2, left: '22%', bottom: '24%', size: 4, delay: '0.9s', duration: '6.2s', driftX: '-12px', tone: 'crimson' },
  { id: 3, left: '34%', bottom: '10%', size: 3, delay: '1.6s', duration: '5.8s', driftX: '14px', tone: 'violet' },
  { id: 4, left: '48%', bottom: '16%', size: 3, delay: '0.4s', duration: '6.5s', driftX: '-8px', tone: 'purple' },
  { id: 5, left: '64%', bottom: '12%', size: 4, delay: '2.1s', duration: '5.6s', driftX: '12px', tone: 'crimson' },
  { id: 6, left: '78%', bottom: '20%', size: 3, delay: '1.1s', duration: '6.0s', driftX: '-14px', tone: 'violet' },
  { id: 7, left: '89%', bottom: '14%', size: 3, delay: '2.6s', duration: '5.3s', driftX: '-10px', tone: 'purple' },
  { id: 8, left: '16%', bottom: '58%', size: 3, delay: '1.8s', duration: '6.4s', driftX: '10px', tone: 'violet' },
  { id: 9, left: '84%', bottom: '64%', size: 3, delay: '0.7s', duration: '5.9s', driftX: '-12px', tone: 'crimson' },
];

const GoogleLogoSvg: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.49 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.13H1.02v3.14C3.03 21.15 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.03 14.02c-.25-.73-.39-1.51-.39-2.32s.14-1.59.39-2.32V6.24H1.02A11.97 11.97 0 0 0 0 11.7c0 1.94.46 3.77 1.02 5.46l4.01-3.14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.79 0 3.4.62 4.67 1.83l3.5-3.5C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.85 1.02 6.86l4.01 3.14C6.01 6.94 8.76 4.75 12 4.75Z"
    />
  </svg>
);

export interface AuthModalProps {
  mandatory?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({ mandatory = false }) => {
  const {
    user,
    isAuthModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    refreshEmailVerification,
    sendPasswordReset,
    signOut,
    firebaseEnabled,
    authError,
    authNotice,
    authLoading,
    clearAuthMessages,
  } = useAuth();

  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'google' | 'email' | 'reset' | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const isAuthenticated = Boolean(user && user.emailVerified);
  const shouldShow = mandatory || !isAuthenticated ? (!isAuthenticated ? true : isAuthModalOpen) : isAuthModalOpen;

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (!authLoading) {
      setPendingAction(null);
    }
  }, [authLoading]);

  useEffect(() => {
    if (!shouldShow || mandatory) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !authLoading) {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldShow, mandatory, authLoading, closeAuthModal]);

  if (!shouldShow) return null;

  const isPendingEmailVerification = Boolean(user && !user.emailVerified);

  const handleTabSwitch = (nextTab: 'signin' | 'register') => {
    if (nextTab === authTab || authLoading) return;
    setAuthTab(nextTab);
    clearAuthMessages();
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingAction('email');
    if (authTab === 'signin') {
      await signInWithEmail(email, password);
    } else {
      await registerWithEmail(email, password, displayName);
    }
  };

  const handleGoogleClick = async () => {
    setPendingAction('google');
    await signInWithGoogle();
  };

  const handleResetClick = async () => {
    setPendingAction('reset');
    await sendPasswordReset(email);
  };

  return (
    <div
      className="kuro-auth-backdrop-enter fixed inset-0 z-50 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      style={{
        background:
          'radial-gradient(ellipse at 18% 12%, rgba(124, 58, 237, 0.34) 0%, transparent 52%), radial-gradient(ellipse at 85% 18%, rgba(225, 29, 72, 0.22) 0%, transparent 46%), radial-gradient(ellipse at 50% 96%, rgba(88, 28, 135, 0.28) 0%, transparent 56%), linear-gradient(180deg, #040308 0%, #0d051a 52%, #030206 100%)',
      }}
    >
      {/* Ambient soft purple & crimson-red glow layers (non-blocking) */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="kuro-auth-orb absolute -left-24 -top-24 h-72 w-72 sm:h-96 sm:w-96 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(147, 51, 234, 0.34) 0%, rgba(109, 40, 217, 0.1) 48%, transparent 72%)',
          }}
        />
        <div
          className="kuro-auth-orb absolute -bottom-24 -right-20 h-72 w-72 sm:h-96 sm:w-96 rounded-full"
          style={{
            animationDelay: '2.2s',
            background:
              'radial-gradient(circle, rgba(225, 29, 72, 0.25) 0%, rgba(159, 18, 57, 0.09) 46%, transparent 72%)',
          }}
        />

        {!reducedMotion &&
          LOGIN_PARTICLES.map((particle) => {
            const color =
              particle.tone === 'crimson'
                ? 'rgba(251, 113, 133, 0.82)'
                : particle.tone === 'violet'
                  ? 'rgba(196, 181, 253, 0.85)'
                  : 'rgba(168, 85, 247, 0.85)';
            const glow =
              particle.tone === 'crimson'
                ? '0 0 10px 1px rgba(225, 29, 72, 0.55)'
                : '0 0 10px 1px rgba(147, 51, 234, 0.6)';

            return (
              <span
                key={particle.id}
                className="kuro-auth-particle absolute rounded-full"
                style={
                  {
                    left: particle.left,
                    bottom: particle.bottom,
                    width: `${particle.size}px`,
                    height: `${particle.size}px`,
                    backgroundColor: color,
                    boxShadow: glow,
                    animationDelay: particle.delay,
                    animationDuration: particle.duration,
                    '--drift-x': particle.driftX,
                  } as React.CSSProperties
                }
              />
            );
          })}
      </div>

      {/* Keyboard-safe scrollable container */}
      <div
        className="relative z-10 flex min-h-full items-center justify-center px-4 py-6 sm:p-6"
        style={{
          paddingTop: 'max(1.5rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="kuro-auth-card kuro-auth-card-enter relative w-full max-w-[430px] overflow-hidden rounded-[30px] p-6 sm:p-7">
          {/* Subtle top specular glass rim highlight (non-blocking) */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/45 to-transparent"
          />

          {/* Dismiss / Close button */}
          {!mandatory && (
            <button
              type="button"
              onClick={closeAuthModal}
              aria-label="Close sign in dialog"
              className="kuro-btn-glass absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-2xl text-slate-300 hover:text-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}

          {/* Official Flix4U Brand Header */}
          <div className="flex flex-col items-center text-center">
            <div className="kuro-auth-logo-enter relative flex h-20 w-20 items-center justify-center sm:h-[88px] sm:w-[88px]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 rounded-full opacity-85"
                style={{
                  background:
                    'radial-gradient(circle, rgba(168, 85, 247, 0.36) 0%, rgba(225, 29, 72, 0.2) 50%, transparent 74%)',
                }}
              />
              <img
                src={KUROSTREAM_LOGO_SRC}
                alt="Flix4U"
                draggable={false}
                className="relative h-full w-full rounded-2xl object-contain drop-shadow-[0_10px_24px_rgba(139,92,246,0.4)]"
              />
            </div>

            <h2
              id="auth-modal-title"
              className="mt-4 font-display text-2xl font-bold tracking-tight text-white"
            >
              {isPendingEmailVerification
                ? 'Verify Your Email'
                : authTab === 'signin'
                  ? 'Welcome Back'
                  : 'Join Flix4U'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300/80 max-w-[300px]">
              {isPendingEmailVerification
                ? 'Complete verification to unlock cloud sync across your devices.'
                : authTab === 'signin'
                  ? 'Sign in to sync your watchlist, favorites, and progress.'
                  : 'Create your account to sync anime across Android and web.'}
            </p>
          </div>

          {/* Pending Email Verification State */}
          {firebaseEnabled && isPendingEmailVerification && user && (
            <div className="kuro-auth-feedback-enter mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-100">
              <p className="font-semibold text-amber-200">Email verification pending</p>
              <p className="mt-1 leading-relaxed text-amber-100/85">
                Signed in as <span className="font-semibold text-white">{user.email}</span>. Open the
                verification link sent to your inbox, then tap refresh below.
              </p>
              <div className="mt-4 flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={refreshEmailVerification}
                  className="kuro-auth-cta inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${authLoading ? 'animate-spin' : ''}`} />
                  <span>I&apos;ve Verified — Continue</span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={resendVerificationEmail}
                    className="kuro-btn-glass inline-flex min-h-[44px] items-center justify-center rounded-2xl px-3 text-xs font-semibold disabled:opacity-60"
                  >
                    <span>Resend Email</span>
                  </button>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={signOut}
                    className="kuro-btn-glass inline-flex min-h-[44px] items-center justify-center rounded-2xl px-3 text-xs font-semibold text-slate-200"
                  >
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Sign In / Sign Up Experience */}
          {firebaseEnabled && !isPendingEmailVerification && (
            <div className="mt-6 space-y-4">
              {/* iOS 26 Segmented Switcher */}
              <div
                className="relative grid grid-cols-2 rounded-2xl border border-white/[0.1] bg-black/45 p-1 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)]"
                role="tablist"
                aria-label="Authentication mode"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[12px] border border-violet-300/30 bg-gradient-to-r from-violet-600/90 via-purple-600/90 to-rose-600/80 shadow-[0_4px_16px_-4px_rgba(139,92,246,0.65)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{
                    transform:
                      authTab === 'signin'
                        ? 'translate3d(0%, 0, 0)'
                        : 'translate3d(100%, 0, 0)',
                  }}
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'signin'}
                  disabled={authLoading}
                  onClick={() => handleTabSwitch('signin')}
                  className={`relative z-10 min-h-[40px] rounded-[12px] text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                    authTab === 'signin' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authTab === 'register'}
                  disabled={authLoading}
                  onClick={() => handleTabSwitch('register')}
                  className={`relative z-10 min-h-[40px] rounded-[12px] text-xs sm:text-sm font-semibold transition-colors duration-200 whitespace-nowrap ${
                    authTab === 'register' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {/* Email / Password Form with Animated Tab Panel */}
              <form
                key={authTab}
                onSubmit={handleEmailSubmit}
                className="kuro-auth-tab-panel space-y-3"
              >
                {authTab === 'register' && (
                  <div className="group relative rounded-2xl border border-white/[0.11] bg-[#080611]/85 transition-all duration-200 focus-within:border-violet-400/75 focus-within:bg-[#110c21]/95 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.18),0_10px_24px_-12px_rgba(225,29,72,0.28)]">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-violet-300" />
                    <input
                      type="text"
                      maxLength={80}
                      autoComplete="name"
                      enterKeyHint="next"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Display Name (optional)"
                      aria-label="Display Name"
                      className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="group relative rounded-2xl border border-white/[0.11] bg-[#080611]/85 transition-all duration-200 focus-within:border-violet-400/75 focus-within:bg-[#110c21]/95 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.18),0_10px_24px_-12px_rgba(225,29,72,0.28)]">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-violet-300" />
                  <input
                    type="email"
                    required
                    inputMode="email"
                    autoComplete="email"
                    enterKeyHint="next"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    aria-label="Email address"
                    className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </div>

                <div className="group relative rounded-2xl border border-white/[0.11] bg-[#080611]/85 transition-all duration-200 focus-within:border-violet-400/75 focus-within:bg-[#110c21]/95 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.18),0_10px_24px_-12px_rgba(225,29,72,0.28)]">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400 transition-colors duration-200 group-focus-within:text-violet-300" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={authTab === 'signin' ? 'current-password' : 'new-password'}
                    enterKeyHint={authTab === 'signin' ? 'go' : 'done'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      authTab === 'signin' ? 'Password' : 'Create password (min 6 characters)'
                    }
                    aria-label="Password"
                    className="h-12 w-full rounded-2xl bg-transparent pl-11 pr-12 text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 transition-colors hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  {authTab === 'signin' ? (
                    <button
                      type="button"
                      disabled={authLoading}
                      onClick={handleResetClick}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-1 text-xs font-medium text-violet-300 transition-colors hover:text-violet-200 disabled:opacity-50"
                    >
                      {authLoading && pendingAction === 'reset'
                        ? 'Sending reset link...'
                        : 'Forgot password?'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Verification email sent after sign up
                    </span>
                  )}
                </div>

                {/* Primary Animated Login / Create Account Button */}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="kuro-auth-cta relative flex min-h-[50px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-5 py-3 text-sm font-semibold tracking-wide disabled:opacity-65"
                >
                  {!reducedMotion && !authLoading && (
                    <span
                      aria-hidden="true"
                      className="kuro-auth-cta-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    />
                  )}
                  {authLoading && pendingAction === 'email' && (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  )}
                  <span className="relative z-10">
                    {authLoading && pendingAction === 'email'
                      ? authTab === 'signin'
                        ? 'Signing In...'
                        : 'Creating Account...'
                      : authTab === 'signin'
                        ? 'Sign In'
                        : 'Create Account'}
                  </span>
                </button>
              </form>

              {/* Hairline Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.14]" />
                <span className="text-xs font-medium text-slate-400">or continue with</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.14]" />
              </div>

              {/* Google Sign-In Button with Official Google Logo */}
              <button
                type="button"
                disabled={authLoading}
                onClick={handleGoogleClick}
                className="kuro-auth-google-btn flex min-h-[50px] w-full items-center justify-center gap-3 rounded-2xl px-5 py-3 text-sm font-semibold disabled:opacity-65"
              >
                {authLoading && pendingAction === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
                ) : (
                  <GoogleLogoSvg className="h-5 w-5 shrink-0" />
                )}
                <span>
                  {authLoading && pendingAction === 'google'
                    ? 'Connecting to Google...'
                    : 'Continue with Google'}
                </span>
              </button>
            </div>
          )}

          {!firebaseEnabled && (
            <div className="kuro-auth-feedback-enter mt-6 flex items-start gap-2.5 rounded-2xl border border-rose-400/30 bg-rose-500/12 px-4 py-3 text-xs text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <span>Firebase Authentication is currently unavailable in this build.</span>
            </div>
          )}

          {/* Animated Success Notice */}
          {authNotice && (
            <div
              role="status"
              className="kuro-auth-feedback-enter mt-4 flex items-start gap-2.5 rounded-2xl border border-emerald-400/35 bg-emerald-500/12 px-3.5 py-3 text-xs leading-relaxed text-emerald-100"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
              <span>{authNotice}</span>
            </div>
          )}

          {/* Animated Error Alert */}
          {authError && (
            <div
              role="alert"
              className="kuro-auth-feedback-enter mt-4 flex items-start gap-2.5 rounded-2xl border border-rose-400/35 bg-rose-500/12 px-3.5 py-3 text-xs leading-relaxed text-rose-100"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
              <span>{authError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

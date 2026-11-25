import React from 'react';
import { Send } from 'lucide-react';

interface TelegramSupportButtonProps {
  className?: string;
  showLabel?: boolean;
}

export const TELEGRAM_SUPPORT_URL = 'https://t.me/rifat_hossain125';

export const handleTelegramSupportClick = (e?: React.MouseEvent) => {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  try {
    const newWindow = window.open(TELEGRAM_SUPPORT_URL, '_blank', 'noopener,noreferrer');
    if (newWindow) newWindow.opener = null;
  } catch {
    window.location.href = TELEGRAM_SUPPORT_URL;
  }
};

export const TelegramSupportButton: React.FC<TelegramSupportButtonProps> = ({
  className = '',
  showLabel = true,
}) => {
  return (
    <div className={`fixed bottom-20 right-4 sm:bottom-8 sm:right-8 z-40 flex items-center gap-3 animate-bounce-slow ${className}`}>
      {showLabel && (
        <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-[#229ED9]/40 bg-[#0c101d]/90 px-3.5 py-2 shadow-[0_10px_25px_rgba(0,0,0,0.5)] backdrop-blur-xl">
          <span className="h-2 w-2 rounded-full bg-[#229ED9] animate-pulse" />
          <span className="text-xs font-semibold text-slate-100 whitespace-nowrap">
            Need Help? Contact Support
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={handleTelegramSupportClick}
        aria-label="Contact Telegram Support"
        className="group relative flex h-14 w-14 sm:h-15 sm:w-15 items-center justify-center rounded-full border border-[#229ED9]/60 bg-gradient-to-br from-[#229ED9] via-[#0088cc] to-[#006699] text-white shadow-[0_0_35px_rgba(34,158,217,0.65)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_50px_rgba(34,158,217,0.9)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
        <Send className="h-6 w-6 sm:h-7 sm:w-7 transform rotate-12 translate-x-0.5 group-hover:scale-110 transition-transform" />
      </button>
    </div>
  );
};

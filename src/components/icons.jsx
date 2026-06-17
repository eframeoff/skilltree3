// Minimal inline SVG icon set (no icon library dependency).
export const PlayIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const LockIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 1 1 6 0v3z" />
  </svg>
);

export const StarIcon = ({ filled, className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" className={className}
       fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const CheckIcon = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CloseIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
  </svg>
);

export const PlusIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
  </svg>
);

export const SendIcon = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
  </svg>
);

const stroke = (d, className = 'w-5 h-5') => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
       strokeLinecap="round" strokeLinejoin="round" className={className}>
    {d}
  </svg>
);

export const HomeIcon = ({ className }) =>
  stroke(<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>, className);

export const TreeIcon = ({ className }) =>
  stroke(<><circle cx="12" cy="4" r="2" /><circle cx="6" cy="14" r="2" /><circle cx="18" cy="14" r="2" /><circle cx="12" cy="21" r="1.6" /><path d="M12 6v3M12 9L6.8 12.6M12 9l5.2 3.6M7 15.6 11 19.4M17 15.6 13 19.4" /></>, className);

export const VideoIcon = ({ className }) =>
  stroke(<><rect x="2" y="6" width="13" height="12" rx="2" /><path d="M15 10l6-3v10l-6-3z" /></>, className);

export const UsersIcon = ({ className }) =>
  stroke(<><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5a3 3 0 0 1 0 6M17 20a6 6 0 0 0-3-5" /></>, className);

export const CalendarIcon = ({ className }) =>
  stroke(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>, className);

export const ClockIcon = ({ className }) =>
  stroke(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, className);

export const PinIcon = ({ className }) =>
  stroke(<><path d="M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>, className);

export const LogoutIcon = ({ className }) =>
  stroke(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>, className);

export const ChevronRightIcon = ({ className = 'w-5 h-5' }) =>
  stroke(<path d="M9 6l6 6-6 6" />, className);

export const BackIcon = ({ className = 'w-6 h-6' }) =>
  stroke(<path d="M15 6l-6 6 6 6" />, className);

export const ShareIcon = ({ className }) =>
  stroke(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></>, className);

export const BookIcon = ({ className }) =>
  stroke(<><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 19a2 2 0 0 1 2-2h12" /></>, className);

export const GradCapIcon = ({ className }) =>
  stroke(<><path d="M22 9L12 5 2 9l10 4 10-4z" /><path d="M6 11v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5" /></>, className);

export const ChatIcon = ({ className }) =>
  stroke(<path d="M21 12a8 8 0 0 1-11.3 7.3L3 21l1.7-6.7A8 8 0 1 1 21 12z" />, className);

export const CompassIcon = ({ className }) =>
  stroke(<><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></>, className);

export const PencilIcon = ({ className }) =>
  stroke(<><path d="M17 3l4 4L8 20l-5 1 1-5z" /><path d="M14.5 5.5l4 4" /></>, className);

export const TrashIcon = ({ className }) =>
  stroke(<><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>, className);

export const LinkIcon = ({ className }) =>
  stroke(<><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 18.5" /></>, className);

export const LayersIcon = ({ className }) =>
  stroke(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /><path d="M3 17l9 5 9-5" /></>, className);

export const SettingsIcon = ({ className }) =>
  stroke(<><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" /></>, className);

export const ShopIcon = ({ className }) =>
  stroke(<><path d="M4 7h16l-1 13H5z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></>, className);

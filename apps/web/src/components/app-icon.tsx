import React, { type SVGProps } from 'react';

export type AppIconName =
  | 'clipboard'
  | 'settings'
  | 'construction'
  | 'shield'
  | 'pin'
  | 'edit'
  | 'award'
  | 'info'
  | 'bell'
  | 'bell-off'
  | 'warning'
  | 'arrow-down'
  | 'download'
  | 'globe'
  | 'home'
  | 'paperclip'
  | 'message-square'
  | 'broom'
  | 'camera'
  | 'search'
  | 'flag'
  | 'users'
  | 'book'
  | 'mail'
  | 'file-text'
  | 'calendar'
  | 'check'
  | 'x'
  | 'log-out'
  | 'user'
  | 'chevron-down'
  | 'chevron-up'
  | 'chevron-right'
  | 'chevron-left'
  | 'clock'
  | 'megaphone'
  | 'ban';

export interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: AppIconName;
}

export function AppIcon({ name, className = 'h-4 w-4', ...props }: AppIconProps) {
  const shared = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };

  switch (name) {
    case 'clipboard':
      return (
        <svg {...shared}>
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 12h6M9 16h6" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...shared}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'construction':
      return (
        <svg {...shared}>
          <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
          <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...shared}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'pin':
      return (
        <svg {...shared}>
          <path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
        </svg>
      );
    case 'edit':
      return (
        <svg {...shared}>
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );
    case 'award':
      return (
        <svg {...shared}>
          <circle cx="12" cy="8" r="6" />
          <path d="m8.5 13-1 9 4.5-3 4.5 3-1-9" />
        </svg>
      );
    case 'info':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...shared}>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
      );
    case 'bell-off':
      return (
        <svg {...shared}>
          <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <path d="m2 2 20 20" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...shared}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'arrow-down':
      return (
        <svg {...shared}>
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      );
    case 'download':
      return (
        <svg {...shared}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </svg>
      );
    case 'globe':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20" />
        </svg>
      );
    case 'home':
      return (
        <svg {...shared}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'paperclip':
      return (
        <svg {...shared}>
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );
    case 'message-square':
      return (
        <svg {...shared}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'broom':
      return (
        <svg {...shared}>
          <path d="m14 17 5 5M17 14l5 5M2 22l5.5-1.5L21.3 6.7a2.4 2.4 0 0 0 0-3.4 2.4 2.4 0 0 0-3.4 0L4.1 17.1 2 22z" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...shared}>
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      );
    case 'search':
      return (
        <svg {...shared}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'flag':
      return (
        <svg {...shared}>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />
        </svg>
      );
    case 'users':
      return (
        <svg {...shared}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'book':
      return (
        <svg {...shared}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
          <path d="M6 6h10M6 10h10" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...shared}>
          <rect width="20" height="16" x="2" y="4" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'file-text':
      return (
        <svg {...shared}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...shared}>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'check':
      return (
        <svg {...shared}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'x':
      return (
        <svg {...shared}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    case 'log-out':
      return (
        <svg {...shared}>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case 'user':
      return (
        <svg {...shared}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...shared}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    case 'chevron-up':
      return (
        <svg {...shared}>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...shared}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      );
    case 'chevron-left':
      return (
        <svg {...shared}>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg {...shared}>
          <path d="m3 11 18-5v12L3 14v-3Z" />
          <path d="M6 15.5 7.5 21h4l-1.2-4.4" />
        </svg>
      );
    case 'ban':
      return (
        <svg {...shared}>
          <circle cx="12" cy="12" r="10" />
          <path d="m4.9 4.9 14.2 14.2" />
        </svg>
      );
  }
}

import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 40, className = '', showText = true }) => {
  return (
    <div className={`flex items-center gap-space-sm select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        <rect width="120" height="120" rx="28" fill="#1B4332" />
        <rect x="22" y="24" width="76" height="72" rx="14" fill="#2D6A4F" stroke="#52B788" strokeWidth="2" />
        <path d="M42 38H78M42 52H78M42 66H64" stroke="#D8F3DC" strokeWidth="4" strokeLinecap="round" />
        <circle cx="82" cy="74" r="14" fill="#52B788" />
        <path d="M76 74L80 78L88 70" stroke="#1B4332" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="34" cy="38" r="3" fill="#D8F3DC" />
        <circle cx="34" cy="52" r="3" fill="#D8F3DC" />
        <circle cx="34" cy="66" r="3" fill="#D8F3DC" />
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-headline-sm text-headline-sm text-primary leading-tight font-bold text-lg">
            مهامي
          </span>
          <span className="font-label-sm text-label-sm text-on-surface-variant font-medium text-xs">
            جمعية إرشاد الجاليات
          </span>
        </div>
      )}
    </div>
  );
};

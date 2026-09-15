/**
 * © 2026 Jory Al-Thuwaini — Mahami Platform
 */

'use client';

import React from 'react';

interface FooterProps {
  className?: string;
}

export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  return (
    <footer
      role="contentinfo"
      aria-label="حقوق الملكية وتذييل الصفحة"
      className={`w-full pt-6 pb-2 border-t border-surface-variant/30 flex flex-col items-center justify-center text-center gap-1.5 transition-all select-none ${className}`}
    >
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-on-surface-variant font-medium">
        <span>© 2026 منصة مهامي</span>
        <span className="text-outline/60">—</span>
        <span>جميع الحقوق محفوظة</span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-on-surface-variant">
        <span>تطوير:</span>
        <span className="font-bold text-primary tracking-wide hover:text-secondary transition-colors">
          جوري الثويني
        </span>
      </div>
    </footer>
  );
};

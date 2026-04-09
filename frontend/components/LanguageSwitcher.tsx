"use client";

import React from 'react';
import { useLocale } from 'next-intl';
import { useRouter, usePathname, routing } from '@/i18n/routing';
import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const nextLocale = locale === 'en' ? 'zh' : 'en';
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 backdrop-blur-sm hover:bg-muted transition-all group"
      title={locale === 'en' ? '切换回中文' : 'Switch to English'}
    >
      <Languages className="h-4 w-4 text-primary group-hover:rotate-12 transition-transform" />
      <span className="text-xs font-semibold tracking-wide flex gap-1 items-center">
        <span className={cn(locale === 'zh' ? "text-foreground" : "text-muted-foreground")}>中文</span>
        <span className="text-border">|</span>
        <span className={cn(locale === 'en' ? "text-foreground" : "text-muted-foreground")}>EN</span>
      </span>
    </button>
  );
}

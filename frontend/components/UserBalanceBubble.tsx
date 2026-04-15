"use client";

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, History, LogOut, Sparkles, UserRound, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { AuthUser } from '@/lib/api';

interface UserBalanceBubbleProps {
  currentUser: AuthUser | null;
  authInitializing: boolean;
  onLogout: () => void;
}

const formatJoinedDate = (locale: string, createdAt: string) => {
  if (!createdAt) {
    return '--';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  const formatterLocale = locale === 'zh' ? 'zh-CN' : 'en-US';
  return new Intl.DateTimeFormat(formatterLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export default function UserBalanceBubble({
  currentUser,
  authInitializing,
  onLogout,
}: UserBalanceBubbleProps) {
  const t = useTranslations('HomePage');
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const isChinese = locale === 'zh';
  const copy = {
    userBalanceTitle: isChinese ? '账户余额' : 'Account Balance',
    aiSearchRemaining: isChinese ? '可用 AI 搜索次数' : 'AI Searches Left',
    aiSearchUsed: isChinese ? '已用 AI 搜索次数' : 'AI Searches Used',
    aiSearchUnlimited: isChinese ? '不限量' : 'Unlimited',
    aiSearchUnlimitedHint: isChinese
      ? '当前账户未设置 AI 搜索限额'
      : 'No AI search cap is configured for this account yet.',
    discoveryCount: isChinese ? '累计 AI 分析次数' : 'Total Discoveries',
    memberSince: isChinese ? '注册于' : 'Member Since',
  };

  const aiSearchesRemaining = currentUser?.stats.aiSearchesRemaining ?? null;
  const aiSearchesLimit = currentUser?.stats.aiSearchesLimit ?? null;
  const aiSearchesUsed = currentUser?.stats.aiSearchesUsed ?? 0;
  const isUnlimited = currentUser?.stats.unlimitedAISearches ?? true;
  const joinedDate = currentUser ? formatJoinedDate(locale, currentUser.createdAt) : '--';
  const balanceBadge = isUnlimited ? copy.aiSearchUnlimited : String(aiSearchesRemaining ?? 0);
  const usageRatio =
    aiSearchesLimit && aiSearchesLimit > 0
      ? Math.min(100, Math.round((aiSearchesUsed / aiSearchesLimit) * 100))
      : 0;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 w-[calc(100vw-2rem)] max-w-sm">
      <AnimatePresence initial={false} mode="wait">
        {isOpen ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="pointer-events-auto rounded-[28px] border border-border/60 bg-background/92 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-primary/20 bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-sm">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {currentUser ? copy.userBalanceTitle : t('authPanelTitle')}
                  </p>
                  <p className="truncate text-base font-semibold text-foreground">
                    {currentUser
                      ? currentUser.username
                      : authInitializing
                        ? t('authChecking')
                        : t('guestMode')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close user panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {currentUser ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-primary/15 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                        {copy.aiSearchRemaining}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{balanceBadge}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isUnlimited
                        ? copy.aiSearchUnlimitedHint
                        : `${aiSearchesUsed} / ${aiSearchesLimit ?? 0}${isChinese ? ' 已用' : ' used'}`}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-border/60 bg-card/70 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <History className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                        {copy.discoveryCount}
                      </span>
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {currentUser.stats.discoveryCount}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{joinedDate}</p>
                  </div>
                </div>

                {!isUnlimited && aiSearchesLimit ? (
                  <div className="mt-4 rounded-3xl border border-border/60 bg-card/60 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{copy.aiSearchUsed}</span>
                      <span>{aiSearchesUsed}/{aiSearchesLimit}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width]"
                        style={{ width: `${usageRatio}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-dashed border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
                    {copy.aiSearchUnlimitedHint}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between gap-3 rounded-3xl border border-border/60 bg-card/60 p-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{copy.memberSince}</p>
                      <p className="truncate text-xs text-muted-foreground">{joinedDate}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>{t('logout')}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-3xl border border-border/60 bg-card/60 p-3 text-sm text-muted-foreground">
                {authInitializing ? t('authChecking') : t('authRequiredHint')}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            type="button"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto inline-flex w-full items-center gap-3 rounded-full border border-border/60 bg-background/92 px-3 py-2 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary/20 via-primary/10 to-background shadow-sm">
              <UserRound className="h-5 w-5 text-primary" />
            </div>

            <div className="min-w-0 flex-1 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {currentUser ? copy.userBalanceTitle : t('authPanelTitle')}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {currentUser
                  ? currentUser.username
                  : authInitializing
                    ? t('authChecking')
                    : t('guestMode')}
              </p>
            </div>

            {currentUser && (
              <div className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {balanceBadge}
              </div>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

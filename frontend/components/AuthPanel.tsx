"use client";

import React from 'react';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { AuthUser } from '@/lib/api';

type AuthMode = 'login' | 'register';

interface AuthPanelProps {
  currentUser: AuthUser | null;
  authMode: AuthMode;
  authUsername: string;
  authPassword: string;
  authLoading: boolean;
  authInitializing: boolean;
  authError: string | null;
  onAuthModeChange: (mode: AuthMode) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onLogout: () => void;
}

export default function AuthPanel({
  currentUser,
  authMode,
  authUsername,
  authPassword,
  authLoading,
  authInitializing,
  authError,
  onAuthModeChange,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onLogout,
}: AuthPanelProps) {
  const t = useTranslations('HomePage');

  if (currentUser) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t('loggedInAs')}</p>
              <p className="text-xs text-muted-foreground">{currentUser.username}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t('logout')}</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('authReadyHint')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{t('authPanelTitle')}</h2>
        <p className="text-xs text-muted-foreground">
          {authInitializing ? t('authChecking') : t('authPanelHint')}
        </p>
      </div>

      <div className="flex rounded-lg bg-muted/60 p-1">
        <button
          type="button"
          onClick={() => onAuthModeChange('login')}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            authMode === 'login' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t('login')}
        </button>
        <button
          type="button"
          onClick={() => onAuthModeChange('register')}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            authMode === 'register' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t('register')}
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <input
          type="text"
          value={authUsername}
          onChange={(event) => onUsernameChange(event.target.value)}
          placeholder={t('username')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <input
          type="password"
          value={authPassword}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder={t('password')}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />

        {authError && <p className="text-sm text-destructive font-medium">{authError}</p>}

        <button
          type="submit"
          disabled={authLoading}
          className="w-full inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-10 px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none"
        >
          {authLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : authMode === 'login' ? (
            t('loginAction')
          ) : (
            t('registerAction')
          )}
        </button>
      </form>
    </div>
  );
}

"use client";

import React from 'react';
import { History, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { DiscoveryRecord } from '@/lib/api';

interface DiscoveryHistoryProps {
  loading: boolean;
  records: DiscoveryRecord[];
  onSelect: (record: DiscoveryRecord) => void;
}

const formatDiscoveryTime = (value: string): string => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export default function DiscoveryHistory({ loading, records, onSelect }: DiscoveryHistoryProps) {
  const t = useTranslations('HomePage');

  return (
    <div className="rounded-2xl border border-border/50 bg-card/80 p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">{t('historyTitle')}</h3>
          <p className="text-xs text-muted-foreground">{t('historySubtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('historyLoading')}</span>
        </div>
      ) : records.length > 0 ? (
        <div className="space-y-2">
          {records.map((record) => (
            <button
              key={record.id}
              type="button"
              onClick={() => onSelect(record)}
              className="w-full rounded-xl border border-border/40 bg-background/70 px-3 py-2 text-left hover:border-primary/40 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{record.result.idiom || record.query}</p>
                  <p className="text-xs text-muted-foreground truncate">{record.query}</p>
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {formatDiscoveryTime(record.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {record.result.meaning || t('noMeaning')}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('historyEmpty')}</p>
      )}
    </div>
  );
}

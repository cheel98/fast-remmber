"use client";

import React, { useEffect, useState } from 'react';
import { X, BookOpen, TrendingUp, TrendingDown, Activity, Smile, Frown, Meh } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { IdiomResult, fetchIdiomDetail } from '@/lib/api';
import UsageExamples from '@/components/UsageExamples';
import { cn } from '@/lib/utils';

interface NodeDetailCardProps {
  idiomName: string;
  x: number;
  y: number;
  onClose: () => void;
  isHover?: boolean;
}

export default function NodeDetailCard({ idiomName, x, y, onClose, isHover }: NodeDetailCardProps) {
  const t = useTranslations('HomePage');
  const tCommon = useTranslations('Common');
  const [data, setData] = useState<IdiomResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchIdiomDetail(idiomName)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || t('saveError')); // Using saveError as generic fetch error name
        setLoading(false);
      });
  }, [idiomName]);

  if (loading) {
    return (
      <div 
        className={cn(
          "absolute z-[60] bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl p-4 w-64 animate-in fade-in zoom-in-95 duration-200",
          !isHover && "pointer-events-auto",
          isHover && "pointer-events-none"
        )}
        style={{ left: x + 20, top: y - 20 }}
      >
        <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
          <div className="h-4 w-4 bg-muted rounded-full" />
          <div className="h-4 w-32 bg-muted rounded" />
          <span className="text-[10px] ml-1">{t('loadingDetails')}</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div 
        className={cn(
          "absolute z-[60] bg-background/95 backdrop-blur-md border border-destructive/50 shadow-2xl rounded-2xl p-4 w-64 animate-in fade-in zoom-in-95 duration-200",
          !isHover && "pointer-events-auto",
          isHover && "pointer-events-none"
        )}
        style={{ left: x + 20, top: y - 20 }}
      >
        <p className="text-xs text-destructive font-medium">{error || t('notFound')}</p>
        {!isHover && <button onClick={onClose} className="mt-2 text-[10px] text-muted-foreground hover:underline">{tCommon('cancel')}</button>}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "absolute z-[60] bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl w-72 overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300",
        !isHover && "pointer-events-auto",
        isHover && "pointer-events-none"
      )}
      style={{ left: x + 20, top: y - 20 }}
      onClick={(e) => !isHover && e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm tracking-tight">{data.idiom}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
        {/* Meaning */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <BookOpen className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('meaning')}</span>
          </div>
          <p className="text-xs leading-relaxed text-foreground/90">{data.meaning || t('noMeaning')}</p>
        </div>

        <UsageExamples idiom={data.idiom} idiomMeaning={data.meaning} examples={data.examples} compact />

        {/* Sentiment */}
        <div className="flex items-center justify-between py-2 border-y border-border/30">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('sentiment')}</span>
          </div>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1",
            data.emotions.includes('褒') || data.emotions.toLowerCase().includes('pos') ? "bg-green-500/10 text-green-600 border border-green-500/20" :
            data.emotions.includes('贬') || data.emotions.toLowerCase().includes('neg') ? "bg-red-500/10 text-red-600 border border-red-500/20" : 
            "bg-blue-500/10 text-blue-600 border border-blue-500/20"
          )}>
            {data.emotions.includes('褒') || data.emotions.toLowerCase().includes('pos') ? <Smile className="h-3 w-3" /> :
             data.emotions.includes('贬') || data.emotions.toLowerCase().includes('neg') ? <Frown className="h-3 w-3" /> :
             <Meh className="h-3 w-3" />}
            {data.emotions}
          </span>
        </div>

        {/* Synonyms */}
        {data.synonyms && data.synonyms.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('synonyms')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.synonyms.map(syn => (
                <span key={syn.name} className="px-2 py-0.5 bg-muted/50 border border-border/50 rounded-md text-[10px] font-medium text-foreground/80 hover:bg-muted transition-colors">
                  {syn.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Antonyms */}
        {data.antonyms && data.antonyms.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3 w-3 text-rose-500" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('antonyms')}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.antonyms.map(ant => (
                <span key={ant.name} className="px-2 py-0.5 bg-muted/50 border border-border/50 rounded-md text-[10px] font-medium text-foreground/80 hover:bg-muted transition-colors">
                  {ant.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-muted/30 px-4 py-2 flex justify-end">
        <span className="text-[9px] text-muted-foreground opacity-50 font-mono">ID: {data.idiom}</span>
      </div>
    </div>
  );
}

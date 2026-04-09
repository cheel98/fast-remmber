"use client";

import { ExternalLink, Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { UsageExample } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UsageExamplesProps {
  examples?: UsageExample[];
  compact?: boolean;
  className?: string;
}

export default function UsageExamples({ examples, compact = false, className }: UsageExamplesProps) {
  const t = useTranslations('HomePage');

  if (!examples?.length) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1.5">
        <Quote className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "text-muted-foreground")} />
        <span className={cn(compact ? "text-[10px]" : "text-xs", "font-semibold uppercase tracking-wider text-muted-foreground")}>
          {t('examples')}
        </span>
      </div>

      <div className="space-y-2">
        {examples.map((example, index) => (
          <div
            key={`${example.sourceUrl}-${index}`}
            className={cn(
              "rounded-xl border border-border/50 bg-muted/20",
              compact ? "p-2.5" : "p-3"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full border border-border/50 bg-background/80 text-muted-foreground",
                  compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
                )}
              >
                {example.usage}
              </span>

              <a
                href={example.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 text-primary hover:underline",
                  compact ? "text-[10px]" : "text-[11px]"
                )}
              >
                <span className="text-muted-foreground">{t('source')}</span>
                <span className="max-w-[120px] truncate">{example.source}</span>
                <ExternalLink className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
              </a>
            </div>

            <p className={cn("mt-2 break-words leading-relaxed text-foreground/90", compact ? "text-xs" : "text-sm")}>
              {example.sentence}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

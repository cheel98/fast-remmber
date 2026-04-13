"use client";

import type { ReactNode } from 'react';
import { ExternalLink, Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { UsageExample } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UsageExamplesProps {
  idiom?: string;
  idiomMeaning?: string;
  examples?: UsageExample[];
  compact?: boolean;
  className?: string;
}

const usageExplanationPrefixes = [
  '用于',
  '用来',
  '比喻',
  '形容',
  '指',
  '表示',
  '常用来',
  '多用来',
  '多指',
  '此处',
  '强调',
  '说明',
  '突出',
  '批评',
  '讽刺',
  '赞扬',
  '赞美',
];

const looksLikeUsageExplanation = (text: string) => {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }

  if (usageExplanationPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  return normalized.length <= 24 && /比喻|形容|表示|说明|强调|指代|意指/.test(normalized);
};

const resolveExampleDisplay = (example: UsageExample, idiomMeaning?: string) => {
  const fallbackMeaning = idiomMeaning?.trim() || '';
  const usage = example.usage?.trim() || '';
  let title = example.title?.trim() || '';
  let usageLabel = usage;

  if (!looksLikeUsageExplanation(usage) && fallbackMeaning) {
    if (!title && usage) {
      title = usage;
    }
    usageLabel = fallbackMeaning;
  }

  if (!usageLabel) {
    usageLabel = fallbackMeaning;
  }

  return {
    title,
    usageLabel,
  };
};

const renderHighlightedSentence = (sentence: string, idiom?: string) => {
  if (!idiom || !sentence.includes(idiom)) {
    return sentence;
  }

  const parts: ReactNode[] = [];
  let remaining = sentence;
  let key = 0;

  while (remaining.length > 0) {
    const index = remaining.indexOf(idiom);
    if (index < 0) {
      parts.push(remaining);
      break;
    }

    if (index > 0) {
      parts.push(remaining.slice(0, index));
    }

    parts.push(
      <mark
        key={`idiom-${key}`}
        className="rounded-md bg-primary/15 px-1 py-0.5 font-semibold text-primary shadow-[inset_0_-1px_0_rgba(59,130,246,0.25)]"
      >
        {idiom}
      </mark>
    );

    remaining = remaining.slice(index + idiom.length);
    key += 1;
  }

  return parts;
};

export default function UsageExamples({ idiom, idiomMeaning, examples, compact = false, className }: UsageExamplesProps) {
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
          (() => {
            const { title, usageLabel } = resolveExampleDisplay(example, idiomMeaning);

            return (
              <div
                key={`${example.sourceUrl}-${title}-${index}`}
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
                    {usageLabel || t('noMeaning')}
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
                  {renderHighlightedSentence(example.sentence, idiom)}
                  {title && (
                    <span className="text-muted-foreground/90">
                      {" — "}
                      {title}
                    </span>
                  )}
                </p>
              </div>
            );
          })()
        ))}
      </div>
    </div>
  );
}

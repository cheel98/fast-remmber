"use client";

import { useTranslations } from 'next-intl';
import type { RelationshipDetail } from '@/lib/api';
import { cn } from '@/lib/utils';

interface RelationshipInsightProps {
  relation: Pick<RelationshipDetail, 'similarityType' | 'difference' | 'sourceExample' | 'targetExample'>;
  sourceIdiom?: string;
  targetIdiom?: string;
  compact?: boolean;
  className?: string;
}

const getSimilarityTone = (similarityType: string) => {
  const normalized = similarityType.trim();

  if (normalized.includes('形')) {
    return 'border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  }

  if (normalized.includes('意')) {
    return 'border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  }

  return 'border-border/60 bg-muted/40 text-foreground/80';
};

const getSimilarityLabel = (similarityType: string, translate: ReturnType<typeof useTranslations>) => {
  const normalized = similarityType.trim();

  if (normalized.includes('形')) {
    return translate('shapeSimilar');
  }

  if (normalized.includes('意')) {
    return translate('meaningSimilar');
  }

  return similarityType;
};

export default function RelationshipInsight({
  relation,
  sourceIdiom,
  targetIdiom,
  compact = false,
  className,
}: RelationshipInsightProps) {
  const t = useTranslations('HomePage');

  const hasSimilarityType = Boolean(relation.similarityType?.trim());
  const hasDifference = Boolean(relation.difference?.trim());
  const hasSourceExample = Boolean(relation.sourceExample?.trim());
  const hasTargetExample = Boolean(relation.targetExample?.trim());

  if (!hasSimilarityType && !hasDifference && !hasSourceExample && !hasTargetExample) {
    return null;
  }

  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5', className)}>
      {hasSimilarityType && relation.similarityType && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('similarityType')}
          </span>
          <span
            className={cn(
              'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold',
              getSimilarityTone(relation.similarityType),
            )}
          >
            {getSimilarityLabel(relation.similarityType, t)}
          </span>
        </div>
      )}

      {hasDifference && relation.difference && (
        <div className="rounded-xl border border-border/50 bg-background/70 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('difference')}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground/85">
            {relation.difference}
          </p>
        </div>
      )}

      {(hasSourceExample || hasTargetExample) && (
        <div className="space-y-2">
          {hasSourceExample && relation.sourceExample && (
            <div className="rounded-xl border border-border/40 bg-muted/25 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {sourceIdiom ? t('exampleOf', { idiom: sourceIdiom }) : t('sourceExample')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                {relation.sourceExample}
              </p>
            </div>
          )}

          {hasTargetExample && relation.targetExample && (
            <div className="rounded-xl border border-border/40 bg-muted/25 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {targetIdiom ? t('exampleOf', { idiom: targetIdiom }) : t('targetExample')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                {relation.targetExample}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

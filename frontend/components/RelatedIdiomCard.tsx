"use client";

import { Check, Compass, Minus, Plus } from 'lucide-react';
import type { RelationshipDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import RelationshipInsight from '@/components/RelationshipInsight';

export type RelatedIdiomAction = 'saved' | 'add' | 'remove' | 'idle';

interface RelatedIdiomCardProps {
  relation: RelationshipDetail;
  sourceIdiom?: string;
  tone?: 'synonym' | 'antonym' | 'neutral';
  action?: RelatedIdiomAction;
  actionTitle?: string;
  onToggle?: (relation: RelationshipDetail) => void;
  onExplore?: (relation: RelationshipDetail) => void;
  exploreTitle?: string;
  showExplore?: boolean;
  compact?: boolean;
}

const getActionIcon = (action?: RelatedIdiomAction) => {
  if (action === 'saved') {
    return <Check className="h-3.5 w-3.5" />;
  }

  if (action === 'add') {
    return <Plus className="h-3.5 w-3.5" />;
  }

  if (action === 'remove') {
    return <Minus className="h-3.5 w-3.5" />;
  }

  return <div className="h-3.5 w-3.5 rounded-sm border border-current" />;
};

export default function RelatedIdiomCard({
  relation,
  sourceIdiom,
  tone = 'neutral',
  action,
  actionTitle,
  onToggle,
  onExplore,
  exploreTitle,
  showExplore = false,
  compact = false,
}: RelatedIdiomCardProps) {
  const containerToneClass =
    tone === 'synonym'
      ? 'border-emerald-200/60 bg-emerald-50/35 dark:border-emerald-500/20 dark:bg-emerald-500/5'
      : tone === 'antonym'
        ? 'border-rose-200/60 bg-rose-50/30 dark:border-rose-500/20 dark:bg-rose-500/5'
        : 'border-border/60 bg-muted/20';

  const actionToneClass =
    action === 'saved'
      ? tone === 'antonym'
        ? 'text-rose-700 dark:text-rose-200'
        : 'text-foreground'
      : action === 'add'
        ? 'text-emerald-700 dark:text-emerald-200'
        : action === 'remove'
          ? 'text-amber-700 line-through dark:text-amber-200'
          : 'text-muted-foreground';

  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-3 shadow-sm',
        containerToneClass,
        compact && 'rounded-xl px-2.5 py-2.5',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {onToggle ? (
              <button
                type="button"
                title={actionTitle}
                onClick={() => onToggle(relation)}
                className={cn(
                  'inline-flex min-w-0 items-center gap-1.5 rounded-full px-0 text-left text-sm font-semibold transition-colors hover:text-primary',
                  actionToneClass,
                )}
              >
                {getActionIcon(action)}
                <span className="truncate">{relation.name}</span>
              </button>
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">
                {relation.name}
              </span>
            )}

            <span className="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {Math.round((relation.strength || 0) * 100)}%
            </span>
          </div>
        </div>

        {showExplore && onExplore && !relation.hasAIExplore && (
          <button
            type="button"
            onClick={() => onExplore(relation)}
            className="rounded-full border border-border/50 bg-background/80 p-1.5 text-muted-foreground transition-colors hover:text-primary"
            title={exploreTitle}
          >
            <Compass className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <RelationshipInsight
        relation={relation}
        sourceIdiom={sourceIdiom}
        targetIdiom={relation.name}
        compact={compact}
        className="mt-3"
      />
    </div>
  );
}

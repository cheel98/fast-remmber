'use client';

import { Filter, Pin, Settings2, Sparkles } from 'lucide-react';

import type { GraphRelationLabel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type GraphLabelVisibility = 'focus' | 'important' | 'all';

interface AppSettingsSheetProps {
  locale: string;
  isGraphPinned: boolean;
  onGraphPinnedChange: (checked: boolean) => void;
  labelVisibility: GraphLabelVisibility;
  onLabelVisibilityChange: (value: GraphLabelVisibility) => void;
  defaultDepth: 0 | 1 | 2;
  onDefaultDepthChange: (value: 0 | 1 | 2) => void;
  nodeLimit: 100 | 300 | 800;
  onNodeLimitChange: (value: 100 | 300 | 800) => void;
  relationFilters: GraphRelationLabel[];
  onRelationFiltersChange: (value: GraphRelationLabel[]) => void;
  autoFocus: boolean;
  onAutoFocusChange: (checked: boolean) => void;
}

const copyByLocale = {
  zh: {
    trigger: '图谱设置',
    title: '图谱设置',
    description: '控制大规模成语图谱的显示密度，先看结构，再看细节。',
    graphSection: '图谱视图',
    pinTitle: '固定图谱',
    pinDescription: '将右侧图谱固定在视口内，便于持续观察结构变化。',
    densitySection: '密度控制',
    labelTitle: '标签显示',
    labelDescription: '控制默认显示多少文字标签。',
    labelOptions: {
      focus: '仅焦点',
      important: '重要节点',
      all: '全部',
    },
    depthTitle: '默认展开深度',
    depthDescription: '搜索或点击后，局部图谱默认展开到几跳。',
    depthOptions: {
      0: '0 跳概览',
      1: '1 跳',
      2: '2 跳',
    },
    limitTitle: '节点上限',
    limitDescription: '限制当前图谱最多显示多少节点。',
    relationTitle: '关系类型',
    relationDescription: '筛选图中显示的关系类别。',
    relationLabels: {
      SYNONYM: '近义',
      ANTONYM: '反义',
      RELATED: '相关',
      ANALOGY: '类比',
    },
    autoFocusTitle: '自动聚焦',
    autoFocusDescription: '搜索或点击节点后，自动切到局部聚焦视图。',
  },
  en: {
    trigger: 'Graph Settings',
    title: 'Graph Settings',
    description: 'Tune graph density so large idiom networks stay readable.',
    graphSection: 'Graph View',
    pinTitle: 'Pin graph',
    pinDescription: 'Keep the graph fixed in the viewport while you inspect details.',
    densitySection: 'Density Controls',
    labelTitle: 'Label visibility',
    labelDescription: 'Choose how much text is shown by default.',
    labelOptions: {
      focus: 'Focus only',
      important: 'Important',
      all: 'All',
    },
    depthTitle: 'Default expansion depth',
    depthDescription: 'How far a local focus graph should expand after search or click.',
    depthOptions: {
      0: 'Overview',
      1: '1 hop',
      2: '2 hops',
    },
    limitTitle: 'Node limit',
    limitDescription: 'Cap how many nodes are rendered at once.',
    relationTitle: 'Relationship types',
    relationDescription: 'Filter which relationship families are visible.',
    relationLabels: {
      SYNONYM: 'Similar',
      ANTONYM: 'Antonym',
      RELATED: 'Related',
      ANALOGY: 'Analogy',
    },
    autoFocusTitle: 'Auto focus',
    autoFocusDescription: 'Jump into a local focused view after search or node click.',
  },
} as const;

const labelVisibilityOptions: GraphLabelVisibility[] = ['focus', 'important', 'all'];
const depthOptions: Array<0 | 1 | 2> = [0, 1, 2];
const nodeLimitOptions: Array<100 | 300 | 800> = [100, 300, 800];
const relationOptions: GraphRelationLabel[] = ['SYNONYM', 'ANTONYM', 'RELATED', 'ANALOGY'];

export function AppSettingsSheet({
  locale,
  isGraphPinned,
  onGraphPinnedChange,
  labelVisibility,
  onLabelVisibilityChange,
  defaultDepth,
  onDefaultDepthChange,
  nodeLimit,
  onNodeLimitChange,
  relationFilters,
  onRelationFiltersChange,
  autoFocus,
  onAutoFocusChange,
}: AppSettingsSheetProps) {
  const copy = locale === 'zh' ? copyByLocale.zh : copyByLocale.en;

  const toggleRelation = (label: GraphRelationLabel, checked: boolean | 'indeterminate') => {
    const nextChecked = checked === true;
    if (nextChecked) {
      if (!relationFilters.includes(label)) {
        onRelationFiltersChange([...relationFilters, label]);
      }
      return;
    }

    const nextFilters = relationFilters.filter((item) => item !== label);
    if (nextFilters.length > 0) {
      onRelationFiltersChange(nextFilters);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full border border-border/60 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-muted"
          aria-label={copy.trigger}
          title={copy.trigger}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[92vw] sm:max-w-md">
        <SheetHeader className="space-y-2 border-b border-border/60 pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            {copy.title}
          </SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4">
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Pin className="h-4 w-4 text-primary" />
              <span>{copy.graphSection}</span>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{copy.pinTitle}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{copy.pinDescription}</p>
                </div>
                <Switch
                  checked={isGraphPinned}
                  onCheckedChange={onGraphPinnedChange}
                  aria-label={copy.pinTitle}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>{copy.densitySection}</span>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{copy.labelTitle}</p>
                <p className="text-sm leading-6 text-muted-foreground">{copy.labelDescription}</p>
                <div className="flex flex-wrap gap-2">
                  {labelVisibilityOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onLabelVisibilityChange(option)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        labelVisibility === option
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-background hover:bg-muted',
                      )}
                    >
                      {copy.labelOptions[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{copy.depthTitle}</p>
                <p className="text-sm leading-6 text-muted-foreground">{copy.depthDescription}</p>
                <div className="flex flex-wrap gap-2">
                  {depthOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onDefaultDepthChange(option)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        defaultDepth === option
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-background hover:bg-muted',
                      )}
                    >
                      {copy.depthOptions[option]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{copy.limitTitle}</p>
                <p className="text-sm leading-6 text-muted-foreground">{copy.limitDescription}</p>
                <div className="flex flex-wrap gap-2">
                  {nodeLimitOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => onNodeLimitChange(option)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        nodeLimit === option
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 bg-background hover:bg-muted',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="h-4 w-4 text-primary" />
              <span>{copy.relationTitle}</span>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">{copy.relationTitle}</p>
                <p className="text-sm leading-6 text-muted-foreground">{copy.relationDescription}</p>
                <div className="space-y-3">
                  {relationOptions.map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-3 py-2"
                    >
                      <Checkbox
                        checked={relationFilters.includes(option)}
                        onCheckedChange={(checked) => toggleRelation(option, checked)}
                        aria-label={copy.relationLabels[option]}
                      />
                      <span className="text-sm text-foreground">{copy.relationLabels[option]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-background/80 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{copy.autoFocusTitle}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{copy.autoFocusDescription}</p>
                </div>
                <Switch
                  checked={autoFocus}
                  onCheckedChange={onAutoFocusChange}
                  aria-label={copy.autoFocusTitle}
                />
              </div>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

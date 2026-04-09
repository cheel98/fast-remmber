"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Link, Activity } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTranslations as useTranslationsCommon } from 'next-intl'; // Using Common namespace

interface RelationshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceId: string;
  targetId: string;
  initialLabel?: string;
  initialStrength?: number;
  onSubmit: (data: { label: string; strength: number }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export default function RelationshipModal({
  isOpen,
  onClose,
  sourceId,
  targetId,
  initialLabel = 'RELATED',
  initialStrength = 0.5,
  onSubmit,
  onDelete,
}: RelationshipModalProps) {
  const t = useTranslations('RelationshipModal');
  const tCommon = useTranslations('Common');
  const tGraph = useTranslations('IdiomGraph'); // For labels like SYNONYM
  const [label, setLabel] = useState(initialLabel);
  const [strength, setStrength] = useState(initialStrength);
  const [loading, setLoading] = useState(false);

  // Sync state when initial values change (e.g. when opening for a different link)
  React.useEffect(() => {
    if (isOpen) {
      setLabel(initialLabel);
      setStrength(initialStrength);
    }
  }, [isOpen, initialLabel, initialStrength]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ label, strength });
      onClose();
    } catch (error) {
      console.error('Failed to save association:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      console.error('Failed to delete association:', error);
    } finally {
      setLoading(false);
    }
  };

  const isEdit = !!onDelete;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">
            {isEdit ? t('editTitle') : t('createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit 
              ? t('descriptionEdit', { sourceId, targetId })
              : t('descriptionCreate', { sourceId, targetId })
            }
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="type" className="text-sm font-medium flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5 text-muted-foreground" />
              {t('type')}
            </Label>
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger id="type" className="w-full bg-muted/30 border-white/5">
                <SelectValue placeholder={t('selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="bg-popover/90 backdrop-blur-lg border-white/10">
                <SelectItem value="SYNONYM">{tGraph('labels.synonym')} (SYNONYM)</SelectItem>
                <SelectItem value="ANTONYM">{tGraph('labels.antonym')} (ANTONYM)</SelectItem>
                <SelectItem value="RELATED">{tGraph('labels.related')} (RELATED)</SelectItem>
                <SelectItem value="ANALOGY">{tGraph('labels.analogy')} (ANALOGY)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            <div className="flex justify-between items-end">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                {t('strength')}
              </Label>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{strength.toFixed(2)}</span>
            </div>
            <Slider
              value={[strength]}
              min={0.1}
              max={1.0}
              step={0.05}
              onValueChange={(vals) => setStrength(vals[0])}
              className="py-2"
            />
            <p className="text-[10px] text-muted-foreground italic">
              {t('strengthDesc')}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 sm:justify-between items-center">
          <div>
            {isEdit && (
              <Button variant="ghost" onClick={handleDelete} disabled={loading} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                🗑️ {tCommon('delete')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={loading} className="hover:bg-white/5">
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="bg-primary/90 hover:bg-primary shadow-lg shadow-primary/20">
              {loading ? t('saving') : tCommon('save')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

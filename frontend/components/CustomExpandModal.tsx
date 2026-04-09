"use client";

import React, { useState } from 'react';
import { X, Send, Loader2, Sparkles, BookOpen, Activity, TrendingUp, TrendingDown, Smile, Frown, Meh } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { IdiomResult, RelationshipDetail } from '@/lib/api';

interface CustomExpandModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceNode: string;
  onSubmit: (result: IdiomResult) => Promise<void>;
}

export default function CustomExpandModal({ isOpen, onClose, sourceNode, onSubmit }: CustomExpandModalProps) {
  const t = useTranslations('CustomExpandModal');
  const [targetName, setTargetName] = useState('');
  const [meaning, setMeaning] = useState('');
  const [emotion, setEmotion] = useState(t('neu'));
  const [relType, setRelType] = useState<'SYNONYM' | 'ANTONYM'>('SYNONYM');
  const [strength, setStrength] = useState(0.8);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetName.trim() || !meaning.trim()) {
      setError(t('errorRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    // Construct the payload for saveIdiom
    // We treat the "sourceNode" as the primary idiom and add "targetName" as a relation.
    // This will create both nodes and the link between them.
    const relation: RelationshipDetail = {
      name: targetName.trim(),
      strength: strength
    };

    const payload: IdiomResult = {
      idiom: sourceNode,
      meaning: "", // We don't necessarily update the source meaning here
      emotions: "", // Or source emotion
      synonyms: relType === 'SYNONYM' ? [relation] : [],
      antonyms: relType === 'ANTONYM' ? [relation] : []
    };

    // We also need to define the target idiom itself to ensure its properties are set
    const targetPayload: IdiomResult = {
      idiom: targetName.trim(),
      meaning: meaning.trim(),
      emotions: emotion,
      synonyms: [],
      antonyms: []
    };

    try {
      // First save the target's properties
      await onSubmit(targetPayload);
      // Then save the relationship from the source
      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err.message || t('errorSave'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border/50 bg-muted/30 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <h3 className="font-bold text-lg">{t('title')}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('startIdiom')}</label>
            <div className="px-3 py-2 bg-muted/50 border border-border/30 rounded-lg text-sm font-bold text-primary">
              {sourceNode}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('targetIdiom')}</label>
              <input
                type="text"
                placeholder={t('targetPlaceholder')}
                value={targetName}
                onChange={(e) => setTargetName(e.target.value)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                {t('relType')}
              </label>
              <select
                value={relType}
                onChange={(e) => setRelType(e.target.value as any)}
                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm outline-none"
              >
                <option value="SYNONYM">{t('synonym')}</option>
                <option value="ANTONYM">{t('antonym')}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                {t('sentiment')}
              </div>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                emotion === t('pos') ? "bg-green-500/10 text-green-600" :
                emotion === t('neg') ? "bg-red-500/10 text-red-600" : "bg-blue-500/10 text-blue-600"
              )}>
                {emotion === t('pos') ? <Smile className="h-3 w-3" /> :
                 emotion === t('neg') ? <Frown className="h-3 w-3" /> :
                 <Meh className="h-3 w-3" />}
                {emotion}
              </span>
            </label>
            <div className="flex gap-2">
              {[t('pos'), t('neg'), t('neu')].map((emo) => (
                <button
                  key={emo}
                  type="button"
                  onClick={() => setEmotion(emo)}
                  className={cn(
                    "flex-1 py-2 text-xs rounded-lg border transition-all flex items-center justify-center gap-1.5",
                    emotion === emo 
                      ? "bg-primary text-primary-foreground border-primary shadow-md" 
                      : "bg-background hover:bg-muted border-border"
                  )}
                >
                  {emo === t('pos') ? <Smile className="h-3.5 w-3.5" /> :
                   emo === t('neg') ? <Frown className="h-3.5 w-3.5" /> :
                   <Meh className="h-3.5 w-3.5" />}
                  {emo}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                {t('confidence')}
              </div>
              <span className="text-primary font-mono">{Math.round(strength * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              {t('meaningLabel')}
            </label>
            <textarea
              placeholder={t('meaningPlaceholder')}
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
              className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
              required
            />
          </div>

          {error && <p className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded-lg">{error}</p>}

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {t('submit')}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

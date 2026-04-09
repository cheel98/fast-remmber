'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Edit3, Check, X, Tag, User, Calendar, Gauge } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { Idiom } from '@/lib/idiom-data'

interface IdiomCardProps {
  idiom: Idiom
  onUpdate?: (idiom: Idiom) => void
  onClose?: () => void
}

export function IdiomCard({ idiom, onUpdate, onClose }: IdiomCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedMeaning, setEditedMeaning] = useState(idiom.meaning)

  const handleSave = () => {
    onUpdate?.({ ...idiom, meaning: editedMeaning })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedMeaning(idiom.meaning)
    setIsEditing(false)
  }

  const getSentimentKey = (s: string) => {
    if (!s) return 'neutral';
    const lower = s.toLowerCase();
    if (lower.includes('褒') || lower === 'positive') return 'positive';
    if (lower.includes('贬') || lower === 'negative') return 'negative';
    return 'neutral';
  };

  const sentimentKey = getSentimentKey(idiom.sentiment);

  const sentimentColor = {
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    neutral: 'text-gray-400',
  }[sentimentKey]

  const sentimentBg = {
    positive: 'bg-emerald-500/10 border-emerald-500/30',
    negative: 'bg-red-500/10 border-red-500/30',
    neutral: 'bg-gray-500/10 border-gray-500/30',
  }[sentimentKey]

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative w-full max-w-md bg-card border border-border rounded-xl overflow-hidden shadow-2xl"
    >
      {/* Header with glow effect */}
      <div className="relative p-6 pb-4 border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-accent/5 to-transparent" />
        <div className="relative flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-1">{idiom.text}</h2>
            <p className="text-sm text-muted-foreground font-mono">{idiom.pinyin}</p>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Meaning - Editable */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">释义</span>
            {!isEditing ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                编辑
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="h-6 px-2 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="h-6 px-2 text-xs text-red-400 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {isEditing ? (
            <Input
              value={editedMeaning}
              onChange={(e) => setEditedMeaning(e.target.value)}
              className="bg-muted/50 border-primary/30 focus:border-primary"
            />
          ) : (
            <p className="text-sm text-foreground/90 leading-relaxed">{idiom.meaning}</p>
          )}
        </div>

        {/* Sentiment */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${sentimentBg}`}>
            <Gauge className={`h-3.5 w-3.5 ${sentimentColor}`} />
            <span className={`text-xs font-medium ${sentimentColor}`}>
              情感: {idiom.sentiment === 'positive' ? '褒义' : idiom.sentiment === 'negative' ? '贬义' : '中性'}
            </span>
            <span className="text-xs text-muted-foreground">
              ({(idiom.sentimentScore * 100).toFixed(0)}%)
            </span>
          </div>
        </div>

        {/* Historical info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-accent" />
            <span className="text-muted-foreground">朝代:</span>
            <span className="text-foreground">{idiom.dynasty}</span>
          </div>
          {idiom.historicalFigure && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">人物:</span>
              <span className="text-foreground">{idiom.historicalFigure}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Tag className="h-3 w-3" />
            核心标签
          </div>
          <div className="flex flex-wrap gap-2">
            {idiom.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="bg-primary/5 border-primary/30 text-primary hover:bg-primary/10"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Filter, Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { sampleIdioms, dynastyColors, sentimentColors } from '@/lib/idiom-data'
import type { Idiom } from '@/lib/idiom-data'

type FilterMode = 'sentiment' | 'dynasty'

const dynastyTimeline = [
  '春秋',
  '战国',
  '汉代',
  '南北朝',
  '唐代',
  '宋代',
  '清代',
]

interface ExplorationViewProps {
  onIdiomSelect?: (idiom: Idiom) => void
}

export function ExplorationView({ onIdiomSelect }: ExplorationViewProps) {
  const [filterMode, setFilterMode] = useState<FilterMode>('sentiment')
  const [selectedDynasty, setSelectedDynasty] = useState<string | null>(null)

  const groupedBySentiment = useMemo(() => {
    return {
      positive: sampleIdioms.filter((i) => i.sentiment === 'positive'),
      negative: sampleIdioms.filter((i) => i.sentiment === 'negative'),
      neutral: sampleIdioms.filter((i) => i.sentiment === 'neutral'),
    }
  }, [])

  const groupedByDynasty = useMemo(() => {
    const groups: Record<string, Idiom[]> = {}
    sampleIdioms.forEach((idiom) => {
      if (!groups[idiom.dynasty]) {
        groups[idiom.dynasty] = []
      }
      groups[idiom.dynasty].push(idiom)
    })
    return groups
  }, [])

  const filteredIdioms = selectedDynasty
    ? sampleIdioms.filter((i) => i.dynasty === selectedDynasty)
    : sampleIdioms

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">语义星云</h2>
          <p className="text-sm text-muted-foreground mt-1">
            探索成语的聚类分布与历史脉络
          </p>
        </div>

        {/* Filter Mode Toggle */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
          <Button
            variant={filterMode === 'sentiment' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('sentiment')}
            className={`gap-2 ${
              filterMode === 'sentiment'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Filter className="h-4 w-4" />
            感情色彩
          </Button>
          <Button
            variant={filterMode === 'dynasty' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setFilterMode('dynasty')}
            className={`gap-2 ${
              filterMode === 'dynasty'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
            }`}
          >
            <Calendar className="h-4 w-4" />
            历史朝代
          </Button>
        </div>
      </div>

      {/* Timeline (Dynasty Mode) */}
      <AnimatePresence mode="wait">
        {filterMode === 'dynasty' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative"
          >
            <div className="flex items-center justify-between bg-card rounded-xl p-4 border border-border overflow-x-auto">
              <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border -translate-y-1/2" />
              <div className="flex items-center gap-4 relative z-10 min-w-max mx-auto">
                {dynastyTimeline.map((dynasty, index) => {
                  const isSelected = selectedDynasty === dynasty
                  const hasIdioms = groupedByDynasty[dynasty]?.length > 0
                  const color = dynastyColors[dynasty] || '#8B5CF6'

                  return (
                    <button
                      key={dynasty}
                      onClick={() =>
                        setSelectedDynasty(isSelected ? null : dynasty)
                      }
                      className={`flex flex-col items-center gap-2 transition-all ${
                        hasIdioms ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                      }`}
                      disabled={!hasIdioms}
                    >
                      <motion.div
                        whileHover={hasIdioms ? { scale: 1.1 } : {}}
                        whileTap={hasIdioms ? { scale: 0.95 } : {}}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                          isSelected
                            ? 'border-primary shadow-lg shadow-primary/30'
                            : 'border-border'
                        }`}
                        style={{
                          backgroundColor: isSelected ? color : `${color}20`,
                        }}
                      >
                        <span className={`text-xs font-bold ${isSelected ? 'text-foreground' : ''}`} style={{ color: isSelected ? '#fff' : color }}>
                          {groupedByDynasty[dynasty]?.length || 0}
                        </span>
                      </motion.div>
                      <span
                        className={`text-xs whitespace-nowrap ${
                          isSelected
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {dynasty}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sentiment Clusters */}
      <AnimatePresence mode="wait">
        {filterMode === 'sentiment' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid md:grid-cols-3 gap-6"
          >
            {/* Positive */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">褒义词</h3>
                  <p className="text-xs text-muted-foreground">
                    {groupedBySentiment.positive.length} 条成语
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {groupedBySentiment.positive.map((idiom, index) => (
                  <IdiomClusterCard
                    key={idiom.id}
                    idiom={idiom}
                    index={index}
                    onClick={() => onIdiomSelect?.(idiom)}
                  />
                ))}
              </div>
            </div>

            {/* Neutral */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gray-500/10">
                  <Minus className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">中性词</h3>
                  <p className="text-xs text-muted-foreground">
                    {groupedBySentiment.neutral.length} 条成语
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {groupedBySentiment.neutral.map((idiom, index) => (
                  <IdiomClusterCard
                    key={idiom.id}
                    idiom={idiom}
                    index={index}
                    onClick={() => onIdiomSelect?.(idiom)}
                  />
                ))}
              </div>
            </div>

            {/* Negative */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <TrendingDown className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">贬义词</h3>
                  <p className="text-xs text-muted-foreground">
                    {groupedBySentiment.negative.length} 条成语
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {groupedBySentiment.negative.map((idiom, index) => (
                  <IdiomClusterCard
                    key={idiom.id}
                    idiom={idiom}
                    index={index}
                    onClick={() => onIdiomSelect?.(idiom)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynasty Filtered View */}
      <AnimatePresence mode="wait">
        {filterMode === 'dynasty' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            {filteredIdioms.map((idiom, index) => (
              <IdiomClusterCard
                key={idiom.id}
                idiom={idiom}
                index={index}
                showDynasty
                onClick={() => onIdiomSelect?.(idiom)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface IdiomClusterCardProps {
  idiom: Idiom
  index: number
  showDynasty?: boolean
  onClick?: () => void
}

function IdiomClusterCard({ idiom, index, showDynasty, onClick }: IdiomClusterCardProps) {
  const color = dynastyColors[idiom.dynasty] || '#8B5CF6'
  const sentimentColor = sentimentColors[idiom.sentiment]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ scale: 1.02, y: -2 }}
      onClick={onClick}
      className="group relative bg-card rounded-lg p-4 border border-border hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${color}15 0%, transparent 70%)`,
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
            {idiom.text}
          </h4>
          <div
            className="w-2 h-2 rounded-full mt-2"
            style={{ backgroundColor: sentimentColor }}
          />
        </div>
        <p className="text-xs text-muted-foreground font-mono mb-3">{idiom.pinyin}</p>
        <p className="text-sm text-foreground/80 line-clamp-2 mb-3">{idiom.meaning}</p>
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {idiom.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-primary/5 border-primary/30 text-primary"
              >
                {tag}
              </Badge>
            ))}
          </div>
          {showDynasty && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {idiom.dynasty}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

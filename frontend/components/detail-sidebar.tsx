'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Network, Link2, Sparkles, TrendingUp, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Idiom } from '@/lib/idiom-data'
import { sampleIdioms, dynastyColors } from '@/lib/idiom-data'

interface DetailSidebarProps {
  idiom: Idiom | null
  onClose: () => void
}

export function DetailSidebar({ idiom, onClose }: DetailSidebarProps) {
  if (!idiom) return null

  const connectedIdioms = sampleIdioms.filter((i) => idiom.connections.includes(i.id))
  const similarIdioms = sampleIdioms
    .filter((i) => i.id !== idiom.id && i.sentiment === idiom.sentiment)
    .slice(0, 3)

  const dynastyColor = dynastyColors[idiom.dynasty] || '#8B5CF6'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 border-b border-border">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
          <div className="relative flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-1">{idiom.text}</h2>
              <p className="text-sm text-muted-foreground font-mono">{idiom.pinyin}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <Badge
            className="mt-3"
            style={{
              backgroundColor: `${dynastyColor}20`,
              borderColor: `${dynastyColor}50`,
              color: dynastyColor,
            }}
          >
            {idiom.dynasty}
          </Badge>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto h-[calc(100%-140px)]">
          {/* Network Statistics */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Network className="h-4 w-4 text-primary" />
              网络统计
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-accent" />
                  <span className="text-xs text-muted-foreground">中心度权重</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {(idiom.centrality * 100).toFixed(0)}%
                </div>
                <Progress value={idiom.centrality * 100} className="mt-2 h-1.5" />
              </div>

              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">关联密度</span>
                </div>
                <div className="text-2xl font-bold text-foreground">
                  {(idiom.density * 100).toFixed(0)}%
                </div>
                <Progress value={idiom.density * 100} className="mt-2 h-1.5" />
              </div>
            </div>
          </div>

          {/* Connected Idioms */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Link2 className="h-4 w-4 text-primary" />
              直接关联 ({connectedIdioms.length})
            </div>
            <div className="space-y-2">
              {connectedIdioms.map((connected) => (
                <motion.div
                  key={connected.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3 border border-border hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-foreground">{connected.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{connected.pinyin}</p>
                  </div>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: dynastyColors[connected.dynasty] || '#8B5CF6' }}
                  />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Similar Idioms Recommendation */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              同类推荐
            </div>
            <div className="space-y-2">
              {similarIdioms.map((similar, index) => (
                <motion.div
                  key={similar.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between bg-muted/30 rounded-lg px-4 py-3 border border-border hover:border-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{index + 1}</span>
                    <div>
                      <p className="font-medium text-foreground">{similar.text}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {similar.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {(similar.centrality * 100).toFixed(0)}%
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Meaning */}
          <div className="bg-muted/30 rounded-lg p-4 border border-border">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">释义</p>
            <p className="text-sm text-foreground/90 leading-relaxed">{idiom.meaning}</p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

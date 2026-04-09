'use client'

import { motion } from 'framer-motion'
import { Network, Compass, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddIdiomDialog } from '@/components/add-idiom-dialog'
import type { Idiom } from '@/lib/idiom-data'

interface NavHeaderProps {
  currentView: 'dashboard' | 'exploration'
  onViewChange: (view: 'dashboard' | 'exploration') => void
  onAddIdiom?: (idiom: Idiom) => void
  existingIds?: string[]
}

export function NavHeader({ currentView, onViewChange, onAddIdiom, existingIds = [] }: NavHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-xl"
    >
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center neural-glow">
              <Network className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">成语神经网络</h1>
            <p className="text-xs text-muted-foreground">Idiom Neural Graph</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
          <Button
            variant={currentView === 'dashboard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('dashboard')}
            className={`gap-2 ${
              currentView === 'dashboard'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">工作台</span>
          </Button>
          <Button
            variant={currentView === 'exploration' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewChange('exploration')}
            className={`gap-2 ${
              currentView === 'exploration'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span className="hidden sm:inline">探索</span>
          </Button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {onAddIdiom && (
            <AddIdiomDialog onAdd={onAddIdiom} existingIds={existingIds} />
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">在线</span>
          </div>
        </div>
      </div>
    </motion.header>
  )
}

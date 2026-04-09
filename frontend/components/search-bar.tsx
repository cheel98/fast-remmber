'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchBarProps {
  onSearch: (query: string) => void
  isLoading?: boolean
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      onSearch(query.trim())
    }
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="relative w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div
        className={`relative flex items-center gap-2 rounded-xl border transition-all duration-300 ${
          isFocused
            ? 'border-primary bg-card shadow-[0_0_30px_rgba(139,92,246,0.15)]'
            : 'border-border bg-card/50'
        }`}
      >
        <div className="flex items-center pl-4">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="输入成语搜索语义网络..."
          className="flex-1 border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 py-6 text-lg"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              type="button"
              onClick={() => setQuery('')}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="p-1 hover:bg-muted rounded-full mr-2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          )}
        </AnimatePresence>
        <Button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="mr-2 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">AI 解析</span>
        </Button>
      </div>

      {/* Glow effect */}
      <AnimatePresence>
        {isFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 -z-10 rounded-xl blur-xl bg-primary/10"
          />
        )}
      </AnimatePresence>
    </motion.form>
  )
}

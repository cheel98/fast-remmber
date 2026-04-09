'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import type { Idiom } from '@/lib/idiom-data'

interface AddIdiomDialogProps {
  onAdd: (idiom: Idiom) => void
  existingIds: string[]
}

const dynastyOptions = ['春秋', '战国', '汉代', '南北朝', '唐代', '宋代', '清代', '现代']
const sentimentOptions = [
  { value: 'positive', label: '褒义' },
  { value: 'negative', label: '贬义' },
  { value: 'neutral', label: '中性' },
]

export function AddIdiomDialog({ onAdd, existingIds }: AddIdiomDialogProps) {
  const [open, setOpen] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [tagInput, setTagInput] = useState('')
  
  const [formData, setFormData] = useState({
    text: '',
    pinyin: '',
    meaning: '',
    sentiment: 'neutral' as 'positive' | 'negative' | 'neutral',
    sentimentScore: 0.5,
    dynasty: '',
    historicalFigure: '',
    tags: [] as string[],
  })

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) })
  }

  const handleAIAnalyze = () => {
    if (!formData.text) return
    
    setIsAnalyzing(true)
    
    // Simulate AI analysis
    setTimeout(() => {
      // Mock AI-generated data based on the idiom text
      const mockAnalysis = {
        pinyin: formData.pinyin || 'mò míng qí miào',
        meaning: formData.meaning || '形容事物或现象非常奇特，难以理解或解释',
        sentiment: 'neutral' as const,
        sentimentScore: 0.5,
        dynasty: '现代',
        tags: ['奇特', '难解', '神秘'],
      }
      
      setFormData({
        ...formData,
        pinyin: mockAnalysis.pinyin,
        meaning: mockAnalysis.meaning,
        sentiment: mockAnalysis.sentiment,
        sentimentScore: mockAnalysis.sentimentScore,
        dynasty: mockAnalysis.dynasty,
        tags: mockAnalysis.tags,
      })
      setIsAnalyzing(false)
    }, 1500)
  }

  const handleSubmit = () => {
    if (!formData.text || !formData.meaning) return

    const newId = (Math.max(...existingIds.map(Number), 0) + 1).toString()
    
    const newIdiom: Idiom = {
      id: newId,
      text: formData.text,
      pinyin: formData.pinyin,
      meaning: formData.meaning,
      sentiment: formData.sentiment,
      sentimentScore: formData.sentiment === 'positive' ? 0.8 : formData.sentiment === 'negative' ? -0.7 : 0.5,
      dynasty: formData.dynasty || '现代',
      historicalFigure: formData.historicalFigure || undefined,
      tags: formData.tags.length > 0 ? formData.tags : ['通用'],
      connections: [],
      centrality: 0.5,
      density: 0.3,
    }

    onAdd(newIdiom)
    setOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      text: '',
      pinyin: '',
      meaning: '',
      sentiment: 'neutral',
      sentimentScore: 0.5,
      dynasty: '',
      historicalFigure: '',
      tags: [],
    })
    setTagInput('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">添加成语</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl text-foreground flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            添加新成语
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            输入成语信息，AI 可以帮助分析语义骨架
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Idiom Text with AI Analyze */}
          <div className="space-y-2">
            <Label htmlFor="text" className="text-sm text-foreground">
              成语 <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="text"
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="例如：守株待兔"
                className="flex-1 bg-muted/50 border-border focus:border-primary"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAIAnalyze}
                disabled={!formData.text || isAnalyzing}
                className="gap-2 border-primary/30 hover:bg-primary/10"
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                AI 分析
              </Button>
            </div>
          </div>

          {/* Pinyin */}
          <div className="space-y-2">
            <Label htmlFor="pinyin" className="text-sm text-foreground">
              拼音
            </Label>
            <Input
              id="pinyin"
              value={formData.pinyin}
              onChange={(e) => setFormData({ ...formData, pinyin: e.target.value })}
              placeholder="shǒu zhū dài tù"
              className="bg-muted/50 border-border focus:border-primary font-mono"
            />
          </div>

          {/* Meaning */}
          <div className="space-y-2">
            <Label htmlFor="meaning" className="text-sm text-foreground">
              释义 <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="meaning"
              value={formData.meaning}
              onChange={(e) => setFormData({ ...formData, meaning: e.target.value })}
              placeholder="输入成语的含义..."
              className="bg-muted/50 border-border focus:border-primary resize-none"
              rows={3}
            />
          </div>

          {/* Sentiment and Dynasty */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-foreground">情感倾向</Label>
              <Select
                value={formData.sentiment}
                onValueChange={(value: 'positive' | 'negative' | 'neutral') =>
                  setFormData({ ...formData, sentiment: value })
                }
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sentimentOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-foreground">朝代</Label>
              <Select
                value={formData.dynasty}
                onValueChange={(value) => setFormData({ ...formData, dynasty: value })}
              >
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue placeholder="选择朝代" />
                </SelectTrigger>
                <SelectContent>
                  {dynastyOptions.map((dynasty) => (
                    <SelectItem key={dynasty} value={dynasty}>
                      {dynasty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Historical Figure */}
          <div className="space-y-2">
            <Label htmlFor="figure" className="text-sm text-foreground">
              相关历史人物
            </Label>
            <Input
              id="figure"
              value={formData.historicalFigure}
              onChange={(e) => setFormData({ ...formData, historicalFigure: e.target.value })}
              placeholder="例如：韩非子"
              className="bg-muted/50 border-border focus:border-primary"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-sm text-foreground">核心标签</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTag()
                  }
                }}
                placeholder="输入标签后按 Enter"
                className="flex-1 bg-muted/50 border-border focus:border-primary"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddTag}
                className="border-border"
              >
                添加
              </Button>
            </div>
            <AnimatePresence>
              {formData.tags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 pt-2"
                >
                  {formData.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-primary/5 border-primary/30 text-primary gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={() => {
              setOpen(false)
              resetForm()
            }}
          >
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.text || !formData.meaning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
          >
            <Plus className="h-4 w-4" />
            添加到图谱
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

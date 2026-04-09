"use client";

import React, { useState } from 'react';
import { Search, Loader2, Save, ChevronLeft, ChevronRight, Menu, Compass, Pencil, X, Check, Trash2, BookOpen, Activity, TrendingUp, TrendingDown, Smile, Frown, Meh } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import IdiomGraph from '@/components/IdiomGraph';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { SkinToggle } from '@/components/skin-toggle';
import UsageExamples from '@/components/UsageExamples';
import { analyzeIdiom, saveIdiom, IdiomResult, fetchIdiomDetail, deleteIdiom } from '@/lib/api';

export default function Home() {
  const t = useTranslations('HomePage');
  const [query, setQuery] = useState('');
  // Discovery (AI Analysis) state
  const [analysisResult, setAnalysisResult] = useState<IdiomResult | null>(null);
  const [editedMeaning, setEditedMeaning] = useState('');
  const [editedEmotions, setEditedEmotions] = useState('');
  const [selectedSyns, setSelectedSyns] = useState<Set<string>>(new Set());
  const [selectedAnts, setSelectedAnts] = useState<Set<string>>(new Set());
  
  // Inspector (Node Details) state
  const [inspectorResult, setInspectorResult] = useState<IdiomResult | null>(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'discovery' | 'inspector'>('discovery');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Key to force re-render the graph when a new node is added
  const [graphKey, setGraphKey] = useState(0);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    setAnalysisResult(null);
    setQuery(searchTerm.trim());

    try {
      const res = await analyzeIdiom(searchTerm.trim());
      setAnalysisResult(res);
      setEditedMeaning(res.meaning);
      setEditedEmotions(res.emotions);
      setSelectedSyns(new Set(res.synonyms?.map(s => s.name) || []));
      setSelectedAnts(new Set(res.antonyms?.map(a => a.name) || []));
      setIsEditing(false);
      setActiveTab('discovery');
      // If expanding from graph, we might want to auto-open the sidebar if it's collapsed
      if (isCollapsed) setIsCollapsed(false);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleHoverDetail = async (term: string) => {
    try {
      const res = await fetchIdiomDetail(term);
      setInspectorResult(res);
      setEditedMeaning(res.meaning || '');
      setEditedEmotions(res.emotions || '');
      setActiveTab('inspector');
      setIsEditing(false);
      if (isCollapsed) setIsCollapsed(false);
      setError(null);
    } catch (err: any) {
      console.error('Hover fetch failed:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  const handleSave = async () => {
    if (!analysisResult) return;
    setSaving(true);
    setError(null);
    try {
      const filteredData = {
        ...analysisResult,
        synonyms: analysisResult.synonyms.filter(s => selectedSyns.has(s.name)),
        antonyms: analysisResult.antonyms.filter(a => selectedAnts.has(a.name)),
      };
      await saveIdiom(filteredData);
      setAnalysisResult(filteredData);
      setSelectedSyns(new Set(filteredData.synonyms.map(s => s.name)));
      setSelectedAnts(new Set(filteredData.antonyms.map(a => a.name)));
      setSaveSuccess(true);
      // Bump graph key to re-fetch the network
      setGraphKey(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    const currentResult = activeTab === 'discovery' ? analysisResult : inspectorResult;
    if (!currentResult) return;

    setSaving(true);
    setError(null);
    try {
      const updatedData = {
        ...currentResult,
        meaning: editedMeaning,
        emotions: editedEmotions,
        synonyms: activeTab === 'discovery' 
          ? currentResult.synonyms.filter(s => selectedSyns.has(s.name))
          : currentResult.synonyms,
        antonyms: activeTab === 'discovery'
          ? currentResult.antonyms.filter(a => selectedAnts.has(a.name))
          : currentResult.antonyms,
      };
      await saveIdiom(updatedData);
      
      if (activeTab === 'discovery') {
        setAnalysisResult(updatedData);
        setSelectedSyns(new Set(updatedData.synonyms.map(s => s.name)));
        setSelectedAnts(new Set(updatedData.antonyms.map(a => a.name)));
      } else {
        setInspectorResult(updatedData);
      }
      
      setIsEditing(false);
      setSaveSuccess(true);
      setGraphKey(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!inspectorResult) return;
    if (!window.confirm(t('deleteConfirm', { idiom: inspectorResult.idiom }))) return;

    setSaving(true);
    setError(null);
    try {
      await deleteIdiom(inspectorResult.idiom);
      setInspectorResult(null);
      setGraphKey(prev => prev + 1);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || t('deleteError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleSyn = (name: string) => {
    setSelectedSyns(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAnt = (name: string) => {
    setSelectedAnts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="px-8 py-6 border-b border-border/40 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            {t('title')}
          </h1>
          <p className="text-sm text-muted-foreground hidden sm:block">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <SkinToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden relative">
        {/* Toggle Button for Collapsed Sidebar */}
        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="absolute left-[360px] top-6 z-20 bg-background border border-border shadow-sm rounded-full p-1.5 hover:bg-muted transition-all hidden lg:flex"
            title={t('collapse')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="absolute left-6 top-6 z-20 bg-primary text-primary-foreground shadow-lg rounded-full p-3 hover:scale-110 active:scale-95 transition-all"
            title={t('expand')}
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {/* Left Panel: Search & Info */}
        <aside 
          className={cn(
            "w-full lg:w-96 flex-shrink-0 border-r border-border/40 bg-muted/10 p-6 flex flex-col gap-6 overflow-y-auto transition-all duration-300 ease-in-out",
            isCollapsed && "lg:-ml-96 lg:opacity-0 pointer-events-none"
          )}
        >
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">{t('discovery')}</h2>
            
            {/* Tab Switcher */}
            <div className="flex border-b border-border/40 mb-4 relative">
              <button
                onClick={() => setActiveTab('discovery')}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  activeTab === 'discovery' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('discovery')}
                {analysisResult && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full animate-pulse z-10" />}
                {activeTab === 'discovery' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
              <button
                onClick={() => setActiveTab('inspector')}
                className={cn(
                  "px-4 py-2 text-sm font-medium transition-colors relative",
                  activeTab === 'inspector' ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('inspector')}
                {activeTab === 'inspector' && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 relative">
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="sr-only">Search</span>
              </button>
            </form>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'discovery' ? (
              <motion.div
                key="discovery"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-6"
              >
                {analysisResult ? (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{t('extractedData')}</h3>
                      <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm bg-gradient-to-br from-background to-muted/20 relative group">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-2xl text-primary">{analysisResult.idiom}</h4>
                          <div className="flex gap-1 items-center">
                            {!analysisResult.hasAIExplore && (
                              <button 
                                onClick={() => performSearch(analysisResult.idiom)}
                                className="p-1.5 hover:bg-primary/10 rounded-md text-primary transition-colors flex items-center gap-1.5 text-xs font-medium"
                                disabled={loading}
                                title={t('aiExplore')}
                              >
                                <Compass className={cn("h-4 w-4", loading && "animate-spin")} />
                                <span>{t('aiExplore')}</span>
                              </button>
                            )}
                            {!isEditing ? (
                              <button 
                                onClick={() => setIsEditing(true)}
                                className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit Info"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : (
                              <div className="flex gap-1">
                                <button 
                                  onClick={handleSaveEdit}
                                  className="p-1.5 hover:bg-green-100 text-green-600 rounded-md transition-colors"
                                  title="Save Changes"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button 
                                  onClick={() => {
                                    setIsEditing(false);
                                    setEditedMeaning(analysisResult.meaning);
                                    setEditedEmotions(analysisResult.emotions);
                                  }}
                                  className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sentiment')}</span>
                          </div>
                          {!isEditing ? (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit bg-muted/50 border border-border/50">
                              {analysisResult.emotions.includes('褒') || analysisResult.emotions.toLowerCase().includes('pos') ? <Smile className="h-3.5 w-3.5 text-emerald-500" /> :
                               analysisResult.emotions.includes('贬') || analysisResult.emotions.toLowerCase().includes('neg') ? <Frown className="h-3.5 w-3.5 text-rose-500" /> :
                               <Meh className="h-3.5 w-3.5 text-blue-500" />}
                              <span className="text-sm text-foreground capitalize font-medium">{analysisResult.emotions}</span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={editedEmotions}
                              onChange={(e) => setEditedEmotions(e.target.value)}
                              className="mt-1 w-full text-sm bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          )}
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('meaning')}</span>
                            </div>
                            {!isEditing ? (
                              <p className="text-sm mt-1 leading-relaxed">{analysisResult.meaning}</p>
                            ) : (
                              <textarea
                                value={editedMeaning}
                                onChange={(e) => setEditedMeaning(e.target.value)}
                                className="mt-1 w-full text-sm bg-background border rounded px-2 py-1 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            )}
                          </div>

                          <UsageExamples examples={analysisResult.examples} />
                          
                          {analysisResult.synonyms && analysisResult.synonyms.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('synonyms')}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {analysisResult.synonyms.map(syn => (
                                  <span 
                                    key={syn.name} 
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group/tag",
                                      selectedSyns.has(syn.name) ? "bg-secondary text-secondary-foreground" : "bg-muted/50 text-muted-foreground opacity-60 border-transparent"
                                    )}
                                  >
                                    <div 
                                      className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => toggleSyn(syn.name)}
                                    >
                                      {selectedSyns.has(syn.name) ? <Check className="h-3 w-3" /> : <div className="h-3 w-3 rounded-sm border border-current" />}
                                      {syn.name} ({Math.round(syn.strength * 100)}%)
                                    </div>
                                    {!syn.hasAIExplore && (
                                      <button 
                                        onClick={() => performSearch(syn.name)}
                                        className="opacity-0 group-hover/tag:opacity-100 hover:text-primary transition-all ml-0.5"
                                        title={t('aiExplore')}
                                      >
                                        <Compass className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {analysisResult.antonyms && analysisResult.antonyms.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('antonyms')}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {analysisResult.antonyms.map(ant => (
                                  <span 
                                    key={ant.name} 
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 group/tag",
                                      selectedAnts.has(ant.name) ? "border-destructive/20 bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground opacity-60 border-transparent"
                                    )}
                                  >
                                    <div 
                                      className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => toggleAnt(ant.name)}
                                    >
                                      {selectedAnts.has(ant.name) ? <Check className="h-3 w-3 text-destructive" /> : <div className="h-3 w-3 rounded-sm border border-current" />}
                                      {ant.name} ({Math.round(ant.strength * 100)}%)
                                    </div>
                                    {!ant.hasAIExplore && (
                                      <button 
                                        onClick={() => performSearch(ant.name)}
                                        className="opacity-0 group-hover/tag:opacity-100 hover:text-primary transition-all ml-0.5"
                                        title={t('aiExplore')}
                                      >
                                        <Compass className="h-3 w-3 text-primary" />
                                      </button>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t w-full flex flex-col gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving || saveSuccess}
                            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {saving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            {saveSuccess ? t('writingToGraph') : t('confirmWrite')}
                          </button>
                          {saveSuccess && <p className="text-xs text-green-600 text-center font-medium">{t('saveSuccess')}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 px-4 text-muted-foreground italic text-sm">
                    {t('noResult')}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="inspector"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col gap-6"
              >
                {inspectorResult ? (
                  <div className="space-y-6">
                    <div className="p-5 rounded-xl border bg-card text-card-foreground shadow-sm bg-gradient-to-br from-background to-muted/20 relative group">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-2xl text-primary">{inspectorResult.idiom}</h4>
                        <div className="flex gap-1 items-center">
                          {!inspectorResult.hasAIExplore && (
                            <button 
                              onClick={() => performSearch(inspectorResult.idiom)}
                              className="p-1.5 hover:bg-primary/10 rounded-md text-primary transition-colors flex items-center gap-1.5 text-xs font-medium"
                              disabled={loading}
                              title={t('aiExplore')}
                            >
                              <Compass className={cn("h-4 w-4", loading && "animate-spin")} />
                              <span>{t('aiExplore')}</span>
                            </button>
                          )}
                          
                          {!isEditing ? (
                            <button 
                              onClick={() => {
                                setIsEditing(true);
                                setEditedMeaning(inspectorResult.meaning || '');
                                setEditedEmotions(inspectorResult.emotions || '');
                              }}
                              className="p-1.5 hover:bg-muted rounded-md text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
                              title="Edit Info"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : (
                            <div className="flex gap-1">
                              <button 
                                onClick={handleSaveEdit}
                                className="p-1.5 hover:bg-green-100 text-green-600 rounded-md transition-colors"
                                title="Save Changes"
                                disabled={saving}
                              >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button 
                                onClick={() => setIsEditing(false)}
                                className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          )}

                          {!isEditing && (
                            <button 
                              onClick={handleDelete}
                              className="p-1.5 hover:bg-red-100 text-red-600 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Idiom"
                              disabled={saving}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('sentiment')}</span>
                        </div>
                        {!isEditing ? (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit bg-muted/50 border border-border/50">
                            {inspectorResult.emotions.includes('褒') || inspectorResult.emotions.toLowerCase().includes('pos') ? <Smile className="h-3.5 w-3.5 text-emerald-500" /> :
                             inspectorResult.emotions.includes('贬') || inspectorResult.emotions.toLowerCase().includes('neg') ? <Frown className="h-3.5 w-3.5 text-rose-500" /> :
                             <Meh className="h-3.5 w-3.5 text-blue-500" />}
                            <span className="text-sm text-foreground capitalize font-medium">{inspectorResult.emotions}</span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={editedEmotions}
                            onChange={(e) => setEditedEmotions(e.target.value)}
                            className="mt-1 w-full text-sm bg-background border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        )}
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('meaning')}</span>
                          </div>
                          {!isEditing ? (
                            <p className="text-sm mt-1 leading-relaxed">{inspectorResult.meaning || t('clickNode')}</p>
                          ) : (
                            <textarea
                              value={editedMeaning}
                              onChange={(e) => setEditedMeaning(e.target.value)}
                              className="mt-1 w-full text-sm bg-background border rounded px-2 py-1 min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          )}
                        </div>

                        <UsageExamples examples={inspectorResult.examples} />
                        
                        {inspectorResult.synonyms && inspectorResult.synonyms.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('synonyms')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {inspectorResult.synonyms.map(syn => (
                                <span 
                                  key={syn.name} 
                                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted/30 text-muted-foreground border-transparent"
                                >
                                  {syn.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {inspectorResult.antonyms && inspectorResult.antonyms.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('antonyms')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {inspectorResult.antonyms.map(ant => (
                                <span 
                                  key={ant.name} 
                                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-muted/30 text-muted-foreground border-transparent"
                                >
                                  {ant.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 px-4 text-muted-foreground italic text-sm">
                    {t('clickNode')}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Right Panel: Graph Visualization */}
        <section className="flex-1 p-6 lg:h-full lg:min-h-0 min-h-[500px]">
          <IdiomGraph 
            key={graphKey} 
            onExpand={(term) => performSearch(term)}
            onShowDetails={handleHoverDetail}
            onSaveSuccess={() => setGraphKey(prev => prev + 1)}
          />
        </section>
      </div>
    </main>
  );
}

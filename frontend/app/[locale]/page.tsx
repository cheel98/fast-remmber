"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Search, Loader2, Save, ChevronLeft, Menu, Compass, Pencil, X, Check, Trash2, BookOpen, Activity, TrendingUp, TrendingDown, Smile, Frown, Meh, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import IdiomGraph from '@/components/IdiomGraph';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { SkinToggle } from '@/components/skin-toggle';
import { AppSettingsSheet } from '@/components/app-settings-sheet';
import UsageExamples from '@/components/UsageExamples';
import RelatedIdiomCard from '@/components/RelatedIdiomCard';
import AuthPanel from '@/components/AuthPanel';
import DiscoveryHistory from '@/components/DiscoveryHistory';
import UserBalanceBubble from '@/components/UserBalanceBubble';
import { analyzeIdiom, saveIdiom, IdiomResult, fetchIdiomDetail, deleteIdiom, loginUser, registerUser, fetchCurrentUser, fetchDiscoveryHistory, clearStoredAuthToken, setStoredAuthToken, getStoredAuthToken, AuthUser, DiscoveryRecord, GraphRelationLabel } from '@/lib/api';

type AuthMode = 'login' | 'register';
type Tone = 'positive' | 'negative' | 'neutral';
type RelationAction = 'saved' | 'add' | 'remove' | 'idle';
type GraphViewMode = 'overview' | 'focused' | 'expanded';
type GraphLabelVisibility = 'focus' | 'important' | 'all';
type UserPreferences = {
  isGraphPinned: boolean;
  labelVisibility: GraphLabelVisibility;
  defaultDepth: 0 | 1 | 2;
  nodeLimit: 100 | 300 | 800;
  relationFilters: GraphRelationLabel[];
  autoFocus: boolean;
};

const USER_PREFERENCES_STORAGE_KEY = 'fast-remember:user-preferences';
const DEFAULT_GRAPH_RELATIONS: GraphRelationLabel[] = ['SYNONYM', 'ANTONYM', 'RELATED', 'ANALOGY'];

const getEmotionTone = (emotion: string): Tone => {
  const normalized = emotion.trim().toLowerCase();

  if (
    normalized.includes('褒') ||
    normalized.includes('积极') ||
    normalized.includes('positive') ||
    normalized.includes('pos')
  ) {
    return 'positive';
  }

  if (
    normalized.includes('贬') ||
    normalized.includes('消极') ||
    normalized.includes('negative') ||
    normalized.includes('neg')
  ) {
    return 'negative';
  }

  return 'neutral';
};

const areSetsEqual = (left: Set<string>, right: Set<string>) =>
  left.size === right.size && [...left].every((value) => right.has(value));

export default function Home() {
  const t = useTranslations('HomePage');
  const locale = useLocale();
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
  const [checkingSavedState, setCheckingSavedState] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Key to force re-render the graph when a new node is added
  const [graphKey, setGraphKey] = useState(0);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [discoveryHistory, setDiscoveryHistory] = useState<DiscoveryRecord[]>([]);
  const [savedSyns, setSavedSyns] = useState<Set<string>>(new Set());
  const [savedAnts, setSavedAnts] = useState<Set<string>>(new Set());
  const [isCurrentIdiomSaved, setIsCurrentIdiomSaved] = useState(false);
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const [isGraphPinned, setIsGraphPinned] = useState(true);
  const [graphMode, setGraphMode] = useState<GraphViewMode>('overview');
  const [graphCenter, setGraphCenter] = useState<string | null>(null);
  const [labelVisibility, setLabelVisibility] = useState<GraphLabelVisibility>('focus');
  const [defaultGraphDepth, setDefaultGraphDepth] = useState<0 | 1 | 2>(1);
  const [graphNodeLimit, setGraphNodeLimit] = useState<100 | 300 | 800>(300);
  const [graphRelationFilters, setGraphRelationFilters] = useState<GraphRelationLabel[]>(DEFAULT_GRAPH_RELATIONS);
  const [autoFocusGraph, setAutoFocusGraph] = useState(true);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [graphPinnedHeight, setGraphPinnedHeight] = useState<number | null>(null);
  const [graphPinnedTop, setGraphPinnedTop] = useState<number | null>(null);
  const [graphPinnedStyle, setGraphPinnedStyle] = useState<React.CSSProperties>({});
  const lastScrollYRef = useRef(0);
  const graphSectionRef = useRef<HTMLDivElement>(null);
  const graphViewportRef = useRef<HTMLDivElement>(null);

  const graphDepth: 0 | 1 | 2 =
    graphMode === 'overview'
      ? 0
      : graphMode === 'expanded'
        ? 2
        : (Math.max(1, defaultGraphDepth) as 1 | 2);

  const applyAnalysisResult = (result: IdiomResult, searchTerm?: string) => {
    setAnalysisResult(result);
    setEditedMeaning(result.meaning);
    setEditedEmotions(result.emotions);
    setSelectedSyns(new Set(result.synonyms?.map((synonym) => synonym.name) || []));
    setSelectedAnts(new Set(result.antonyms?.map((antonym) => antonym.name) || []));
    setSavedSyns(new Set());
    setSavedAnts(new Set());
    setIsCurrentIdiomSaved(false);
    setIsEditing(false);
    setSaveSuccess(false);
    setError(null);
    setQuery(searchTerm?.trim() || result.idiom);

    if (isCollapsed) {
      setIsCollapsed(false);
    }
  };

  const focusGraphOnIdiom = (idiom: string, preferredDepth?: 0 | 1 | 2) => {
    const normalizedIdiom = idiom.trim();
    if (!normalizedIdiom) {
      return;
    }

    const nextDepth = preferredDepth ?? defaultGraphDepth;
    setGraphCenter(normalizedIdiom);
    setGraphMode(nextDepth >= 2 ? 'expanded' : 'focused');
  };

  const resetGraphToOverview = () => {
    setGraphCenter(null);
    setGraphMode('overview');
  };

  const expandFocusedGraph = () => {
    if (!graphCenter) {
      return;
    }
    setGraphMode('expanded');
  };

  const loadDiscoveryHistory = async () => {
    if (!getStoredAuthToken()) {
      setDiscoveryHistory([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const records = await fetchDiscoveryHistory();
      setDiscoveryHistory(records);
    } catch (historyErr) {
      console.error('Failed to fetch discovery history:', historyErr);
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshCurrentUser = async () => {
    if (!getStoredAuthToken()) {
      setCurrentUser(null);
      return null;
    }

    const user = await fetchCurrentUser();
    setCurrentUser(user);
    return user;
  };

  const syncSavedGraphState = async (idiom: string) => {
    if (!currentUser || !idiom.trim()) {
      setSavedSyns(new Set());
      setSavedAnts(new Set());
      setIsCurrentIdiomSaved(false);
      return;
    }

    setCheckingSavedState(true);
    try {
      const savedDetail = await fetchIdiomDetail(idiom);
      setSavedSyns(new Set(savedDetail.synonyms.map((synonym) => synonym.name)));
      setSavedAnts(new Set(savedDetail.antonyms.map((antonym) => antonym.name)));
      setIsCurrentIdiomSaved(true);
    } catch {
      setSavedSyns(new Set());
      setSavedAnts(new Set());
      setIsCurrentIdiomSaved(false);
    } finally {
      setCheckingSavedState(false);
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setAuthInitializing(false);
        return;
      }

      try {
        await refreshCurrentUser();
        await loadDiscoveryHistory();
      } catch {
        clearStoredAuthToken();
        setCurrentUser(null);
        setDiscoveryHistory([]);
      } finally {
        setAuthInitializing(false);
      }
    };

    void initializeAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const rawPreferences = window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);

      if (rawPreferences) {
        const parsedPreferences = JSON.parse(rawPreferences) as Partial<UserPreferences>;

        if (typeof parsedPreferences.isGraphPinned === 'boolean') {
          setIsGraphPinned(parsedPreferences.isGraphPinned);
        }
        if (parsedPreferences.labelVisibility === 'focus' || parsedPreferences.labelVisibility === 'important' || parsedPreferences.labelVisibility === 'all') {
          setLabelVisibility(parsedPreferences.labelVisibility);
        }
        if (parsedPreferences.defaultDepth === 0 || parsedPreferences.defaultDepth === 1 || parsedPreferences.defaultDepth === 2) {
          setDefaultGraphDepth(parsedPreferences.defaultDepth);
        }
        if (parsedPreferences.nodeLimit === 100 || parsedPreferences.nodeLimit === 300 || parsedPreferences.nodeLimit === 800) {
          setGraphNodeLimit(parsedPreferences.nodeLimit);
        }
        if (Array.isArray(parsedPreferences.relationFilters)) {
          const nextFilters = parsedPreferences.relationFilters.filter((label): label is GraphRelationLabel =>
            DEFAULT_GRAPH_RELATIONS.includes(label as GraphRelationLabel),
          );
          if (nextFilters.length > 0) {
            setGraphRelationFilters(nextFilters);
          }
        }
        if (typeof parsedPreferences.autoFocus === 'boolean') {
          setAutoFocusGraph(parsedPreferences.autoFocus);
        }
      }
    } catch (preferencesError) {
      console.error('Failed to load user preferences:', preferencesError);
    } finally {
      setPreferencesReady(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !preferencesReady) {
      return;
    }

    const preferences: UserPreferences = {
      isGraphPinned,
      labelVisibility,
      defaultDepth: defaultGraphDepth,
      nodeLimit: graphNodeLimit,
      relationFilters: graphRelationFilters,
      autoFocus: autoFocusGraph,
    };

    window.localStorage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  }, [autoFocusGraph, defaultGraphDepth, graphNodeLimit, graphRelationFilters, isGraphPinned, labelVisibility, preferencesReady]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollYRef.current) {
        setIsTopBarVisible(true);
      } else if (currentScrollY > lastScrollYRef.current + 4) {
        setIsTopBarVisible(false);
      }

      lastScrollYRef.current = currentScrollY;
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < -4) {
        setIsTopBarVisible(true);
      } else if (event.deltaY > 4) {
        setIsTopBarVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!isGraphPinned || graphPinnedTop === null) {
      setGraphPinnedStyle({});
      return;
    }

    const updatePinnedGraphStyle = () => {
      const section = graphSectionRef.current;
      if (!section) {
        return;
      }

      const rect = section.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const bottomInset = window.innerWidth >= 1024 ? 24 : 16;
      const top = Math.min(
        Math.max(graphPinnedTop, 16),
        Math.max(16, window.innerHeight - 220)
      );
      const availableHeight = Math.max(220, window.innerHeight - top - bottomInset);
      const measuredHeight =
        graphPinnedHeight ??
        graphViewportRef.current?.getBoundingClientRect().height ??
        rect.height ??
        availableHeight;
      const height = Math.min(Math.max(measuredHeight, 360), availableHeight);

      setGraphPinnedStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${height}px`,
        zIndex: 30,
      });
    };

    updatePinnedGraphStyle();
    const timeouts = [0, 160, 320].map((delay) => window.setTimeout(updatePinnedGraphStyle, delay));

    window.addEventListener('resize', updatePinnedGraphStyle);

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      window.removeEventListener('resize', updatePinnedGraphStyle);
    };
  }, [isGraphPinned, graphPinnedHeight, graphPinnedTop, isCollapsed]);

  const ensureAuthenticated = () => {
    if (currentUser) {
      return true;
    }

    setError(t('authRequired'));
    return false;
  };

  const canUseAISearch = currentUser
    ? currentUser.stats.unlimitedAISearches || (currentUser.stats.aiSearchesRemaining ?? 0) > 0
    : false;

  const ensureCanPerformAISearch = () => {
    if (!ensureAuthenticated()) {
      return false;
    }

    if (!canUseAISearch) {
      setError(locale === 'zh' ? 'AI 搜索额度已用完' : 'AI search balance is exhausted.');
      return false;
    }

    return true;
  };

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    if (!ensureCanPerformAISearch()) return;

    setActiveTab('discovery');
    setLoading(true);
    setError(null);
    setSaveSuccess(false);
    setAnalysisResult(null);
    setQuery(searchTerm.trim());

    try {
      const res = await analyzeIdiom(searchTerm.trim());
      applyAnalysisResult(res, searchTerm);
      if (autoFocusGraph) {
        focusGraphOnIdiom(res.idiom);
      }
      await Promise.all([
        syncSavedGraphState(res.idiom),
        loadDiscoveryHistory(),
        refreshCurrentUser(),
      ]);
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

  const handleGraphNodeFocus = async (term: string) => {
    focusGraphOnIdiom(term);
    await handleHoverDetail(term);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void performSearch(query);
  };

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!authUsername.trim()) {
      setAuthError(t('authFormIncomplete'));
      return;
    }

    setAuthLoading(true);
    setAuthError(null);
    setError(null);

    try {
      const authResponse = authMode === 'login'
        ? await loginUser(authUsername.trim(), authPassword)
        : await registerUser(authUsername.trim(), authPassword);

      setStoredAuthToken(authResponse.token);
      setCurrentUser(authResponse.user);
      setAuthUsername('');
      setAuthPassword('');
      await loadDiscoveryHistory();
    } catch (err: any) {
      setAuthError(err.message || t('authFailed'));
    } finally {
      setAuthLoading(false);
      setAuthInitializing(false);
    }
  };

  const handleLogout = () => {
    clearStoredAuthToken();
    setCurrentUser(null);
    setDiscoveryHistory([]);
    setAnalysisResult(null);
    setInspectorResult(null);
    setSavedSyns(new Set());
    setSavedAnts(new Set());
    setIsCurrentIdiomSaved(false);
    setSelectedSyns(new Set());
    setSelectedAnts(new Set());
    resetGraphToOverview();
    setError(null);
    setSaveSuccess(false);
  };

  const handleHistorySelect = async (record: DiscoveryRecord) => {
    applyAnalysisResult(record.result, record.query);
    setActiveTab('discovery');
    if (autoFocusGraph) {
      focusGraphOnIdiom(record.result.idiom);
    }
    await syncSavedGraphState(record.result.idiom);
  };

  const getRelationAction = (name: string, selectedSet: Set<string>, savedSet: Set<string>): RelationAction => {
    const isSelected = selectedSet.has(name);
    const isSaved = savedSet.has(name);

    if (isSelected && isSaved) {
      return 'saved';
    }
    if (isSelected && !isSaved) {
      return 'add';
    }
    if (!isSelected && isSaved) {
      return 'remove';
    }
    return 'idle';
  };

  const getRelationActionLabel = (action: RelationAction) => {
    if (action === 'saved') {
      return t('relationSaved');
    }
    if (action === 'add') {
      return t('relationAdd');
    }
    if (action === 'remove') {
      return t('relationRemove');
    }
    return t('relationUnsaved');
  };

  const hasPendingGraphChanges = analysisResult
    ? !isCurrentIdiomSaved ||
    !areSetsEqual(selectedSyns, savedSyns) ||
    !areSetsEqual(selectedAnts, savedAnts)
    : false;

  const isGraphSynced = Boolean(analysisResult) && isCurrentIdiomSaved && !hasPendingGraphChanges;

  const handleSave = async () => {
    if (!analysisResult || !ensureAuthenticated()) return;
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
      setSavedSyns(new Set(filteredData.synonyms.map(s => s.name)));
      setSavedAnts(new Set(filteredData.antonyms.map(a => a.name)));
      setIsCurrentIdiomSaved(true);
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
    if (!ensureAuthenticated()) return;
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
        setSavedSyns(new Set(updatedData.synonyms.map(s => s.name)));
        setSavedAnts(new Set(updatedData.antonyms.map(a => a.name)));
        setIsCurrentIdiomSaved(true);
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
    if (!inspectorResult || !ensureAuthenticated()) return;
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
      setSaveSuccess(false);
      return next;
    });
  };

  const toggleAnt = (name: string) => {
    setSelectedAnts(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      setSaveSuccess(false);
      return next;
    });
  };

  const updateGraphPinnedPreference = (nextPinned: boolean) => {
    if (!nextPinned) {
      setIsGraphPinned(false);
      setGraphPinnedHeight(null);
      setGraphPinnedTop(null);
      setGraphPinnedStyle({});
      return;
    }

    const rect = graphViewportRef.current?.getBoundingClientRect();
    setGraphPinnedHeight(rect?.height ? Math.round(rect.height) : null);
    setGraphPinnedTop(rect ? Math.round(rect.top) : null);
    setIsGraphPinned(true);
  };

  const renderEmotionBadge = (emotion: string) => {
    const tone = getEmotionTone(emotion);

    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full w-fit bg-muted/50 border border-border/50">
        {tone === 'positive' ? (
          <Smile className="h-3.5 w-3.5 text-emerald-500" />
        ) : tone === 'negative' ? (
          <Frown className="h-3.5 w-3.5 text-rose-500" />
        ) : (
          <Meh className="h-3.5 w-3.5 text-blue-500" />
        )}
        <span className="text-sm text-foreground capitalize font-medium">{emotion || t('noMeaning')}</span>
      </div>
    );
  };

  const headerContext = inspectorResult?.idiom ||
    analysisResult?.idiom ||
    (authInitializing ? t('authChecking') : currentUser ? t('authReadyHint') : t('guestMode'));

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      <div
        className="fixed inset-x-0 top-0 z-40 h-8"
        onMouseEnter={() => setIsTopBarVisible(true)}
      />

      <motion.header
        initial={false}
        animate={{
          y: isTopBarVisible ? 0 : -110,
          opacity: isTopBarVisible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onMouseEnter={() => setIsTopBarVisible(true)}
        onMouseLeave={() => setIsTopBarVisible(false)}
        className={cn(
          "fixed left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-border/60 bg-background/85 px-4 py-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/70",
          !isTopBarVisible && "pointer-events-none"
        )}
      >
        {/* <div className="min-w-0 flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 shadow-sm">
            {activeTab === 'discovery' ? (
              <Compass className="h-4 w-4 text-primary" />
            ) : (
              <BookOpen className="h-4 w-4 text-primary" />
            )}
            <span className="text-sm font-medium">
              {activeTab === 'discovery' ? t('discovery') : t('inspector')}
            </span>
          </div>
          <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground md:inline">
            {headerContext}
          </span>
        </div> */}
        <div className="mx-auto flex shrink-0 items-center gap-2">
          <AppSettingsSheet
            locale={locale}
            isGraphPinned={isGraphPinned}
            onGraphPinnedChange={updateGraphPinnedPreference}
            labelVisibility={labelVisibility}
            onLabelVisibilityChange={setLabelVisibility}
            defaultDepth={defaultGraphDepth}
            onDefaultDepthChange={setDefaultGraphDepth}
            nodeLimit={graphNodeLimit}
            onNodeLimitChange={setGraphNodeLimit}
            relationFilters={graphRelationFilters}
            onRelationFiltersChange={setGraphRelationFilters}
            autoFocus={autoFocusGraph}
            onAutoFocusChange={setAutoFocusGraph}
          />
          <SkinToggle />
          <LanguageSwitcher />
        </div>
      </motion.header>

      <div className="flex-1 flex flex-col lg:flex-row h-screen overflow-hidden relative">
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
            <AuthPanel
              currentUser={currentUser}
              authMode={authMode}
              authUsername={authUsername}
              authPassword={authPassword}
              authLoading={authLoading}
              authInitializing={authInitializing}
              authError={authError}
              onAuthModeChange={setAuthMode}
              onUsernameChange={setAuthUsername}
              onPasswordChange={setAuthPassword}
              onSubmit={handleAuthSubmit}
              onLogout={handleLogout}
            />

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
                disabled={!currentUser || !canUseAISearch}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={loading || !canUseAISearch}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="sr-only">Search</span>
              </button>
            </form>
            {!currentUser && <p className="text-xs text-muted-foreground">{t('authRequiredHint')}</p>}
            {currentUser && !canUseAISearch && (
              <p className="text-xs font-medium text-amber-600">
                {locale === 'zh' ? 'AI 搜索额度已用完' : 'AI search balance is exhausted.'}
              </p>
            )}
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
          </div>

          {currentUser && activeTab === 'discovery' && (
            <DiscoveryHistory
              loading={historyLoading}
              records={discoveryHistory}
              onSelect={(record) => {
                void handleHistorySelect(record);
              }}
            />
          )}

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
                                disabled={loading || !canUseAISearch}
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
                            renderEmotionBadge(analysisResult.emotions)
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

                          <UsageExamples idiom={analysisResult.idiom} idiomMeaning={analysisResult.meaning} examples={analysisResult.examples} />

                          {analysisResult.synonyms && analysisResult.synonyms.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('synonyms')}</span>
                              </div>
                              <div className="mt-1.5 space-y-2">
                                {analysisResult.synonyms.map(syn => (
                                  (() => {
                                    const action = getRelationAction(syn.name, selectedSyns, savedSyns);

                                    return (
                                      <RelatedIdiomCard
                                        key={syn.name}
                                        relation={syn}
                                        sourceIdiom={analysisResult.idiom}
                                        tone="synonym"
                                        action={action}
                                        actionTitle={getRelationActionLabel(action)}
                                        onToggle={() => toggleSyn(syn.name)}
                                        onExplore={() => performSearch(syn.name)}
                                        exploreTitle={t('aiExplore')}
                                        showExplore
                                      />
                                    );
                                  })()
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
                              <div className="mt-1.5 space-y-2">
                                {analysisResult.antonyms.map(ant => (
                                  (() => {
                                    const action = getRelationAction(ant.name, selectedAnts, savedAnts);

                                    return (
                                      <RelatedIdiomCard
                                        key={ant.name}
                                        relation={ant}
                                        sourceIdiom={analysisResult.idiom}
                                        tone="antonym"
                                        action={action}
                                        actionTitle={getRelationActionLabel(action)}
                                        onToggle={() => toggleAnt(ant.name)}
                                        onExplore={() => performSearch(ant.name)}
                                        exploreTitle={t('aiExplore')}
                                        showExplore
                                      />
                                    );
                                  })()
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-6 pt-4 border-t w-full flex flex-col gap-2">
                          <button
                            onClick={handleSave}
                            disabled={saving || checkingSavedState || !currentUser || !analysisResult || isGraphSynced}
                            className="w-full inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {saving ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="mr-2 h-4 w-4" />
                            )}
                            {checkingSavedState
                              ? t('checkingGraphState')
                              : isGraphSynced
                                ? t('writingToGraph')
                                : isCurrentIdiomSaved
                                  ? t('updateGraph')
                                  : t('confirmWrite')}
                          </button>
                          {saveSuccess && <p className="text-xs text-green-600 text-center font-medium">{t('saveSuccess')}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 px-4 text-muted-foreground italic text-sm">
                    {currentUser ? t('noResult') : t('authRequiredHint')}
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
                              disabled={loading || !canUseAISearch}
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
                              disabled={!currentUser}
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
                              disabled={saving || !currentUser}
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
                          renderEmotionBadge(inspectorResult.emotions)
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

                        <UsageExamples idiom={inspectorResult.idiom} idiomMeaning={inspectorResult.meaning} examples={inspectorResult.examples} />

                        {inspectorResult.synonyms && inspectorResult.synonyms.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('synonyms')}</span>
                            </div>
                            <div className="mt-1.5 space-y-2">
                              {inspectorResult.synonyms.map(syn => (
                                <RelatedIdiomCard
                                  key={syn.name}
                                  relation={syn}
                                  sourceIdiom={inspectorResult.idiom}
                                  tone="synonym"
                                />
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
                            <div className="mt-1.5 space-y-2">
                              {inspectorResult.antonyms.map(ant => (
                                <RelatedIdiomCard
                                  key={ant.name}
                                  relation={ant}
                                  sourceIdiom={inspectorResult.idiom}
                                  tone="antonym"
                                />
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
        <section
          className="flex-1 p-6 lg:h-full lg:min-h-0 min-h-[500px]"
          onMouseEnter={() => setIsTopBarVisible(false)}
        >
          <div
            ref={graphSectionRef}
            className="relative h-full min-h-[500px]"
            style={isGraphPinned && graphPinnedHeight ? { minHeight: `${graphPinnedHeight}px` } : undefined}
          >
            <div
              ref={graphViewportRef}
              className={cn(
                "relative h-full min-h-[500px]",
                isGraphPinned && "rounded-2xl bg-background/75 backdrop-blur"
              )}
              style={isGraphPinned ? graphPinnedStyle : undefined}
            >
              <IdiomGraph
                key={`${currentUser?.id ?? 'guest'}-${graphKey}`}
                isAuthenticated={Boolean(currentUser)}
                graphMode={graphMode}
                graphCenter={graphCenter}
                graphDepth={graphDepth}
                nodeLimit={graphNodeLimit}
                relationFilters={graphRelationFilters}
                labelVisibility={labelVisibility}
                refreshKey={graphKey}
                onExpand={(term) => performSearch(term)}
                onShowDetails={handleHoverDetail}
                onFocusNode={(term) => void handleGraphNodeFocus(term)}
                onReturnToOverview={resetGraphToOverview}
                onExpandFocusedGraph={expandFocusedGraph}
                onSaveSuccess={() => setGraphKey(prev => prev + 1)}
              />
            </div>
          </div>
        </section>
      </div>
      <UserBalanceBubble
        currentUser={currentUser}
        authInitializing={authInitializing}
        onLogout={handleLogout}
      />
    </main>
  );
}

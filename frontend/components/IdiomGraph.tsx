"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { Compass, Maximize, Network, Orbit, Plus, SearchSlash, Target, ZoomIn, ZoomOut } from 'lucide-react';
import { useTheme } from 'next-themes';

import type { FetchGraphOptions, GraphData, GraphRelationLabel, IdiomResult } from '@/lib/api';
import { associateIdioms, dissociateIdioms, fetchGraph, saveIdiom } from '@/lib/api';
import CustomExpandModal from './CustomExpandModal';
import NodeDetailCard from './NodeDetailCard';
import RelationshipDetailCard from './RelationshipDetailCard';
import RelationshipModal from './RelationshipModal';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

type GraphViewMode = 'overview' | 'focused' | 'expanded';
type GraphLabelVisibility = 'focus' | 'important' | 'all';

interface IdiomGraphProps {
  onExpand?: (term: string) => void;
  onShowDetails?: (term: string) => void;
  onFocusNode?: (term: string) => void;
  onReturnToOverview?: () => void;
  onExpandFocusedGraph?: () => void;
  onSaveSuccess?: () => void;
  isAuthenticated?: boolean;
  graphMode: GraphViewMode;
  graphCenter?: string | null;
  graphDepth: 0 | 1 | 2;
  nodeLimit: 100 | 300 | 800;
  relationFilters: GraphRelationLabel[];
  labelVisibility: GraphLabelVisibility;
  refreshKey?: number;
}

const GRAPH_LAYOUT = {
  overviewNodeRadius: 6,
  focusedNodeRadius: 9,
  meaningBoost: 2.5,
  linkGap: 14,
  pointerRadiusInset: 0.5,
} as const;

const copyByLocale = {
  zh: {
    overview: '概览',
    focused: '聚焦',
    expanded: '扩展',
    backToOverview: '返回概览',
    expandMore: '继续展开',
    centeredOn: '当前焦点',
    visibleRelations: '关系筛选',
  },
  en: {
    overview: 'Overview',
    focused: 'Focused',
    expanded: 'Expanded',
    backToOverview: 'Back to overview',
    expandMore: 'Expand more',
    centeredOn: 'Focused on',
    visibleRelations: 'Visible relations',
  },
} as const;

const getNodeBaseRadius = (node: { hasMeaning?: boolean }, graphMode: GraphViewMode) => {
  const baseRadius = graphMode === 'overview' ? GRAPH_LAYOUT.overviewNodeRadius : GRAPH_LAYOUT.focusedNodeRadius;
  return baseRadius + (node.hasMeaning ? GRAPH_LAYOUT.meaningBoost : 0);
};

export default function IdiomGraph({
  onExpand,
  onShowDetails,
  onFocusNode,
  onReturnToOverview,
  onExpandFocusedGraph,
  onSaveSuccess,
  isAuthenticated = false,
  graphMode,
  graphCenter,
  graphDepth,
  nodeLimit,
  relationFilters,
  labelVisibility,
  refreshKey = 0,
}: IdiomGraphProps) {
  const t = useTranslations('IdiomGraph');
  const locale = useLocale();
  const copy = locale === 'zh' ? copyByLocale.zh : copyByLocale.en;
  const { theme } = useTheme();
  const isLight = theme?.startsWith('light');

  const relationLabelMap: Record<string, string> = {
    SYNONYM: t('labels.synonym'),
    ANTONYM: t('labels.antonym'),
    RELATED: t('labels.related'),
    ANALOGY: t('labels.analogy'),
  };

  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [hoverLink, setHoverLink] = useState<any>(null);
  const [detailCardNode, setDetailCardNode] = useState<any>(null);
  const [hoverCardNode, setHoverCardNode] = useState<any>(null);
  const [hoverCardLink, setHoverCardLink] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<any>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: any } | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{ x: number; y: number; link: any } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNode, setModalNode] = useState('');
  const [linkingSource, setLinkingSource] = useState<any>(null);
  const [linkingTarget, setLinkingTarget] = useState<any>(null);
  const [currentPointerPos, setCurrentPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);

  const activeFetchOptions: FetchGraphOptions = {
    mode: graphMode === 'overview' ? 'overview' : 'focus',
    center: graphMode === 'overview' ? undefined : graphCenter ?? undefined,
    depth: graphMode === 'overview' ? 0 : graphDepth,
    limit: nodeLimit,
    labels: relationFilters,
  };

  const importantNodeIds = useMemo(() => {
    const sortedDegrees = [...data.nodes].map((node) => node.degree ?? 0).sort((left, right) => right - left);
    const thresholdIndex = Math.min(sortedDegrees.length - 1, Math.max(0, Math.floor(sortedDegrees.length * 0.12)));
    const threshold = sortedDegrees.length > 0 ? sortedDegrees[thresholdIndex] : 0;
    return new Set(data.nodes.filter((node) => (node.degree ?? 0) >= threshold && (node.degree ?? 0) > 0).map((node) => node.id));
  }, [data.nodes]);

  const loadGraphData = useCallback(async () => {
    if (!isAuthenticated) {
      setData({ nodes: [], links: [] });
      setLoading(false);
      setGraphError(null);
      return;
    }

    setLoading(true);
    setGraphError(null);
    try {
      const result = await fetchGraph(activeFetchOptions);
      setData(result);
    } catch (error: any) {
      console.error('Failed to load graph data:', error);
      setGraphError(error?.message ?? 'Failed to load graph data');
      setData({ nodes: [], links: [] });
    } finally {
      setLoading(false);
    }
  }, [
    activeFetchOptions.center,
    activeFetchOptions.depth,
    activeFetchOptions.limit,
    activeFetchOptions.mode,
    isAuthenticated,
    relationFilters,
  ]);

  useEffect(() => {
    void loadGraphData();
  }, [loadGraphData, refreshKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!fgRef.current || data.nodes.length === 0) {
        return;
      }

      const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
      fgRef.current.d3Force('link')?.distance((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const source = nodeById.get(sourceId) ?? { hasMeaning: false };
        const target = nodeById.get(targetId) ?? { hasMeaning: false };
        return getNodeBaseRadius(source, graphMode) + getNodeBaseRadius(target, graphMode) + GRAPH_LAYOUT.linkGap;
      });
      fgRef.current.d3Force('link')?.strength(() => (graphMode === 'overview' ? 0.28 : 0.48));
      fgRef.current.d3Force('charge')?.strength(graphMode === 'overview' ? -90 : -180);
      fgRef.current.d3ReheatSimulation?.();
      fgRef.current.zoomToFit(600, 80);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [data, graphMode]);

  const updateHighlightSets = (nodes: Set<string>, links: Set<any>) => {
    setHighlightNodes(new Set(nodes));
    setHighlightLinks(new Set(links));
  };

  const applyNodeHighlight = useCallback((node: any | null) => {
    const nextNodes = new Set<string>();
    const nextLinks = new Set<any>();
    if (node) {
      nextNodes.add(node.id);
      data.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        if (sourceId === node.id || targetId === node.id) {
          nextLinks.add(link);
          nextNodes.add(sourceId);
          nextNodes.add(targetId);
        }
      });
    }
    updateHighlightSets(nextNodes, nextLinks);
  }, [data.links]);

  const applyLinkHighlight = useCallback((link: any | null) => {
    const nextNodes = new Set<string>();
    const nextLinks = new Set<any>();
    if (link) {
      nextLinks.add(link);
      nextNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
      nextNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
    }
    updateHighlightSets(nextNodes, nextLinks);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) {
      return;
    }
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom * 1.45, 320);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) {
      return;
    }
    const currentZoom = fgRef.current.zoom();
    fgRef.current.zoom(currentZoom / 1.45, 320);
  }, []);

  const handleZoomToFit = useCallback(() => {
    fgRef.current?.zoomToFit(500, 70);
  }, []);

  const handleNodeHover = (node: any | null) => {
    setHoverLink(null);
    setHoverCardLink(null);
    setHoverNode(node);
    setHoverCardNode(node);
    applyNodeHighlight(node);

    if (node) {
      onShowDetails?.(node.id);
    }
  };

  const handleLinkHover = (link: any | null) => {
    setHoverNode(null);
    setHoverCardNode(null);
    setHoverLink(link);
    setHoverCardLink(link);
    applyLinkHighlight(link);
  };

  const handlePinNode = (node: any) => {
    if (node.fx === undefined) {
      node.fx = node.x;
      node.fy = node.y;
    } else {
      node.fx = undefined;
      node.fy = undefined;
    }
    setContextMenu(null);
    fgRef.current?.d3ReheatSimulation?.();
  };

  const handleCustomExpand = (node: any) => {
    setModalNode(node.id);
    setIsModalOpen(true);
    setContextMenu(null);
  };

  const handleModalSubmit = async (result: IdiomResult) => {
    await saveIdiom(result);
    onSaveSuccess?.();
    await loadGraphData();
  };

  const handleRelationshipSubmit = async (params: {
    label: string;
    strength: number;
    similarityType?: string;
    difference?: string;
    sourceExample?: string;
    targetExample?: string;
  }) => {
    if (!linkingSource || !linkingTarget) {
      return;
    }

    if (linkContextMenu && linkContextMenu.link.label !== params.label) {
      await dissociateIdioms(
        typeof linkContextMenu.link.source === 'object' ? linkContextMenu.link.source.id : linkContextMenu.link.source,
        typeof linkContextMenu.link.target === 'object' ? linkContextMenu.link.target.id : linkContextMenu.link.target,
        linkContextMenu.link.label,
      );
    }

    await associateIdioms(linkingSource.id, linkingTarget.id, params.label, params.strength, {
      similarityType: params.similarityType,
      difference: params.difference,
      sourceExample: params.sourceExample,
      targetExample: params.targetExample,
    });

    setLinkingSource(null);
    setLinkingTarget(null);
    setCurrentPointerPos(null);
    setLinkContextMenu(null);
    setIsRelationshipModalOpen(false);
    onSaveSuccess?.();
    await loadGraphData();
  };

  const handleRelationshipDelete = async () => {
    if (!linkContextMenu) {
      return;
    }

    const { link } = linkContextMenu;
    await dissociateIdioms(
      typeof link.source === 'object' ? link.source.id : link.source,
      typeof link.target === 'object' ? link.target.id : link.target,
      link.label,
    );
    setLinkContextMenu(null);
    onSaveSuccess?.();
    await loadGraphData();
  };

  const handleEditRelationship = (link: any) => {
    setLinkingSource(typeof link.source === 'object' ? link.source : { id: link.source });
    setLinkingTarget(typeof link.target === 'object' ? link.target : { id: link.target });
    setIsRelationshipModalOpen(true);
  };

  const handleReverseRelationship = async (link: any) => {
    const source = typeof link.source === 'object' ? link.source.id : link.source;
    const target = typeof link.target === 'object' ? link.target.id : link.target;

    await dissociateIdioms(source, target, link.label);
    await associateIdioms(target, source, link.label, link.strength, {
      similarityType: link.similarityType,
      difference: link.difference,
      sourceExample: link.targetExample,
      targetExample: link.sourceExample,
    });

    setLinkContextMenu(null);
    onSaveSuccess?.();
    await loadGraphData();
  };

  const shouldShowLabel = (node: any) => {
    if (!node?.label) {
      return false;
    }
    if (hoverNode?.id === node.id || detailCardNode?.id === node.id || graphCenter === node.id) {
      return true;
    }
    if (labelVisibility === 'all') {
      return zoomLevel > 0.72 || data.nodes.length <= 30;
    }
    if (labelVisibility === 'important' && importantNodeIds.has(node.id)) {
      return zoomLevel > 0.65;
    }
    return zoomLevel > 1.8 && graphMode !== 'overview';
  };

  const relationFilterSummary = relationFilters.map((label) => relationLabelMap[label] ?? label).join(' / ');

  if (loading) {
    return <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/20 text-muted-foreground">{t('loading')}</div>;
  }

  if (!isAuthenticated) {
    return <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/20 text-muted-foreground">{t('loginRequired')}</div>;
  }

  if (graphError) {
    return <div className="flex h-full w-full items-center justify-center rounded-xl border bg-muted/20 px-6 text-center text-sm text-muted-foreground">{graphError}</div>;
  }

  if (data.nodes.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/20 px-6 text-center text-muted-foreground">
        <SearchSlash className="h-8 w-8" />
        <p>{t('noData')}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-xl border border-border/50 shadow-inner"
      onMouseMove={(event) => {
        if (!linkingSource || !fgRef.current) {
          return;
        }
        const { x, y } = fgRef.current.screen2GraphCoords(event.clientX, event.clientY);
        setCurrentPointerPos({ x, y });
      }}
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: graphMode === 'overview' ? '44px 44px' : '34px 34px',
      }}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex max-w-[70%] flex-col gap-2">
        <div className="pointer-events-auto inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur">
          {graphMode === 'overview' ? <Network className="h-3.5 w-3.5 text-primary" /> : <Target className="h-3.5 w-3.5 text-primary" />}
          <span>{graphMode === 'overview' ? copy.overview : graphMode === 'focused' ? copy.focused : copy.expanded}</span>
          <span className="text-muted-foreground">{data.nodes.length} nodes</span>
        </div>

        <div className="pointer-events-auto inline-flex w-fit flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
          {graphCenter && graphMode !== 'overview' && (
            <span className="font-medium text-foreground">
              {copy.centeredOn}: {graphCenter}
            </span>
          )}
          <span>
            {copy.visibleRelations}: {relationFilterSummary}
          </span>
        </div>
      </div>

      <div className="absolute bottom-6 left-4 z-20 flex flex-wrap gap-2">
        {graphMode !== 'overview' && onReturnToOverview && (
          <button
            type="button"
            onClick={onReturnToOverview}
            className="rounded-full border border-border/60 bg-background/85 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur transition-colors hover:bg-muted"
          >
            {copy.backToOverview}
          </button>
        )}
        {graphMode === 'focused' && onExpandFocusedGraph && (
          <button
            type="button"
            onClick={onExpandFocusedGraph}
            className="rounded-full border border-primary/50 bg-primary/10 px-3 py-2 text-xs font-medium text-primary shadow-lg backdrop-blur transition-colors hover:bg-primary/15"
          >
            {copy.expandMore}
          </button>
        )}
      </div>

      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel=""
        linkDirectionalArrowLength={graphMode === 'overview' ? 0 : 3}
        linkDirectionalArrowRelPos={1}
        onZoomEnd={({ k }: { k: number }) => setZoomLevel(k)}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number' || Number.isNaN(node.x) || Number.isNaN(node.y)) {
            return;
          }

          const radius = getNodeBaseRadius(node, graphMode);
          const isHighlighted = highlightNodes.has(node.id) || graphCenter === node.id;
          const isDimmed = (hoverNode || hoverLink || graphCenter) && !isHighlighted && graphMode !== 'overview';
          const alpha = graphMode === 'overview' ? (isDimmed ? 0.1 : 0.86) : (isDimmed ? 0.18 : 1);
          ctx.globalAlpha = alpha;

          const emotion = (node.emotion || '').trim().toLowerCase();
          let nodeColor = '#3e74ce';
          if (emotion.includes('positive') || emotion.includes('积') || emotion.includes('褒')) {
            nodeColor = '#38d19a';
          } else if (emotion.includes('negative') || emotion.includes('贬') || emotion.includes('消')) {
            nodeColor = '#c85d75';
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + (isHighlighted ? 3 : 1.5), 0, 2 * Math.PI, false);
          ctx.fillStyle = isHighlighted ? `${nodeColor}55` : `${nodeColor}22`;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          if (node.fx !== undefined) {
            ctx.beginPath();
            ctx.arc(node.x + radius * 0.65, node.y - radius * 0.65, 3, 0, 2 * Math.PI);
            ctx.fillStyle = isLight ? '#111827' : '#ffffff';
            ctx.fill();
          }

          if (shouldShowLabel(node)) {
            const fontSize = Math.max(7, radius * 0.58);
            ctx.font = `600 ${fontSize}px "Microsoft YaHei", Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
            ctx.shadowBlur = 5;
            ctx.fillText(node.label, node.x, node.y);
            ctx.shadowBlur = 0;
          }

          ctx.globalAlpha = 1;
        }}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number' || Number.isNaN(node.x) || Number.isNaN(node.y)) {
            return;
          }
          const radius = getNodeBaseRadius(node, graphMode) - GRAPH_LAYOUT.pointerRadiusInset;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        onNodeHover={handleNodeHover}
        onLinkHover={handleLinkHover}
        onNodeRightClick={(node: any, event: any) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY, node });
          setLinkContextMenu(null);
        }}
        onLinkRightClick={(link: any, event: any) => {
          event.preventDefault();
          if (!containerRef.current) {
            return;
          }
          const rect = containerRef.current.getBoundingClientRect();
          setLinkContextMenu({ x: event.clientX - rect.left, y: event.clientY - rect.top, link });
          setContextMenu(null);
        }}
        onNodeClick={(node: any) => {
          if (linkingSource && linkingSource.id !== node.id) {
            setLinkingTarget(node);
            setIsRelationshipModalOpen(true);
            return;
          }

          setDetailCardNode(node);
          onShowDetails?.(node.id);
          onFocusNode?.(node.id);
        }}
        onBackgroundClick={() => {
          setContextMenu(null);
          setLinkContextMenu(null);
          setDetailCardNode(null);
          setHoverCardNode(null);
          setHoverCardLink(null);
          setHoverNode(null);
          setHoverLink(null);
          applyNodeHighlight(null);
          setLinkingSource(null);
          setCurrentPointerPos(null);
        }}
        onRenderFramePost={(ctx, globalScale) => {
          if (!linkingSource || !currentPointerPos) {
            return;
          }
          ctx.beginPath();
          ctx.moveTo(linkingSource.x, linkingSource.y);
          ctx.lineTo(currentPointerPos.x, currentPointerPos.y);
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(56, 209, 154, 0.85)';
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
          ctx.setLineDash([]);
        }}
        linkColor={(link: any) => {
          const isHighlighted = highlightLinks.has(link);
          const isDimmed = (hoverNode || hoverLink || graphCenter) && !isHighlighted && graphMode !== 'overview';
          const alpha = isDimmed ? 0.04 : (graphMode === 'overview' ? 0.22 : 0.42);
          const strength = link.strength || 0.5;

          if (link.label === 'SYNONYM') {
            return `hsla(${170 - strength * 35}, 78%, ${62 - strength * 18}%, ${alpha + strength * 0.18})`;
          }
          if (link.label === 'ANTONYM') {
            return `hsla(4, ${75 + strength * 20}%, ${66 - strength * 24}%, ${alpha + strength * 0.2})`;
          }
          if (link.label === 'ANALOGY') {
            return `hsla(36, 78%, 62%, ${alpha + 0.14})`;
          }
          return `rgba(148, 163, 184, ${alpha + 0.08})`;
        }}
        linkWidth={(link: any) => {
          const baseWidth = graphMode === 'overview' ? 0.8 : 1.1;
          const strengthBoost = (link.strength || 0.5) * (graphMode === 'overview' ? 1.2 : 1.7);
          const highlightBoost = highlightLinks.has(link) ? 1.8 : 1;
          return (baseWidth + strengthBoost) * highlightBoost;
        }}
      />

      {contextMenu && fgRef.current && (() => {
        const coords = fgRef.current.graph2ScreenCoords(contextMenu.node.x, contextMenu.node.y);
        return (
          <div
            className="absolute z-50 w-48 rounded-lg border border-border bg-background/95 py-1 shadow-2xl backdrop-blur-md"
            style={{ left: coords.x + 12, top: coords.y + 12 }}
          >
            <div className="border-b border-border/50 px-3 py-2">
              <p className="truncate text-xs font-bold text-muted-foreground">{contextMenu.node.label}</p>
            </div>
            <button onClick={() => handlePinNode(contextMenu.node)} className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground">
              {contextMenu.node.fx !== undefined ? t('menu.unlock') : t('menu.pin')}
            </button>
            <button
              onClick={() => {
                setDetailCardNode(contextMenu.node);
                setContextMenu(null);
                onShowDetails?.(contextMenu.node.id);
              }}
              className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              {t('menu.details')}
            </button>
            <button onClick={() => { onExpand?.(contextMenu.node.id); setContextMenu(null); }} className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground">
              {t('menu.aiExpand')}
            </button>
            <button onClick={() => handleCustomExpand(contextMenu.node)} className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground">
              {t('menu.customExpand')}
            </button>
            <button
              onClick={() => {
                setLinkingSource(contextMenu.node);
                setCurrentPointerPos({ x: contextMenu.node.x, y: contextMenu.node.y });
                setContextMenu(null);
              }}
              className="mt-1 w-full border-t border-border/30 px-4 py-2 text-left text-sm transition-colors hover:bg-emerald-600 hover:text-white"
            >
              {t('menu.connect')}
            </button>
          </div>
        );
      })()}

      {linkContextMenu && (
        <div className="absolute z-50 w-40 rounded-lg border border-border bg-background/95 py-1 shadow-2xl backdrop-blur-md" style={{ left: linkContextMenu.x + 10, top: linkContextMenu.y + 10 }}>
          <div className="border-b border-border/50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t('menu.relManagement')}</p>
          </div>
          <button onClick={() => handleEditRelationship(linkContextMenu.link)} className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground">{t('menu.editRel')}</button>
          <button onClick={() => handleReverseRelationship(linkContextMenu.link)} className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-primary hover:text-primary-foreground">{t('menu.reverseRel')}</button>
          <button onClick={() => void handleRelationshipDelete()} className="mt-1 w-full border-t border-border/30 px-4 py-2 text-left text-sm transition-colors hover:bg-destructive hover:text-destructive-foreground">{t('menu.deleteRel')}</button>
        </div>
      )}

      <CustomExpandModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} sourceNode={modalNode} onSubmit={handleModalSubmit} />

      <RelationshipModal
        isOpen={isRelationshipModalOpen}
        onClose={() => {
          setIsRelationshipModalOpen(false);
          setLinkingSource(null);
          setLinkingTarget(null);
          setCurrentPointerPos(null);
          setLinkContextMenu(null);
        }}
        sourceId={linkingSource?.id}
        targetId={linkingTarget?.id}
        initialLabel={linkContextMenu?.link.label}
        initialStrength={linkContextMenu?.link.strength}
        initialSimilarityType={linkContextMenu?.link.similarityType}
        initialDifference={linkContextMenu?.link.difference}
        initialSourceExample={linkContextMenu?.link.sourceExample}
        initialTargetExample={linkContextMenu?.link.targetExample}
        onSubmit={handleRelationshipSubmit}
        onDelete={linkContextMenu ? handleRelationshipDelete : undefined}
      />

      {detailCardNode && fgRef.current && (() => {
        const coords = fgRef.current.graph2ScreenCoords(detailCardNode.x, detailCardNode.y);
        return <NodeDetailCard idiomName={detailCardNode.id} x={coords.x} y={coords.y} onClose={() => setDetailCardNode(null)} />;
      })()}

      {hoverCardNode && !detailCardNode && !contextMenu && !linkContextMenu && fgRef.current && (() => {
        const coords = fgRef.current.graph2ScreenCoords(hoverCardNode.x, hoverCardNode.y);
        return <NodeDetailCard idiomName={hoverCardNode.id} x={coords.x} y={coords.y} onClose={() => undefined} isHover={true} />;
      })()}

      {hoverCardLink && !detailCardNode && !contextMenu && !linkContextMenu && fgRef.current && (() => {
        const sourceNode = typeof hoverCardLink.source === 'object' ? hoverCardLink.source : data.nodes.find((node) => node.id === hoverCardLink.source);
        const targetNode = typeof hoverCardLink.target === 'object' ? hoverCardLink.target : data.nodes.find((node) => node.id === hoverCardLink.target);
        if (!sourceNode || !targetNode || typeof sourceNode.x !== 'number' || typeof sourceNode.y !== 'number' || typeof targetNode.x !== 'number' || typeof targetNode.y !== 'number') {
          return null;
        }
        const coords = fgRef.current.graph2ScreenCoords((sourceNode.x + targetNode.x) / 2, (sourceNode.y + targetNode.y) / 2);
        return (
          <RelationshipDetailCard
            relation={hoverCardLink}
            sourceIdiom={sourceNode.id}
            targetIdiom={targetNode.id}
            relationLabel={relationLabelMap[hoverCardLink.label] || hoverCardLink.label}
            x={coords.x}
            y={coords.y}
          />
        );
      })()}

      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
        <button onClick={handleZoomIn} className="rounded-xl border border-border bg-background/80 p-2.5 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-muted active:scale-95" title={t('zoomIn')}>
          <ZoomIn className="h-5 w-5 text-foreground" />
        </button>
        <button onClick={handleZoomOut} className="rounded-xl border border-border bg-background/80 p-2.5 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-muted active:scale-95" title={t('zoomOut')}>
          <ZoomOut className="h-5 w-5 text-foreground" />
        </button>
        <button onClick={handleZoomToFit} className="rounded-xl border border-border bg-background/80 p-2.5 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-muted active:scale-95" title={t('zoomToFit')}>
          <Maximize className="h-5 w-5 text-foreground" />
        </button>
        {onExpand && graphCenter && (
          <button onClick={() => onExpand(graphCenter)} className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-primary shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-primary/15 active:scale-95" title={t('menu.aiExpand')}>
            <Compass className="h-5 w-5" />
          </button>
        )}
        {graphMode !== 'overview' && onExpandFocusedGraph && (
          <button onClick={onExpandFocusedGraph} className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-primary shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-primary/15 active:scale-95" title={copy.expandMore}>
            <Plus className="h-5 w-5" />
          </button>
        )}
        {graphMode !== 'overview' && onReturnToOverview && (
          <button onClick={onReturnToOverview} className="rounded-xl border border-border bg-background/80 p-2.5 shadow-lg backdrop-blur transition-all hover:scale-105 hover:bg-muted active:scale-95" title={copy.backToOverview}>
            <Orbit className="h-5 w-5 text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Plus, Minus, Maximize, ZoomIn, ZoomOut, Palette } from 'lucide-react';
import { useTheme } from 'next-themes';
import { GraphData, fetchGraph, saveIdiom, IdiomResult, associateIdioms, dissociateIdioms } from '@/lib/api';
import CustomExpandModal from './CustomExpandModal';
import NodeDetailCard from './NodeDetailCard';
import RelationshipModal from './RelationshipModal';

// Dynamically import ForceGraph2D to prevent SSR window is not defined errors
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface IdiomGraphProps {
  onExpand?: (term: string) => void;
  onShowDetails?: (term: string) => void;
  onSaveSuccess?: () => void;
}

export default function IdiomGraph({ onExpand, onShowDetails, onSaveSuccess }: IdiomGraphProps) {
  const t = useTranslations('IdiomGraph');
  const { theme } = useTheme();
  const isLight = theme && theme.startsWith('light');
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(0);
  const lastClickRef = useRef({ node: null, time: 0 });

  // Highlight states
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [hoverLink, setHoverLink] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: any } | null>(null);
  const [linkContextMenu, setLinkContextMenu] = useState<{ x: number, y: number, link: any } | null>(null);

  // Detail Card state
  const [detailCardNode, setDetailCardNode] = useState<any>(null);
  const [hoverCardNode, setHoverCardNode] = useState<any>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalNode, setModalNode] = useState<string>('');

  // Association state
  const [linkSource, setLinkSource] = useState<any>(null);
  const [currentPointerPos, setCurrentPointerPos] = useState<{ x: number, y: number } | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [linkingSource, setLinkingSource] = useState<any>(null);
  const [isRelationshipModalOpen, setIsRelationshipModalOpen] = useState(false);
  const [linkingTarget, setLinkingTarget] = useState<any>(null);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);
      if (e.key === 'Escape') {
        setLinkingSource(null);
        setCurrentPointerPos(null);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') setIsCtrlPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Animation frame loop to force redraws for the "breathing" effect
  useEffect(() => {
    let animationFrameId: number;
    const animate = () => {
      setFrame(f => f + 1);
      animationFrameId = requestAnimationFrame(animate);
    };
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom * 1.5, 500);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      const currentZoom = fgRef.current.zoom();
      fgRef.current.zoom(currentZoom / 1.5, 500);
    }
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(600, 50);
    }
  }, []);

  const updateHighlight = () => {
    setHighlightNodes(new Set(highlightNodes));
    setHighlightLinks(new Set(highlightLinks));
  };

  const handleNodeHover = (node: any) => {
    // Clear previous timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    highlightNodes.clear();
    highlightLinks.clear();
    if (node) {
      highlightNodes.add(node.id);
      data.links.forEach((link: any) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;

        if (sourceId === node.id || targetId === node.id) {
          highlightLinks.add(link);
          highlightNodes.add(sourceId);
          highlightNodes.add(targetId);
        }
      });

      // Trigger detail fetch after a short delay (debounce)
      hoverTimeoutRef.current = setTimeout(() => {
        if (onShowDetails) onShowDetails(node.id);
        setHoverCardNode(node);
      }, 300);
    } else {
      setHoverCardNode(null);
    }
    setHoverNode(node || null);
    updateHighlight();
  };

  const handleNodeRightClick = (node: any, event: any) => {
    event.preventDefault();
    setHoverNode(null);
    setHoverLink(null);
    setHoverCardNode(null); // Hide hover card
    setLinkContextMenu(null);
    setContextMenu({ x: event.clientX, y: event.clientY, node });
  };

  const handleLinkRightClick = (link: any, event: any) => {
    event.preventDefault();
    setHoverNode(null);
    setHoverLink(null);
    setHoverCardNode(null); // Hide hover card
    setContextMenu(null);

    // Calculate position relative to container
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      setLinkContextMenu({ x, y, link });
    } else {
      setLinkContextMenu({ x: event.clientX, y: event.clientY, link });
    }
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
    fgRef.current.d3ReheatSimulation();
  };

  const handleExpandNode = (node: any) => {
    if (onExpand) onExpand(node.id);
    setContextMenu(null);
  };

  const handleShowNodeDetails = (node: any) => {
    setDetailCardNode(node);
    setContextMenu(null);
  };

  const handleCustomExpand = (node: any) => {
    setModalNode(node.id);
    setIsModalOpen(true);
    setContextMenu(null);
  };

  const handleModalSubmit = async (result: IdiomResult) => {
    await saveIdiom(result);
    if (onSaveSuccess) onSaveSuccess();
  };

  const handleStartConnection = (node: any) => {
    setLinkingSource(node);
    setContextMenu(null);
    // Explicitly set pointer position to start where node is
    setCurrentPointerPos({ x: node.x, y: node.y });
  };

  const handleRelationshipSubmit = async (params: { label: string; strength: number }) => {
    if (linkingSource && linkingTarget) {
      // If we are editing (linkContextMenu exists) and the label changed, delete the old one first
      if (linkContextMenu && linkContextMenu.link.label !== params.label) {
        await dissociateIdioms(
          typeof linkContextMenu.link.source === 'object' ? linkContextMenu.link.source.id : linkContextMenu.link.source,
          typeof linkContextMenu.link.target === 'object' ? linkContextMenu.link.target.id : linkContextMenu.link.target,
          linkContextMenu.link.label
        );
      }

      await associateIdioms(linkingSource.id, linkingTarget.id, params.label, params.strength);
      fetchGraph().then(setData); // Refresh graph
      setLinkingSource(null);
      setLinkingTarget(null);
      setCurrentPointerPos(null);
      setLinkContextMenu(null);
    }
  };

  const handleRelationshipDelete = async () => {
    if (linkContextMenu) {
      const { link } = linkContextMenu;
      await dissociateIdioms(
        typeof link.source === 'object' ? link.source.id : link.source,
        typeof link.target === 'object' ? link.target.id : link.target,
        link.label
      );
      fetchGraph().then(setData);
      setLinkContextMenu(null);
    }
  };

  const handleEditRelationship = (link: any) => {
    setLinkingSource(typeof link.source === 'object' ? link.source : { id: link.source });
    setLinkingTarget(typeof link.target === 'object' ? link.target : { id: link.target });
    setIsRelationshipModalOpen(true);
  };

  const handleReverseRelationship = async (link: any) => {
    const s = typeof link.source === 'object' ? link.source.id : link.source;
    const t = typeof link.target === 'object' ? link.target.id : link.target;

    await dissociateIdioms(s, t, link.label);
    await associateIdioms(t, s, link.label, link.strength);
    fetchGraph().then(setData);
    setLinkContextMenu(null);
  };

  useEffect(() => {
    // Set force configuration after graph loads to increase spacing
    const timer = setTimeout(() => {
      if (fgRef.current) {
        // Dynamic link distance based on 4-tier strength
        fgRef.current.d3Force('link')?.distance((link: any) => {
          const s = link.strength || 0.5;
          const source = typeof link.source === 'object' ? link.source : data.nodes.find(n => n.id === link.source);
          const target = typeof link.target === 'object' ? link.target : data.nodes.find(n => n.id === link.target);
          
          // 获取两个节点的半径（基于其是否释义）
          const rSource = source?.hasMeaning ? 16.5 : 10.5;
          const rTarget = target?.hasMeaning ? 16.5 : 10.5;
          
          // 连线距离 = 半径之和 + 基于强度的额外间隙
          // Multiplier 设为 80，在强度为 0.5 时产生 20 的额外间隙
          const gapMultiplier = 80;
          return (rSource + rTarget) + gapMultiplier * Math.pow(1 - s, 2);
        });

        // Adjusted repulsion to prevent fighting with tight links
        fgRef.current.d3Force('charge')?.strength(-300);
        // Reheat simulation so changes take effect
        fgRef.current.d3ReheatSimulation?.();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [data]);

  useEffect(() => {
    fetchGraph()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load graph data:', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground border rounded-xl bg-muted/20">{t('loading')}</div>;
  }

  if (data.nodes.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-muted-foreground border rounded-xl bg-muted/20">{t('noData')}</div>;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full border border-border/50 rounded-xl overflow-hidden relative shadow-inner"
      onMouseMove={(e) => {
        if (linkingSource && fgRef.current) {
          const { x, y } = fgRef.current.screen2GraphCoords(e.clientX, e.clientY);
          setCurrentPointerPos({ x, y });
        }
      }}
      style={{
        backgroundColor: 'var(--background)',
        backgroundImage: `
          linear-gradient(var(--grid-color) 1px, transparent 1px),
          linear-gradient(90deg, var(--grid-color) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        nodeLabel="" // We draw the label inside the node, so disable tooltip if desired, or keep it.
        nodeAutoColorBy="id" // Gives each distinct idiom a distinct color
        linkDirectionalArrowLength={3.5} // Restored arrows
        linkDirectionalArrowRelPos={1}
        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number' || isNaN(node.x) || isNaN(node.y)) {
            return;
          }
          const label = node.label || '';
          const time = Date.now() / 1000;

          // Base radius based on whether the idiom is explained
          const baseRadius = node.hasMeaning ? 16.5 : 10.5;
          // Breathing radius
          const r = baseRadius + Math.sin(time * 2) * 0.5;

          // Highlight logic
          const isHighlighted = highlightNodes.has(node.id);
          const isDimmed = hoverNode && !isHighlighted;
          const globalAlpha = isDimmed ? 0.15 : 1;
          ctx.globalAlpha = globalAlpha;

          // Color mapping based on emotion (more robust matching for both Chinese and English labels)
          let nodeColor = '#3e74ce'; // Default Neutral (Cobalt Blue)
          const emo = (node.emotion || node.sentiment || '').trim().toLowerCase();

          if (emo.includes('褒') || emo === 'positive') {
            nodeColor = '#38d19a'; // Positive (Teal)
          } else if (emo.includes('贬') || emo === 'negative') {
            nodeColor = '#ba516d'; // Negative (Rose)
          } else if (emo.includes('中') || emo === 'neutral') {
            nodeColor = '#3e74ce'; // Neutral (Cobalt Blue)
          }

          // Outer glow for breathing effect
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4, 0, 2 * Math.PI, false);
          const gradient = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 6);
          gradient.addColorStop(0, `${nodeColor}44`);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.fill();

          // Main circle
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fillStyle = nodeColor;
          ctx.fill();

          // Draw "Pinned" indicator if pinned
          if (node.fx !== undefined) {
            ctx.beginPath();
            ctx.arc(node.x + r * 0.6, node.y - r * 0.6, 3, 0, 2 * Math.PI);
            ctx.fillStyle = isLight ? '#000000' : '#ffffff';
            ctx.fill();
          }

          // Draw white text inside
          const fontSize = (label.length > 4 ? 0.35 : 0.4) * baseRadius * (r / baseRadius);
          ctx.font = `600 ${fontSize}px "Microsoft YaHei", Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = isLight ? '#ffffff' : '#ffffff'; // Sticking to white text for nodes as they have colored backgrounds
          ctx.shadowColor = 'rgba(0,0,0,0.3)';
          ctx.shadowBlur = 4;
          ctx.fillText(label, node.x, node.y);
          ctx.shadowBlur = 0; // Reset shadow
          ctx.globalAlpha = 1; // Reset alpha
        }}
        onNodeClick={(node: any) => {
          if (linkingSource && linkingSource.id !== node.id) {
            setLinkingTarget(node);
            setIsRelationshipModalOpen(true);
            return;
          }

          setContextMenu(null);
          setDetailCardNode(null);

          const now = Date.now();
          if (lastClickRef.current.node === node.id && (now - lastClickRef.current.time) < 300) {
            handlePinNode(node);
            lastClickRef.current = { node: null, time: 0 };
          } else {
            lastClickRef.current = { node: node.id, time: now };
          }
        }}
        onNodeHover={handleNodeHover}
        onNodeRightClick={handleNodeRightClick}
        onLinkHover={(link: any) => {
          setHoverLink(link);
          highlightNodes.clear();
          highlightLinks.clear();

          if (link) {
            highlightLinks.add(link);
            highlightNodes.add(typeof link.source === 'object' ? link.source.id : link.source);
            highlightNodes.add(typeof link.target === 'object' ? link.target.id : link.target);
          }
          updateHighlight();
        }}
        onLinkRightClick={handleLinkRightClick}
        linkLabel={(link: any) => {
          if (contextMenu || linkContextMenu) return ''; // Hide tooltip if menu is open

          const labelMap: Record<string, string> = {
            'SYNONYM': t('labels.synonym'),
            'ANTONYM': t('labels.antonym'),
            'RELATED': t('labels.related'),
            'ANALOGY': t('labels.analogy')
          };
          const labelStr = labelMap[link.label] || link.label;
          return `<div class="bg-popover/90 backdrop-blur border border-border p-2 rounded shadow-lg text-xs">
            <span class="font-bold text-primary">${labelStr}</span>
            <span class="text-muted-foreground ml-2">(${t('labels.strength')}: ${(link.strength || 0.5).toFixed(2)})</span>
          </div>`;
        }}
        nodePointerAreaPaint={(node: any, color, ctx) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number' || isNaN(node.x) || isNaN(node.y)) {
            return;
          }
          ctx.fillStyle = color;
          ctx.beginPath();
          const r = node.hasMeaning ? 16 : 10;
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
          ctx.fill();
        }}
        onBackgroundClick={() => {
          setContextMenu(null);
          setLinkContextMenu(null);
          setDetailCardNode(null);
          if (linkingSource) {
            setLinkingSource(null);
            setCurrentPointerPos(null);
          }
        }}
        // Association drag logic
        onNodeDrag={(node: any, event: any) => {
          if (event.ctrlKey) {
            if (!linkSource) {
              setLinkSource(node);
              // Fix node position temporarily to prevent it from moving while linking
              node.__oldFx = node.fx;
              node.__oldFy = node.fy;
              node.fx = node.x;
              node.fy = node.y;
            }
            // Update mouse position in graph coordinates
            const { x, y } = fgRef.current.screen2GraphCoords(event.x, event.y);
            setCurrentPointerPos({ x, y });
          }
        }}
        onNodeDragEnd={(node: any) => {
          if (linkSource) {
            // Check if we are over another node
            if (hoverNode && hoverNode.id !== linkSource.id) {
              setLinkingSource(linkSource);
              setLinkingTarget(hoverNode);
              setIsRelationshipModalOpen(true);
            }

            // Restore node fixed state
            if (node.__oldFx === undefined) delete node.fx; else node.fx = node.__oldFx;
            if (node.__oldFy === undefined) delete node.fy; else node.fy = node.__oldFy;

            setLinkSource(null);
            setCurrentPointerPos(null);
          }
        }}
        onRenderFramePost={(ctx, globalScale) => {
          const activeSource = linkingSource || linkSource;
          if (activeSource && (currentPointerPos || hoverNode)) {
            const target = (hoverNode && hoverNode.id !== activeSource.id) ? hoverNode : currentPointerPos;
            if (target) {
              ctx.beginPath();
              ctx.moveTo(activeSource.x, activeSource.y);
              ctx.lineTo(target.x, target.y);
              ctx.strokeStyle = linkingSource ? 'rgba(56, 209, 154, 0.8)' : (isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.4)');
              ctx.setLineDash([5, 5]);
              ctx.lineWidth = 2 / globalScale;
              ctx.stroke();
              ctx.setLineDash([]);

              // If it's the target node, draw a small circle at the tip
              if (hoverNode && hoverNode.id !== activeSource.id) {
                ctx.beginPath();
                ctx.arc(hoverNode.x, hoverNode.y, 8 / globalScale, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(56, 209, 154, 0.4)';
                ctx.fill();
              }
            }
          }
        }}
        linkColor={(link: any) => {
          const isHighlighted = highlightLinks.has(link);
          const isHovered = hoverLink === link;
          const isDimmed = (hoverNode || hoverLink) && !isHighlighted;
          const alpha = isDimmed ? 0.05 : (isHovered ? 0.8 : 0.5);
          const strength = link.strength || 0.5;

          if (link.label === 'SYNONYM') {
            const hue = 180 - strength * 60;
            const lightness = 70 - strength * 30;
            return `hsla(${hue}, 80%, ${lightness}%, ${alpha + strength * 0.2})`;
          } else if (link.label === 'ANTONYM') {
            const saturation = 70 + strength * 30;
            const lightness = 70 - strength * 50;
            return `hsla(0, ${saturation}%, ${lightness}%, ${alpha + strength * 0.3})`;
          }
          return `rgba(156, 163, 175, ${alpha})`;
        }}
        linkWidth={(link: any) => {
          const isHighlighted = highlightLinks.has(link);
          const isHovered = hoverLink === link;
          const baseWidth = (1 + (link.strength || 0.5) * 2.5);
          return baseWidth * (isHovered ? 3 : (isHighlighted ? 2 : 1));
        }}
      />

      {/* Context Menu */}
      {contextMenu && fgRef.current && (
        (() => {
          const coords = fgRef.current.graph2ScreenCoords(contextMenu.node.x, contextMenu.node.y);
          return (
            <div
              className="absolute z-50 bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-lg py-1 w-48 animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
              style={{ left: coords.x + 12, top: coords.y + 12 }}
            >
              <div className="px-3 py-2 border-b border-border/50">
                <p className="text-xs font-bold text-muted-foreground truncate">{contextMenu.node.label}</p>
              </div>
              <button
                onClick={() => handlePinNode(contextMenu.node)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {contextMenu.node.fx !== undefined ? t('menu.unlock') : t('menu.pin')}
              </button>
              <button
                onClick={() => handleShowNodeDetails(contextMenu.node)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {t('menu.details')}
              </button>
              <button
                onClick={() => handleExpandNode(contextMenu.node)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {t('menu.aiExpand')}
              </button>
              <button
                onClick={() => handleCustomExpand(contextMenu.node)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {t('menu.customExpand')}
              </button>
              <button
                onClick={() => handleStartConnection(contextMenu.node)}
                className="w-full text-left px-4 py-2 text-sm hover:bg-emerald-600 hover:text-white transition-colors border-t border-border/30 mt-1"
              >
                {t('menu.connect')}
              </button>
            </div>
          );
        })()
      )}

      <CustomExpandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceNode={modalNode}
        onSubmit={handleModalSubmit}
      />

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
        onSubmit={handleRelationshipSubmit}
        onDelete={linkContextMenu ? handleRelationshipDelete : undefined}
      />

      {/* Relationship Context Menu */}
      {linkContextMenu && (
        <div
          className="absolute z-50 bg-background/95 backdrop-blur-md border border-border shadow-2xl rounded-lg py-1 w-40 animate-in fade-in zoom-in-95 duration-100 pointer-events-auto"
          style={{ left: linkContextMenu.x + 10, top: linkContextMenu.y + 10 }}
        >
          <div className="px-3 py-2 border-b border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t('menu.relManagement')}</p>
          </div>
          <button
            onClick={() => handleEditRelationship(linkContextMenu.link)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {t('menu.editRel')}
          </button>
          <button
            onClick={() => handleReverseRelationship(linkContextMenu.link)}
            className="w-full text-left px-4 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {t('menu.reverseRel')}
          </button>
          <button
            onClick={() => handleRelationshipDelete()}
            className="w-full text-left px-4 py-2 text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors border-t border-border/30 mt-1"
          >
            {t('menu.deleteRel')}
          </button>
        </div>
      )}

      {detailCardNode && fgRef.current && (
        (() => {
          const coords = fgRef.current.graph2ScreenCoords(detailCardNode.x, detailCardNode.y);
          return (
            <NodeDetailCard
              idiomName={detailCardNode.id}
              x={coords.x}
              y={coords.y}
              onClose={() => setDetailCardNode(null)}
            />
          );
        })()
      )}

      {hoverCardNode && !detailCardNode && !contextMenu && !linkContextMenu && fgRef.current && (
        (() => {
          const coords = fgRef.current.graph2ScreenCoords(hoverCardNode.x, hoverCardNode.y);
          return (
            <NodeDetailCard
              idiomName={hoverCardNode.id}
              x={coords.x}
              y={coords.y}
              onClose={() => { }}
              isHover={true}
            />
          );
        })()
      )}

      {/* Floating Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-10">
        <button
          onClick={handleZoomIn}
          className="bg-background/80 backdrop-blur border border-border shadow-lg rounded-xl p-2.5 hover:bg-muted transition-all hover:scale-105 active:scale-95"
          title={t('zoomIn')}
        >
          <ZoomIn className="h-5 w-5 text-foreground" />
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-background/80 backdrop-blur border border-border shadow-lg rounded-xl p-2.5 hover:bg-muted transition-all hover:scale-105 active:scale-95"
          title={t('zoomOut')}
        >
          <ZoomOut className="h-5 w-5 text-foreground" />
        </button>
        <button
          onClick={handleZoomToFit}
          className="bg-background/80 backdrop-blur border border-border shadow-lg rounded-xl p-2.5 hover:bg-muted transition-all hover:scale-105 active:scale-95"
          title={t('zoomToFit')}
        >
          <Maximize className="h-5 w-5 text-foreground" />
        </button>
      </div>
    </div>
  );
}

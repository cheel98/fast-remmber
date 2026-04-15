"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GraphLink } from '@/lib/api';
import { cn } from '@/lib/utils';
import RelationshipInsight from '@/components/RelationshipInsight';

interface RelationshipDetailCardProps {
  relation: GraphLink;
  sourceIdiom: string;
  targetIdiom: string;
  relationLabel: string;
  x: number;
  y: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function RelationshipDetailCard({
  relation,
  sourceIdiom,
  targetIdiom,
  relationLabel,
  x,
  y,
  onMouseEnter,
  onMouseLeave,
}: RelationshipDetailCardProps) {
  const t = useTranslations('IdiomGraph');
  const tHome = useTranslations('HomePage');
  const cardRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const [position, setPosition] = useState({ left: x + 18, top: y - 24 });
  const [hasManualPosition, setHasManualPosition] = useState(false);
  const [dragState, setDragState] = useState({
    isDragging: false,
    offsetX: 0,
    offsetY: 0,
  });

  const getRelativePosition = (clientX: number, clientY: number, offsetX: number, offsetY: number) => {
    const offsetParent = cardRef.current?.offsetParent;
    const parentRect = offsetParent instanceof HTMLElement
      ? offsetParent.getBoundingClientRect()
      : { left: 0, top: 0 };

    return {
      left: clientX - parentRect.left - offsetX,
      top: clientY - parentRect.top - offsetY,
    };
  };

  const anchorPosition = { left: x + 18, top: y - 24 };

  useEffect(() => {
    setHasManualPosition(false);
    setPosition(anchorPosition);
  }, [relation.source, relation.target, relation.label, sourceIdiom, targetIdiom]);

  useEffect(() => {
    if (hasManualPosition) {
      return;
    }

    setPosition(anchorPosition);
  }, [anchorPosition.left, anchorPosition.top, hasManualPosition]);

  useEffect(() => {
    if (!dragState.isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setPosition(getRelativePosition(
        event.clientX,
        event.clientY,
        dragState.offsetX,
        dragState.offsetY,
      ));
    };

    const handlePointerUp = (event: PointerEvent) => {
      isDraggingRef.current = false;
      setDragState((current) => ({ ...current, isDragging: false }));

      if (!onMouseLeave || !cardRef.current) {
        return;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || !cardRef.current.contains(target)) {
        onMouseLeave();
      }
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const rect = cardRef.current.getBoundingClientRect();
    isDraggingRef.current = true;
    onMouseEnter?.();
    setHasManualPosition(true);
    setDragState({
      isDragging: true,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    });
  };

  const handleCardMouseEnter = () => {
    onMouseEnter?.();
  };

  const handleCardMouseLeave = () => {
    if (isDraggingRef.current) {
      return;
    }

    onMouseLeave?.();
  };

  return (
    <div
      ref={cardRef}
      className="absolute z-[60] w-72 max-h-[420px] overflow-y-auto rounded-2xl border border-border/60 bg-background/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
      style={{ left: position.left, top: position.top }}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        className="mb-3 flex cursor-grab items-center justify-between gap-3 border-b border-border/40 pb-2 active:cursor-grabbing touch-none"
        onPointerDown={handleDragStart}
      >
        <div className="flex items-center gap-2">
          <Move className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {relationLabel}
          </span>
        </div>
        <span className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t('labels.strength')}: {(relation.strength || 0.5).toFixed(2)}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {tHome('sourceIdiomLabel')}
          </p>
          <p className="mt-1 font-semibold text-foreground">{sourceIdiom}</p>
        </div>
        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {tHome('targetIdiomLabel')}
          </p>
          <p className="mt-1 font-semibold text-foreground">{targetIdiom}</p>
        </div>
      </div>

      <RelationshipInsight
        relation={relation}
        sourceIdiom={sourceIdiom}
        targetIdiom={targetIdiom}
        className="mt-3"
      />
    </div>
  );
}

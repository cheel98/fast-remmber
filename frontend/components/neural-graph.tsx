'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import type { Idiom } from '@/lib/idiom-data'
import { sampleIdioms, dynastyColors } from '@/lib/idiom-data'

interface GraphNode {
  id: string
  idiom: Idiom
  x: number
  y: number
  vx: number
  vy: number
  fx?: number
  fy?: number
}

interface GraphEdge {
  source: GraphNode
  target: GraphNode
  strength: number
}

interface NeuralGraphProps {
  idioms?: Idiom[]
  selectedIdiomId?: string | null
  onNodeClick?: (idiom: Idiom) => void
  highlightConnections?: string[]
}

export function NeuralGraph({
  idioms = sampleIdioms,
  selectedIdiomId,
  onNodeClick,
  highlightConnections = [],
}: NeuralGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const isDraggingRef = useRef(false)
  const draggedNodeRef = useRef<GraphNode | null>(null)

  // Initialize nodes and edges
  useEffect(() => {
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    const radius = Math.min(dimensions.width, dimensions.height) * 0.35

    nodesRef.current = idioms.map((idiom, index) => {
      const angle = (index / idioms.length) * Math.PI * 2
      return {
        id: idiom.id,
        idiom,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0,
      }
    })

    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]))
    edgesRef.current = []

    idioms.forEach((idiom) => {
      const sourceNode = nodeMap.get(idiom.id)
      if (!sourceNode) return

      idiom.connections.forEach((targetId) => {
        const targetNode = nodeMap.get(targetId)
        if (targetNode && !edgesRef.current.some(
          (e) =>
            (e.source.id === idiom.id && e.target.id === targetId) ||
            (e.source.id === targetId && e.target.id === idiom.id)
        )) {
          edgesRef.current.push({
            source: sourceNode,
            target: targetNode,
            strength: 0.5 + Math.random() * 0.5,
          })
        }
      })
    })
  }, [idioms, dimensions])

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Force simulation and rendering
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    let time = 0

    const simulate = () => {
      const nodes = nodesRef.current
      const edges = edgesRef.current

      // Apply forces
      nodes.forEach((node) => {
        if (node.fx !== undefined) {
          node.x = node.fx
          node.vx = 0
        }
        if (node.fy !== undefined) {
          node.y = node.fy
          node.vy = 0
        }

        // Center gravity
        const dx = dimensions.width / 2 - node.x
        const dy = dimensions.height / 2 - node.y
        node.vx += dx * 0.0003
        node.vy += dy * 0.0003
      })

      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 1500 / (dist * dist)

          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          nodes[i].vx -= fx
          nodes[i].vy -= fy
          nodes[j].vx += fx
          nodes[j].vy += fy
        }
      }

      // Attraction along edges
      edges.forEach((edge) => {
        const dx = edge.target.x - edge.source.x
        const dy = edge.target.y - edge.source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 150) * 0.01 * edge.strength

        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        edge.source.vx += fx
        edge.source.vy += fy
        edge.target.vx -= fx
        edge.target.vy -= fy
      })

      // Update positions with damping
      nodes.forEach((node) => {
        if (node.fx === undefined) {
          node.vx *= 0.9
          node.vy *= 0.9
          node.x += node.vx
          node.y += node.vy

          // Boundary constraints
          const padding = 50
          node.x = Math.max(padding, Math.min(dimensions.width - padding, node.x))
          node.y = Math.max(padding, Math.min(dimensions.height - padding, node.y))
        }
      })
    }

    const render = () => {
      time += 0.02
      ctx.clearRect(0, 0, dimensions.width, dimensions.height)

      const edges = edgesRef.current
      const nodes = nodesRef.current

      // Draw edges
      edges.forEach((edge) => {
        const isHighlighted =
          selectedIdiomId &&
          (edge.source.id === selectedIdiomId || edge.target.id === selectedIdiomId)

        ctx.beginPath()
        ctx.moveTo(edge.source.x, edge.source.y)
        ctx.lineTo(edge.target.x, edge.target.y)

        if (isHighlighted) {
          ctx.strokeStyle = `rgba(139, 92, 246, ${0.6 + Math.sin(time * 3) * 0.2})`
          ctx.lineWidth = 2
        } else {
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)'
          ctx.lineWidth = 1
        }
        ctx.stroke()

        // Animated flow effect for highlighted edges
        if (isHighlighted) {
          const gradient = ctx.createLinearGradient(
            edge.source.x,
            edge.source.y,
            edge.target.x,
            edge.target.y
          )
          const offset = (time * 0.5) % 1
          gradient.addColorStop(Math.max(0, offset - 0.1), 'rgba(139, 92, 246, 0)')
          gradient.addColorStop(offset, 'rgba(139, 92, 246, 0.8)')
          gradient.addColorStop(Math.min(1, offset + 0.1), 'rgba(139, 92, 246, 0)')

          ctx.beginPath()
          ctx.moveTo(edge.source.x, edge.source.y)
          ctx.lineTo(edge.target.x, edge.target.y)
          ctx.strokeStyle = gradient
          ctx.lineWidth = 3
          ctx.stroke()
        }
      })

      // Draw nodes
      nodes.forEach((node) => {
        const isSelected = selectedIdiomId === node.id
        const isHovered = hoveredNode === node.id
        const isConnected =
          selectedIdiomId &&
          (node.idiom.connections.includes(selectedIdiomId) ||
            idioms.find((i) => i.id === selectedIdiomId)?.connections.includes(node.id))

        const baseRadius = 24 + node.idiom.centrality * 12
        const pulseRadius = baseRadius + Math.sin(time * 2 + parseInt(node.id) * 0.5) * 3

        // Glow effect for selected/hovered nodes
        if (isSelected || isHovered) {
          const glow = ctx.createRadialGradient(
            node.x,
            node.y,
            0,
            node.x,
            node.y,
            pulseRadius * 2.5
          )
          glow.addColorStop(0, 'rgba(139, 92, 246, 0.4)')
          glow.addColorStop(0.5, 'rgba(139, 92, 246, 0.1)')
          glow.addColorStop(1, 'rgba(139, 92, 246, 0)')

          ctx.beginPath()
          ctx.arc(node.x, node.y, pulseRadius * 2.5, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        // Node circle
        const dynastyColor = dynastyColors[node.idiom.dynasty] || '#8B5CF6'

        ctx.beginPath()
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2)

        if (isSelected) {
          ctx.fillStyle = '#8B5CF6'
        } else if (isConnected) {
          ctx.fillStyle = `${dynastyColor}CC`
        } else {
          ctx.fillStyle = `${dynastyColor}99`
        }
        ctx.fill()

        // Border
        ctx.beginPath()
        ctx.arc(node.x, node.y, pulseRadius, 0, Math.PI * 2)
        ctx.strokeStyle = isSelected || isHovered ? '#8B5CF6' : `${dynastyColor}66`
        ctx.lineWidth = isSelected || isHovered ? 3 : 1.5
        ctx.stroke()

        // Text
        ctx.font = `${isSelected || isHovered ? 'bold ' : ''}14px system-ui, sans-serif`
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.idiom.text, node.x, node.y)
      })

      simulate()
      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [dimensions, selectedIdiomId, hoveredNode, idioms])

  // Mouse interaction handlers
  const getNodeAtPosition = useCallback(
    (x: number, y: number): GraphNode | null => {
      for (const node of nodesRef.current) {
        const dx = x - node.x
        const dy = y - node.y
        const radius = 24 + node.idiom.centrality * 12
        if (dx * dx + dy * dy < radius * radius) {
          return node
        }
      }
      return null
    },
    []
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (isDraggingRef.current && draggedNodeRef.current) {
        draggedNodeRef.current.fx = x
        draggedNodeRef.current.fy = y
      } else {
        const node = getNodeAtPosition(x, y)
        setHoveredNode(node?.id || null)
        if (canvasRef.current) {
          canvasRef.current.style.cursor = node ? 'pointer' : 'default'
        }
      }
    },
    [getNodeAtPosition]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const node = getNodeAtPosition(x, y)

      if (node) {
        isDraggingRef.current = true
        draggedNodeRef.current = node
        node.fx = x
        node.fy = y
      }
    },
    [getNodeAtPosition]
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (draggedNodeRef.current && !isDraggingRef.current) {
        // This was a click, not a drag
      }

      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect && !isDraggingRef.current) {
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const node = getNodeAtPosition(x, y)
        if (node) {
          onNodeClick?.(node.idiom)
        }
      }

      if (draggedNodeRef.current) {
        draggedNodeRef.current.fx = undefined
        draggedNodeRef.current.fy = undefined
      }
      isDraggingRef.current = false
      draggedNodeRef.current = null
    },
    [getNodeAtPosition, onNodeClick]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const node = getNodeAtPosition(x, y)

      if (node) {
        onNodeClick?.(node.idiom)
      }
    },
    [getNodeAtPosition, onNodeClick]
  )

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden grid-bg"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onMouseLeave={() => setHoveredNode(null)}
      />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-card/80 backdrop-blur-sm rounded-lg p-3 border border-border">
        <p className="text-xs text-muted-foreground mb-2">朝代颜色</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(dynastyColors).map(([dynasty, color]) => (
            <div key={dynasty} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-foreground/80">{dynasty}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-card/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-border">
        点击节点查看详情 · 拖拽节点调整位置
      </div>
    </motion.div>
  )
}

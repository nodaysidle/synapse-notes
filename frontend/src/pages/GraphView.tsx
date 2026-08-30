import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { supabase } from '../lib/supabase'
import { useWorkspace } from '../contexts/WorkspaceContext'
import type { Note } from '../lib/database.types'
import { analyzeText, getSharedKeywords } from '../utils/textAnalysis'

interface GraphNode extends THREE.Mesh {
  userData: {
    noteId: string
    title: string
    createdAt: Date
    connectionCount: number
  }
}

interface GraphEdge extends THREE.Line {
  userData: {
    sourceId: string
    targetId: string
  }
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const hoveredNodeRef = useRef<GraphNode | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const tooltipTimeoutRef = useRef<number | null>(null)
  const layoutIterationsRef = useRef(0)
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map())
  // Reusable Vector3 for force calculations
  const tempVec = useRef(new THREE.Vector3())

  const MAX_LAYOUT_ITERATIONS = 150

  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noteCount, setNoteCount] = useState(0)
  const [legendOpen, setLegendOpen] = useState(false)

  const handleResize = useCallback(() => {
    if (!cameraRef.current || !rendererRef.current || !containerRef.current) return

    cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
    cameraRef.current.updateProjectionMatrix()
    rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
  }, [])

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return

    // Skip hover on touch devices
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches
    if (isTouchDevice) return

    const rect = containerRef.current.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current)
    const intersects = raycasterRef.current.intersectObjects(nodesRef.current)

    if (intersects.length > 0) {
      const node = intersects[0].object as GraphNode

      if (hoveredNodeRef.current !== node) {
        if (hoveredNodeRef.current) {
          const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial
          material.emissiveIntensity = 0.4
        }

        hoveredNodeRef.current = node
        const material = node.material as THREE.MeshStandardMaterial
        material.emissiveIntensity = 0.8

        if (tooltipRef.current) {
          tooltipRef.current.textContent = node.userData.title
          tooltipRef.current.style.display = 'block'
          tooltipRef.current.style.left = `${event.clientX + 10}px`
          tooltipRef.current.style.top = `${event.clientY + 10}px`
          tooltipRef.current.style.opacity = '1'
        }
      } else if (tooltipRef.current) {
        tooltipRef.current.style.left = `${event.clientX + 10}px`
        tooltipRef.current.style.top = `${event.clientY + 10}px`
      }
    } else {
      if (hoveredNodeRef.current) {
        const material = hoveredNodeRef.current.material as THREE.MeshStandardMaterial
        material.emissiveIntensity = 0.4
        hoveredNodeRef.current = null

        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '0'
          tooltipTimeoutRef.current = window.setTimeout(() => {
            if (tooltipRef.current && hoveredNodeRef.current === null) {
              tooltipRef.current.style.display = 'none'
            }
          }, 200)
        }
      }
    }
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredNodeRef.current) {
      navigate(`/notes/${hoveredNodeRef.current.userData.noteId}`)
    }
  }, [navigate])

  // Touch support for mobile (Android Capacitor)
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return
    if (event.changedTouches.length === 0) return

    const touch = event.changedTouches[0]
    const rect = containerRef.current.getBoundingClientRect()

    const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1
    const touchPoint = new THREE.Vector2(x, y)

    raycasterRef.current.setFromCamera(touchPoint, cameraRef.current)
    const intersects = raycasterRef.current.intersectObjects(nodesRef.current)

    if (intersects.length > 0) {
      const node = intersects[0].object as GraphNode
      navigate(`/notes/${node.userData.noteId}`)
    }
  }, [navigate])

  const applyForceDirectedLayout = useCallback(() => {
    const repulsionStrength = 500
    const attractionStrength = 0.01

    const forces = new Map<GraphNode, THREE.Vector3>()

    nodesRef.current.forEach(node => {
      forces.set(node, new THREE.Vector3(0, 0, 0))
    })

    // Repulsion between all nodes (reuse tempVec)
    for (let i = 0; i < nodesRef.current.length; i++) {
      for (let j = i + 1; j < nodesRef.current.length; j++) {
        const node1 = nodesRef.current[i]
        const node2 = nodesRef.current[j]
        tempVec.current.subVectors(node1.position, node2.position)
        const distance = tempVec.current.length()

        if (distance > 0) {
          const forceMag = repulsionStrength / (distance * distance)
          tempVec.current.normalize().multiplyScalar(forceMag)
          forces.get(node1)!.add(tempVec.current)
          forces.get(node2)!.sub(tempVec.current)
        }
      }
    }

    // Attraction along edges - O(1) lookups via nodeMap
    edgesRef.current.forEach(edge => {
      const source = nodeMapRef.current.get(edge.userData.sourceId)
      const target = nodeMapRef.current.get(edge.userData.targetId)

      if (source && target) {
        tempVec.current.subVectors(target.position, source.position)
        const distance = tempVec.current.length()
        tempVec.current.normalize().multiplyScalar(distance * attractionStrength)

        forces.get(source)!.add(tempVec.current)
        forces.get(target)!.sub(tempVec.current)
      }
    })

    // Apply forces
    nodesRef.current.forEach(node => {
      const force = forces.get(node)!
      node.position.add(force.multiplyScalar(0.1))

      node.position.x = Math.max(-50, Math.min(50, node.position.x))
      node.position.y = Math.max(-50, Math.min(50, node.position.y))
      node.position.z = Math.max(-50, Math.min(50, node.position.z))
    })

    // Update edge positions - O(1) lookups
    edgesRef.current.forEach(edge => {
      const source = nodeMapRef.current.get(edge.userData.sourceId)
      const target = nodeMapRef.current.get(edge.userData.targetId)

      if (source && target && edge.geometry) {
        const positions = edge.geometry.attributes.position
        if (positions) {
          positions.setXYZ(0, source.position.x, source.position.y, source.position.z)
          positions.setXYZ(1, target.position.x, target.position.y, target.position.z)
          positions.needsUpdate = true
        }
      }
    })
  }, [])

  const animate = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(animate)

    if (controlsRef.current) {
      controlsRef.current.update()
    }

    // Only run layout for first N frames, then stop (convergence)
    if (layoutIterationsRef.current < MAX_LAYOUT_ITERATIONS) {
      applyForceDirectedLayout()
      layoutIterationsRef.current++
    }

    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }
  }, [applyForceDirectedLayout])

  const initGraph = useCallback(() => {
    if (!containerRef.current) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f14)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    )
    camera.position.z = 50
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controlsRef.current = controls

    const ambientLight = new THREE.AmbientLight(0xC8FF00, 0.4)
    scene.add(ambientLight)

    const pointLight1 = new THREE.PointLight(0xC8FF00, 0.8)
    pointLight1.position.set(50, 50, 50)
    scene.add(pointLight1)

    const pointLight2 = new THREE.PointLight(0xC8FF00, 0.6)
    pointLight2.position.set(-50, -50, -50)
    scene.add(pointLight2)

    // Event listeners - both mouse (desktop) and touch (mobile)
    window.addEventListener('resize', handleResize)
    renderer.domElement.addEventListener('mousemove', handleMouseMove)
    renderer.domElement.addEventListener('click', handleClick)
    renderer.domElement.addEventListener('touchend', handleTouchEnd)

    animate()

    // Tooltip (desktop only)
    const tooltip = document.createElement('div')
    tooltip.className = 'fixed px-4 py-2 rounded-xl text-sm pointer-events-none opacity-0 transition-all duration-200 z-50 text-white font-medium shadow-lg'
    tooltip.style.cssText = `
      background: rgba(200, 255, 0, 0.15);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(200, 255, 0, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px rgba(200, 255, 0, 0.2);
      display: none;
    `
    document.body.appendChild(tooltip)
    tooltipRef.current = tooltip
  }, [animate, handleClick, handleMouseMove, handleTouchEnd, handleResize])

  const buildGraphFromNotes = useCallback((notes: Note[]) => {
    if (!sceneRef.current) return

    // Reset layout iterations for new graph
    layoutIterationsRef.current = 0

    // Clear existing graph
    nodesRef.current.forEach(node => {
      node.geometry?.dispose()
      ;(node.material as THREE.Material)?.dispose()
      sceneRef.current?.remove(node)
    })
    edgesRef.current.forEach(edge => {
      edge.geometry?.dispose()
      ;(edge.material as THREE.Material)?.dispose()
      sceneRef.current?.remove(edge)
    })
    nodesRef.current = []
    edgesRef.current = []
    nodeMapRef.current.clear()

    if (notes.length === 0) return

    // Pre-analyze all notes
    const noteAnalysis = new Map<string, { keywords: string[]; mood: string; moodScore: number }>()
    notes.forEach(note => {
      const text = [note.title, note.transcript, note.content].filter(Boolean).join(' ')
      noteAnalysis.set(note.id, analyzeText(text))
    })

    // Build links based on shared keywords ONLY (not mood)
    const links: { source: string; target: string; value: number; sharedKeywords: string[] }[] = []
    const MIN_SHARED_KEYWORDS = 2 // Require at least 2 shared keywords to connect

    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const analysis1 = noteAnalysis.get(notes[i].id)!
        const analysis2 = noteAnalysis.get(notes[j].id)!

        const sharedKeywords = getSharedKeywords(analysis1.keywords, analysis2.keywords)

        if (sharedKeywords.length >= MIN_SHARED_KEYWORDS) {
          const connectionStrength = Math.min(1, sharedKeywords.length / 5)
          links.push({
            source: notes[i].id,
            target: notes[j].id,
            value: connectionStrength,
            sharedKeywords,
          })
        }
      }
    }

    // Calculate connection counts
    const connectionCounts = new Map<string, number>()
    links.forEach(link => {
      connectionCounts.set(link.source, (connectionCounts.get(link.source) || 0) + 1)
      connectionCounts.set(link.target, (connectionCounts.get(link.target) || 0) + 1)
    })

    const moodColors: Record<string, number> = {
      happy: 0x22c55e,
      motivated: 0xf59e0b,
      creative: 0xa855f7,
      calm: 0x14b8a6,
      reflective: 0x6366f1,
      tired: 0x64748b,
      anxious: 0xf97316,
      sad: 0x3b82f6,
      angry: 0xef4444,
    }

    // Create node meshes
    notes.forEach(note => {
      const connectionCount = connectionCounts.get(note.id) || 0
      const analysis = noteAnalysis.get(note.id)!
      const baseSize = 2
      const nodeSize = baseSize + connectionCount * 0.5

      const moodColor = moodColors[analysis.mood] || 0xC8FF00
      const color = new THREE.Color(moodColor)
      const glowIntensity = 0.3 + Math.min(connectionCount * 0.1, 0.5)

      const geometry = new THREE.SphereGeometry(nodeSize, 32, 32)
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: glowIntensity,
        metalness: 0.4,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9,
      })

      const node = new THREE.Mesh(geometry, material) as unknown as GraphNode
      node.userData = {
        noteId: note.id,
        title: note.title || 'Untitled Note',
        createdAt: new Date(note.created_at),
        connectionCount,
      }

      node.position.set(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40
      )

      sceneRef.current!.add(node)
      nodesRef.current.push(node)
      nodeMapRef.current.set(note.id, node)
    })

    // Create edges
    links.forEach(link => {
      const sourceNode = nodeMapRef.current.get(link.source)
      const targetNode = nodeMapRef.current.get(link.target)

      if (sourceNode && targetNode) {
        const opacity = Math.min(0.8, link.value * 0.6 + 0.2)
        const edgeColor = link.value > 0.5
          ? new THREE.Color(0xC8FF00)
          : new THREE.Color(0xC8FF00)

        const material = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity,
        })

        const geometry = new THREE.BufferGeometry().setFromPoints([
          sourceNode.position,
          targetNode.position,
        ])

        const edge = new THREE.Line(geometry, material) as unknown as GraphEdge
        edge.userData = {
          sourceId: link.source,
          targetId: link.target,
        }

        sceneRef.current!.add(edge)
        edgesRef.current.push(edge)
      }
    })

    setNoteCount(notes.length)
  }, [])

  const fetchNotes = useCallback(async () => {
    if (!workspace) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data: notes, error: fetchError } = await supabase
        .from('notes')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      buildGraphFromNotes(notes || [])
    } catch (err) {
      setError('Failed to load notes for graph view. Please try again.')
      console.error('Error fetching notes for graph:', err)
    } finally {
      setLoading(false)
    }
  }, [workspace, buildGraphFromNotes])

  const cleanup = useCallback(() => {
    window.removeEventListener('resize', handleResize)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (rendererRef.current && containerRef.current) {
      rendererRef.current.domElement.removeEventListener('mousemove', handleMouseMove)
      rendererRef.current.domElement.removeEventListener('click', handleClick)
      rendererRef.current.domElement.removeEventListener('touchend', handleTouchEnd)
      if (containerRef.current.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement)
      }
    }

    if (tooltipRef.current && document.body.contains(tooltipRef.current)) {
      document.body.removeChild(tooltipRef.current)
    }

    if (rendererRef.current) {
      rendererRef.current.dispose()
    }

    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }

    // Dispose GPU resources before clearing the refs so WebGL memory is freed
    nodesRef.current.forEach(node => {
      node.geometry?.dispose()
      ;(node.material as THREE.Material)?.dispose()
    })
    edgesRef.current.forEach(edge => {
      edge.geometry?.dispose()
      ;(edge.material as THREE.Material)?.dispose()
    })
    controlsRef.current?.dispose()

    nodesRef.current = []
    edgesRef.current = []
    nodeMapRef.current.clear()
  }, [handleClick, handleMouseMove, handleTouchEnd, handleResize])

  useEffect(() => {
    initGraph()
    return () => { cleanup() }
  }, [initGraph, cleanup])

  useEffect(() => {
    if (workspace) { fetchNotes() }
  }, [workspace, fetchNotes])

  useEffect(() => {
    if (!workspace) return

    const channel = supabase
      .channel('graph_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        () => { fetchNotes() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspace, fetchNotes])

  return (
    <div
      className="relative w-full max-w-full overflow-hidden bg-base-dark"
      style={{ height: 'calc(100dvh - 5.5rem)' }}
    >
      {/* Error */}
      {error && (
        <div className="absolute top-6 left-3 right-3 z-20 mx-auto max-w-sm">
          <div
            className="px-4 py-3 rounded-2xl shadow-xl border border-red-500/30"
            style={{ background: 'rgba(239, 68, 68, 0.1)', backdropFilter: 'blur(12px)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg className="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-300 min-w-0 break-words">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base-dark/80 backdrop-blur-sm z-10">
          <div
            className="rounded-2xl shadow-xl p-8 text-center border border-accent/20"
            style={{ background: 'rgba(200, 255, 0, 0.05)', backdropFilter: 'blur(16px)' }}
          >
            <div role="status" aria-live="polite" className="relative mx-auto mb-4 w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-accent/20"></div>
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin"></div>
              <span className="sr-only">Loading knowledge graph...</span>
            </div>
            <p className="text-gray-300">Loading knowledge graph...</p>
          </div>
        </div>
      )}

      {/* Empty graph — keep 3D canvas mounted, overlay copy */}
      {!loading && !error && noteCount === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-6 pointer-events-none">
          <div
            className="max-w-sm rounded-2xl border border-white/15 px-5 py-6 text-center"
            style={{ background: 'rgba(10, 10, 15, 0.72)', backdropFilter: 'blur(14px)' }}
          >
            <h2 className="text-base font-semibold text-white">No notes in your graph yet</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">
              Capture a note from Home. When it finishes processing, it will appear here as a node.
            </p>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-3 z-10 flex max-w-[calc(100%-7rem)] items-center gap-2 rounded-xl border border-white/10 px-3 py-2 min-h-[44px] text-white/80 transition-all duration-200 hover:border-accent/30 hover:text-white active:bg-white/5"
        style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px)' }}
      >
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span className="truncate text-sm font-medium">Back</span>
      </button>

      {/* Legend — above bottom nav; hide chrome noise when empty */}
      {noteCount > 0 && (
      <div
        className="absolute bottom-4 left-3 z-10 max-w-[min(18rem,calc(100%-1.5rem))] rounded-2xl border border-white/10 shadow-xl"
        style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(16px)' }}
      >
        <button
          onClick={() => setLegendOpen(o => !o)}
          className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-white/90 w-full"
        >
          <span>Legend</span>
          <svg className={`w-4 h-4 ml-auto transition-transform ${legendOpen ? 'rotate-180' : ''}`}
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {legendOpen && (
          <div className="px-4 pb-4 space-y-2 text-xs text-gray-400">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-3 shrink-0"
                style={{ background: '#C8FF00', boxShadow: '0 0 12px rgba(200, 255, 0, 0.5)' }}
              ></div>
              <span>Notes ({noteCount})</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-0.5 mr-3 shrink-0" style={{ background: '#C8FF00' }}></div>
              <span>Shared keywords</span>
            </div>

            {/* Mood colors */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-gray-500 mb-2">Node color = mood</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#22c55e' }}></div>
                  <span className="text-xs">Happy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#a855f7' }}></div>
                  <span className="text-xs">Creative</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#6366f1' }}></div>
                  <span className="text-xs">Reflective</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#3b82f6' }}></div>
                  <span className="text-xs">Calm/Sad</span>
                </div>
              </div>
            </div>

            {/* Platform-aware instructions */}
            <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
              <p className="text-gray-500 hidden md:block">Drag to rotate</p>
              <p className="text-gray-500 hidden md:block">Scroll to zoom</p>
              <p className="text-gray-500 hidden md:block">Click node to view note</p>
              <p className="text-gray-500 md:hidden">Pinch to zoom</p>
              <p className="text-gray-500 md:hidden">Drag to rotate</p>
              <p className="text-gray-500 md:hidden">Tap node to view note</p>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Stats badge */}
      {!loading && noteCount > 0 && (
        <div
          className="absolute top-4 right-3 z-10 rounded-xl border border-accent/20 px-3 py-2"
          style={{ background: 'rgba(200, 255, 0, 0.1)', backdropFilter: 'blur(12px)' }}
        >
          <span className="text-accent text-sm font-medium">{noteCount} notes</span>
        </div>
      )}
    </div>
  )
}

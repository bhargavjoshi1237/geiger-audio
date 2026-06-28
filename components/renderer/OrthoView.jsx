'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

const WORLD = { x: [-5, 5], y: [-3, 3], z: [-5, 5] }
const PAD = 14

const VIEWS = [
  { id: 'top',   label: 'Top',   hAxis: 'x', vAxis: 'z', hFlip: false, vFlip: false },
  { id: 'front', label: 'Front', hAxis: 'x', vAxis: 'y', hFlip: false, vFlip: true  },
  { id: 'back',  label: 'Back',  hAxis: 'x', vAxis: 'y', hFlip: true,  vFlip: true  },
  { id: 'left',  label: 'Left',  hAxis: 'z', vAxis: 'y', hFlip: true,  vFlip: true  },
  { id: 'right', label: 'Right', hAxis: 'z', vAxis: 'y', hFlip: false, vFlip: true  },
]

function toCanvas(pos, cfg, W, H) {
  const [hLo, hHi] = WORLD[cfg.hAxis]
  const [vLo, vHi] = WORLD[cfg.vAxis]
  const iW = W - PAD * 2
  const iH = H - PAD * 2
  const hN = (pos[cfg.hAxis] - hLo) / (hHi - hLo)
  const vN = (pos[cfg.vAxis] - vLo) / (vHi - vLo)
  return [
    PAD + (cfg.hFlip ? 1 - hN : hN) * iW,
    PAD + (cfg.vFlip ? 1 - vN : vN) * iH,
  ]
}

function fromCanvas(cx, cy, cfg, W, H) {
  const [hLo, hHi] = WORLD[cfg.hAxis]
  const [vLo, vHi] = WORLD[cfg.vAxis]
  const iW = W - PAD * 2
  const iH = H - PAD * 2
  const hN = cfg.hFlip ? 1 - (cx - PAD) / iW : (cx - PAD) / iW
  const vN = cfg.vFlip ? 1 - (cy - PAD) / iH : (cy - PAD) / iH
  return {
    [cfg.hAxis]: Math.max(hLo, Math.min(hHi, hLo + hN * (hHi - hLo))),
    [cfg.vAxis]: Math.max(vLo, Math.min(vHi, vLo + vN * (vHi - vLo))),
  }
}

function drawScene(canvas, cfg, objects, speakers, selectedId, draggingId) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  if (W === 0 || H === 0) return

  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = '#0A0A0A'
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 0.5
  for (let i = 1; i < 10; i++) {
    const x = PAD + (i / 10) * (W - PAD * 2)
    const y = PAD + (i / 10) * (H - PAD * 2)
    ctx.beginPath(); ctx.moveTo(x, PAD); ctx.lineTo(x, H - PAD); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke()
  }

  // Room boundary
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 1
  ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2)

  // Center cross
  const [ox, oy] = toCanvas({ x: 0, y: 0, z: 0 }, cfg, W, H)
  ctx.strokeStyle = '#1e1e1e'
  ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(ox, PAD); ctx.lineTo(ox, H - PAD); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(PAD, oy); ctx.lineTo(W - PAD, oy); ctx.stroke()

  // Speakers
  for (const sp of speakers) {
    const [cx, cy] = toCanvas(sp, cfg, W, H)
    ctx.fillStyle = sp.y > 0.1 ? '#2e2e2e' : '#474747'
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#333333'
    ctx.font = '6px sans-serif'
    ctx.fillText(sp.label, cx + 3, cy - 2)
  }

  // Listener
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.arc(ox, oy, 3.5, 0, Math.PI * 2); ctx.fill()

  // Audio objects
  for (const obj of objects) {
    const [cx, cy] = toCanvas(obj, cfg, W, H)
    const sel = obj.id === selectedId || obj.id === draggingId
    if (sel) {
      ctx.strokeStyle = '#FF6B00'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.fillStyle = sel ? '#FF6B00' : 'rgba(255,107,0,0.55)'
    ctx.beginPath(); ctx.arc(cx, cy, sel ? 5 : 3.5, 0, Math.PI * 2); ctx.fill()
    if (sel) {
      ctx.fillStyle = '#FF6B00'
      ctx.font = 'bold 7px sans-serif'
      ctx.fillText(obj.name.slice(0, 8), cx + 7, cy - 3)
    }
  }
}

export default function OrthoView({ expanded, onExpandToggle }) {
  const { objects, selectedObjectId, setSelectedObjectId, updateObject, speakerPreset, SPEAKER_POSITIONS } = useAudio()
  const canvasRef  = useRef(null)
  const [viewId, setViewId] = useState('top')
  const draggingId = useRef(null)

  const cfg      = VIEWS.find(v => v.id === viewId)
  const speakers = SPEAKER_POSITIONS[speakerPreset] ?? []

  // Sync canvas pixel dimensions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!expanded) {
      canvas.width  = 150
      canvas.height = 150
      return
    }
    const sync = () => {
      canvas.width  = canvas.offsetWidth  || 1
      canvas.height = canvas.offsetHeight || 1
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [expanded])

  // RAF draw loop (runs in both states)
  useEffect(() => {
    let id
    const loop = () => {
      if (canvasRef.current) {
        drawScene(canvasRef.current, cfg, objects, speakers, selectedObjectId, draggingId.current)
      }
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [cfg, objects, speakers, selectedObjectId])

  // Pointer handlers (expanded only)
  const hitTest = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const r  = canvas.getBoundingClientRect()
    const mx = (e.clientX - r.left) * (canvas.width  / r.width)
    const my = (e.clientY - r.top)  * (canvas.height / r.height)
    for (const obj of [...objects].reverse()) {
      const [cx, cy] = toCanvas(obj, cfg, canvas.width, canvas.height)
      if (Math.hypot(mx - cx, my - cy) < 12) return obj.id
    }
    return null
  }, [objects, cfg])

  const onMouseDown = useCallback((e) => {
    const hit = hitTest(e)
    if (hit) { draggingId.current = hit; setSelectedObjectId(hit); e.preventDefault() }
    else setSelectedObjectId(null)
  }, [hitTest, setSelectedObjectId])

  const onMouseMove = useCallback((e) => {
    if (!draggingId.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const r  = canvas.getBoundingClientRect()
    const mx = (e.clientX - r.left) * (canvas.width  / r.width)
    const my = (e.clientY - r.top)  * (canvas.height / r.height)
    updateObject(draggingId.current, fromCanvas(mx, my, cfg, canvas.width, canvas.height))
  }, [cfg, updateObject])

  const onMouseUp = useCallback(() => { draggingId.current = null }, [])

  // ─── COLLAPSED: exact minimap clone ───────────────────────────────────────
  if (!expanded) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between pr-0.5">
          <span className="text-[10px] text-[#4a4a4a]">
            {VIEWS.find(v => v.id === viewId)?.label} View
          </span>
          <button
            onClick={onExpandToggle}
            className="text-[#333333] hover:text-[#737373] transition-colors cursor-pointer"
            title="Expand ortho view"
          >
            <Maximize2 size={9} />
          </button>
        </div>
        <canvas
          ref={canvasRef}
          width={150}
          height={150}
          className="rounded border border-[#2a2a2a] opacity-90"
          style={{ pointerEvents: 'none', display: 'block' }}
        />
      </div>
    )
  }

  // ─── EXPANDED: full interactive panel ─────────────────────────────────────
  const btnBase = 'px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer'

  return (
    <div
      className="flex flex-col h-full border-r overflow-hidden"
      style={{ background: '#0A0A0A', borderColor: '#2a2a2a' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-2 py-1 shrink-0 border-b"
        style={{ borderColor: '#1e1e1e' }}
      >
        <span className="text-[9px] text-[#4a4a4a] uppercase tracking-widest font-mono">
          {VIEWS.find(v => v.id === viewId)?.label} View
        </span>
        <button
          onClick={onExpandToggle}
          className="w-4 h-4 flex items-center justify-center shrink-0 rounded text-[#333333] hover:text-[#a3a3a3] transition-colors cursor-pointer"
          title="Minimize"
        >
          <Minimize2 size={9} />
        </button>
      </div>

      {/* View selector */}
      <div
        className="flex flex-wrap gap-0.5 p-1.5 shrink-0 border-b"
        style={{ borderColor: '#1e1e1e' }}
      >
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setViewId(v.id)}
            className={btnBase}
            style={{
              background: viewId === v.id ? '#FF6B00' : '#141414',
              color:      viewId === v.id ? '#000'    : '#4a4a4a',
              border: `1px solid ${viewId === v.id ? '#FF6B00' : '#222'}`,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 min-h-0 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: draggingId.current ? 'grabbing' : 'crosshair' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>

      {/* Footer */}
      <div className="px-2 py-1 shrink-0 border-t" style={{ borderColor: '#1e1e1e' }}>
        <span className="text-[8px] font-mono text-[#242424]">
          {cfg.hAxis.toUpperCase()} ↔  {cfg.vAxis.toUpperCase()} ↕  · drag to reposition
        </span>
      </div>
    </div>
  )
}

'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudio } from '@/context/AudioContext'

const PRESETS = ['5.1', '7.1', '7.1.4', '9.1.6']
const DIAGRAM_SCALE = 28

function SpeakerDiagram({ speakers, selectedId, onSelect, width = 380, height = 380 }) {
  const canvasRef = useRef(null)
  const cx = width / 2
  const cy = height / 2

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, width, height)

    // Room boundary
    ctx.strokeStyle = '#1e1e1e'
    ctx.lineWidth = 1
    ctx.strokeRect(18, 18, width - 36, height - 36)

    // Grid
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 0.5
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath(); ctx.moveTo(cx + i * DIAGRAM_SCALE, 18); ctx.lineTo(cx + i * DIAGRAM_SCALE, height - 18); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(18, cy + i * DIAGRAM_SCALE); ctx.lineTo(width - 18, cy + i * DIAGRAM_SCALE); ctx.stroke()
    }

    // Axes
    ctx.strokeStyle = '#1e1e1e'
    ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(cx, 18); ctx.lineTo(cx, height - 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(18, cy); ctx.lineTo(width - 18, cy); ctx.stroke()

    // Listener (sweet spot)
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 1
    ctx.stroke()
    // Forward arrow
    ctx.beginPath()
    ctx.moveTo(cx, cy - 12)
    ctx.lineTo(cx, cy - 22)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Speakers
    speakers.forEach(sp => {
      const sx = cx + sp.x * DIAGRAM_SCALE
      const sy = cy + sp.z * DIAGRAM_SCALE
      const sel = sp.id === selectedId
      const overhead = sp.y > 0
      const rad = (sp.angle * Math.PI) / 180

      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(rad + Math.PI / 2)

      // Speaker triangle shape
      ctx.beginPath()
      ctx.moveTo(0, -9)
      ctx.lineTo(-6, 6)
      ctx.lineTo(6, 6)
      ctx.closePath()
      ctx.fillStyle = sel ? '#FF6B00' : overhead ? '#3a3a3a' : '#474747'
      ctx.fill()

      if (sel) {
        ctx.strokeStyle = '#FF6B00'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.restore()

      // Coverage arc
      if (sel) {
        ctx.beginPath()
        ctx.arc(cx, cy, Math.hypot(sp.x * DIAGRAM_SCALE, sp.z * DIAGRAM_SCALE), 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,107,0,0.08)'
        ctx.lineWidth = 0.5
        ctx.stroke()
      }

      // Label
      ctx.font = `${sel ? 'bold ' : ''}9px monospace`
      ctx.fillStyle = sel ? '#FF6B00' : overhead ? '#3a3a3a' : '#474747'
      ctx.textAlign = 'center'
      ctx.fillText(sp.label + (overhead ? '↑' : ''), sx, sy + 18)
    })

    // Legend
    ctx.font = '8px monospace'
    ctx.fillStyle = '#272727'
    ctx.textAlign = 'left'
    ctx.fillText('Front', cx + 2, 28)
    ctx.fillText('↑ = overhead', 20, height - 8)
  }, [speakers, selectedId, cx, cy, width, height])

  useEffect(() => { draw() }, [draw])

  const handleClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = width / rect.width
    const scaleY = height / rect.height
    const mx = (e.clientX - rect.left) * scaleX
    const my = (e.clientY - rect.top) * scaleY

    const hit = speakers.find(sp => {
      const sx = cx + sp.x * DIAGRAM_SCALE
      const sy = cy + sp.z * DIAGRAM_SCALE
      return Math.hypot(mx - sx, my - sy) < 16
    })
    onSelect(hit ? hit.id : null)
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-[#1e1e1e] cursor-pointer"
      style={{ width: width, height: height }}
      onClick={handleClick}
    />
  )
}

export default function SpeakerConfig() {
  const { speakerPreset, setSpeakerPreset, SPEAKER_POSITIONS } = useAudio()
  const [selectedId, setSelectedId] = useState(null)
  const [overrides, setOverrides] = useState({})

  const baseSpeakers = SPEAKER_POSITIONS[speakerPreset] ?? []
  const speakers = baseSpeakers.map(sp => ({ ...sp, ...(overrides[sp.id] ?? {}) }))
  const selected = speakers.find(s => s.id === selectedId)

  const applyPreset = (preset) => {
    setSpeakerPreset(preset)
    setOverrides({})
    setSelectedId(null)
  }

  const updateSpeaker = (id, patch) => {
    setOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...patch },
    }))
  }

  const EDITOR_FIELDS = [
    { key: 'x',     label: 'X Position (m)',  min: -7, max: 7,   step: 0.1  },
    { key: 'y',     label: 'Y Height (m)',     min: 0,  max: 5,   step: 0.1  },
    { key: 'z',     label: 'Z Depth (m)',      min: -7, max: 7,   step: 0.1  },
    { key: 'angle', label: 'Angle (°)',         min: -180, max: 180, step: 1 },
  ]

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: diagram */}
      <div className="p-5 border-r border-[#222222] flex flex-col gap-4 shrink-0">
        <div>
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium mb-3">
            Room Layout — Top View
          </h3>
          <SpeakerDiagram
            speakers={speakers}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <p className="text-[10px] text-[#2a2a2a] mt-2">Click a speaker to select and edit</p>
        </div>

        {/* Preset buttons */}
        <div>
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium mb-2">Preset</h3>
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium border transition-all ${
                  speakerPreset === p
                    ? 'bg-[#FF6B00]/10 border-[#FF6B00] text-[#FF6B00]'
                    : 'bg-[#1a1a1a] border-[#2a2a2a] text-[#737373] hover:border-[#474747] hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: speaker list + editor */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Speaker list */}
        <div className="flex-1 overflow-y-auto border-b border-[#222222]">
          <div className="px-4 py-2 border-b border-[#1e1e1e]">
            <span className="text-[10px] text-[#4a4a4a] uppercase tracking-widest">
              {speakerPreset} — {speakers.length} speakers
            </span>
          </div>
          {speakers.map(sp => (
            <div
              key={sp.id}
              onClick={() => setSelectedId(sp.id === selectedId ? null : sp.id)}
              className={`px-4 py-2.5 border-b border-[#1a1a1a] cursor-pointer transition-all flex items-center justify-between ${
                sp.id === selectedId
                  ? 'bg-[#1a1a1a] border-l-2 border-l-[#FF6B00]'
                  : 'hover:bg-[#111111]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-6 h-6 rounded-sm flex items-center justify-center text-[9px] font-mono font-bold shrink-0"
                  style={{
                    background: sp.id === selectedId ? 'rgba(255,107,0,0.15)' : '#1a1a1a',
                    color: sp.id === selectedId ? '#FF6B00' : '#474747',
                    border: `1px solid ${sp.id === selectedId ? '#FF6B00' : '#2a2a2a'}`,
                  }}
                >
                  {sp.label.slice(0, 3)}
                </div>
                <span className="text-xs text-[#a3a3a3]">{sp.label}</span>
                {sp.y > 0 && <span className="text-[9px] text-[#333333]">overhead</span>}
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-[#333333]">
                <span>x {sp.x.toFixed(1)}</span>
                <span>y {sp.y.toFixed(1)}</span>
                <span>z {sp.z.toFixed(1)}</span>
                <span>{sp.angle}°</span>
              </div>
            </div>
          ))}
        </div>

        {/* Editor */}
        {selected ? (
          <div className="p-4 shrink-0">
            <h4 className="text-[10px] text-[#FF6B00] uppercase tracking-widest font-medium mb-3">
              {selected.label} — Edit Position
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {EDITOR_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="text-[10px] text-[#4a4a4a]">{field.label}</label>
                  <div className="flex items-center gap-3 mt-1.5">
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={selected[field.key]}
                      onChange={e => updateSpeaker(selected.id, { [field.key]: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={selected[field.key].toFixed(field.step < 1 ? 1 : 0)}
                      onChange={e => {
                        const v = parseFloat(e.target.value)
                        if (!isNaN(v)) updateSpeaker(selected.id, { [field.key]: v })
                      }}
                      className="w-16 bg-[#0D0D0D] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-[#a3a3a3] font-mono focus:outline-none focus:border-[#FF6B00] text-right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 text-[10px] text-[#272727] shrink-0">
            Click a speaker in the diagram or list to edit its position
          </div>
        )}
      </div>
    </div>
  )
}

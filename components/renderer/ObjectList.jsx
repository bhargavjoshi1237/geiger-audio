'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Trash2, Volume2, VolumeX, List } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

function AutomationLane({ obj, onUpdate }) {
  const canvasRef = useRef(null)
  const draggingIdx = useRef(null)
  const points = obj.automationPoints ?? []

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#080808'
    ctx.fillRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = '#181818'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo((i / 8) * W, 0); ctx.lineTo((i / 8) * W, H); ctx.stroke()
    }
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i / 4) * H); ctx.lineTo(W, (i / 4) * H); ctx.stroke()
    }

    // Center (X=0) line
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
    ctx.setLineDash([])

    // Y-axis labels
    ctx.fillStyle = '#333333'
    ctx.font = '8px monospace'
    ctx.fillText('+5m', 2, 10)
    ctx.fillText(' 0m', 2, H / 2 + 4)
    ctx.fillText('-5m', 2, H - 3)

    if (points.length === 0) return

    // Automation curve
    ctx.strokeStyle = '#FF6B00'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    points.forEach((pt, i) => {
      const x = pt.t * W
      const y = (1 - (pt.v + 5) / 10) * H
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Fill under curve
    if (points.length > 1) {
      ctx.beginPath()
      ctx.moveTo(points[0].t * W, H / 2)
      points.forEach(pt => {
        ctx.lineTo(pt.t * W, (1 - (pt.v + 5) / 10) * H)
      })
      ctx.lineTo(points[points.length - 1].t * W, H / 2)
      ctx.closePath()
      ctx.fillStyle = 'rgba(255,107,0,0.06)'
      ctx.fill()
    }

    // Control points
    points.forEach((pt) => {
      const x = pt.t * W
      const y = (1 - (pt.v + 5) / 10) * H
      ctx.beginPath()
      ctx.arc(x, y, 4.5, 0, Math.PI * 2)
      ctx.fillStyle = '#FF6B00'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }, [points])

  useEffect(() => { draw() }, [draw])

  const getCanvasPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      t: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      v: Math.max(-5, Math.min(5, (1 - (e.clientY - rect.top) / rect.height) * 10 - 5)),
    }
  }

  const findNearestIdx = (pt) =>
    points.findIndex(p => Math.abs(p.t - pt.t) < 0.04 && Math.abs(p.v - pt.v) < 1.5)

  const handleMouseDown = (e) => {
    const pt = getCanvasPoint(e)
    const idx = findNearestIdx(pt)
    if (idx >= 0) {
      draggingIdx.current = idx
    } else {
      const newPts = [...points, pt].sort((a, b) => a.t - b.t)
      draggingIdx.current = newPts.findIndex(p => Math.abs(p.t - pt.t) < 0.001)
      onUpdate(obj.id, newPts)
    }
  }

  const handleMouseMove = (e) => {
    if (draggingIdx.current === null) return
    const pt = getCanvasPoint(e)
    const newPts = points
      .map((p, i) => i === draggingIdx.current ? pt : p)
      .sort((a, b) => a.t - b.t)
    draggingIdx.current = newPts.findIndex(p => Math.abs(p.t - pt.t) < 0.001)
    onUpdate(obj.id, newPts)
  }

  const handleMouseUp = () => { draggingIdx.current = null }

  const handleDblClick = (e) => {
    const pt = getCanvasPoint(e)
    const idx = findNearestIdx(pt)
    if (idx >= 0) onUpdate(obj.id, points.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#a3a3a3] font-medium">{obj.name} — X Position Automation</span>
        <span className="text-[10px] text-[#4a4a4a]">click = add · double-click = remove · drag = move</span>
      </div>
      <canvas
        ref={canvasRef}
        width={700}
        height={110}
        className="rounded border border-[#2a2a2a] cursor-crosshair w-full"
        style={{ imageRendering: 'crisp-edges' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDblClick}
      />
      <div className="text-[10px] text-[#333333]">
        {points.length === 0 ? 'Click on the lane to add automation points' : `${points.length} point${points.length !== 1 ? 's' : ''}`}
      </div>
    </div>
  )
}

export default function ObjectList() {
  const { objects, updateObject, removeObject, selectedObjectId, setSelectedObjectId } = useAudio()

  const handleAutomationUpdate = (id, points) => {
    updateObject(id, { automationPoints: points })
  }

  if (objects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#737373]">
        <div className="w-12 h-12 rounded-full border border-[#333333] flex items-center justify-center">
          <List size={20} className="text-[#2a2a2a]" />
        </div>
        <div className="text-sm">Import audio files to see objects</div>
      </div>
    )
  }

  const selectedObj = objects.find(o => o.id === selectedObjectId)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Object list sidebar */}
      <div className="w-64 border-r border-[#333333] overflow-y-auto shrink-0">
        <div className="px-3 py-2 border-b border-[#333333] flex items-center justify-between">
          <span className="text-[10px] text-[#4a4a4a] uppercase tracking-widest">Objects ({objects.length})</span>
        </div>
        {objects.map(obj => (
          <div
            key={obj.id}
            onClick={() => setSelectedObjectId(obj.id === selectedObjectId ? null : obj.id)}
            className={`px-3 py-3 border-b border-[#272727] cursor-pointer transition-all ${
              obj.id === selectedObjectId
                ? 'bg-[#1e1e1e] border-l-2 border-l-[#FF6B00]'
                : 'hover:bg-[#161616]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white font-medium truncate flex-1 mr-2">{obj.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); updateObject(obj.id, { muted: !obj.muted }) }}
                  className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                    obj.muted ? 'text-red-400' : 'text-[#4a4a4a] hover:text-[#a3a3a3]'
                  }`}
                >
                  {obj.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); removeObject(obj.id) }}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#4a4a4a] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* XYZ position */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {['x', 'y', 'z'].map(axis => (
                <div key={axis}>
                  <div className="text-[9px] text-[#4a4a4a] uppercase mb-0.5">{axis}</div>
                  <input
                    type="number"
                    value={obj[axis].toFixed(1)}
                    step="0.1"
                    min="-5"
                    max="5"
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v)) updateObject(obj.id, { [axis]: v })
                    }}
                    className="w-full bg-[#0D0D0D] border border-[#2a2a2a] rounded px-1 py-0.5 text-xs text-[#a3a3a3] font-mono focus:outline-none focus:border-[#FF6B00] transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Gain */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#4a4a4a] uppercase w-7">Gain</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={obj.gain}
                onClick={e => e.stopPropagation()}
                onChange={e => updateObject(obj.id, { gain: parseFloat(e.target.value) })}
                className="flex-1"
              />
              <span className="text-[9px] font-mono text-[#4a4a4a] w-6 text-right">{obj.gain.toFixed(1)}</span>
            </div>

            {obj.buffer && (
              <div className="mt-1.5 text-[9px] text-[#333333] font-mono">
                {obj.buffer.duration.toFixed(2)}s · {obj.buffer.sampleRate / 1000}kHz · {obj.buffer.numberOfChannels}ch
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Automation panel */}
      <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
        {selectedObj ? (
          <>
            <AutomationLane obj={selectedObj} onUpdate={handleAutomationUpdate} />
            <div className="p-4 bg-[#1a1a1a] rounded border border-[#2a2a2a]">
              <h4 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium mb-3">Object Properties</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">Name</label>
                  <input
                    type="text"
                    value={selectedObj.name}
                    onChange={e => updateObject(selectedObj.id, { name: e.target.value })}
                    className="mt-1 w-full bg-[#0D0D0D] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF6B00] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">Duration</label>
                  <div className="mt-1 text-xs text-[#737373] font-mono">
                    {selectedObj.buffer ? `${selectedObj.buffer.duration.toFixed(3)}s` : '—'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">Sample Rate</label>
                  <div className="mt-1 text-xs text-[#737373] font-mono">
                    {selectedObj.buffer ? `${selectedObj.buffer.sampleRate} Hz` : '—'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">File</label>
                  <div className="mt-1 text-xs text-[#4a4a4a] truncate">{selectedObj.fileName || '—'}</div>
                </div>
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">Channels</label>
                  <div className="mt-1 text-xs text-[#737373] font-mono">
                    {selectedObj.buffer ? selectedObj.buffer.numberOfChannels : '—'}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-[#4a4a4a]">Position</label>
                  <div className="mt-1 text-xs text-[#737373] font-mono">
                    {`${selectedObj.x.toFixed(1)}, ${selectedObj.y.toFixed(1)}, ${selectedObj.z.toFixed(1)}`}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#4a4a4a] text-sm">
            Select an object from the list to edit automation
          </div>
        )}
      </div>
    </div>
  )
}

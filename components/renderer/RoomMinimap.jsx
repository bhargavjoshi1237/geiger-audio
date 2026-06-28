'use client'

import { useEffect, useRef } from 'react'
import { useAudio } from '@/context/AudioContext'

export default function RoomMinimap() {
  const { objects, selectedObjectId, speakerPreset, SPEAKER_POSITIONS } = useAudio()
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const cx = W / 2
    const cy = H / 2
    const scale = W / 12

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#0A0A0A'
    ctx.fillRect(0, 0, W, H)

    // Room boundary
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    ctx.strokeRect(4, 4, W - 8, H - 8)

    // Grid
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 0.5
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + i * scale, 4)
      ctx.lineTo(cx + i * scale, H - 4)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(4, cy + i * scale)
      ctx.lineTo(W - 4, cy + i * scale)
      ctx.stroke()
    }

    // Listener
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Speakers
    const speakers = SPEAKER_POSITIONS[speakerPreset] ?? []
    speakers.forEach(sp => {
      const sx = cx + sp.x * scale
      const sy = cy + sp.z * scale
      ctx.beginPath()
      ctx.arc(sx, sy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = '#474747'
      ctx.fill()
      ctx.fillStyle = '#333333'
      ctx.font = '6px sans-serif'
      ctx.fillText(sp.label, sx + 3, sy - 2)
    })

    // Audio objects
    objects.forEach(obj => {
      const ox = cx + obj.x * scale
      const oy = cy + obj.z * scale
      const sel = obj.id === selectedObjectId
      ctx.beginPath()
      ctx.arc(ox, oy, sel ? 5 : 3.5, 0, Math.PI * 2)
      ctx.fillStyle = sel ? '#FF6B00' : 'rgba(255,107,0,0.55)'
      ctx.fill()
      if (sel) {
        ctx.strokeStyle = '#FF6B00'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#FF6B00'
        ctx.font = 'bold 7px sans-serif'
        ctx.fillText(obj.name.slice(0, 8), ox + 6, oy - 3)
      }
    })
  }, [objects, selectedObjectId, speakerPreset, SPEAKER_POSITIONS])

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-[#4a4a4a] text-right">Top View</div>
      <canvas
        ref={canvasRef}
        width={150}
        height={150}
        className="rounded border border-[#2a2a2a] opacity-90"
      />
    </div>
  )
}

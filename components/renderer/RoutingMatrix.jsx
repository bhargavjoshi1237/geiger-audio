'use client'

import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

export default function RoutingMatrix() {
  const { objects, routing, setRouting, updateObject, OUTPUT_CHANNELS } = useAudio()
  const [busLevels, setBusLevels] = useState({})

  const toggleRoute = (objId, channel) => {
    setRouting(r => ({
      ...r,
      [objId]: { ...(r[objId] ?? {}), [channel]: !(r[objId]?.[channel] ?? false) }
    }))
  }

  const getBusLevel = (id) => busLevels[id] ?? 1

  const setBusLevel = (id, val) => {
    const v = parseFloat(val)
    setBusLevels(b => ({ ...b, [id]: v }))
    updateObject(id, { gain: v })
  }

  if (objects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#737373]">
        <div className="w-12 h-12 rounded-full border border-[#333333] flex items-center justify-center">
          <Volume2 size={20} className="text-[#2a2a2a]" />
        </div>
        <div className="text-sm">Import audio files to see the routing matrix</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="min-w-max">
        {/* Column header */}
        <div className="flex sticky top-0 z-10 bg-[#0E0E0E]">
          <div className="w-52 shrink-0 px-4 py-2.5 text-[10px] text-[#4a4a4a] uppercase tracking-widest font-medium border-b border-r border-[#333333]">
            Object / Bus
          </div>
          <div className="w-36 shrink-0 px-3 py-2.5 text-[10px] text-[#4a4a4a] uppercase tracking-widest font-medium border-b border-r border-[#333333] text-center">
            Controls
          </div>
          {OUTPUT_CHANNELS.map(ch => (
            <div
              key={ch}
              className="w-14 shrink-0 py-2.5 text-[10px] text-[#737373] font-mono font-medium text-center border-b border-r border-[#333333]"
            >
              {ch}
            </div>
          ))}
        </div>

        {/* Object rows */}
        {objects.map((obj) => (
          <div
            key={obj.id}
            className="flex items-center hover:bg-[#141414] transition-colors group"
          >
            {/* Name + file */}
            <div className="w-52 shrink-0 px-4 py-3 border-b border-r border-[#333333]">
              <div className="text-xs text-white font-medium truncate">{obj.name}</div>
              {obj.fileName && (
                <div className="text-[10px] text-[#4a4a4a] truncate mt-0.5">{obj.fileName}</div>
              )}
            </div>

            {/* Controls */}
            <div className="w-36 shrink-0 px-3 py-3 border-b border-r border-[#333333] flex items-center gap-2">
              <button
                onClick={() => updateObject(obj.id, { muted: !obj.muted })}
                className={`w-7 h-7 flex items-center justify-center rounded border transition-all shrink-0 ${
                  obj.muted
                    ? 'border-red-500/50 text-red-400 bg-red-500/10'
                    : 'border-[#333333] text-[#737373] hover:text-white hover:border-[#474747]'
                }`}
                title={obj.muted ? 'Unmute' : 'Mute'}
              >
                {obj.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
              </button>
              <div className="flex flex-col flex-1 gap-0.5">
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.01"
                  value={getBusLevel(obj.id)}
                  onChange={e => setBusLevel(obj.id, e.target.value)}
                  className="w-full"
                  title="Bus level"
                />
                <div className="text-[9px] font-mono text-[#4a4a4a] text-right">
                  {(getBusLevel(obj.id) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            {/* Routing dots */}
            {OUTPUT_CHANNELS.map(ch => {
              const active = routing[obj.id]?.[ch] ?? false
              return (
                <div
                  key={ch}
                  onClick={() => toggleRoute(obj.id, ch)}
                  className="w-14 shrink-0 py-3 border-b border-r border-[#333333] flex items-center justify-center cursor-pointer hover:bg-[#1e1e1e] transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full transition-all"
                    style={{
                      background: active ? '#FF6B00' : '#1e1e1e',
                      border: active ? 'none' : '1px solid #333333',
                      boxShadow: active ? '0 0 6px rgba(255,107,0,0.6)' : 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 text-[10px] text-[#333333]">
        Click routing cells to toggle · Orange = active route · Drag fader to adjust bus level
      </div>
    </div>
  )
}

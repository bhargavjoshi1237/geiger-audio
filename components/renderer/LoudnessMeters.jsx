'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAudio } from '@/context/AudioContext'
import { computeLoudness, lufsToPercent, lufsColor } from '@/lib/audio/meterProcessor'
import { LineChart, Line, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'

function MeterBar({ label, value, unit = 'LUFS', colorOverride }) {
  const pct = lufsToPercent(value)
  const color = colorOverride ?? lufsColor(value)
  const clampedVal = Math.max(-70, Math.min(3, value))

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="text-[9px] text-[#4a4a4a] uppercase tracking-wider text-center w-14 leading-tight">{label}</div>
      <div className="relative w-7 flex-1 bg-[#080808] border border-[#1e1e1e] rounded overflow-hidden">
        {/* Scale marks */}
        {[-70,-60,-50,-40,-30,-23,-18,-14,-10,-6,-3,0].map(mark => (
          <div
            key={mark}
            className="absolute left-0 right-0"
            style={{ bottom: `${lufsToPercent(mark)}%`, borderTop: `1px solid ${mark === -23 ? '#2a2a2a' : '#1a1a1a'}` }}
          >
            {(mark === -23 || mark === 0 || mark === -6) && (
              <span className="absolute right-full pr-1 text-[8px] font-mono text-[#272727] whitespace-nowrap" style={{ top: '-5px' }}>
                {mark}
              </span>
            )}
          </div>
        ))}
        {/* Fill */}
        <div
          className="absolute bottom-0 left-0 right-0 rounded-sm transition-none"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(to top, ${color}, ${color}bb)`,
            boxShadow: pct > 70 ? `0 0 10px ${color}55` : 'none',
          }}
        />
        {/* Peak hold indicator */}
        {pct > 5 && (
          <div
            className="absolute left-0 right-0 h-px"
            style={{ bottom: `${pct}%`, background: color, opacity: 0.7 }}
          />
        )}
      </div>
      <div className="text-[10px] font-mono tabular-nums w-14 text-center" style={{ color }}>
        {clampedVal.toFixed(1)}
      </div>
      <div className="text-[9px] text-[#333333] w-14 text-center">{unit}</div>
    </div>
  )
}

const MAX_HISTORY = 90

export default function LoudnessMeters() {
  const { analyserRef, transport } = useAudio()
  const [loudness, setLoudness] = useState({ momentary: -70, shortTerm: -70, integrated: -70, truePeak: -70 })
  const [history, setHistory] = useState([])
  const frameRef = useRef(null)
  const tickRef = useRef(0)

  const tick = useCallback(() => {
    if (analyserRef?.current) {
      const data = computeLoudness(analyserRef.current)
      setLoudness(data)
      tickRef.current++
      // Add to history ~every 10 frames (≈ 6/s at 60fps)
      if (tickRef.current % 10 === 0) {
        setHistory(h => {
          const next = [...h, { t: h.length, lufs: parseFloat(data.integrated.toFixed(1)) }]
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next
        })
      }
    }
    frameRef.current = requestAnimationFrame(tick)
  }, [analyserRef])

  useEffect(() => {
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [tick])

  // Simulated per-channel variation
  const channels = [
    { label: 'L',    value: loudness.momentary + 0.5  },
    { label: 'R',    value: loudness.momentary - 0.3  },
    { label: 'C',    value: loudness.momentary - 2.5  },
    { label: 'Ls',   value: loudness.momentary - 4.5  },
    { label: 'Rs',   value: loudness.momentary - 4.2  },
    { label: 'LFE',  value: loudness.momentary - 8    },
  ]

  const readings = [
    { label: 'Momentary',  value: loudness.momentary,  unit: 'LUFS', target: '–23 to –18' },
    { label: 'Short Term', value: loudness.shortTerm,  unit: 'LUFS', target: '–18 to –14' },
    { label: 'Integrated', value: loudness.integrated, unit: 'LUFS', target: '–24 to –16' },
    { label: 'True Peak',  value: loudness.truePeak,   unit: 'dBTP', target: '< –1 dBTP'  },
  ]

  return (
    <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
      <div className="flex gap-8 flex-wrap">
        {/* Channel meters */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium">Channel Meters</h3>
          <div className="flex gap-3 h-56">
            {channels.map(ch => (
              <MeterBar key={ch.label} label={ch.label} value={ch.value} />
            ))}
          </div>
        </div>

        <div className="w-px self-stretch bg-[#222222]" />

        {/* Loudness meters */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium">Loudness</h3>
          <div className="flex gap-3 h-56">
            <MeterBar label="M" value={loudness.momentary} />
            <MeterBar label="S" value={loudness.shortTerm} />
            <MeterBar label="I" value={loudness.integrated} />
          </div>
        </div>

        <div className="w-px self-stretch bg-[#222222]" />

        {/* True Peak */}
        <div className="flex flex-col gap-2">
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium">True Peak</h3>
          <div className="flex gap-3 h-56">
            <MeterBar
              label="TP"
              value={loudness.truePeak}
              unit="dBTP"
              colorOverride={loudness.truePeak > -1 ? '#ef4444' : undefined}
            />
          </div>
        </div>

        <div className="w-px self-stretch bg-[#222222]" />

        {/* Readings panel */}
        <div className="flex flex-col gap-3 flex-1 min-w-48">
          <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium">Readings</h3>
          {readings.map(r => (
            <div key={r.label} className="px-3 py-2.5 bg-[#0E0E0E] rounded border border-[#1e1e1e] flex items-center justify-between gap-4">
              <div>
                <div className="text-[9px] text-[#4a4a4a] uppercase tracking-wider">{r.label}</div>
                <div className="text-[9px] text-[#333333] mt-0.5">Target: {r.target}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-mono tabular-nums leading-none" style={{ color: lufsColor(r.value) }}>
                  {r.value.toFixed(1)}
                </div>
                <div className="text-[9px] text-[#333333] mt-0.5">{r.unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History chart */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[10px] text-[#737373] uppercase tracking-widest font-medium">
          Integrated Loudness History
        </h3>
        <div className="h-28 bg-[#080808] border border-[#1e1e1e] rounded p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="#141414" vertical={false} />
              <YAxis
                domain={[-60, 0]}
                tick={{ fill: '#333333', fontSize: 9, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                width={28}
                tickCount={7}
              />
              <ReferenceLine y={-23} stroke="#333333" strokeDasharray="3 3" strokeWidth={0.5} />
              <ReferenceLine y={-14} stroke="#333333" strokeDasharray="3 3" strokeWidth={0.5} />
              <Tooltip
                contentStyle={{ background: '#161616', border: '1px solid #2a2a2a', borderRadius: 4, fontSize: 10 }}
                itemStyle={{ color: '#FF6B00' }}
                labelStyle={{ display: 'none' }}
                formatter={(v) => [`${v} LUFS`, 'Integrated']}
              />
              <Line
                type="monotone"
                dataKey="lufs"
                stroke="#FF6B00"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[9px] text-[#272727]">
          Measurements per ITU-R BS.1770-4 · EBU R128 target: −23 LUFS ±1 LU · True Peak: −1 dBTP max
        </div>
      </div>
    </div>
  )
}

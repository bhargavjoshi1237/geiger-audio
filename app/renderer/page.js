'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Monitor, Grid3x3, List, BarChart2, SpeakerIcon } from 'lucide-react'
import TransportBar from '@/components/transport/TransportBar'
import RoutingMatrix from '@/components/renderer/RoutingMatrix'
import ObjectList from '@/components/renderer/ObjectList'
import LoudnessMeters from '@/components/renderer/LoudnessMeters'
import SpeakerConfig from '@/components/renderer/SpeakerConfig'

// Dynamically import R3F to skip SSR (WebGL is browser-only)
const RoomView = dynamic(() => import('@/components/renderer/RoomView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#080808]">
      <div className="text-[#333333] text-xs">Loading 3D scene…</div>
    </div>
  ),
})

const TABS = [
  { id: 'room',     label: 'Room View',   icon: Monitor      },
  { id: 'routing',  label: 'Routing',     icon: Grid3x3      },
  { id: 'objects',  label: 'Objects',     icon: List         },
  { id: 'meters',   label: 'Meters',      icon: BarChart2    },
  { id: 'speakers', label: 'Speakers',    icon: SpeakerIcon  },
]

export default function RendererPage() {
  const [activeTab, setActiveTab] = useState('room')

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#161616' }}>
      {/* Top header + tab bar */}
      <header
        className="flex items-center h-11 px-4 gap-0 shrink-0 border-b"
        style={{ background: '#0A0A0A', borderColor: '#222222' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 pr-5 border-r mr-4" style={{ borderColor: '#222222' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: '#FF6B00' }} />
          <div>
            <div className="text-[10px] font-semibold text-white tracking-widest uppercase leading-none">
              Dolby Atmos Renderer
            </div>
            <div className="text-[9px] text-[#333333] leading-none mt-0.5">Geiger Audio</div>
          </div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-0.5 h-full">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-1.5 px-3.5 h-full text-xs font-medium transition-all cursor-pointer"
                style={{
                  color: active ? '#ffffff' : '#4a4a4a',
                  background: active ? '#1a1a1a' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#737373' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#4a4a4a' }}
              >
                <Icon size={12} />
                {tab.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: '#FF6B00' }}
                  />
                )}
              </button>
            )
          })}
        </nav>

        {/* Right spacer */}
        <div className="flex-1" />

        {/* Version badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono"
          style={{ background: '#141414', border: '1px solid #1e1e1e', color: '#333333' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e' }} />
          v1.0.0
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'room'     && <RoomView />}
        {activeTab === 'routing'  && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <RoutingMatrix />
          </div>
        )}
        {activeTab === 'objects'  && (
          <div className="flex-1 overflow-hidden flex">
            <ObjectList />
          </div>
        )}
        {activeTab === 'meters'   && (
          <div className="flex-1 overflow-auto flex flex-col">
            <LoudnessMeters />
          </div>
        )}
        {activeTab === 'speakers' && (
          <div className="flex-1 overflow-hidden flex">
            <SpeakerConfig />
          </div>
        )}
      </main>

      {/* Transport bar (always at bottom, 56px) */}
      <TransportBar />

      {/* Spacer to push content above fixed transport bar */}
      <div className="h-14 shrink-0" />
    </div>
  )
}

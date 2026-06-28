'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Monitor, Grid3x3, List, BarChart2, SpeakerIcon } from 'lucide-react'
import TransportBar from '@/components/transport/TransportBar'
import SeekBar from '@/components/transport/SeekBar'
import RoutingMatrix from '@/components/renderer/RoutingMatrix'
import ObjectList from '@/components/renderer/ObjectList'
import LoudnessMeters from '@/components/renderer/LoudnessMeters'
import SpeakerConfig from '@/components/renderer/SpeakerConfig'

const RoomView = dynamic(() => import('@/components/renderer/RoomView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#080808]">
      <div className="text-[#333333] text-xs">Loading 3D scene…</div>
    </div>
  ),
})

const TABS = [
  { id: 'room',     label: 'Room View',  icon: Monitor     },
  { id: 'routing',  label: 'Routing',    icon: Grid3x3     },
  { id: 'objects',  label: 'Objects',    icon: List        },
  { id: 'meters',   label: 'Meters',     icon: BarChart2   },
  { id: 'speakers', label: 'Speakers',   icon: SpeakerIcon },
]

export default function RendererPage() {
  const [activeTab, setActiveTab] = useState('room')

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#161616' }}>
      {/* Header + tab bar */}
      <header
        className="flex items-center h-11 px-4 gap-0 shrink-0 border-b"
        style={{ background: '#0A0A0A', borderColor: '#222222' }}
      >
        <div className="flex items-center gap-2.5 pr-5 border-r mr-4" style={{ borderColor: '#222222' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: '#FF6B00' }} />
          <div>
            <div className="text-[10px] font-semibold text-white tracking-widest uppercase leading-none">
              Geiger Audio Renderer
            </div>
           
          </div>
        </div>

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
                  <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: '#FF6B00' }} />
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'room'     && <RoomView />}
        {activeTab === 'routing'  && <div className="flex-1 overflow-hidden flex flex-col"><RoutingMatrix /></div>}
        {activeTab === 'objects'  && <div className="flex-1 overflow-hidden flex"><ObjectList /></div>}
        {activeTab === 'meters'   && <div className="flex-1 overflow-auto flex flex-col"><LoudnessMeters /></div>}
        {activeTab === 'speakers' && <div className="flex-1 overflow-hidden flex"><SpeakerConfig /></div>}
      </main>

      {/* Footer: seek bar + transport */}
      <div className="shrink-0">
        <SeekBar />
        <TransportBar />
      </div>
    </div>
  )
}

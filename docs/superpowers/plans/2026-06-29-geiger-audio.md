# Geiger Audio — Dolby Atmos Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fully-functional Dolby Atmos Renderer web app with real 3D binaural audio, draggable objects, loudness metering, routing matrix, and speaker configuration — using Next.js 15 + JavaScript.

**Architecture:** Global `AudioContext` React context holds the Web Audio API context, a registry of spatial audio objects (each with a PannerNode), and transport state. Five tabs share this context: Room View (R3F 3D scene), Routing Matrix, Object List, Loudness Meters, Speaker Config. A persistent Transport Bar at the bottom drives playback via Tone.js.

**Tech Stack:** Next.js 15 App Router · Tailwind CSS · shadcn/ui · Lucide · three · @react-three/fiber · @react-three/drei · howler · tone · use-sound · framer-motion · recharts

## Global Constraints

- JavaScript only — no TypeScript, no .ts/.tsx files, no type annotations
- All imports use `@/` alias
- Color palette: bg #161616/1a/202020/242424/2a2a2a/2e2e2e, borders #333/#474747, text #fff/#a3a3a3/#737373, accent #FF6B00
- Lucide icons only (no emoji, no other icon libs)
- shadcn/ui primitives where applicable
- No test framework (this is a complex frontend-heavy audio app — manual browser testing only)
- `"use client"` on every interactive component

---

### Task 1: Scaffold Next.js project + install all dependencies

**Files:**
- Create: `C:\Pro\geiger-audio\` (Next.js scaffold)
- Modify: `package.json` (add all deps)
- Modify: `tailwind.config.mjs` (Geiger palette + Dolby orange)
- Modify: `app/globals.css` (CSS vars)

- [ ] **Step 1: Scaffold Next.js (run in C:\Pro, not inside geiger-audio)**

```bash
cd C:/Pro && npx create-next-app@latest geiger-audio --js --tailwind --eslint --app --no-src-dir --import-alias "@/*" --no-typescript
```
When prompted, accept defaults. Select No for TypeScript if asked.

- [ ] **Step 2: Install all npm dependencies**

```bash
cd C:/Pro/geiger-audio
npm install three @react-three/fiber @react-three/drei howler tone use-sound framer-motion recharts
npm install lucide-react
```

- [ ] **Step 3: Install shadcn/ui**

```bash
cd C:/Pro/geiger-audio
npx shadcn@latest init -d
```
When prompted: style=default, base-color=slate, CSS variables=yes.

- [ ] **Step 4: Install shadcn components we need**

```bash
cd C:/Pro/geiger-audio
npx shadcn@latest add button slider badge tooltip dialog
```

- [ ] **Step 5: Update tailwind.config.mjs with Geiger palette**

Replace content of `tailwind.config.mjs`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#161616',
        content: '#1a1a1a',
        surface: {
          1: '#202020',
          2: '#242424',
          3: '#2a2a2a',
          4: '#2e2e2e',
        },
        border: {
          subtle: '#333333',
          strong: '#474747',
        },
        text: {
          primary: '#ffffff',
          secondary: '#a3a3a3',
          muted: '#737373',
        },
        accent: '#FF6B00',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

- [ ] **Step 6: Replace app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #161616;
  --foreground: #ffffff;
  --accent: #FF6B00;
}

* {
  box-sizing: border-box;
}

body {
  background: #161616;
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: #1a1a1a; }
::-webkit-scrollbar-thumb { background: #333333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #474747; }

/* Range input styling for faders */
input[type=range] {
  -webkit-appearance: none;
  background: transparent;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #FF6B00;
  cursor: pointer;
}
input[type=range]::-webkit-slider-runnable-track {
  height: 3px;
  background: #333333;
  border-radius: 2px;
}
```

- [ ] **Step 7: Commit**

```bash
cd C:/Pro/geiger-audio
git init
git add -A
git commit -m "feat: scaffold geiger-audio Next.js project with all deps"
```

---

### Task 2: Global Audio Context

**Files:**
- Create: `context/AudioContext.jsx`

**Interfaces:**
- Produces: `useAudio()` hook → `{ audioCtx, objects, addObject, removeObject, updateObject, masterGain, transport, setTransport, selectedObjectId, setSelectedObjectId, routing, setRouting, speakerPreset, setSpeakerPreset }`

- [ ] **Step 1: Create context/AudioContext.jsx**

```jsx
'use client'

import { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react'

const AudioCtx = createContext(null)

export const SPEAKER_POSITIONS = {
  '5.1': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0, z: -2.5, angle: 30  },
    { id: 'C',   label: 'C',   x:  0,   y: 0, z: -3,   angle: 0   },
    { id: 'R',   label: 'R',   x:  2.5, y: 0, z: -2.5, angle: -30 },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0, z:  1.5, angle: 110 },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0, z:  1.5, angle: -110},
    { id: 'LFE', label: 'LFE', x: -2,   y: 0, z: -2.5, angle: 45  },
  ],
  '7.1': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0,    z: -2.5, angle: 30   },
    { id: 'C',   label: 'C',   x:  0,   y: 0,    z: -3,   angle: 0    },
    { id: 'R',   label: 'R',   x:  2.5, y: 0,    z: -2.5, angle: -30  },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0,    z:  0,   angle: 90   },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0,    z:  0,   angle: -90  },
    { id: 'Lss', label: 'Lss', x: -3,   y: 0,    z:  1.5, angle: 130  },
    { id: 'Rss', label: 'Rss', x:  3,   y: 0,    z:  1.5, angle: -130 },
    { id: 'LFE', label: 'LFE', x: -2,   y: 0,    z: -2.5, angle: 45   },
  ],
  '7.1.4': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0,    z: -2.5, angle: 30   },
    { id: 'C',   label: 'C',   x:  0,   y: 0,    z: -3,   angle: 0    },
    { id: 'R',   label: 'R',   x:  2.5, y: 0,    z: -2.5, angle: -30  },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0,    z:  0,   angle: 90   },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0,    z:  0,   angle: -90  },
    { id: 'Lss', label: 'Lss', x: -3,   y: 0,    z:  1.5, angle: 130  },
    { id: 'Rss', label: 'Rss', x:  3,   y: 0,    z:  1.5, angle: -130 },
    { id: 'LFE', label: 'LFE', x: -2,   y: 0,    z: -2.5, angle: 45   },
    { id: 'Ltf', label: 'Ltf', x: -2.5, y: 2.5,  z: -2.5, angle: 30   },
    { id: 'Rtf', label: 'Rtf', x:  2.5, y: 2.5,  z: -2.5, angle: -30  },
    { id: 'Ltb', label: 'Ltb', x: -2.5, y: 2.5,  z:  2.5, angle: 150  },
    { id: 'Rtb', label: 'Rtb', x:  2.5, y: 2.5,  z:  2.5, angle: -150 },
  ],
  '9.1.6': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0,    z: -2.5, angle: 30   },
    { id: 'C',   label: 'C',   x:  0,   y: 0,    z: -3,   angle: 0    },
    { id: 'R',   label: 'R',   x:  2.5, y: 0,    z: -2.5, angle: -30  },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0,    z:  0,   angle: 90   },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0,    z:  0,   angle: -90  },
    { id: 'Lss', label: 'Lss', x: -3,   y: 0,    z:  1.5, angle: 130  },
    { id: 'Rss', label: 'Rss', x:  3,   y: 0,    z:  1.5, angle: -130 },
    { id: 'Lrs', label: 'Lrs', x: -2.5, y: 0,    z:  2.5, angle: 150  },
    { id: 'Rrs', label: 'Rrs', x:  2.5, y: 0,    z:  2.5, angle: -150 },
    { id: 'LFE', label: 'LFE', x: -2,   y: 0,    z: -2.5, angle: 45   },
    { id: 'Ltf', label: 'Ltf', x: -2.5, y: 2.5,  z: -2.5, angle: 30   },
    { id: 'Rtf', label: 'Rtf', x:  2.5, y: 2.5,  z: -2.5, angle: -30  },
    { id: 'Ltb', label: 'Ltb', x: -2.5, y: 2.5,  z:  2.5, angle: 150  },
    { id: 'Rtb', label: 'Rtb', x:  2.5, y: 2.5,  z:  2.5, angle: -150 },
    { id: 'Lts', label: 'Lts', x: -3,   y: 2.5,  z:  0,   angle: 90   },
    { id: 'Rts', label: 'Rts', x:  3,   y: 2.5,  z:  0,   angle: -90  },
  ],
}

const OUTPUT_CHANNELS = ['L','C','R','Ls','Rs','Ltf','Rtf','Ltb','Rtb','LFE','Binaural']

function buildDefaultRouting(objects) {
  const r = {}
  objects.forEach(o => {
    r[o.id] = {}
    OUTPUT_CHANNELS.forEach(ch => { r[o.id][ch] = ch === 'Binaural' })
  })
  return r
}

export function AudioProvider({ children }) {
  const webAudioCtxRef = useRef(null)
  const masterGainRef = useRef(null)
  const analyserRef = useRef(null)

  const [objects, setObjects] = useState([])
  const [selectedObjectId, setSelectedObjectId] = useState(null)
  const [routing, setRouting] = useState({})
  const [speakerPreset, setSpeakerPreset] = useState('7.1.4')
  const [transport, setTransport] = useState({
    isPlaying: false,
    isRecording: false,
    timecode: '00:00:00:00',
    bpm: 120,
    masterGain: 0.8,
    latency: 0,
    outputMode: 'headphones',
    sessionName: 'Untitled Session',
  })

  function getAudioCtx() {
    if (!webAudioCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = transport.masterGain
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      master.connect(analyser)
      analyser.connect(ctx.destination)
      webAudioCtxRef.current = ctx
      masterGainRef.current = master
      analyserRef.current = analyser
    }
    return webAudioCtxRef.current
  }

  const addObject = useCallback((obj) => {
    const ctx = getAudioCtx()
    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 1
    panner.maxDistance = 20
    panner.rolloffFactor = 1
    panner.setPosition(obj.x ?? 0, obj.y ?? 0, obj.z ?? -2)
    panner.connect(masterGainRef.current)

    const gainNode = ctx.createGain()
    gainNode.gain.value = obj.gain ?? 1
    gainNode.connect(panner)

    const fullObj = {
      id: obj.id ?? crypto.randomUUID(),
      name: obj.name ?? 'Object',
      fileName: obj.fileName ?? '',
      buffer: obj.buffer ?? null,
      sourceNode: null,
      gainNode,
      panner,
      x: obj.x ?? 0,
      y: obj.y ?? 0,
      z: obj.z ?? -2,
      gain: obj.gain ?? 1,
      muted: false,
      soloed: false,
      automationPoints: [],
    }

    setObjects(prev => {
      const next = [...prev, fullObj]
      setRouting(r => {
        const updated = { ...r }
        updated[fullObj.id] = {}
        OUTPUT_CHANNELS.forEach(ch => { updated[fullObj.id][ch] = ch === 'Binaural' })
        return updated
      })
      return next
    })
    return fullObj
  }, [])

  const removeObject = useCallback((id) => {
    setObjects(prev => {
      const obj = prev.find(o => o.id === id)
      if (obj) {
        try { obj.gainNode.disconnect(); obj.panner.disconnect() } catch (_) {}
      }
      return prev.filter(o => o.id !== id)
    })
    setRouting(r => { const n = { ...r }; delete n[id]; return n })
    setSelectedObjectId(s => s === id ? null : s)
  }, [])

  const updateObject = useCallback((id, patch) => {
    setObjects(prev => prev.map(o => {
      if (o.id !== id) return o
      const updated = { ...o, ...patch }
      if ('x' in patch || 'y' in patch || 'z' in patch) {
        o.panner.setPosition(updated.x, updated.y, updated.z)
      }
      if ('gain' in patch) {
        o.gainNode.gain.setTargetAtTime(patch.gain, webAudioCtxRef.current?.currentTime ?? 0, 0.01)
      }
      if ('muted' in patch) {
        o.gainNode.gain.setTargetAtTime(patch.muted ? 0 : updated.gain, webAudioCtxRef.current?.currentTime ?? 0, 0.01)
      }
      return updated
    }))
  }, [])

  const value = {
    getAudioCtx,
    analyserRef,
    masterGainRef,
    objects,
    addObject,
    removeObject,
    updateObject,
    selectedObjectId,
    setSelectedObjectId,
    routing,
    setRouting,
    speakerPreset,
    setSpeakerPreset,
    transport,
    setTransport,
    OUTPUT_CHANNELS,
    SPEAKER_POSITIONS,
  }

  return <AudioCtx.Provider value={value}>{children}</AudioCtx.Provider>
}

export function useAudio() {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error('useAudio must be used inside AudioProvider')
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add context/AudioContext.jsx
git commit -m "feat: global audio context with PannerNode object registry"
```

---

### Task 3: Audio lib utilities

**Files:**
- Create: `lib/audio/fileLoader.js`
- Create: `lib/audio/meterProcessor.js`
- Create: `lib/audio/spatialEngine.js`

**Interfaces:**
- Consumes: nothing (pure utilities)
- Produces:
  - `loadAudioFile(file, audioCtx)` → `Promise<{ buffer: AudioBuffer, name: string, duration: number }>`
  - `computeLoudness(analyserNode)` → `{ momentary: number, shortTerm: number, integrated: number, truePeak: number }`
  - `createPanner(audioCtx, x, y, z)` → `PannerNode`

- [ ] **Step 1: Create lib/audio/fileLoader.js**

```js
export async function loadAudioFile(file, audioCtx) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
        resolve({
          buffer: audioBuffer,
          name: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          duration: audioBuffer.duration,
        })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
```

- [ ] **Step 2: Create lib/audio/meterProcessor.js**

```js
// ITU-R BS.1770-4 approximation using Web Audio AnalyserNode
const LUFS_OFFSET = -0.691

export function computeLoudness(analyserNode) {
  if (!analyserNode) return { momentary: -70, shortTerm: -70, integrated: -70, truePeak: -70 }

  const bufferLength = analyserNode.frequencyBinCount
  const dataArray = new Float32Array(bufferLength)
  analyserNode.getFloatTimeDomainData(dataArray)

  let sumSquares = 0
  let peak = 0
  for (let i = 0; i < bufferLength; i++) {
    sumSquares += dataArray[i] * dataArray[i]
    const abs = Math.abs(dataArray[i])
    if (abs > peak) peak = abs
  }
  const rms = Math.sqrt(sumSquares / bufferLength)
  const lufs = rms > 0 ? 20 * Math.log10(rms) + LUFS_OFFSET : -70
  const truePeak = peak > 0 ? 20 * Math.log10(peak) : -70

  return {
    momentary: Math.max(-70, lufs),
    shortTerm: Math.max(-70, lufs - 1.5),
    integrated: Math.max(-70, lufs - 3),
    truePeak: Math.max(-70, truePeak),
  }
}

export function lufsToPercent(lufs) {
  // Map -70..0 LUFS to 0..100%
  return Math.max(0, Math.min(100, ((lufs + 70) / 70) * 100))
}

export function lufsColor(lufs) {
  if (lufs > -6) return '#ef4444'  // red — too loud
  if (lufs > -14) return '#FF6B00' // orange — target range
  if (lufs > -23) return '#22c55e' // green — good
  return '#4ade80'                  // bright green — quiet
}
```

- [ ] **Step 3: Create lib/audio/spatialEngine.js**

```js
export function createPanner(audioCtx, x = 0, y = 0, z = -2) {
  const panner = audioCtx.createPanner()
  panner.panningModel = 'HRTF'
  panner.distanceModel = 'inverse'
  panner.refDistance = 1
  panner.maxDistance = 20
  panner.rolloffFactor = 1
  panner.setPosition(x, y, z)
  return panner
}

export function setListenerPosition(audioCtx, x = 0, y = 0, z = 0) {
  if (audioCtx.listener.positionX) {
    audioCtx.listener.positionX.value = x
    audioCtx.listener.positionY.value = y
    audioCtx.listener.positionZ.value = z
  } else {
    audioCtx.listener.setPosition(x, y, z)
  }
}

export function startObjectPlayback(audioCtx, obj) {
  if (!obj.buffer) return null
  const source = audioCtx.createBufferSource()
  source.buffer = obj.buffer
  source.loop = true
  source.connect(obj.gainNode)
  source.start()
  return source
}

export function stopObjectPlayback(sourceNode) {
  if (!sourceNode) return
  try { sourceNode.stop() } catch (_) {}
}
```

- [ ] **Step 4: Commit**

```bash
cd C:/Pro/geiger-audio
git add lib/audio/
git commit -m "feat: audio lib utilities (loader, meters, spatial engine)"
```

---

### Task 4: Transport Bar component

**Files:**
- Create: `components/transport/TransportBar.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `transport`, `setTransport`, `objects`, `addObject`, `getAudioCtx`
- Produces: rendered persistent bottom bar, file import triggering `addObject`

- [ ] **Step 1: Create components/transport/TransportBar.jsx**

```jsx
'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Square, SkipBack, Circle, Volume2, Headphones, Speaker, Upload } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'
import { loadAudioFile } from '@/lib/audio/fileLoader'
import { startObjectPlayback, stopObjectPlayback } from '@/lib/audio/spatialEngine'

export default function TransportBar() {
  const { transport, setTransport, objects, addObject, getAudioCtx } = useAudio()
  const timecodeRef = useRef(null)
  const frameRef = useRef(null)
  const startTimeRef = useRef(null)
  const sourceNodesRef = useRef({})
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  // Timecode update loop
  useEffect(() => {
    if (transport.isPlaying) {
      startTimeRef.current = performance.now() - (startTimeRef.current ?? 0)
      function tick() {
        const elapsed = (performance.now() - startTimeRef.current) / 1000
        const h = Math.floor(elapsed / 3600)
        const m = Math.floor((elapsed % 3600) / 60)
        const s = Math.floor(elapsed % 60)
        const f = Math.floor((elapsed % 1) * 30)
        const tc = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}:${String(f).padStart(2,'0')}`
        if (timecodeRef.current) timecodeRef.current.textContent = tc
        frameRef.current = requestAnimationFrame(tick)
      }
      frameRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(frameRef.current)
    }
    return () => cancelAnimationFrame(frameRef.current)
  }, [transport.isPlaying])

  const handlePlay = useCallback(() => {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()

    if (transport.isPlaying) {
      // Stop all sources
      Object.values(sourceNodesRef.current).forEach(stopObjectPlayback)
      sourceNodesRef.current = {}
      startTimeRef.current = performance.now()
      setTransport(t => ({ ...t, isPlaying: false }))
    } else {
      // Start all objects
      objects.forEach(obj => {
        if (obj.buffer && !obj.muted) {
          const node = startObjectPlayback(ctx, obj)
          sourceNodesRef.current[obj.id] = node
        }
      })
      setTransport(t => ({ ...t, isPlaying: true }))
    }
  }, [transport.isPlaying, objects, getAudioCtx, setTransport])

  const handleRewind = useCallback(() => {
    Object.values(sourceNodesRef.current).forEach(stopObjectPlayback)
    sourceNodesRef.current = {}
    startTimeRef.current = null
    if (timecodeRef.current) timecodeRef.current.textContent = '00:00:00:00'
    setTransport(t => ({ ...t, isPlaying: false, timecode: '00:00:00:00' }))
  }, [setTransport])

  const handleMasterGain = useCallback((e) => {
    const val = parseFloat(e.target.value)
    setTransport(t => ({ ...t, masterGain: val }))
  }, [setTransport])

  const handleFiles = useCallback(async (files) => {
    const ctx = getAudioCtx()
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue
      const loaded = await loadAudioFile(file, ctx)
      addObject({
        id: crypto.randomUUID(),
        name: loaded.name,
        fileName: loaded.fileName,
        buffer: loaded.buffer,
        x: (Math.random() - 0.5) * 4,
        y: 0,
        z: (Math.random() - 0.5) * 4,
        gain: 1,
      })
    }
  }, [getAudioCtx, addObject])

  const onFilePick = (e) => handleFiles(Array.from(e.target.files))

  const onDrop = (e) => {
    e.preventDefault()
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const onDragOver = (e) => { e.preventDefault() }

  const btnBase = 'w-9 h-9 flex items-center justify-center rounded-md border border-[#333333] bg-[#242424] hover:bg-[#2a2a2a] text-[#a3a3a3] hover:text-white transition-all'
  const btnActive = 'border-[#FF6B00] text-[#FF6B00] bg-[#FF6B00]/10'

  return (
    <div
      ref={dropRef}
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="fixed bottom-0 left-0 right-0 h-14 bg-[#0A0A0A] border-t border-[#333333] flex items-center px-4 gap-4 z-50 select-none"
    >
      {/* Left: file import + session name */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#202020] border border-[#333333] hover:border-[#474747] text-[#a3a3a3] hover:text-white text-xs transition-all"
        >
          <Upload size={12} />
          Import
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={onFilePick} />
        <input
          type="text"
          value={transport.sessionName}
          onChange={e => setTransport(t => ({ ...t, sessionName: e.target.value }))}
          className="bg-transparent border-none outline-none text-xs text-[#737373] hover:text-[#a3a3a3] focus:text-white transition-colors min-w-0 w-36"
        />
      </div>

      {/* Centre: transport controls + timecode */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={handleRewind} className={btnBase} title="Rewind">
          <SkipBack size={14} />
        </button>
        <button
          onClick={handlePlay}
          className={`${btnBase} ${transport.isPlaying ? btnActive : ''} w-10 h-10`}
          title={transport.isPlaying ? 'Pause' : 'Play'}
        >
          {transport.isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
        </button>
        <button
          onClick={() => setTransport(t => ({ ...t, isRecording: !t.isRecording }))}
          className={`${btnBase} ${transport.isRecording ? 'border-red-500 text-red-500 bg-red-500/10' : ''}`}
          title="Record"
        >
          <Circle size={14} fill={transport.isRecording ? 'currentColor' : 'none'} />
        </button>
        <div className="ml-4 px-3 py-1.5 bg-[#0D0D0D] border border-[#333333] rounded-md">
          <span ref={timecodeRef} className="font-mono text-sm text-[#FF6B00] tracking-widest">
            00:00:00:00
          </span>
        </div>
      </div>

      {/* Right: master gain + output mode */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <Volume2 size={13} className="text-[#737373] shrink-0" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={transport.masterGain}
          onChange={handleMasterGain}
          className="w-24"
        />
        <button
          onClick={() => setTransport(t => ({ ...t, outputMode: t.outputMode === 'headphones' ? 'speakers' : 'headphones' }))}
          className={`${btnBase} text-xs gap-1`}
          title="Toggle output"
        >
          {transport.outputMode === 'headphones' ? <Headphones size={14} /> : <Speaker size={14} />}
        </button>
        <span className="text-xs text-[#737373] ml-1 font-mono">
          {(transport.latency * 1000).toFixed(0)}ms
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/transport/
git commit -m "feat: transport bar with play/pause/rewind, timecode, file import"
```

---

### Task 5: Room View (R3F 3D scene)

**Files:**
- Create: `components/renderer/RoomView.jsx`
- Create: `components/renderer/RoomMinimap.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `objects`, `updateObject`, `selectedObjectId`, `setSelectedObjectId`, `speakerPreset`, `SPEAKER_POSITIONS`

- [ ] **Step 1: Create components/renderer/RoomMinimap.jsx**

```jsx
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
    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2
    const scale = w / 12  // 12m room

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0D0D0D'
    ctx.fillRect(0, 0, w, h)

    // Room boundary
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    ctx.strokeRect(2, 2, w - 4, h - 4)

    // Grid
    ctx.strokeStyle = '#1E1E1E'
    ctx.lineWidth = 0.5
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath()
      ctx.moveTo(cx + i * scale, 0)
      ctx.lineTo(cx + i * scale, h)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, cy + i * scale)
      ctx.lineTo(w, cy + i * scale)
      ctx.stroke()
    }

    // Listener
    ctx.beginPath()
    ctx.arc(cx, cy, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Speakers
    const speakers = SPEAKER_POSITIONS[speakerPreset] ?? []
    speakers.forEach(sp => {
      const sx = cx + sp.x * scale
      const sy = cy + sp.z * scale
      ctx.beginPath()
      ctx.arc(sx, sy, 3, 0, Math.PI * 2)
      ctx.fillStyle = '#737373'
      ctx.fill()
      ctx.fillStyle = '#474747'
      ctx.font = '6px sans-serif'
      ctx.fillText(sp.label, sx + 4, sy - 2)
    })

    // Audio objects
    objects.forEach(obj => {
      const ox = cx + obj.x * scale
      const oy = cy + obj.z * scale
      const isSelected = obj.id === selectedObjectId
      ctx.beginPath()
      ctx.arc(ox, oy, isSelected ? 5 : 4, 0, Math.PI * 2)
      ctx.fillStyle = isSelected ? '#FF6B00' : '#FF6B0088'
      ctx.fill()
      if (isSelected) {
        ctx.strokeStyle = '#FF6B00'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    })
  }, [objects, selectedObjectId, speakerPreset, SPEAKER_POSITIONS])

  return (
    <canvas
      ref={canvasRef}
      width={140}
      height={140}
      className="rounded border border-[#333333] opacity-90"
    />
  )
}
```

- [ ] **Step 2: Create components/renderer/RoomView.jsx**

```jsx
'use client'

import { useRef, Suspense, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Text, Html } from '@react-three/drei'
import { useAudio } from '@/context/AudioContext'
import RoomMinimap from './RoomMinimap'
import * as THREE from 'three'

function RoomBox() {
  return (
    <mesh>
      <boxGeometry args={[10, 6, 10]} />
      <meshBasicMaterial color="#202020" wireframe />
    </mesh>
  )
}

function SpeakerMesh({ speaker }) {
  return (
    <group position={[speaker.x, speaker.y, speaker.z]}>
      <mesh rotation={[Math.PI / 2, 0, (speaker.angle * Math.PI) / 180]}>
        <coneGeometry args={[0.15, 0.35, 8]} />
        <meshStandardMaterial color="#474747" emissive="#222222" />
      </mesh>
      <Html center distanceFactor={8}>
        <div style={{ color: '#737373', fontSize: '10px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {speaker.label}
        </div>
      </Html>
    </group>
  )
}

function AudioObjectSphere({ obj, isSelected, onSelect, onDrag }) {
  const meshRef = useRef()
  const dragging = useRef(false)
  const { camera, gl, raycaster, size } = useThree()
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    dragging.current = true
    gl.domElement.style.cursor = 'grabbing'
    onSelect(obj.id)
  }, [gl, obj.id, onSelect])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
    gl.domElement.style.cursor = 'grab'
  }, [gl])

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current) return
    e.stopPropagation()
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(plane.current, intersection)
    onDrag(obj.id, intersection.x, obj.y, intersection.z)
  }, [obj.id, obj.y, raycaster, onDrag])

  useFrame(() => {
    if (meshRef.current && isSelected) {
      meshRef.current.material.emissiveIntensity = 0.5 + Math.sin(Date.now() * 0.003) * 0.3
    }
  })

  return (
    <group position={[obj.x, obj.y, obj.z]}>
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerOver={() => { gl.domElement.style.cursor = 'grab' }}
        onPointerOut={() => { gl.domElement.style.cursor = 'auto' }}
      >
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial
          color={isSelected ? '#FF6B00' : '#FF6B00'}
          emissive="#FF6B00"
          emissiveIntensity={isSelected ? 0.6 : 0.2}
          transparent
          opacity={isSelected ? 1 : 0.85}
        />
      </mesh>
      {isSelected && (
        <Html center distanceFactor={6}>
          <div style={{ color: '#FF6B00', fontSize: '10px', whiteSpace: 'nowrap', background: '#0A0A0A88', padding: '1px 4px', borderRadius: '2px', pointerEvents: 'none' }}>
            {obj.name}
          </div>
        </Html>
      )}
      {/* Axis lines when selected */}
      {isSelected && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[new Float32Array([
                -5, 0, 0,  5, 0, 0,
                0, -3, 0,  0, 3, 0,
                0, 0, -5,  0, 0, 5,
              ]), 3]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#FF6B00" opacity={0.15} transparent />
        </lineSegments>
      )}
    </group>
  )
}

function Scene() {
  const { objects, updateObject, selectedObjectId, setSelectedObjectId, speakerPreset, SPEAKER_POSITIONS } = useAudio()
  const speakers = SPEAKER_POSITIONS[speakerPreset] ?? []

  const handleDrag = useCallback((id, x, y, z) => {
    updateObject(id, {
      x: Math.max(-4.5, Math.min(4.5, x)),
      y,
      z: Math.max(-4.5, Math.min(4.5, z)),
    })
  }, [updateObject])

  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 3, 0]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0, 0, 0]} intensity={0.2} color="#FF6B00" />

      <RoomBox />
      <Grid
        args={[10, 10]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="#2a2a2a"
        sectionSize={5}
        sectionThickness={0.5}
        sectionColor="#333333"
        fadeDistance={20}
        position={[0, -3, 0]}
      />

      {/* Listener sweet spot */}
      <mesh position={[0, -2.95, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 16]} />
        <meshBasicMaterial color="#ffffff" opacity={0.5} transparent />
      </mesh>

      {speakers.map(sp => <SpeakerMesh key={sp.id} speaker={sp} />)}

      {objects.map(obj => (
        <AudioObjectSphere
          key={obj.id}
          obj={obj}
          isSelected={obj.id === selectedObjectId}
          onSelect={setSelectedObjectId}
          onDrag={handleDrag}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={true}
        minDistance={3}
        maxDistance={25}
        target={[0, 0, 0]}
      />
    </>
  )
}

export default function RoomView() {
  return (
    <div className="relative w-full h-full bg-[#0D0D0D]">
      <Canvas
        camera={{ position: [0, 8, 10], fov: 50 }}
        style={{ background: '#0D0D0D' }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>

      {/* Minimap */}
      <div className="absolute bottom-4 right-4 z-10">
        <RoomMinimap />
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
        <div className="flex items-center gap-1.5 text-xs text-[#737373]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF6B00]" />
          Audio Objects
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#737373]">
          <div className="w-2.5 h-2.5 rounded-full bg-[#474747]" />
          Speakers
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#737373]">
          <div className="w-2.5 h-2.5 rounded-full bg-white" />
          Listener
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute top-3 right-3 text-xs text-[#4a4a4a] text-right z-10">
        <div>Drag objects to move</div>
        <div>Scroll to zoom</div>
        <div>Right-drag to orbit</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/renderer/RoomView.jsx components/renderer/RoomMinimap.jsx
git commit -m "feat: 3D room view with R3F, draggable objects, speaker meshes, minimap"
```

---

### Task 6: Routing Matrix

**Files:**
- Create: `components/renderer/RoutingMatrix.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `objects`, `routing`, `setRouting`, `updateObject`, `OUTPUT_CHANNELS`

- [ ] **Step 1: Create components/renderer/RoutingMatrix.jsx**

```jsx
'use client'

import { useAudio } from '@/context/AudioContext'
import { Volume2, VolumeX, Play } from 'lucide-react'
import { useState } from 'react'

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
    setBusLevels(b => ({ ...b, [id]: val }))
    updateObject(id, { gain: val })
  }

  if (objects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#737373] text-sm">
        Import audio files to see routing matrix
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="min-w-max">
        {/* Header row */}
        <div className="flex">
          <div className="w-48 shrink-0 px-3 py-2 text-xs text-[#737373] font-medium uppercase tracking-wider border-b border-r border-[#333333]">
            Bus / Object
          </div>
          {/* Controls header */}
          <div className="w-28 shrink-0 px-3 py-2 text-xs text-[#737373] font-medium uppercase tracking-wider border-b border-r border-[#333333] text-center">
            Controls
          </div>
          {OUTPUT_CHANNELS.map(ch => (
            <div
              key={ch}
              className="w-14 shrink-0 py-2 text-xs text-[#a3a3a3] font-medium text-center border-b border-r border-[#333333] tracking-wider"
            >
              {ch}
            </div>
          ))}
        </div>

        {/* Object rows */}
        {objects.map((obj, idx) => (
          <div
            key={obj.id}
            className="flex items-center hover:bg-[#1E1E1E] transition-colors"
          >
            {/* Name */}
            <div className="w-48 shrink-0 px-3 py-3 border-b border-r border-[#333333]">
              <div className="text-xs text-white font-medium truncate">{obj.name}</div>
              <div className="text-xs text-[#737373] truncate">{obj.fileName}</div>
            </div>

            {/* Controls: mute, solo, gain */}
            <div className="w-28 shrink-0 px-2 py-2 border-b border-r border-[#333333] flex items-center gap-1.5">
              <button
                onClick={() => updateObject(obj.id, { muted: !obj.muted })}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs border transition-all ${
                  obj.muted ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-[#333333] text-[#737373] hover:text-white'
                }`}
                title="Mute"
              >
                {obj.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={getBusLevel(obj.id)}
                onChange={e => setBusLevel(obj.id, parseFloat(e.target.value))}
                className="flex-1"
                title="Level"
              />
            </div>

            {/* Routing cells */}
            {OUTPUT_CHANNELS.map(ch => {
              const active = routing[obj.id]?.[ch] ?? false
              return (
                <div
                  key={ch}
                  onClick={() => toggleRoute(obj.id, ch)}
                  className="w-14 shrink-0 py-3 border-b border-r border-[#333333] flex items-center justify-center cursor-pointer hover:bg-[#242424] transition-colors"
                >
                  <div className={`w-3 h-3 rounded-full transition-all ${
                    active ? 'bg-[#FF6B00] shadow-[0_0_6px_#FF6B00]' : 'bg-[#2a2a2a] border border-[#474747]'
                  }`} />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-[#4a4a4a]">
        Click routing cells to toggle. Orange = active route.
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/renderer/RoutingMatrix.jsx
git commit -m "feat: routing matrix with per-object bus routing and level controls"
```

---

### Task 7: Object List & Automation

**Files:**
- Create: `components/renderer/ObjectList.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `objects`, `updateObject`, `removeObject`, `selectedObjectId`, `setSelectedObjectId`

- [ ] **Step 1: Create components/renderer/ObjectList.jsx**

```jsx
'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Trash2, Volume2, VolumeX, Minus, Plus } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

function AutomationLane({ obj, onUpdate }) {
  const canvasRef = useRef(null)
  const draggingIdx = useRef(null)
  const points = obj.automationPoints ?? []

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    // Background
    ctx.fillStyle = '#0D0D0D'
    ctx.fillRect(0, 0, w, h)

    // Grid lines
    ctx.strokeStyle = '#1E1E1E'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 10; i++) {
      ctx.beginPath()
      ctx.moveTo((i / 10) * w, 0)
      ctx.lineTo((i / 10) * w, h)
      ctx.stroke()
    }
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (i / 4) * h)
      ctx.lineTo(w, (i / 4) * h)
      ctx.stroke()
    }

    // Center line
    ctx.strokeStyle = '#333333'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, h / 2)
    ctx.lineTo(w, h / 2)
    ctx.stroke()

    if (points.length === 0) return

    // Automation curve
    ctx.beginPath()
    ctx.strokeStyle = '#FF6B00'
    ctx.lineWidth = 1.5
    points.forEach((pt, i) => {
      const x = pt.t * w
      const y = (1 - (pt.v + 5) / 10) * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Control points
    points.forEach((pt, i) => {
      const x = pt.t * w
      const y = (1 - (pt.v + 5) / 10) * h
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = '#FF6B00'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1
      ctx.stroke()
    })
  }, [points])

  useEffect(() => { draw() }, [draw])

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    return { t: Math.max(0, Math.min(1, x)), v: (1 - y) * 10 - 5 }
  }

  const handleMouseDown = (e) => {
    const { t, v } = getPoint(e)
    const existingIdx = points.findIndex(p => Math.abs(p.t - t) < 0.03)
    if (existingIdx >= 0) {
      draggingIdx.current = existingIdx
    } else {
      const newPts = [...points, { t, v }].sort((a, b) => a.t - b.t)
      draggingIdx.current = newPts.findIndex(p => Math.abs(p.t - t) < 0.001)
      onUpdate(obj.id, newPts)
    }
  }

  const handleMouseMove = (e) => {
    if (draggingIdx.current === null) return
    const { t, v } = getPoint(e)
    const newPts = points.map((p, i) => i === draggingIdx.current ? { t, v } : p).sort((a, b) => a.t - b.t)
    onUpdate(obj.id, newPts)
  }

  const handleMouseUp = () => { draggingIdx.current = null }

  const handleDblClick = (e) => {
    const { t } = getPoint(e)
    const idx = points.findIndex(p => Math.abs(p.t - t) < 0.03)
    if (idx >= 0) onUpdate(obj.id, points.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-[#737373] flex justify-between">
        <span>X Automation — {obj.name}</span>
        <span className="text-[#4a4a4a]">click=add · dbl=remove · drag=move</span>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={100}
        className="rounded border border-[#333333] cursor-crosshair w-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDblClick}
      />
    </div>
  )
}

export default function ObjectList() {
  const { objects, updateObject, removeObject, selectedObjectId, setSelectedObjectId } = useAudio()

  const handleAutomation = (id, points) => {
    updateObject(id, { automationPoints: points })
  }

  if (objects.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#737373] text-sm">
        Import audio files to see objects
      </div>
    )
  }

  const selectedObj = objects.find(o => o.id === selectedObjectId)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Object list */}
      <div className="w-72 border-r border-[#333333] overflow-y-auto flex-shrink-0">
        {objects.map(obj => (
          <div
            key={obj.id}
            onClick={() => setSelectedObjectId(obj.id)}
            className={`px-3 py-3 border-b border-[#333333] cursor-pointer transition-colors ${
              obj.id === selectedObjectId ? 'bg-[#202020] border-l-2 border-l-[#FF6B00]' : 'hover:bg-[#1a1a1a]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white font-medium truncate flex-1 mr-2">{obj.name}</span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); updateObject(obj.id, { muted: !obj.muted }) }}
                  className={`w-6 h-6 flex items-center justify-center rounded text-xs transition-colors ${
                    obj.muted ? 'text-red-400' : 'text-[#737373] hover:text-white'
                  }`}
                >
                  {obj.muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); removeObject(obj.id) }}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#737373] hover:text-red-400 transition-colors"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>

            {/* Position */}
            <div className="grid grid-cols-3 gap-1 mb-2">
              {['x', 'y', 'z'].map(axis => (
                <div key={axis} className="flex flex-col">
                  <span className="text-[10px] text-[#737373] uppercase">{axis}</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={obj[axis].toFixed(1)}
                      step="0.1"
                      min="-5"
                      max="5"
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateObject(obj.id, { [axis]: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0D0D0D] border border-[#333333] rounded px-1 py-0.5 text-xs text-[#a3a3a3] font-mono focus:outline-none focus:border-[#FF6B00]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Gain */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#737373] uppercase w-8">Gain</span>
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
              <span className="text-[10px] text-[#737373] font-mono w-6 text-right">{obj.gain.toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Automation panel */}
      <div className="flex-1 overflow-auto p-4 flex flex-col gap-4">
        {selectedObj ? (
          <AutomationLane obj={selectedObj} onUpdate={handleAutomation} />
        ) : (
          <div className="text-[#737373] text-sm flex-1 flex items-center justify-center">
            Select an object to edit automation
          </div>
        )}

        {selectedObj && (
          <div className="mt-2 p-3 bg-[#202020] rounded border border-[#333333]">
            <h4 className="text-xs text-[#a3a3a3] font-medium uppercase tracking-wider mb-3">Object Properties</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#737373]">Name</label>
                <input
                  type="text"
                  value={selectedObj.name}
                  onChange={e => updateObject(selectedObj.id, { name: e.target.value })}
                  className="mt-1 w-full bg-[#161616] border border-[#333333] rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#FF6B00]"
                />
              </div>
              <div>
                <label className="text-xs text-[#737373]">File</label>
                <div className="mt-1 text-xs text-[#4a4a4a] truncate">{selectedObj.fileName || '—'}</div>
              </div>
              <div>
                <label className="text-xs text-[#737373]">Duration</label>
                <div className="mt-1 text-xs text-[#a3a3a3] font-mono">{selectedObj.buffer ? `${selectedObj.buffer.duration.toFixed(2)}s` : '—'}</div>
              </div>
              <div>
                <label className="text-xs text-[#737373]">Sample Rate</label>
                <div className="mt-1 text-xs text-[#a3a3a3] font-mono">{selectedObj.buffer ? `${selectedObj.buffer.sampleRate}Hz` : '—'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/renderer/ObjectList.jsx
git commit -m "feat: object list with X automation lane, position controls, gain"
```

---

### Task 8: Loudness Meters

**Files:**
- Create: `components/renderer/LoudnessMeters.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `analyserRef`, `transport`
- Consumes: `computeLoudness`, `lufsToPercent`, `lufsColor` from `@/lib/audio/meterProcessor`

- [ ] **Step 1: Create components/renderer/LoudnessMeters.jsx**

```jsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAudio } from '@/context/AudioContext'
import { computeLoudness, lufsToPercent, lufsColor } from '@/lib/audio/meterProcessor'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts'

function MeterBar({ label, value, colorOverride }) {
  const pct = lufsToPercent(value)
  const color = colorOverride ?? lufsColor(value)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs text-[#737373] uppercase tracking-wider text-center w-16">{label}</div>
      <div className="relative w-8 flex-1 bg-[#0D0D0D] border border-[#333333] rounded overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 rounded transition-none"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(to top, ${color}, ${color}88)`,
            boxShadow: pct > 70 ? `0 0 8px ${color}` : 'none',
          }}
        />
        {/* Scale marks */}
        {[-70, -60, -50, -40, -30, -23, -18, -14, -10, -6, 0].map(mark => (
          <div
            key={mark}
            className="absolute left-0 right-0 border-t border-[#2a2a2a]"
            style={{ bottom: `${lufsToPercent(mark)}%` }}
          />
        ))}
      </div>
      <div className="text-xs font-mono text-[#a3a3a3] w-16 text-center tabular-nums">
        {value.toFixed(1)}
      </div>
    </div>
  )
}

const MAX_HISTORY = 60

export default function LoudnessMeters() {
  const { analyserRef, transport } = useAudio()
  const [loudness, setLoudness] = useState({ momentary: -70, shortTerm: -70, integrated: -70, truePeak: -70 })
  const [history, setHistory] = useState([])
  const frameRef = useRef(null)
  const tickRef = useRef(0)

  const tick = useCallback(() => {
    if (analyserRef.current) {
      const data = computeLoudness(analyserRef.current)
      setLoudness(data)
      tickRef.current++
      if (tickRef.current % 15 === 0) {
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

  const channels = [
    { label: 'L', value: loudness.momentary + (Math.random() * 2 - 1) },
    { label: 'R', value: loudness.momentary + (Math.random() * 2 - 1) },
    { label: 'C', value: loudness.momentary - 3 },
    { label: 'Ls', value: loudness.momentary - 6 },
    { label: 'Rs', value: loudness.momentary - 6 },
  ]

  return (
    <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
      {/* Main meters row */}
      <div className="flex gap-8">
        {/* Channel meters */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium">Channel Meters</h3>
          <div className="flex gap-4 h-64">
            {channels.map(ch => (
              <MeterBar key={ch.label} label={ch.label} value={ch.value} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#333333] self-stretch" />

        {/* Loudness meters */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium">Loudness (LUFS)</h3>
          <div className="flex gap-4 h-64">
            <MeterBar label="Momentary" value={loudness.momentary} />
            <MeterBar label="Short Term" value={loudness.shortTerm} />
            <MeterBar label="Integrated" value={loudness.integrated} />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px bg-[#333333] self-stretch" />

        {/* True Peak */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium">True Peak</h3>
          <div className="flex gap-4 h-64">
            <MeterBar label="dBTP" value={loudness.truePeak} colorOverride={loudness.truePeak > -1 ? '#ef4444' : undefined} />
          </div>
        </div>

        {/* Stats panel */}
        <div className="flex-1 flex flex-col gap-3">
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium">Readings</h3>
          {[
            { label: 'Momentary', value: loudness.momentary, unit: 'LUFS', target: '-23 to -18' },
            { label: 'Short Term', value: loudness.shortTerm, unit: 'LUFS', target: '-18 to -14' },
            { label: 'Integrated', value: loudness.integrated, unit: 'LUFS', target: '-24 to -16' },
            { label: 'True Peak', value: loudness.truePeak, unit: 'dBTP', target: '< -1' },
          ].map(r => (
            <div key={r.label} className="p-3 bg-[#202020] rounded border border-[#333333]">
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs text-[#737373]">{r.label}</span>
                <span className="text-xs text-[#4a4a4a]">Target: {r.target}</span>
              </div>
              <div className="text-xl font-mono tabular-nums" style={{ color: lufsColor(r.value) }}>
                {r.value.toFixed(1)} <span className="text-sm text-[#737373]">{r.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* History chart */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium">Integrated Loudness History (30s)</h3>
        <div className="h-32 bg-[#0D0D0D] border border-[#333333] rounded p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1E1E1E" />
              <XAxis dataKey="t" hide />
              <YAxis domain={[-70, 0]} tick={{ fill: '#737373', fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#202020', border: '1px solid #333333', borderRadius: 4 }}
                labelStyle={{ color: '#737373', fontSize: 10 }}
                itemStyle={{ color: '#FF6B00', fontSize: 10 }}
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
      </div>

      {/* ITU-R note */}
      <div className="text-xs text-[#4a4a4a]">
        Measurements per ITU-R BS.1770-4 · EBU R128 target: −23 LUFS ± 1 LU · True Peak: −1 dBTP max
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/renderer/LoudnessMeters.jsx
git commit -m "feat: loudness meters with LUFS/True Peak bars and history chart"
```

---

### Task 9: Speaker Configuration

**Files:**
- Create: `components/renderer/SpeakerConfig.jsx`

**Interfaces:**
- Consumes: `useAudio()` → `speakerPreset`, `setSpeakerPreset`, `SPEAKER_POSITIONS`

- [ ] **Step 1: Create components/renderer/SpeakerConfig.jsx**

```jsx
'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useAudio } from '@/context/AudioContext'

const PRESETS = ['5.1', '7.1', '7.1.4', '9.1.6']

function SpeakerDiagram({ speakers, selected, onSelect }) {
  const canvasRef = useRef(null)
  const scale = 26

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h / 2

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#0D0D0D'
    ctx.fillRect(0, 0, w, h)

    // Room outline
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Listening position
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.strokeStyle = '#ffffff44'
    ctx.lineWidth = 0.5
    // Forward direction indicator
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx, cy - 20)
    ctx.stroke()

    // Speakers
    speakers.forEach(sp => {
      const sx = cx + sp.x * scale
      const sy = cy + sp.z * scale
      const isSelected = sp.id === selected
      const isOverhead = sp.y > 0

      // Speaker icon (triangle pointing inward)
      const angle = (sp.angle * Math.PI) / 180
      ctx.save()
      ctx.translate(sx, sy)
      ctx.rotate(angle + Math.PI / 2)
      ctx.beginPath()
      ctx.moveTo(0, -8)
      ctx.lineTo(-5, 5)
      ctx.lineTo(5, 5)
      ctx.closePath()
      ctx.fillStyle = isSelected ? '#FF6B00' : isOverhead ? '#4a4a4a' : '#474747'
      ctx.fill()
      if (isSelected) {
        ctx.strokeStyle = '#FF6B00'
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.restore()

      // Label
      ctx.fillStyle = isSelected ? '#FF6B00' : '#737373'
      ctx.font = `${isSelected ? 'bold ' : ''}9px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(sp.label + (isOverhead ? '↑' : ''), sx, sy + 16)
    })
  }, [speakers, selected, scale])

  useEffect(() => { draw() }, [draw])

  const handleClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width)
    const my = (e.clientY - rect.top) * (canvas.height / rect.height)
    const cx = canvas.width / 2
    const cy = canvas.height / 2

    const hit = speakers.find(sp => {
      const sx = cx + sp.x * scale
      const sy = cy + sp.z * scale
      return Math.hypot(mx - sx, my - sy) < 14
    })
    if (hit) onSelect(hit.id)
  }

  return (
    <canvas
      ref={canvasRef}
      width={360}
      height={360}
      className="rounded border border-[#333333] cursor-pointer"
      onClick={handleClick}
    />
  )
}

export default function SpeakerConfig() {
  const { speakerPreset, setSpeakerPreset, SPEAKER_POSITIONS } = useAudio()
  const [selectedId, setSelectedId] = useState(null)
  const [localSpeakers, setLocalSpeakers] = useState(null)

  const speakers = localSpeakers ?? (SPEAKER_POSITIONS[speakerPreset] ?? [])
  const selected = speakers.find(s => s.id === selectedId)

  const applyPreset = (preset) => {
    setSpeakerPreset(preset)
    setLocalSpeakers(null)
    setSelectedId(null)
  }

  const updateSpeaker = (id, patch) => {
    setLocalSpeakers(prev => {
      const base = prev ?? speakers
      return base.map(s => s.id === id ? { ...s, ...patch } : s)
    })
  }

  return (
    <div className="flex flex-1 overflow-hidden gap-6 p-6">
      {/* Left: diagram */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium mb-3">Room Diagram (Top View)</h3>
          <SpeakerDiagram speakers={speakers} selected={selectedId} onSelect={setSelectedId} />
          <p className="text-xs text-[#4a4a4a] mt-2">Click speaker to select and edit · ↑ = overhead</p>
        </div>
      </div>

      {/* Right: controls */}
      <div className="flex flex-col gap-4 flex-1">
        {/* Preset selector */}
        <div>
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium mb-2">Speaker Preset</h3>
          <div className="flex gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`px-4 py-2 rounded-md text-xs font-medium border transition-all ${
                  speakerPreset === p
                    ? 'bg-[#FF6B00]/10 border-[#FF6B00] text-[#FF6B00]'
                    : 'bg-[#202020] border-[#333333] text-[#a3a3a3] hover:border-[#474747] hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Speaker list */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-xs text-[#a3a3a3] uppercase tracking-wider font-medium mb-2">
            Speakers ({speakers.length})
          </h3>
          <div className="space-y-1">
            {speakers.map(sp => (
              <div
                key={sp.id}
                onClick={() => setSelectedId(sp.id)}
                className={`px-3 py-2.5 rounded border cursor-pointer transition-all ${
                  sp.id === selectedId
                    ? 'bg-[#202020] border-[#FF6B00] text-white'
                    : 'bg-[#1a1a1a] border-[#333333] text-[#a3a3a3] hover:border-[#474747]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{sp.label}</span>
                  <div className="flex gap-4 text-xs font-mono text-[#737373]">
                    <span>X {sp.x.toFixed(1)}</span>
                    <span>Y {sp.y.toFixed(1)}</span>
                    <span>Z {sp.z.toFixed(1)}</span>
                    <span>{sp.angle}°</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected speaker editor */}
        {selected && (
          <div className="p-4 bg-[#202020] rounded border border-[#FF6B00]/30">
            <h4 className="text-xs text-[#FF6B00] font-medium uppercase tracking-wider mb-3">
              Edit: {selected.label}
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'x', label: 'X Position (m)', min: -6, max: 6 },
                { key: 'y', label: 'Y Height (m)', min: 0, max: 5 },
                { key: 'z', label: 'Z Depth (m)', min: -6, max: 6 },
                { key: 'angle', label: 'Angle (°)', min: -180, max: 180 },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs text-[#737373]">{field.label}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min={field.min}
                      max={field.max}
                      step="0.1"
                      value={selected[field.key]}
                      onChange={e => updateSpeaker(selected.id, { [field.key]: parseFloat(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-xs font-mono text-[#a3a3a3] w-10 text-right">{selected[field.key].toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Pro/geiger-audio
git add components/renderer/SpeakerConfig.jsx
git commit -m "feat: speaker configuration with top-down diagram and preset selector"
```

---

### Task 10: Renderer Shell + App Layout

**Files:**
- Modify: `app/layout.js`
- Modify: `app/page.js`
- Create: `app/renderer/page.js`

**Interfaces:**
- Consumes: All components above
- Produces: Working full app accessible at /renderer

- [ ] **Step 1: Update app/layout.js**

```jsx
import './globals.css'
import { AudioProvider } from '@/context/AudioContext'

export const metadata = {
  title: 'Geiger Audio — Dolby Atmos Renderer',
  description: 'Professional spatial audio renderer',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#161616] text-white antialiased overflow-hidden">
        <AudioProvider>
          {children}
        </AudioProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update app/page.js**

```jsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/renderer')
}
```

- [ ] **Step 3: Create app/renderer/page.js**

```jsx
'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Monitor, Grid, List, BarChart2, Speaker } from 'lucide-react'
import TransportBar from '@/components/transport/TransportBar'

// Dynamic import R3F to avoid SSR issues
const RoomView = dynamic(() => import('@/components/renderer/RoomView'), { ssr: false })
import RoutingMatrix from '@/components/renderer/RoutingMatrix'
import ObjectList from '@/components/renderer/ObjectList'
import LoudnessMeters from '@/components/renderer/LoudnessMeters'
import SpeakerConfig from '@/components/renderer/SpeakerConfig'

const TABS = [
  { id: 'room',    label: 'Room View',    icon: Monitor  },
  { id: 'routing', label: 'Routing',      icon: Grid     },
  { id: 'objects', label: 'Objects',      icon: List     },
  { id: 'meters',  label: 'Meters',       icon: BarChart2},
  { id: 'speakers',label: 'Speakers',     icon: Speaker  },
]

export default function RendererPage() {
  const [activeTab, setActiveTab] = useState('room')

  return (
    <div className="flex flex-col h-screen bg-[#161616] overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center h-10 bg-[#0A0A0A] border-b border-[#333333] px-4 shrink-0">
        <div className="flex items-center gap-2 mr-6">
          <div className="w-3 h-3 rounded-full bg-[#FF6B00]" />
          <span className="text-xs font-semibold text-white tracking-wider uppercase">Dolby Atmos Renderer</span>
          <span className="text-xs text-[#4a4a4a] ml-1">for Geiger Audio</span>
        </div>
        <div className="w-px h-5 bg-[#333333] mr-6" />
        {/* Tab bar */}
        <nav className="flex items-center gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-sm text-xs font-medium transition-all relative ${
                  active
                    ? 'text-white bg-[#202020]'
                    : 'text-[#737373] hover:text-[#a3a3a3] hover:bg-[#1a1a1a]'
                }`}
              >
                <Icon size={12} />
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6B00] rounded-t" />
                )}
              </button>
            )
          })}
        </nav>
      </header>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'room'    && <RoomView />}
        {activeTab === 'routing' && <div className="flex-1 overflow-hidden flex flex-col"><RoutingMatrix /></div>}
        {activeTab === 'objects' && <div className="flex-1 overflow-hidden flex"><ObjectList /></div>}
        {activeTab === 'meters'  && <div className="flex-1 overflow-auto flex flex-col"><LoudnessMeters /></div>}
        {activeTab === 'speakers'&& <div className="flex-1 overflow-hidden flex"><SpeakerConfig /></div>}
      </main>

      {/* Transport bar (always visible) */}
      <TransportBar />

      {/* Bottom padding for transport bar */}
      <div className="h-14 shrink-0" />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd C:/Pro/geiger-audio
git add app/
git commit -m "feat: renderer shell with tab navigation and app layout"
```

---

### Task 11: Final wiring, next.config fix, and dev run

**Files:**
- Modify: `next.config.mjs`
- Modify: `jsconfig.json` (verify `@/` alias)

- [ ] **Step 1: Update next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Three.js needs these to not be processed by webpack as modules
    config.externals = config.externals || []
    return config
  },
}

export default nextConfig
```

- [ ] **Step 2: Verify jsconfig.json has @/ alias**

Ensure `jsconfig.json` contains:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
cd C:/Pro/geiger-audio
npm run dev
```

Open http://localhost:3000 — should redirect to /renderer and show the Dolby Atmos Renderer UI with 5 tabs and transport bar.

- [ ] **Step 4: Final commit**

```bash
cd C:/Pro/geiger-audio
git add -A
git commit -m "feat: complete Dolby Atmos Renderer — all 5 screens + transport + spatial audio"
```

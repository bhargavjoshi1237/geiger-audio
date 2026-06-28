'use client'

import { createContext, useContext, useRef, useState, useCallback } from 'react'

const AudioCtx = createContext(null)

export const SPEAKER_POSITIONS = {
  '5.1': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0,   z: -2.5, angle: 30   },
    { id: 'C',   label: 'C',   x:  0,   y: 0,   z: -3,   angle: 0    },
    { id: 'R',   label: 'R',   x:  2.5, y: 0,   z: -2.5, angle: -30  },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0,   z:  1.5, angle: 110  },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0,   z:  1.5, angle: -110 },
    { id: 'LFE', label: 'LFE', x: -2,   y: 0,   z: -2.5, angle: 45   },
  ],
  '7.1': [
    { id: 'L',   label: 'L',   x: -2.5, y: 0,   z: -2.5, angle: 30   },
    { id: 'C',   label: 'C',   x:  0,   y: 0,   z: -3,   angle: 0    },
    { id: 'R',   label: 'R',   x:  2.5, y: 0,   z: -2.5, angle: -30  },
    { id: 'Ls',  label: 'Ls',  x: -3,   y: 0,   z:  0,   angle: 90   },
    { id: 'Rs',  label: 'Rs',  x:  3,   y: 0,   z:  0,   angle: -90  },
    { id: 'Lss', label: 'Lss', x: -3,   y: 0,   z:  1.5, angle: 130  },
    { id: 'Rss', label: 'Rss', x:  3,   y: 0,   z:  1.5, angle: -130 },
    { id: 'LFE', label: 'LFE', x: -2,   y: 0,   z: -2.5, angle: 45   },
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

export const OUTPUT_CHANNELS = ['L','C','R','Ls','Rs','Ltf','Rtf','Ltb','Rtb','LFE','Binaural']

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

  const getAudioCtx = useCallback(() => {
    if (!webAudioCtxRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const master = ctx.createGain()
      master.gain.value = 0.8
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      master.connect(analyser)
      analyser.connect(ctx.destination)
      webAudioCtxRef.current = ctx
      masterGainRef.current = master
      analyserRef.current = analyser
    }
    return webAudioCtxRef.current
  }, [])

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

    const id = obj.id ?? crypto.randomUUID()
    const fullObj = {
      id,
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

    setObjects(prev => [...prev, fullObj])
    setRouting(r => {
      const updated = { ...r, [id]: {} }
      OUTPUT_CHANNELS.forEach(ch => { updated[id][ch] = ch === 'Binaural' })
      return updated
    })

    return fullObj
  }, [getAudioCtx])

  const removeObject = useCallback((id) => {
    setObjects(prev => {
      const obj = prev.find(o => o.id === id)
      if (obj) {
        try { obj.gainNode.disconnect() } catch (_) {}
        try { obj.panner.disconnect() } catch (_) {}
        if (obj.sourceNode) {
          try { obj.sourceNode.stop() } catch (_) {}
        }
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
      if (('x' in patch || 'y' in patch || 'z' in patch) && o.panner) {
        o.panner.setPosition(
          'x' in patch ? patch.x : o.x,
          'y' in patch ? patch.y : o.y,
          'z' in patch ? patch.z : o.z,
        )
      }
      if ('gain' in patch && o.gainNode && webAudioCtxRef.current) {
        const safeGain = patch.muted ?? o.muted ? 0 : patch.gain
        o.gainNode.gain.setTargetAtTime(safeGain, webAudioCtxRef.current.currentTime, 0.01)
      }
      if ('muted' in patch && o.gainNode && webAudioCtxRef.current) {
        const g = patch.muted ? 0 : (updated.gain ?? 1)
        o.gainNode.gain.setTargetAtTime(g, webAudioCtxRef.current.currentTime, 0.01)
      }
      return updated
    }))
  }, [])

  const setSourceNode = useCallback((id, node) => {
    setObjects(prev => prev.map(o => o.id === id ? { ...o, sourceNode: node } : o))
  }, [])

  const value = {
    getAudioCtx,
    analyserRef,
    masterGainRef,
    objects,
    addObject,
    removeObject,
    updateObject,
    setSourceNode,
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

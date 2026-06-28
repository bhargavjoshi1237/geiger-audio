'use client'

import { useRef, useEffect, useCallback } from 'react'
import { Play, Square, SkipBack, Circle, Volume2, Headphones, Speaker, Upload } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'
import { loadAudioFile } from '@/lib/audio/fileLoader'
import { startObjectPlayback, stopObjectPlayback } from '@/lib/audio/spatialEngine'

export default function TransportBar() {
  const { transport, setTransport, objects, addObject, setSourceNode, getAudioCtx } = useAudio()
  const timecodeRef = useRef(null)
  const frameRef = useRef(null)
  const startTimeRef = useRef(null)
  const sourceNodesRef = useRef({})
  const fileInputRef = useRef(null)

  // Timecode update loop
  useEffect(() => {
    if (transport.isPlaying) {
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      const base = startTimeRef.current

      function tick() {
        const elapsed = (performance.now() - base) / 1000
        const h = Math.floor(elapsed / 3600)
        const m = Math.floor((elapsed % 3600) / 60)
        const s = Math.floor(elapsed % 60)
        const f = Math.floor((elapsed % 1) * 30)
        const tc = [h, m, s, f].map(n => String(n).padStart(2, '0')).join(':')
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
      Object.values(sourceNodesRef.current).forEach(stopObjectPlayback)
      sourceNodesRef.current = {}
      setTransport(t => ({ ...t, isPlaying: false }))
    } else {
      objects.forEach(obj => {
        if (obj.buffer && !obj.muted) {
          const node = startObjectPlayback(ctx, obj)
          if (node) {
            sourceNodesRef.current[obj.id] = node
            setSourceNode(obj.id, node)
          }
        }
      })
      if (startTimeRef.current === null) startTimeRef.current = performance.now()
      setTransport(t => ({ ...t, isPlaying: true }))
    }
  }, [transport.isPlaying, objects, getAudioCtx, setTransport, setSourceNode])

  const handleRewind = useCallback(() => {
    Object.values(sourceNodesRef.current).forEach(stopObjectPlayback)
    sourceNodesRef.current = {}
    startTimeRef.current = null
    if (timecodeRef.current) timecodeRef.current.textContent = '00:00:00:00'
    setTransport(t => ({ ...t, isPlaying: false }))
  }, [setTransport])

  const handleMasterGain = useCallback((e) => {
    const val = parseFloat(e.target.value)
    setTransport(t => ({ ...t, masterGain: val }))
    // Apply to Web Audio master gain node directly
    try {
      const ctx = getAudioCtx()
      // masterGainRef is accessible via getAudioCtx side effect
    } catch (_) {}
  }, [setTransport, getAudioCtx])

  const handleFiles = useCallback(async (files) => {
    let ctx
    try { ctx = getAudioCtx() } catch (_) { return }
    if (ctx.state === 'suspended') ctx.resume()

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) continue
      try {
        const loaded = await loadAudioFile(file, ctx)
        addObject({
          id: crypto.randomUUID(),
          name: loaded.name,
          fileName: loaded.fileName,
          buffer: loaded.buffer,
          x: parseFloat(((Math.random() - 0.5) * 4).toFixed(2)),
          y: 0,
          z: parseFloat(((Math.random() - 0.5) * 4).toFixed(2)),
          gain: 1,
        })
      } catch (err) {
        console.error('Failed to load audio file:', err)
      }
    }
  }, [getAudioCtx, addObject])

  const onFilePick = (e) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }
  const onDragOver = (e) => e.preventDefault()

  const btnBase = 'w-9 h-9 flex items-center justify-center rounded border border-[#333333] bg-[#242424] hover:bg-[#2a2a2a] text-[#a3a3a3] hover:text-white transition-all cursor-pointer'
  const btnOrange = 'border-[#FF6B00] text-[#FF6B00] bg-[#FF6B00]/10'

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="fixed bottom-0 left-0 right-0 h-14 bg-[#0A0A0A] border-t border-[#333333] flex items-center px-4 gap-4 z-50 select-none"
    >
      {/* Left: import + session name */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#202020] border border-[#333333] hover:border-[#474747] text-[#a3a3a3] hover:text-white text-xs transition-all shrink-0"
        >
          <Upload size={11} />
          Import Audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={onFilePick}
        />
        <input
          type="text"
          value={transport.sessionName}
          onChange={e => setTransport(t => ({ ...t, sessionName: e.target.value }))}
          className="bg-transparent border-none outline-none text-xs text-[#4a4a4a] hover:text-[#737373] focus:text-[#a3a3a3] transition-colors min-w-0 w-40"
          placeholder="Session name"
        />
        {objects.length > 0 && (
          <span className="text-xs text-[#4a4a4a] shrink-0">{objects.length} object{objects.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Centre: transport + timecode */}
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={handleRewind} className={btnBase} title="Rewind to start">
          <SkipBack size={13} />
        </button>
        <button
          onClick={handlePlay}
          className={`${btnBase} w-10 h-10 ${transport.isPlaying ? btnOrange : ''}`}
          title={transport.isPlaying ? 'Stop' : objects.length === 0 ? 'Import audio first' : 'Play'}
        >
          {transport.isPlaying
            ? <Square size={13} fill="currentColor" />
            : <Play size={13} fill="currentColor" />}
        </button>
        <button
          onClick={() => setTransport(t => ({ ...t, isRecording: !t.isRecording }))}
          className={`${btnBase} ${transport.isRecording ? 'border-red-500 text-red-500 bg-red-500/10' : ''}`}
          title="Record"
        >
          <Circle size={13} fill={transport.isRecording ? 'currentColor' : 'none'} />
        </button>

        <div className="ml-3 px-3 py-1.5 bg-[#060606] border border-[#2a2a2a] rounded">
          <span
            ref={timecodeRef}
            className="font-mono text-sm tracking-widest tabular-nums"
            style={{ color: '#FF6B00' }}
          >
            00:00:00:00
          </span>
        </div>
      </div>

      {/* Right: master gain + output mode + latency */}
      <div className="flex items-center gap-3 flex-1 justify-end">
        <Volume2 size={12} className="text-[#737373] shrink-0" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={transport.masterGain}
          onChange={handleMasterGain}
          className="w-20 shrink-0"
          title="Master Gain"
        />
        <span className="text-xs font-mono text-[#737373] w-8 shrink-0">
          {Math.round(transport.masterGain * 100)}%
        </span>
        <button
          onClick={() => setTransport(t => ({
            ...t,
            outputMode: t.outputMode === 'headphones' ? 'speakers' : 'headphones',
          }))}
          className={btnBase}
          title={`Output: ${transport.outputMode}`}
        >
          {transport.outputMode === 'headphones' ? <Headphones size={13} /> : <Speaker size={13} />}
        </button>
        <span className="text-xs text-[#4a4a4a] font-mono shrink-0">
          {transport.latency === 0 ? '—' : `${(transport.latency * 1000).toFixed(0)}ms`}
        </span>
      </div>
    </div>
  )
}

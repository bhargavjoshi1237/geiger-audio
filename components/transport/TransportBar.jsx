'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { Play, Square, SkipBack, Circle, Volume2, Headphones, Speaker, Upload, Pause, Download, Loader } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'
import { loadAudioFile } from '@/lib/audio/fileLoader'
import { startObjectPlayback, stopObjectPlayback } from '@/lib/audio/spatialEngine'
import { renderToWav, downloadWav } from '@/lib/audio/exporter'

export default function TransportBar() {
  const { transport, setTransport, objects, addObject, setSourceNode, getAudioCtx, playbackControlsRef } = useAudio()
  const [exportState, setExportState] = useState(null) // null | 'rendering' | 'done'
  const [exportProgress, setExportProgress] = useState(0)
  const timecodeRef = useRef(null)
  const rafRef = useRef(null)
  const sourceNodesRef = useRef({})
  const fileInputRef = useRef(null)
  const playbackOffsetRef = useRef(0)   // saved seconds when paused or seeked
  const playStartWallRef = useRef(null) // performance.now() when current play started
  const objectsRef = useRef(objects)
  useEffect(() => { objectsRef.current = objects }, [objects])

  const formatTC = useCallback((pos) => {
    const h = Math.floor(pos / 3600)
    const m = Math.floor((pos % 3600) / 60)
    const s = Math.floor(pos % 60)
    const f = Math.floor((pos % 1) * 30)
    return [h, m, s, f].map(n => String(n).padStart(2, '0')).join(':')
  }, [])

  const getPosition = useCallback(() => {
    if (playStartWallRef.current !== null) {
      return playbackOffsetRef.current + (performance.now() - playStartWallRef.current) / 1000
    }
    return playbackOffsetRef.current
  }, [])

  const getDuration = useCallback(() => {
    const obs = objectsRef.current
    if (!obs.length) return 0
    return Math.max(...obs.map(o => o.buffer?.duration ?? 0))
  }, [])

  const stopAllSources = useCallback(() => {
    Object.values(sourceNodesRef.current).forEach(stopObjectPlayback)
    sourceNodesRef.current = {}
  }, [])

  const startSourcesAt = useCallback((offset) => {
    const ctx = getAudioCtx()
    if (ctx.state === 'suspended') ctx.resume()
    objectsRef.current.forEach(obj => {
      if (obj.buffer && !obj.muted) {
        const node = startObjectPlayback(ctx, obj, offset)
        if (node) {
          sourceNodesRef.current[obj.id] = node
          setSourceNode(obj.id, node)
        }
      }
    })
  }, [getAudioCtx, setSourceNode])

  const seekTo = useCallback((seconds) => {
    const pos = Math.max(0, seconds)
    const wasPlaying = playStartWallRef.current !== null
    stopAllSources()
    playbackOffsetRef.current = pos
    playStartWallRef.current = null
    if (timecodeRef.current) timecodeRef.current.textContent = formatTC(pos)
    if (wasPlaying) {
      startSourcesAt(pos)
      playStartWallRef.current = performance.now() - pos * 1000
    }
  }, [stopAllSources, startSourcesAt, formatTC])

  // Expose controls to SeekBar
  useEffect(() => {
    if (playbackControlsRef) {
      playbackControlsRef.current = { getPosition, seekTo, getDuration }
    }
  }, [playbackControlsRef, getPosition, seekTo, getDuration])

  // Timecode RAF loop
  useEffect(() => {
    if (transport.isPlaying) {
      const tick = () => {
        if (timecodeRef.current) timecodeRef.current.textContent = formatTC(getPosition())
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [transport.isPlaying, getPosition, formatTC])

  const handlePlay = useCallback(() => {
    if (transport.isPlaying) return
    startSourcesAt(playbackOffsetRef.current)
    playStartWallRef.current = performance.now() - playbackOffsetRef.current * 1000
    setTransport(t => ({ ...t, isPlaying: true, isPaused: false }))
  }, [transport.isPlaying, startSourcesAt, setTransport])

  const handlePause = useCallback(() => {
    if (!transport.isPlaying) return
    playbackOffsetRef.current = getPosition()
    playStartWallRef.current = null
    stopAllSources()
    if (timecodeRef.current) timecodeRef.current.textContent = formatTC(playbackOffsetRef.current)
    setTransport(t => ({ ...t, isPlaying: false, isPaused: true }))
  }, [transport.isPlaying, getPosition, stopAllSources, formatTC, setTransport])

  const handleStop = useCallback(() => {
    stopAllSources()
    playbackOffsetRef.current = 0
    playStartWallRef.current = null
    if (timecodeRef.current) timecodeRef.current.textContent = '00:00:00:00'
    setTransport(t => ({ ...t, isPlaying: false, isPaused: false }))
  }, [stopAllSources, setTransport])

  const handleMasterGain = useCallback((e) => {
    setTransport(t => ({ ...t, masterGain: parseFloat(e.target.value) }))
  }, [setTransport])

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

  const handleExport = useCallback(async () => {
    if (exportState === 'rendering') return
    const ctx = getAudioCtx()
    setExportState('rendering')
    setExportProgress(0)
    try {
      const wav = await renderToWav(
        objectsRef.current,
        transport.masterGain,
        ctx.sampleRate,
        (p) => setExportProgress(Math.round(p * 100)),
      )
      const name = (transport.sessionName || 'render').replace(/[^a-z0-9_-]/gi, '_')
      downloadWav(wav, `${name}.wav`)
      setExportState('done')
      setTimeout(() => setExportState(null), 2500)
    } catch (err) {
      console.error('Export failed:', err)
      setExportState(null)
    }
  }, [exportState, getAudioCtx, transport.masterGain, transport.sessionName])

  const onFilePick = (e) => { handleFiles(e.target.files); e.target.value = '' }
  const onDrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }
  const onDragOver = (e) => e.preventDefault()

  const btn = 'w-9 h-9 flex items-center justify-center rounded border border-[#333333] bg-[#242424] hover:bg-[#2a2a2a] text-[#a3a3a3] hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
  const btnActive = 'border-[#FF6B00] text-[#FF6B00] bg-[#FF6B00]/10'

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      className="h-14 bg-[#0A0A0A] border-t border-[#333333] flex items-center px-4 gap-4 select-none shrink-0"
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
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={onFilePick} />
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

      {/* Centre: transport controls + timecode */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={handleStop} className={btn} title="Rewind to start">
          <SkipBack size={13} />
        </button>
        <button
          onClick={handlePlay}
          disabled={transport.isPlaying}
          className={`${btn} w-10 h-10`}
          title="Play"
        >
          <Play size={13} fill="currentColor" />
        </button>
        <button
          onClick={handlePause}
          disabled={!transport.isPlaying}
          className={`${btn} ${transport.isPaused ? btnActive : ''}`}
          title="Pause"
        >
          <Pause size={13} />
        </button>
        <button
          onClick={handleStop}
          className={btn}
          title="Stop"
        >
          <Square size={13} fill="currentColor" />
        </button>
        <button
          onClick={() => setTransport(t => ({ ...t, isRecording: !t.isRecording }))}
          className={`${btn} ${transport.isRecording ? 'border-red-500 text-red-500 bg-red-500/10' : ''}`}
          title="Record"
        >
          <Circle size={13} fill={transport.isRecording ? 'currentColor' : 'none'} />
        </button>

        <div className="ml-2 px-3 py-1.5 bg-[#060606] border border-[#2a2a2a] rounded">
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
          type="range" min="0" max="1" step="0.01"
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
          className={btn}
          title={`Output: ${transport.outputMode}`}
        >
          {transport.outputMode === 'headphones' ? <Headphones size={13} /> : <Speaker size={13} />}
        </button>
        <span className="text-xs text-[#4a4a4a] font-mono shrink-0">
          {transport.latency === 0 ? '—' : `${(transport.latency * 1000).toFixed(0)}ms`}
        </span>

        {/* Divider */}
        <div className="w-px h-6 bg-[#2a2a2a] shrink-0" />

        {/* Export WAV */}
        <button
          onClick={handleExport}
          disabled={objects.length === 0 || exportState === 'rendering'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-all shrink-0
            ${exportState === 'done'
              ? 'border-green-600 bg-green-600/10 text-green-500'
              : exportState === 'rendering'
                ? 'border-[#FF6B00] bg-[#FF6B00]/10 text-[#FF6B00] cursor-wait'
                : 'border-[#333333] bg-[#202020] text-[#a3a3a3] hover:border-[#474747] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          title="Render spatial mix to WAV"
        >
          {exportState === 'rendering'
            ? <><Loader size={11} className="animate-spin" /> {exportProgress}%</>
            : exportState === 'done'
              ? <><Download size={11} /> Done</>
              : <><Download size={11} /> Export WAV</>
          }
        </button>
      </div>
    </div>
  )
}

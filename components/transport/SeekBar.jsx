'use client'

import { useRef, useEffect } from 'react'
import { useAudio } from '@/context/AudioContext'

export default function SeekBar() {
  const { playbackControlsRef } = useAudio()
  const sliderRef = useRef(null)
  const rafRef = useRef(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    const tick = () => {
      if (!isDraggingRef.current && sliderRef.current && playbackControlsRef?.current) {
        const pos = playbackControlsRef.current.getPosition()
        const dur = playbackControlsRef.current.getDuration()
        if (dur > 0) {
          const pct = ((pos % dur) / dur) * 100
          sliderRef.current.value = pct
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playbackControlsRef])

  const handleChange = (e) => {
    if (!playbackControlsRef?.current) return
    const pct = parseFloat(e.target.value) / 100
    const dur = playbackControlsRef.current.getDuration()
    if (dur > 0) playbackControlsRef.current.seekTo(pct * dur)
  }

  return (
    <div
      className="h-5 flex items-center px-4"
      style={{ background: '#0A0A0A', borderTop: '1px solid #1a1a1a' }}
    >
      <input
        ref={sliderRef}
        type="range"
        min="0"
        max="100"
        step="0.05"
        defaultValue="0"
        onChange={handleChange}
        onMouseDown={() => { isDraggingRef.current = true }}
        onMouseUp={() => { isDraggingRef.current = false }}
        onTouchStart={() => { isDraggingRef.current = true }}
        onTouchEnd={() => { isDraggingRef.current = false }}
        className="w-full h-1 cursor-pointer"
        style={{ accentColor: '#FF6B00' }}
        title="Seek"
      />
    </div>
  )
}

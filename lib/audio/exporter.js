/**
 * Renders all spatial audio objects through their HRTF panner chain using
 * OfflineAudioContext, then encodes the result to a WAV ArrayBuffer.
 *
 * @param {object[]} objects  - Audio objects from AudioContext state
 * @param {number}   masterGain
 * @param {number}   sampleRate - Must match the live AudioContext sample rate
 * @param {function} onProgress - Called with 0..1 during rendering
 * @returns {Promise<ArrayBuffer>} WAV file bytes
 */
export async function renderToWav(objects, masterGain, sampleRate, onProgress) {
  const active = objects.filter(o => o.buffer && !o.muted)
  if (!active.length) throw new Error('No unmuted audio objects to render')

  const duration = Math.max(...active.map(o => o.buffer.duration))
  if (!duration) throw new Error('All buffers have zero duration')

  const numFrames = Math.ceil(duration * sampleRate)
  const offline   = new OfflineAudioContext(2, numFrames, sampleRate)

  // Master gain
  const master = offline.createGain()
  master.gain.value = Math.max(0, masterGain)
  master.connect(offline.destination)

  // Re-create each object's signal chain in the offline context
  for (const obj of active) {
    const panner = offline.createPanner()
    panner.panningModel  = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance   = 1
    panner.maxDistance   = 20
    panner.rolloffFactor = 1
    panner.setPosition(obj.x ?? 0, obj.y ?? 0, obj.z ?? -2)
    panner.connect(master)

    const gain = offline.createGain()
    gain.gain.value = obj.gain ?? 1
    gain.connect(panner)

    const source = offline.createBufferSource()
    source.buffer = obj.buffer  // AudioBuffer is shared safely across contexts
    source.loop   = false
    source.connect(gain)
    source.start(0)
  }

  // OfflineAudioContext doesn't have native progress events;
  // fire synthetic ticks via suspend/resume checkpoints
  const TICKS = 20
  for (let i = 1; i < TICKS; i++) {
    const t = (i / TICKS) * duration
    offline.suspend(t).then(() => {
      onProgress?.(t / duration)
      offline.resume()
    }).catch(() => {}) // suspend after duration is harmless
  }

  const rendered = await offline.startRendering()
  onProgress?.(1)
  return encodeWav(rendered)
}

function encodeWav(buf) {
  const ch      = buf.numberOfChannels
  const sr      = buf.sampleRate
  const len     = buf.length
  const bps     = 2                     // 16-bit
  const dataLen = len * ch * bps
  const ab      = new ArrayBuffer(44 + dataLen)
  const v       = new DataView(ab)

  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)) }
  str(0,  'RIFF')
  v.setUint32(4,  36 + dataLen,        true)
  str(8,  'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16,                  true)  // PCM chunk size
  v.setUint16(20, 1,                   true)  // PCM format
  v.setUint16(22, ch,                  true)
  v.setUint32(24, sr,                  true)
  v.setUint32(28, sr * ch * bps,       true)  // byte rate
  v.setUint16(32, ch * bps,            true)  // block align
  v.setUint16(34, 16,                  true)  // bits per sample
  str(36, 'data')
  v.setUint32(40, dataLen,             true)

  const channels = Array.from({ length: ch }, (_, i) => buf.getChannelData(i))
  let off = 44
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]))
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
      off += 2
    }
  }

  return ab
}

export function downloadWav(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'audio/wav' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

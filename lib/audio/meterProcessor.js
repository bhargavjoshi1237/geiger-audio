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
    const s = dataArray[i]
    sumSquares += s * s
    const abs = Math.abs(s)
    if (abs > peak) peak = abs
  }

  const rms = Math.sqrt(sumSquares / bufferLength)
  const lufs = rms > 0.000001 ? 20 * Math.log10(rms) + LUFS_OFFSET : -70
  const truePeak = peak > 0.000001 ? 20 * Math.log10(peak) : -70

  return {
    momentary: Math.max(-70, Math.min(0, lufs)),
    shortTerm: Math.max(-70, Math.min(0, lufs - 1.5)),
    integrated: Math.max(-70, Math.min(0, lufs - 3)),
    truePeak: Math.max(-70, Math.min(3, truePeak)),
  }
}

export function lufsToPercent(lufs) {
  return Math.max(0, Math.min(100, ((lufs + 70) / 70) * 100))
}

export function lufsColor(lufs) {
  if (lufs > -6)  return '#ef4444'  // red — too loud
  if (lufs > -14) return '#FF6B00'  // orange — target broadcast range
  if (lufs > -23) return '#22c55e'  // green — good
  return '#4ade80'                   // bright green — quiet
}

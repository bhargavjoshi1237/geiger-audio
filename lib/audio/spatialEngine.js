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

export function startObjectPlayback(audioCtx, obj, offset = 0) {
  if (!obj.buffer || !obj.gainNode) return null
  const source = audioCtx.createBufferSource()
  source.buffer = obj.buffer
  source.loop = true
  source.connect(obj.gainNode)
  const safeOffset = offset % obj.buffer.duration
  source.start(0, safeOffset)
  return source
}

export function stopObjectPlayback(sourceNode) {
  if (!sourceNode) return
  try { sourceNode.stop() } catch (_) {}
  try { sourceNode.disconnect() } catch (_) {}
}

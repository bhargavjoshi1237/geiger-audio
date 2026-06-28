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
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
        })
      } catch (err) {
        reject(new Error(`Failed to decode ${file.name}: ${err.message}`))
      }
    }
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsArrayBuffer(file)
  })
}

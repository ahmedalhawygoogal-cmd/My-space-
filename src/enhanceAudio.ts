function writeStr(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i))
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const bitsPerSample = 16
  const samples = buffer.length
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples * blockAlign
  const bytes = new ArrayBuffer(44 + dataSize)
  const view = new DataView(bytes)
  writeStr(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(view, 8, 'WAVE')
  writeStr(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeStr(view, 36, 'data')
  view.setUint32(40, dataSize, true)
  const channels: Float32Array[] = []
  for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i))
  let offset = 44
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([bytes], { type: 'audio/wav' })
}

export async function enhanceAudioBlob(blob: Blob): Promise<{ blob: Blob; durationMs: number; mimeType: string }> {
  const decodeCtx = new AudioContext()
  try {
    const raw = await blob.arrayBuffer()
    const decoded = await decodeCtx.decodeAudioData(raw.slice(0))
    const offline = new OfflineAudioContext(decoded.numberOfChannels, decoded.length, decoded.sampleRate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    const highpass = offline.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 100
    highpass.Q.value = 0.7
    const compressor = offline.createDynamicsCompressor()
    compressor.threshold.value = -24
    compressor.knee.value = 30
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    const gain = offline.createGain()
    gain.gain.value = 2
    source.connect(highpass)
    highpass.connect(compressor)
    compressor.connect(gain)
    gain.connect(offline.destination)
    source.start(0)
    const rendered = await offline.startRendering()
    const wav = audioBufferToWav(rendered)
    return {
      blob: wav,
      durationMs: Math.round(rendered.duration * 1000),
      mimeType: 'audio/wav',
    }
  } finally {
    await decodeCtx.close().catch(() => undefined)
  }
}

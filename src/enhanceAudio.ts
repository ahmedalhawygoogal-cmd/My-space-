import type { RecDistance } from './types'
import { DISTANCE_PRE_GAIN } from './types'
import { denoisePcm } from './utils/rnnoise'

const RNNOISE_RATE = 48000

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

function mixToMono(buffer: AudioBuffer): Float32Array {
  const first = buffer.getChannelData(0)
  if (buffer.numberOfChannels === 1) return new Float32Array(first)
  const out = new Float32Array(buffer.length)
  const n = buffer.numberOfChannels
  for (let i = 0; i < buffer.length; i++) {
    let sum = 0
    for (let ch = 0; ch < n; ch++) sum += buffer.getChannelData(ch)[i]
    out[i] = sum / n
  }
  return out
}

async function resampleMono(samples: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  if (fromRate === toRate) return samples
  const length = Math.max(1, Math.ceil((samples.length * toRate) / fromRate))
  const ctx = new OfflineAudioContext(1, length, toRate)
  const buf = ctx.createBuffer(1, samples.length, fromRate)
  buf.copyToChannel(new Float32Array(samples), 0)
  const source = ctx.createBufferSource()
  source.buffer = buf
  source.connect(ctx.destination)
  source.start(0)
  const rendered = await ctx.startRendering()
  return rendered.getChannelData(0).slice()
}

function pcmToBuffer(samples: Float32Array, sampleRate: number): AudioBuffer {
  const ctx = new OfflineAudioContext(1, samples.length, sampleRate)
  const buf = ctx.createBuffer(1, samples.length, sampleRate)
  buf.copyToChannel(new Float32Array(samples), 0)
  return buf
}

function applyPreGain(samples: Float32Array, gain: number): Float32Array {
  if (gain === 1) return samples
  const out = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain
  return out
}

async function applySpeechChain(buffer: AudioBuffer): Promise<AudioBuffer> {
  const offline = new OfflineAudioContext(1, buffer.length, buffer.sampleRate)
  const source = offline.createBufferSource()
  source.buffer = buffer

  const highpass = offline.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 80
  highpass.Q.value = 0.7

  const presence = offline.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3000
  presence.Q.value = 1
  presence.gain.value = 4

  const compressor = offline.createDynamicsCompressor()
  compressor.threshold.value = -18
  compressor.knee.value = 6
  compressor.ratio.value = 3
  compressor.attack.value = 0.01
  compressor.release.value = 0.15

  const limiter = offline.createDynamicsCompressor()
  limiter.threshold.value = -1
  limiter.knee.value = 0
  limiter.ratio.value = 20
  limiter.attack.value = 0.001
  limiter.release.value = 0.05

  source.connect(highpass)
  highpass.connect(presence)
  presence.connect(compressor)
  compressor.connect(limiter)
  limiter.connect(offline.destination)
  source.start(0)
  return offline.startRendering()
}

export async function enhanceAudioBlob(
  blob: Blob,
  distance: RecDistance = 'near',
): Promise<{ blob: Blob; durationMs: number; mimeType: string }> {
  const decodeCtx = new AudioContext()
  try {
    const raw = await blob.arrayBuffer()
    const decoded = await decodeCtx.decodeAudioData(raw.slice(0))
    const mono = mixToMono(decoded)
    const at48k = await resampleMono(mono, decoded.sampleRate, RNNOISE_RATE)
    const boosted = applyPreGain(at48k, DISTANCE_PRE_GAIN[distance] ?? 1)
    const denoised = await denoisePcm(boosted)
    const denoisedBuffer = pcmToBuffer(denoised, RNNOISE_RATE)
    const rendered = await applySpeechChain(denoisedBuffer)
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

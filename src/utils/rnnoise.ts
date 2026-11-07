import type { Rnnoise } from '@shiguredo/rnnoise-wasm'

const PCM_SCALE = 0x8000

let rnnoisePromise: Promise<Rnnoise> | null = null

export async function loadRnnoise(): Promise<Rnnoise> {
  if (!rnnoisePromise) {
    rnnoisePromise = import('@shiguredo/rnnoise-wasm').then((mod) => mod.Rnnoise.load())
  }
  return rnnoisePromise
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

export async function denoisePcm(samples: Float32Array): Promise<Float32Array> {
  const rnnoise = await loadRnnoise()
  const frameSize = rnnoise.frameSize
  const state = rnnoise.createDenoiseState()
  try {
    const out = new Float32Array(samples.length)
    const frame = new Float32Array(frameSize)
    for (let offset = 0; offset < samples.length; offset += frameSize) {
      frame.fill(0)
      const count = Math.min(frameSize, samples.length - offset)
      for (let i = 0; i < count; i++) {
        const sample = samples[offset + i] ?? 0
        frame[i] = Math.max(-1, Math.min(1, sample)) * PCM_SCALE
      }
      state.processFrame(frame)
      for (let i = 0; i < count; i++) {
        out[offset + i] = Math.max(-1, Math.min(1, frame[i] / PCM_SCALE))
      }
      if (offset > 0 && offset % (frameSize * 200) === 0) await yieldToUi()
    }
    return out
  } finally {
    state.destroy()
  }
}

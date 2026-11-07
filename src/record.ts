import { Capacitor } from '@capacitor/core'
import { CapacitorAudioRecorder as AudioRecorder, type StartRecordingOptions } from '@capgo/capacitor-audio-recorder'
import { startRecordingKeepAlive, stopRecordingKeepAlive } from './keepAlive'
import type { RecDistance } from './types'
import { base64ToBlob } from './utils'

export { AudioRecorder }

export interface DistanceAudioProfile {
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  gain: number
  compressorThreshold: number
  compressorRatio: number
}

export const DISTANCE_AUDIO: Record<RecDistance, DistanceAudioProfile> = {
  near: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    gain: 1.5,
    compressorThreshold: -24,
    compressorRatio: 12,
  },
  medium: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    gain: 2.5,
    compressorThreshold: -30,
    compressorRatio: 8,
  },
  far: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: true,
    gain: 4,
    compressorThreshold: -40,
    compressorRatio: 4,
  },
}

export function webAudioConstraints(distance: RecDistance = 'medium'): MediaTrackConstraints {
  const p = DISTANCE_AUDIO[distance]
  return {
    channelCount: 2,
    noiseSuppression: p.noiseSuppression,
    echoCancellation: p.echoCancellation,
    autoGainControl: p.autoGainControl,
    sampleRate: 48000,
  }
}

export const WEB_AUDIO_CONSTRAINTS: MediaTrackConstraints = webAudioConstraints('medium')

export function nativeRecordOpts(distance: RecDistance = 'medium', enhance = false) {
  const p = DISTANCE_AUDIO[distance]
  return {
    format: 'm4a' as const,
    sampleRate: 48000,
    bitRate: 256000,
    numberOfChannels: 2,
    autoGainControl: p.autoGainControl,
    noiseSuppression: p.noiseSuppression,
    echoCancellation: p.echoCancellation,
    gain: enhance && distance === 'far' ? p.gain * 1.35 : p.gain,
  }
}

export const NATIVE_RECORD_OPTS = nativeRecordOpts('medium')

export const NATIVE_AUDIO_MIME = 'audio/mp4'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

function denied(): DOMException {
  const err = new Error('Microphone permission not granted') as DOMException
  Object.assign(err, { name: 'NotAllowedError' })
  return err
}

export async function ensureMicPermission(): Promise<void> {
  const cur = await AudioRecorder.checkPermissions()
  if (cur.recordAudio === 'granted') return
  const next = await AudioRecorder.requestPermissions()
  if (next.recordAudio !== 'granted') throw denied()
}

export async function startNativeRecording(opts?: { distance?: RecDistance; enhance?: boolean }): Promise<void> {
  await ensureMicPermission()
  await startRecordingKeepAlive()
  try {
    await AudioRecorder.startRecording({
      ...nativeRecordOpts(opts?.distance ?? 'medium', !!opts?.enhance),
    } as StartRecordingOptions)
  } catch (err) {
    await stopRecordingKeepAlive()
    throw err
  }
}

export interface ProcessedRecordingGraph {
  context: AudioContext
  stream: MediaStream
  analyser: AnalyserNode
}

export async function createProcessedRecordingGraph(
  raw: MediaStream,
  opts?: { enhance?: boolean; distance?: RecDistance },
): Promise<ProcessedRecordingGraph> {
  const distance = opts?.distance ?? 'medium'
  const enhance = !!opts?.enhance
  const profile = DISTANCE_AUDIO[distance]
  const context = new AudioContext({ sampleRate: 48000 })
  try {
    if (context.state === 'suspended') await context.resume()
    const source = context.createMediaStreamSource(raw)
    const compressor = context.createDynamicsCompressor()
    compressor.threshold.value = profile.compressorThreshold
    compressor.knee.value = 30
    compressor.ratio.value = profile.compressorRatio
    compressor.attack.value = 0.003
    compressor.release.value = 0.25
    const gain = context.createGain()
    gain.gain.value = enhance && distance === 'far' ? profile.gain * 1.35 : profile.gain
    const destination = context.createMediaStreamDestination()
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048

    let node: AudioNode = source
    if (enhance) {
      const highpass = context.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = distance === 'far' ? 100 : distance === 'medium' ? 90 : 80
      highpass.Q.value = 0.7
      node.connect(highpass)
      node = highpass
      if (distance === 'medium') {
        const lowpass = context.createBiquadFilter()
        lowpass.type = 'lowpass'
        lowpass.frequency.value = 12000
        lowpass.Q.value = 0.7
        node.connect(lowpass)
        node = lowpass
      }
    }
    node.connect(compressor)
    compressor.connect(gain)
    node = gain
    if (enhance) {
      const presence = context.createBiquadFilter()
      presence.type = 'peaking'
      presence.frequency.value = 3000
      presence.Q.value = 1
      presence.gain.value = 4
      node.connect(presence)
      node = presence
    }
    node.connect(destination)
    node.connect(analyser)
    return { context, stream: destination.stream, analyser }
  } catch (err) {
    await context.close().catch(() => undefined)
    throw err
  }
}

export async function closeProcessedRecordingGraph(context: AudioContext | null | undefined): Promise<void> {
  if (!context) return
  try {
    if (context.state !== 'closed') await context.close()
  } catch {
    /* ignore */
  }
}

export async function pauseNativeRecording(): Promise<void> {
  await AudioRecorder.pauseRecording()
}

export async function resumeNativeRecording(): Promise<void> {
  await AudioRecorder.resumeRecording()
}

export async function cancelNativeRecording(): Promise<void> {
  try {
    await AudioRecorder.cancelRecording()
  } catch {
    /* ignore */
  }
  await stopRecordingKeepAlive()
}

export async function nativeAmplitude(): Promise<number> {
  try {
    const { value } = await AudioRecorder.getCurrentAmplitude()
    return typeof value === 'number' ? value : 0
  } catch {
    return 0
  }
}

function stripB64(data: string): string {
  const i = data.indexOf(',')
  return i >= 0 ? data.slice(i + 1) : data
}

export async function recordingToBlob(result: {
  blob?: Blob
  uri?: string
  base64?: string
}): Promise<Blob> {
  if (result.blob && result.blob.size) {
    return result.blob.type ? result.blob : new Blob([result.blob], { type: NATIVE_AUDIO_MIME })
  }
  if (result.base64) return base64ToBlob(stripB64(result.base64), NATIVE_AUDIO_MIME)
  if (result.uri) {
    const src = Capacitor.convertFileSrc(result.uri)
    const res = await fetch(src)
    if (!res.ok) throw new Error('Failed to read recording')
    const blob = await res.blob()
    const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : NATIVE_AUDIO_MIME
    return new Blob([blob], { type })
  }
  throw new Error('No recording data')
}

export async function stopNativeRecording(): Promise<{ blob: Blob; durationMs: number; mimeType: string }> {
  try {
    const result = await AudioRecorder.stopRecording()
    const blob = await recordingToBlob(result)
    return {
      blob,
      durationMs: result.duration ?? 0,
      mimeType: blob.type || NATIVE_AUDIO_MIME,
    }
  } finally {
    await stopRecordingKeepAlive()
  }
}

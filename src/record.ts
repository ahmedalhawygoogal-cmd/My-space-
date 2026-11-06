import { Capacitor } from '@capacitor/core'
import { CapacitorAudioRecorder as AudioRecorder, type StartRecordingOptions } from '@capgo/capacitor-audio-recorder'
import { base64ToBlob } from './utils'

export { AudioRecorder }

export const WEB_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  channelCount: 2,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  sampleRate: 48000,
}

export const NATIVE_RECORD_OPTS = {
  format: 'm4a' as const,
  sampleRate: 48000,
  bitRate: 256000,
  numberOfChannels: 2,
}

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

export async function startNativeRecording(): Promise<void> {
  await ensureMicPermission()
  await AudioRecorder.startRecording({
    ...NATIVE_RECORD_OPTS,
  } as StartRecordingOptions)
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
  const result = await AudioRecorder.stopRecording()
  const blob = await recordingToBlob(result)
  return {
    blob,
    durationMs: result.duration ?? 0,
    mimeType: blob.type || NATIVE_AUDIO_MIME,
  }
}

import { Capacitor, registerPlugin } from '@capacitor/core'

interface RecordingKeepAlivePlugin {
  start(): Promise<void>
  stop(): Promise<void>
}

const RecordingKeepAlive = registerPlugin<RecordingKeepAlivePlugin>('RecordingKeepAlive')

export async function startRecordingKeepAlive(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  try {
    await RecordingKeepAlive.start()
  } catch {
    /* ignore */
  }
}

export async function stopRecordingKeepAlive(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  try {
    await RecordingKeepAlive.stop()
  } catch {
    /* ignore */
  }
}

import { Capacitor } from '@capacitor/core'
import { blobToBase64, downloadBlob } from '../utils'

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

function isShareCancel(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /cancel|dismiss|abort/i.test(msg)
}

export async function saveBlobToDevice(blob: Blob, filename: string): Promise<'native' | 'web'> {
  if (Capacitor.isNativePlatform()) {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const data = await blobToBase64(blob)
    await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Documents,
      recursive: true,
    })
    return 'native'
  }
  downloadBlob(blob, filename)
  return 'web'
}

export async function shareBlob(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded' | 'aborted'> {
  if (Capacitor.isNativePlatform()) {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const data = await blobToBase64(blob)
    const written = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    })
    try {
      await Share.share({ title, url: written.uri, dialogTitle: title })
      return 'shared'
    } catch (err) {
      if (isShareCancel(err)) return 'aborted'
      throw err
    }
  }

  const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  const shareData: ShareData = { files: [file], title }
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare(shareData))
  if (canShareFiles) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (err) {
      if (isShareCancel(err)) return 'aborted'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

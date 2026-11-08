import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

export async function uploadRecordingToCloud(
  recordingId: string,
  blob: Blob,
): Promise<{ path: string; url: string }> {
  const path = `recordings/${recordingId}.m4a`
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, blob, {
    contentType: blob.type || 'audio/mp4',
  })
  const url = await getDownloadURL(storageRef)
  return { path, url }
}

const NVIDIA_STUDIO_VOICE_URL = 'https://ai.api.nvidia.com/v1/audio/studiovoice'

export async function enhanceAudioWithNVIDIA(originalBlob: Blob): Promise<Blob> {
  const key = import.meta.env.VITE_NVIDIA_API_KEY
  if (!key) throw new Error('missing NVIDIA API key')

  const formData = new FormData()
  formData.append('file', originalBlob, 'audio.wav')

  const res = await fetch(NVIDIA_STUDIO_VOICE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'audio/wav',
    },
    body: formData,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(detail.trim() || `NVIDIA ${res.status}`)
  }

  const out = await res.blob()
  if (!out.size) throw new Error('empty NVIDIA response')
  return new Blob([out], { type: out.type || 'audio/wav' })
}

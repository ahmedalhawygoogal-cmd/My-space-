const KEY = 'myspace-cloud-sync'

export function isCloudSyncEnabled(): boolean {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw == null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

export function setCloudSyncEnabled(on: boolean): void {
  localStorage.setItem(KEY, on ? '1' : '0')
}

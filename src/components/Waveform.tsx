import type { RecDistance } from '../types'
import { DISTANCE_WAVEFORM_GAIN } from '../types'

type WaveformProps = {
  amplitudes: number[]
  distance?: RecDistance
}

export function Waveform({ amplitudes, distance = 'near' }: WaveformProps) {
  const bars = amplitudes.length ? amplitudes : Array.from({ length: 48 }, () => 0)
  const gain = DISTANCE_WAVEFORM_GAIN[distance] ?? 1
  return (
    <div className="wave waveform" aria-hidden>
      {bars.map((v, i) => {
        const h = Math.max(4, Math.min(100, (Number.isFinite(v) ? v : 0) * gain * 100))
        return <span key={i} className="waveform-bar" style={{ height: `${h}%` }} />
      })}
    </div>
  )
}

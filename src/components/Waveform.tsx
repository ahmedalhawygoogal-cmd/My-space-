type WaveformProps = {
  amplitudes: number[]
}

export function Waveform({ amplitudes }: WaveformProps) {
  const bars = amplitudes.length ? amplitudes : Array.from({ length: 48 }, () => 0)
  return (
    <div className="wave waveform" aria-hidden>
      {bars.map((v, i) => {
        const h = Math.max(4, Math.min(100, (Number.isFinite(v) ? v : 0) * 100))
        return <span key={i} className="waveform-bar" style={{ height: `${h}%` }} />
      })}
    </div>
  )
}

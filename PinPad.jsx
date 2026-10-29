import { useEffect, useState } from 'react'
import { normalizeDigits } from '../utils.js'

export default function PinPad({
  title,
  subtitle,
  mode = 'enter',
  onComplete,
  onCancel,
  error,
  shake,
  disabled,
  extra
}) {
  const [pin, setPin] = useState('')
  const [stage, setStage] = useState('enter')
  const [first, setFirst] = useState('')

  useEffect(() => {
    setPin('')
    setStage('enter')
    setFirst('')
  }, [mode])

  useEffect(() => {
    if (shake) setPin('')
  }, [shake])

  useEffect(() => {
    const onKey = (e) => {
      if (disabled) return
      const digit = normalizeDigits(e.key)
      if (digit >= '0' && digit <= '9' && digit.length === 1) push(digit)
      if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function push(d) {
    if (disabled) return
    setPin((p) => {
      if (p.length >= 4) return p
      const next = p + d
      if (next.length === 4) {
        setTimeout(() => finish(next), 80)
      }
      return next
    })
  }

  function finish(value) {
    if (mode === 'create') {
      if (stage === 'enter') {
        setFirst(value)
        setPin('')
        setStage('confirm')
        return
      }
      onComplete?.(first, value)
      setPin('')
      return
    }
    onComplete?.(value)
    setPin('')
  }

  const label =
    mode === 'create'
      ? stage === 'confirm'
        ? 'أكد الرقم السري'
        : 'أنشئ رقماً سرياً من 4 أرقام'
      : title

  return (
    <div className={`pin-wrap ${shake ? 'shake' : ''}`}>
      <h2 className="display">{label}</h2>
      {subtitle ? <p className="lead">{subtitle}</p> : null}
      <div className="dots">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`dot ${pin.length > i ? 'filled' : ''}`} />
        ))}
      </div>
      <div className="pin-err">{error || ' '}</div>
      <div className="pad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <button key={n} type="button" disabled={disabled} onClick={() => push(n)}>
            {n}
          </button>
        ))}
        <button type="button" className="ghost" onClick={onCancel}>
          إلغاء
        </button>
        <button type="button" disabled={disabled} onClick={() => push('0')}>
          0
        </button>
        <button type="button" className="ghost" onClick={() => setPin((p) => p.slice(0, -1))}>
          مسح
        </button>
      </div>
      {extra}
    </div>
  )
}

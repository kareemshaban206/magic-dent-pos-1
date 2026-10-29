import { useEffect, useState } from 'react'

function Tooth() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none" aria-hidden>
      <path
        d="M24 6c-4.5 0-7.2 3.2-8.4 6.2C14.4 15.4 12 16 10.5 18.2 8.4 21.2 8 25.5 10 29c1.4 2.5 3.2 3.4 4.1 6.2.8 2.5.6 6.3 2.7 8.1 2.3 2 5.1-.4 5.6-3.2.4-2.2.3-4.6 1.6-6.4 1.3 1.8 1.2 4.2 1.6 6.4.5 2.8 3.3 5.2 5.6 3.2 2.1-1.8 1.9-5.6 2.7-8.1.9-2.8 2.7-3.7 4.1-6.2 2-3.5 1.6-7.8-.5-10.8C36 16 33.6 15.4 32.4 12.2 31.2 9.2 28.5 6 24 6z"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}

export default function ProductImage({ src, alt, className }) {
  const [state, setState] = useState(src ? 'loading' : 'empty')

  useEffect(() => {
    setState(src ? 'loading' : 'empty')
  }, [src])

  if (!src || state === 'empty' || state === 'err') {
    return (
      <div className={className} aria-hidden>
        <Tooth />
      </div>
    )
  }

  return (
    <div className={className}>
      {state === 'loading' ? <div className="shimmer" /> : null}
      <img
        src={src}
        alt={alt || ''}
        style={{ display: state === 'ok' ? 'block' : 'none' }}
        onLoad={() => setState('ok')}
        onError={() => setState('err')}
      />
    </div>
  )
}

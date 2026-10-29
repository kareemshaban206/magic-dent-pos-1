export default function Logo({ size = 36, variant = 'dark' }) {
  const glow = variant === 'paper' ? '#0ea5e9' : '#38bdf8'
  const enamel = variant === 'paper' ? '#0f172a' : '#e2e8f0'
  const fill = variant === 'paper' ? '#f8fafc' : '#0b1224'
  const ring = variant === 'paper' ? '#0ea5e9' : '#38bdf8'
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <circle cx="32" cy="32" r="30" fill={fill} stroke={ring} strokeWidth="2.2" />
      <circle cx="32" cy="32" r="24" fill="none" stroke={glow} strokeOpacity="0.28" strokeWidth="1.4" />
      <path
        d="M32 12c-6.2 0-10 4.4-11.6 8.6C19.2 24.8 16 25.6 14 28.6 11.2 32.8 10.6 38.6 13.4 43.4c1.9 3.3 4.4 4.5 5.6 8.2 1.1 3.4.8 8.4 3.6 10.8 3 2.6 6.8-.6 7.4-4.4.6-3 .4-6.2 2.2-8.6 1.8 2.4 1.6 5.6 2.2 8.6.6 3.8 4.4 7 7.4 4.4 2.8-2.4 2.5-7.4 3.6-10.8 1.2-3.7 3.7-4.9 5.6-8.2 2.8-4.8 2.2-10.6-.6-14.8-2-3-5.2-3.8-6.4-8C42 16.4 38.2 12 32 12z"
        fill={enamel}
      />
      <path
        d="M26 28c2.2-3.4 4.4-4.8 6-4.8s3.8 1.4 6 4.8"
        stroke={glow}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

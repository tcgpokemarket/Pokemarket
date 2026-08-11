'use client'

import { useEffect, useState } from 'react'

export default function PackOpeningAnimation({
  packName,
  onComplete,
}: {
  packName: string
  onComplete: () => void
}) {
  const [phase, setPhase] = useState<'sealed' | 'shake' | 'burst' | 'done'>('sealed')

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setPhase('shake'), 500),
      window.setTimeout(() => setPhase('burst'), 1700),
      window.setTimeout(() => setPhase('done'), 2700),
      window.setTimeout(onComplete, 2900),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [onComplete])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a15] px-4 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.14),transparent_55%)]" />

      <div className={`relative transition-all duration-500 ${phase === 'shake' ? 'animate-[shake_0.12s_linear_infinite]' : ''} ${phase === 'burst' || phase === 'done' ? 'scale-110 opacity-0' : 'scale-100'}`}>
        <div className="relative h-72 w-48 overflow-hidden rounded-3xl border-2 border-yellow-300/70 bg-gradient-to-br from-yellow-300 via-yellow-500 to-orange-600 shadow-[0_0_80px_rgba(250,204,21,0.35)]">
          <div className="absolute inset-3 rounded-2xl border border-white/40" />
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <span className="text-5xl font-black text-white drop-shadow-lg">◈</span>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-white/90">Poké Rips</p>
            <p className="mt-2 text-lg font-black text-white">{packName}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-8 bg-black/20" />
        </div>
        {phase === 'burst' && (
          <>
            <span className="absolute -inset-12 animate-ping rounded-full border border-yellow-300/50" />
            <span className="absolute -inset-24 rounded-full bg-yellow-300/10 blur-3xl" />
          </>
        )}
      </div>

      {phase === 'burst' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="absolute h-2 w-2 rounded-full bg-yellow-300 animate-[spark_0.8s_ease-out_forwards]"
              style={{
                transform: `rotate(${i * 20}deg) translateY(-${90 + (i % 5) * 25}px)`,
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-20 text-center">
        <p className="text-sm font-bold text-yellow-300">
          {phase === 'sealed' && 'Ready to rip'}
          {phase === 'shake' && 'Opening pack…'}
          {phase === 'burst' && 'REVEAL!'}
          {phase === 'done' && 'Card revealed'}
        </p>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-7px) rotate(-2deg); }
          75% { transform: translateX(7px) rotate(2deg); }
        }
        @keyframes spark {
          0% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </div>
  )
}

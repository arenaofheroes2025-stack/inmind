import { motion } from 'framer-motion'

type LoadingCinematicProps = {
  label?: string
}

export function LoadingCinematic({ label = 'Gerando mundo...' }: LoadingCinematicProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center gap-5"
    >
      {/* video frame */}
      <div className="relative w-full max-w-md overflow-hidden rounded-frame">
        {/* decorative border */}
        <div className="absolute inset-0 z-10 rounded-frame border-2 border-gold/25 pointer-events-none" />
        <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />

        {/* corner ornaments */}
        <div className="absolute left-1 top-1 z-10 h-3 w-3 border-l-2 border-t-2 border-gold/40 rounded-tl-sm" />
        <div className="absolute right-1 top-1 z-10 h-3 w-3 border-r-2 border-t-2 border-gold/40 rounded-tr-sm" />
        <div className="absolute left-1 bottom-1 z-10 h-3 w-3 border-l-2 border-b-2 border-gold/40 rounded-bl-sm" />
        <div className="absolute right-1 bottom-1 z-10 h-3 w-3 border-r-2 border-b-2 border-gold/40 rounded-br-sm" />

        {/* outer glow */}
        <div className="absolute -inset-1 z-0 rounded-frame bg-gold/5 blur-xl" />

        {/* video — non-interactive, loops, no controls */}
        <video
          src="/videos/Loading_World_Generation.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="relative z-[1] w-full rounded-frame object-cover pointer-events-none select-none"
          style={{ aspectRatio: '16/9' }}
        />

        {/* subtle vignette overlay */}
        <div className="absolute inset-0 z-[2] rounded-frame bg-gradient-to-t from-obsidian/60 via-transparent to-obsidian/30 pointer-events-none" />
      </div>

      {/* label */}
      <div className="flex items-center gap-2.5">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="h-4 w-4 rounded-full border-2 border-gold/30 border-t-gold"
        />
        <p className="font-display text-sm tracking-wide text-gold/80 animate-pulse">
          {label}
        </p>
      </div>
    </motion.div>
  )
}

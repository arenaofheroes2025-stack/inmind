import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

type SpinnerProps = {
  label?: string
  size?: 'sm' | 'md'
}

export function Spinner({ label, size = 'md' }: SpinnerProps) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-8 w-8'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* outer glow ring */}
        <div className={`absolute inset-0 ${dim} animate-pulse rounded-full bg-gold/10 blur-md`} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          className={`relative ${dim} text-gold`}
        >
          <Loader2 className="h-full w-full" />
        </motion.div>
      </div>
      {label ? (
        <p className="text-xs font-display text-gold/80 animate-pulse tracking-wide">{label}</p>
      ) : null}
    </div>
  )
}

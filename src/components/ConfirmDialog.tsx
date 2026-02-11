import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { AlertTriangle, Info } from 'lucide-react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity data-closed:opacity-0 data-enter:duration-200 data-leave:duration-150"
      />

      <div className="fixed inset-0 flex items-center justify-center px-4">
        <DialogPanel
          transition
          className="relative w-full max-w-md overflow-hidden rounded-frame rpg-frame rpg-texture bg-gradient-to-b from-panel to-panel/95 transition-all data-closed:scale-95 data-closed:opacity-0 data-enter:duration-250 data-leave:duration-200"
        >
          {/* accent bar */}
          <div
            className={`h-0.5 w-full ${
              variant === 'danger'
                ? 'bg-gradient-to-r from-transparent via-crimson to-transparent'
                : 'bg-gradient-to-r from-transparent via-gold to-transparent'
            }`}
          />

          <div className="p-6">
            {/* icon */}
            <div
              className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border ${
                variant === 'danger'
                  ? 'border-crimson/20 bg-crimson/8'
                  : 'border-gold/20 bg-gold/10'
              }`}
            >
              {variant === 'danger' ? (
                <AlertTriangle className="h-6 w-6 text-crimson" />
              ) : (
                <Info className="h-6 w-6 text-gold" />
              )}
            </div>

            <DialogTitle className="text-center font-display text-lg font-semibold text-ink">
              {title}
            </DialogTitle>

            {description ? (
              <p className="mt-2 text-center text-sm leading-relaxed text-ink-muted">
                {description}
              </p>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-lg border border-gold/20 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-gold/40 hover:bg-gold/5"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={`flex-1 rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                  variant === 'danger'
                    ? 'bg-crimson text-white shadow-[0_0_20px_rgba(220,53,69,0.3)] hover:bg-crimson/90'
                    : 'bg-gradient-to-r from-gold-dim via-gold to-gold-light text-obsidian shadow-[0_0_20px_rgba(201,168,76,0.3)] hover:shadow-[0_0_28px_rgba(201,168,76,0.4)]'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}

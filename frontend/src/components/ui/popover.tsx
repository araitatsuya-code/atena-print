import { useEffect, useRef, useState, type ReactNode } from 'react'

interface PopoverProps {
  triggerLabel: ReactNode
  triggerClassName?: string
  triggerTitle?: string
  triggerAriaLabel?: string
  align?: 'left' | 'right'
  children: (close: () => void) => ReactNode
}

export function Popover({
  triggerLabel,
  triggerClassName,
  triggerTitle,
  triggerAriaLabel,
  align = 'right',
  children,
}: PopoverProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (triggerRef.current?.contains(target)) return
      if (contentRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={triggerAriaLabel}
        title={triggerTitle}
        className={triggerClassName}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          ref={contentRef}
          role="dialog"
          className={`absolute top-full mt-1 z-50 rounded-md border border-gray-200 bg-white shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

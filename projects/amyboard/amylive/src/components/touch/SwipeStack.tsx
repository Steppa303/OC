import { useRef, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface SwipeStackCard {
  id: string
  node: ReactNode
}

interface SwipeStackProps {
  cards: SwipeStackCard[]
  activeIndex: number
  onIndexChange: (i: number) => void
  className?: string
}

const SWIPE_THRESHOLD = 100

/**
 * Full-screen swipeable card stack with Framer Motion.
 * - drag="x" with spring transition
 * - Dot indicators at bottom
 * - Renders only active + 1 neighbor on each side
 * - Container: h-[calc(100dvh-180px)] on mobile
 */
export function SwipeStack({ cards, activeIndex, onIndexChange, className = '' }: SwipeStackProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  if (cards.length === 0) return null

  const hasPrev = activeIndex > 0
  const hasNext = activeIndex < cards.length - 1

  // Determine visible indices: active + 1 neighbor each side
  const visibleIndices = new Set<number>()
  for (let i = Math.max(0, activeIndex - 1); i <= Math.min(cards.length - 1, activeIndex + 1); i++) {
    visibleIndices.add(i)
  }

  const goPrev = () => {
    if (hasPrev) onIndexChange(activeIndex - 1)
  }

  const goNext = () => {
    if (hasNext) onIndexChange(activeIndex + 1)
  }

  const direction = useRef(1)

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Card Area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ height: 'calc(100dvh - 180px)' }}
      >
        <AnimatePresence mode="popLayout" custom={direction.current}>
          {cards.map((card, i) => {
            if (!visibleIndices.has(i)) return null
            const isActive = i === activeIndex

            return (
              <motion.div
                key={card.id}
                custom={i > activeIndex ? 1 : -1}
                initial={
                  isActive
                    ? { x: 300, opacity: 0 }
                    : { x: 0, opacity: 0.5, scale: 0.95 }
                }
                animate={
                  isActive
                    ? { x: 0, opacity: 1, scale: 1 }
                    : { x: 0, opacity: 0, scale: 0.95 }
                }
                exit={{ x: i > activeIndex ? -300 : 300, opacity: 0, scale: 0.95 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                  mass: 1,
                }}
                drag={isActive ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.3}
                onDragEnd={
                  isActive
                    ? (_, info) => {
                        if (info.offset.x > SWIPE_THRESHOLD && hasPrev) {
                          direction.current = -1
                          goPrev()
                        } else if (info.offset.x < -SWIPE_THRESHOLD && hasNext) {
                          direction.current = 1
                          goNext()
                        }
                      }
                    : undefined
                }
                className={`absolute inset-0 ${isActive ? 'z-10' : 'z-0 pointer-events-none'}`}
                style={{ touchAction: isActive ? 'pan-y' : 'none' }}
              >
                {card.node}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Bottom Controls: Dots + Prev/Next */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)]">
        <button
          onClick={goPrev}
          disabled={!hasPrev}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ChevronLeft size={14} />
          Prev
        </button>

        {/* Dot indicators */}
        <div className="flex items-center gap-1.5">
          {cards.map((_, i) => (
            <button
              key={i}
              onClick={() => onIndexChange(i)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                i === activeIndex
                  ? 'bg-[var(--color-primary)] w-3'
                  : 'bg-[var(--color-text-muted)]/40 hover:bg-[var(--color-text-muted)]/60'
              }`}
              aria-label={`Go to card ${i + 1}`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={!hasNext}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
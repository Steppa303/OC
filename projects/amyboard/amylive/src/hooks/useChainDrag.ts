import { useState, useCallback, useRef } from 'react'

interface DragState {
  sourceModuleId: string
  sourceOutput: string
  startX: number
  startY: number
  currentX: number
  currentY: number
  hoveredInput: { moduleId: string; input: string } | null
}

interface RegisteredInput {
  moduleId: string
  input: string
  element: HTMLElement
}

interface DragConnection {
  from: { moduleId: string; output: string }
  to: { moduleId: string; input: string }
}

/**
 * Hook for drag-to-connect functionality between modules.
 * Manages drag state, hit testing, and connection creation.
 */
export function useChainDrag() {
  const [dragState, setDragState] = useState<DragState | null>(null)
  const inputRegistry = useRef<Map<string, RegisteredInput>>(new Map())
  const dragLineEl = useRef<HTMLDivElement | null>(null)

  const removeDragLine = useCallback(() => {
    if (dragLineEl.current) {
      dragLineEl.current.remove()
      dragLineEl.current = null
    }
  }, [])

  const startDrag = useCallback(
    (moduleId: string, output: string, x: number, y: number) => {
      setDragState({
        sourceModuleId: moduleId,
        sourceOutput: output,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        hoveredInput: null,
      })
    },
    [],
  )

  const updateDrag = useCallback(
    (x: number, y: number) => {
      setDragState((prev) => {
        if (!prev) return null

        let hovered: { moduleId: string; input: string } | null = null
        for (const [, reg] of inputRegistry.current) {
          const rect = reg.element.getBoundingClientRect()
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          ) {
            hovered = { moduleId: reg.moduleId, input: reg.input }
            break
          }
        }

        return {
          ...prev,
          currentX: x,
          currentY: y,
          hoveredInput: hovered,
        }
      })
    },
    [],
  )

  const endDrag = useCallback((): DragConnection | null => {
    if (!dragState) return null

    let result: DragConnection | null = null

    if (dragState.hoveredInput) {
      result = {
        from: { moduleId: dragState.sourceModuleId, output: dragState.sourceOutput },
        to: { moduleId: dragState.hoveredInput.moduleId, input: dragState.hoveredInput.input },
      }
    }

    setDragState(null)
    removeDragLine()
    return result
  }, [dragState, removeDragLine])

  const cancelDrag = useCallback(() => {
    setDragState(null)
    removeDragLine()
  }, [removeDragLine])

  const registerInput = useCallback(
    (moduleId: string, input: string, element: HTMLElement) => {
      const key = `${moduleId}:${input}`
      inputRegistry.current.set(key, { moduleId, input, element })
    },
    [],
  )

  const unregisterInput = useCallback(
    (moduleId: string, input: string) => {
      const key = `${moduleId}:${input}`
      inputRegistry.current.delete(key)
    },
    [],
  )

  const getDragLine = useCallback((): { from: { x: number; y: number }; to: { x: number; y: number } } | null => {
    if (!dragState) return null
    return {
      from: { x: dragState.startX, y: dragState.startY },
      to: { x: dragState.currentX, y: dragState.currentY },
    }
  }, [dragState])

  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    registerInput,
    unregisterInput,
    dragLine: getDragLine(),
  }
}
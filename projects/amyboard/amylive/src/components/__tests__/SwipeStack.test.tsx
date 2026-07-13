import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SwipeStack } from '../touch/SwipeStack'

describe('SwipeStack', () => {
  it('renders active card content', () => {
    const cards = [
      { id: '1', node: <div>Card 1</div> },
      { id: '2', node: <div>Card 2</div> },
    ]
    render(<SwipeStack cards={cards} activeIndex={0} onIndexChange={() => {}} />)
    expect(screen.getByText('Card 1')).toBeDefined()
  })

  it('shows dot indicators matching card count', () => {
    const cards = [
      { id: '1', node: <div>Card 1</div> },
      { id: '2', node: <div>Card 2</div> },
      { id: '3', node: <div>Card 3</div> },
    ]
    const { container } = render(<SwipeStack cards={cards} activeIndex={0} onIndexChange={() => {}} />)
    // Dots are buttons with aria-label "Go to card N"
    const dots = container.querySelectorAll('button[aria-label^="Go to card"]')
    expect(dots.length).toBe(3)
  })

  it('has Prev/Next navigation buttons', () => {
    const cards = [
      { id: '1', node: <div>Card 1</div> },
      { id: '2', node: <div>Card 2</div> },
    ]
    render(<SwipeStack cards={cards} activeIndex={0} onIndexChange={() => {}} />)
    expect(screen.getByText('Prev')).toBeDefined()
    expect(screen.getByText('Next')).toBeDefined()
  })

  it('disables Prev on first card', () => {
    const cards = [
      { id: '1', node: <div>Card 1</div> },
      { id: '2', node: <div>Card 2</div> },
    ]
    render(<SwipeStack cards={cards} activeIndex={0} onIndexChange={() => {}} />)
    const prevBtn = screen.getByText('Prev').closest('button')
    expect(prevBtn?.disabled).toBe(true)
  })

  it('disables Next on last card', () => {
    const cards = [
      { id: '1', node: <div>Card 1</div> },
      { id: '2', node: <div>Card 2</div> },
    ]
    render(<SwipeStack cards={cards} activeIndex={1} onIndexChange={() => {}} />)
    const nextBtn = screen.getByText('Next').closest('button')
    expect(nextBtn?.disabled).toBe(true)
  })

  it('returns null for empty cards', () => {
    const { container } = render(<SwipeStack cards={[]} activeIndex={0} onIndexChange={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})
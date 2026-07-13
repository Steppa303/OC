import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TouchSlider } from '../touch/TouchSlider'

describe('TouchSlider', () => {
  it('renders with label and value', () => {
    render(<TouchSlider label="Frequency" value={440} min={20} max={8000} onChange={() => {}} />)
    expect(screen.getByText('Frequency')).toBeDefined()
    expect(screen.getByText('440')).toBeDefined()
  })

  it('renders with unit', () => {
    render(<TouchSlider label="Test" value={100} min={0} max={1000} unit="Hz" onChange={() => {}} />)
    // Value and unit are in separate spans; test for the numeric value
    expect(screen.getByText('100')).toBeDefined()
    expect(screen.getByText('Hz')).toBeDefined()
  })

  it('shows min/max labels when showMinMax is true', () => {
    render(<TouchSlider label="Freq" value={440} min={20} max={8000} showMinMax onChange={() => {}} />)
    expect(screen.getByText('20')).toBeDefined()
    expect(screen.getByText('8000')).toBeDefined()
  })

  it('displays kilo-format for values >= 1000', () => {
    render(<TouchSlider label="Cutoff" value={5000} min={20} max={16000} onChange={() => {}} />)
    // Value is '5.0k' (5.0.toFixed(1) + 'k' as a single string)
    expect(screen.getByText('5.0k')).toBeDefined()
  })

  it('renders with log scale', () => {
    render(<TouchSlider label="Freq" value={440} min={20} max={8000} logScale showMinMax onChange={() => {}} />)
    expect(screen.getByText('20')).toBeDefined()
    expect(screen.getByText('8000')).toBeDefined()
  })

  it('renders the slider track element for pointer interaction', () => {
    const onChange = vi.fn()
    const { container } = render(<TouchSlider label="Test" value={0.5} min={0} max={1} step={0.01} onChange={onChange} />)
    // The track has overflow-hidden class from tailwind
    const track = container.querySelector('[class*="overflow-hidden"]')
    expect(track).toBeDefined()
    expect(track?.classList.contains('touch-none')).toBe(true)
  })

  it('updates display value when value changes', () => {
    const { rerender } = render(<TouchSlider label="Amp" value={0.5} min={0} max={1} onChange={() => {}} />)
    expect(screen.getByText('0.5')).toBeDefined()
    rerender(<TouchSlider label="Amp" value={0.8} min={0} max={1} onChange={() => {}} />)
    expect(screen.getByText('0.8')).toBeDefined()
  })
})
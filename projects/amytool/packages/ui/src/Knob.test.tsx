import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Knob } from './Knob';

function Harness({
  scale = 'lin',
  min = 0,
  max = 100,
}: {
  scale?: 'lin' | 'log';
  min?: number;
  max?: number;
}) {
  const [value, setValue] = useState(50);
  return (
    <Knob
      label="Cutoff"
      value={value}
      min={min}
      max={max}
      defaultValue={25}
      scale={scale}
      onChange={setValue}
    />
  );
}

// jsdom lacks pointer capture; stub it.
beforeAll(() => {
  Element.prototype.setPointerCapture = () => undefined;
  Element.prototype.releasePointerCapture = () => undefined;
});

describe('Knob', () => {
  it('exposes slider semantics with value text', () => {
    render(<Harness />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    expect(knob).toHaveAttribute('aria-valuemin', '0');
    expect(knob).toHaveAttribute('aria-valuemax', '100');
    expect(knob).toHaveAttribute('aria-valuenow', '50');
  });

  it('increases value on upward drag and respects shift fine mode', () => {
    render(<Harness />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    fireEvent.pointerDown(knob, { pointerId: 1, clientY: 200 });
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(knob, { pointerId: 1, clientY: 100 });
    // 100px up * 0.005 norm/px = +0.5 norm → 50 + 50 = 100
    expect(knob).toHaveAttribute('aria-valuenow', '100');

    fireEvent.pointerDown(knob, { pointerId: 1, clientY: 200 });
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 300, shiftKey: true });
    fireEvent.pointerUp(knob, { pointerId: 1, clientY: 300 });
    // 100px down fine (×0.1) → −0.05 norm → 100 − 5 = 95
    expect(knob).toHaveAttribute('aria-valuenow', '95');
  });

  it('resets to defaultValue on double click', () => {
    render(<Harness />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    fireEvent.doubleClick(knob);
    expect(knob).toHaveAttribute('aria-valuenow', '25');
  });

  it('changes value with wheel and arrow keys', () => {
    render(<Harness />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    fireEvent.wheel(knob, { deltaY: -1 });
    expect(knob).toHaveAttribute('aria-valuenow', '52');
    fireEvent.keyDown(knob, { key: 'ArrowDown' });
    expect(knob).toHaveAttribute('aria-valuenow', '50');
  });

  it('maps log scale symmetrically', () => {
    render(<Harness scale="log" min={20} max={20000} />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    // one wheel tick up then down returns to start value
    fireEvent.wheel(knob, { deltaY: -1 });
    fireEvent.wheel(knob, { deltaY: 1 });
    expect(Number(knob.getAttribute('aria-valuenow'))).toBeCloseTo(50, 6);
  });

  it('renders a finite needle for a log scale with min 0 instead of NaN', () => {
    const { container } = render(<Harness scale="log" min={0} max={5000} />);
    const needle = container.querySelector('line');
    expect(needle).not.toBeNull();
    expect(Number(needle?.getAttribute('x2'))).not.toBeNaN();
    expect(Number(needle?.getAttribute('y2'))).not.toBeNaN();
  });

  it('drags a log scale with min 0 without producing NaN values', () => {
    render(<Harness scale="log" min={0} max={5000} />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    fireEvent.pointerDown(knob, { pointerId: 1, clientY: 200 });
    fireEvent.pointerMove(knob, { pointerId: 1, clientY: 400 });
    fireEvent.pointerUp(knob, { pointerId: 1, clientY: 400 });
    const value = Number(knob.getAttribute('aria-valuenow'));
    expect(Number.isFinite(value)).toBe(true);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThanOrEqual(5000);
  });

  it('shows a tooltip while hovering', () => {
    render(<Harness />);
    const knob = screen.getByRole('slider', { name: 'Cutoff' });
    fireEvent.mouseEnter(knob);
    expect(screen.getByText('50.0')).toBeInTheDocument();
    fireEvent.mouseLeave(knob);
    expect(screen.queryByText('50.0')).not.toBeInTheDocument();
  });
});

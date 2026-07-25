import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Jack } from './Jack';
import { Select } from './Select';
import { Toggle } from './Toggle';
import { Display } from './Display';
import { Panel } from './Panel';

describe('Jack', () => {
  it('carries kind/dir data attributes and connected state', () => {
    render(<Jack kind="audio" dir="out" label="out" connected />);
    const jack = screen.getByRole('button', { name: /out \(audio out, connected\)/ });
    expect(jack).toHaveAttribute('data-kind', 'audio');
    expect(jack).toHaveAttribute('data-dir', 'out');
    expect(jack.className).toContain('ui-jack-connected');
  });
});

describe('Select', () => {
  it('renders options and reports changes', () => {
    function H() {
      const [v, setV] = useState('saw');
      return <Select label="Wave" value={v} options={['sine', 'saw']} onChange={setV} />;
    }
    render(<H />);
    const select = screen.getByLabelText('Wave');
    fireEvent.change(select, { target: { value: 'sine' } });
    expect(select).toHaveValue('sine');
  });
});

describe('Toggle', () => {
  it('switches state', () => {
    function H() {
      const [v, setV] = useState(false);
      return <Toggle label="Adv" checked={v} onChange={setV} />;
    }
    render(<H />);
    const box = screen.getByRole('checkbox', { name: 'Adv' });
    fireEvent.click(box);
    expect(box).toBeChecked();
  });
});

describe('Display', () => {
  it('renders value, text and scope variants', () => {
    const { rerender } = render(<Display kind="value" value="440" label="freq" />);
    expect(screen.getByRole('status', { name: 'freq' })).toHaveTextContent('440');
    rerender(<Display kind="text" lines={['a', 'b']} />);
    expect(document.querySelector('.ui-display-text')?.textContent).toBe('a\nb');
    rerender(<Display kind="scope" samples={[0, 1, -1, 0]} />);
    expect(screen.getByRole('img', { name: 'oscilloscope' })).toBeInTheDocument();
  });
});

describe('Panel', () => {
  it('renders zones and hp-based width variable', () => {
    render(
      <Panel name="VCO" hp={8} jacksIn={<Jack kind="cv" dir="in" label="fm" />}>
        <span>controls</span>
      </Panel>,
    );
    const panel = screen.getByRole('region', { name: 'VCO' });
    expect(panel).toHaveAttribute('data-hp', '8');
    expect(panel.getAttribute('style')).toContain('--panel-hp: 8');
    expect(screen.getByText('controls')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fm \(cv in\)/ })).toBeInTheDocument();
  });
});

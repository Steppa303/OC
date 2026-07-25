import { useMemo, useState } from 'react';
import { Display, Jack, Knob, Panel, Select, Slider, Toggle } from '@amy/ui';

/** Gallery of every UI primitive — dev aid + visual regression reference (P0-02). */
export function UiShowcase() {
  const [cutoff, setCutoff] = useState(800);
  const [res, setRes] = useState(0.3);
  const [wave, setWave] = useState('saw');
  const [advanced, setAdvanced] = useState(false);
  const [mix, setMix] = useState(0.5);

  const sine = useMemo(
    () => Array.from({ length: 64 }, (_, i) => Math.sin((i / 63) * Math.PI * 4)),
    [],
  );

  return (
    <div style={{ display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start' }}>
      <Panel
        name="VCO Demo"
        hp={8}
        onMenu={() => setAdvanced((a) => !a)}
        jacksIn={
          <>
            <Jack kind="cv" dir="in" label="1v/oct" connected />
            <Jack kind="gate" dir="in" label="sync" />
            {advanced && <Jack kind="cv" dir="in" label="fm" />}
          </>
        }
        jacksOut={<Jack kind="audio" dir="out" label="out" connected />}
      >
        <Select label="Wave" value={wave} options={['sine', 'saw', 'square', 'triangle', 'noise']} onChange={setWave} />
        <Knob label="Cutoff" value={cutoff} min={20} max={20000} scale="log" unit="Hz" defaultValue={800} onChange={setCutoff} size="lg" />
        <Knob label="Res" value={res} min={0} max={1} defaultValue={0.3} onChange={setRes} />
        <Toggle label="Adv" checked={advanced} onChange={setAdvanced} />
        <Slider label="Mix" value={mix} min={0} max={1} onChange={setMix} />
      </Panel>

      <Panel name="Displays" hp={8} jacksIn={<Jack kind="midi" dir="in" label="midi" />}>
        <Display kind="scope" samples={sine} />
        <Display kind="value" value={cutoff.toFixed(0)} label="cutoff readout" />
        <Display kind="text" lines={['AMY ready', `wave: ${wave}`]} />
      </Panel>
    </div>
  );
}

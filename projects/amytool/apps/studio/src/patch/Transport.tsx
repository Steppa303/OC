import { useEngine } from './engine';
import { usePatchStore } from './patchStore';
import { useBoardStore } from '../board/boardStore';
import { MidiInputPicker } from './MidiInputPicker';

/** Audio on/off for the simulator preview + realtime output routing (P3-05) +
 *  sequencer transport/tempo (P5-02). */
export function Transport() {
  const { state, enabled, start, stop, runSequencer } = useEngine();
  const target = useBoardStore((s) => s.target);
  const setTarget = useBoardStore((s) => s.setTarget);
  const connection = useBoardStore((s) => s.connection);
  const sendSequencer = useBoardStore((s) => s.sendSequencer);
  const tempo = usePatchStore((s) => s.doc.globals.tempo);
  const setTempo = usePatchStore((s) => s.setTempo);
  const loading = state === 'loading';
  const boardConnected = connection === 'connected';

  const playSeq = (run: boolean) => {
    runSequencer(run);
    sendSequencer(run);
  };

  const value = target.sim && target.board ? 'both' : target.board ? 'board' : 'sim';
  const onTarget = (v: string) =>
    setTarget({ sim: v === 'sim' || v === 'both', board: v === 'board' || v === 'both' });

  return (
    <div className="patch-transport">
      <button
        type="button"
        className={enabled ? 'transport-btn transport-on' : 'transport-btn'}
        onClick={() => (enabled ? void stop() : void start())}
        disabled={loading}
        data-testid="audio-toggle"
      >
        {enabled ? '⏸ Audio' : '▶ Audio'}
      </button>
      <span className="transport-state" data-testid="engine-state">
        {loading ? 'loading…' : state === 'error' ? 'audio error' : enabled ? 'live' : 'stopped'}
      </span>
      <MidiInputPicker />
      <label className="transport-target" title="Where realtime control is sent">
        <span>Out</span>
        <select data-testid="output-target" value={value} onChange={(e) => onTarget(e.target.value)}>
          <option value="sim">Sim</option>
          <option value="board" disabled={!boardConnected}>
            Board
          </option>
          <option value="both" disabled={!boardConnected}>
            Both
          </option>
        </select>
      </label>
      <label className="transport-tempo" title="Sequencer tempo (BPM)">
        <span aria-hidden="true">♩</span>
        <input
          type="number"
          data-testid="tempo"
          aria-label="Sequencer tempo in BPM"
          min={20}
          max={300}
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
        />
      </label>
      <span className="transport-seq">
        <button
          type="button"
          className="transport-btn"
          data-testid="seq-start"
          aria-label="Start sequencer"
          onClick={() => playSeq(true)}
        >
          ▶ Seq
        </button>
        <button
          type="button"
          className="transport-btn"
          data-testid="seq-stop"
          aria-label="Stop sequencer"
          onClick={() => playSeq(false)}
        >
          ⏹
        </button>
      </span>
    </div>
  );
}

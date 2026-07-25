/**
 * The complete AMY parameter table — the app-wide source of truth (CLAUDE.md rule 5).
 * Transcribed from https://github.com/shorepine/amy/blob/main/docs/api.md
 * ("amy_event, amy.send, and amy_send API" tables). Every entry keeps the doc's
 * wording in `doc`. Nothing outside this file may hardcode wire letters or kwarg names.
 */

export type ParamKind =
  | 'uint'
  | 'int'
  | 'float'
  | 'floatlist' // comma-separated floats (fixed semantic slots, e.g. effects)
  | 'intlist' // comma-separated ints (e.g. voices)
  | 'coefs' // ControlCoefficients (9 slots, see constants.COEF_ORDER)
  | 'bplist' // envelope breakpoints: time(ms),value pairs; empty slots allowed
  | 'string'; // rest-of-message string (must be the last field before Z)

export interface ParamDef {
  /** Python/JS kwarg name (identical across bindings per api.md). */
  readonly name: string;
  /** Wire code letter(s). */
  readonly wire: string;
  readonly kind: ParamKind;
  readonly min?: number;
  readonly max?: number;
  /** Section in api.md, for docs/UI grouping. */
  readonly section: 'synth' | 'osc' | 'coefs' | 'pcm' | 'effects' | 'other';
  /** Condensed note from api.md. */
  readonly doc: string;
}

const P = (
  name: string,
  wire: string,
  kind: ParamKind,
  section: ParamDef['section'],
  doc: string,
  range?: { min?: number; max?: number },
): ParamDef => ({ name, wire, kind, section, doc, ...range });

export const PARAMS: readonly ParamDef[] = [
  // --- synths and voices ---
  P('synth', 'i', 'uint', 'synth', 'Define a set of voices for voice management.', { min: 0, max: 31 }),
  P('midi_cc', 'ic', 'string', 'synth', 'MIDI CC mapping command for this synth (C,L,N,X,O,CMD).'),
  P('synth_delay', 'id', 'uint', 'synth', 'Delay (ms) applied to synth note-ons.'),
  P('synth_flags', 'if', 'uint', 'synth', 'Synth creation flags: 1=MIDI drum note->preset translation; 2=drop note-offs.'),
  P('cv_trigger', 'ig', 'string', 'synth', 'External CV event triggering config (gate CV, thresholds, pitch CV, scale, offset, wire template).'),
  P('grab_midi_notes', 'im', 'uint', 'synth', '0 prevents default forwarding of MIDI note-on/offs to this synth.', { min: 0, max: 1 }),
  P('note_source_channel', 'iM', 'uint', 'synth', 'Marks events resulting from MIDI input (not re-forwarded to MIDI out).', { min: 1, max: 16 }),
  P('oscs_per_voice', 'in', 'uint', 'synth', 'Reserve this many oscs per voice when initializing a synth without a patch.', { min: 1 }),
  P('midi_note_cmd', 'io', 'string', 'synth', 'MIDI note on/off command mapping for this synth (M,L,N,X,O,CMD).'),
  P('pedal', 'ip', 'int', 'synth', 'Non-zero = sustain pedal down. Use with synth.'),
  P('to_synth', 'it', 'uint', 'synth', 'New synth number when renumbering an entire synth.', { min: 0, max: 31 }),
  P('num_voices', 'iv', 'uint', 'synth', 'Number of voices to allocate when defining a synth (with patch).'),
  P('synth_level', 'iV', 'float', 'synth', 'Per-instrument output level, default 1.0 (channel volume target).', { min: 0 }),
  P('patch', 'K', 'uint', 'synth', 'Apply patch: 0-127 Juno, 128-255 DX7, 256 piano, 258 legacy drums, 384-390 GM kits, 1024+ user.'),
  P('voices', 'r', 'intlist', 'synth', 'Comma-separated voice list to address / load patch into.'),
  P('patch_string', 'u', 'string', 'synth', 'AMY message defining a RAM patch (with patch 1024-1055) or direct synth config.'),

  // --- oscillator control ---
  P('osc', 'v', 'uint', 'osc', 'Which oscillator to control.'),
  P('wave', 'w', 'uint', 'osc', 'Waveform 0-21 (see constants.WAVES). Default SINE.', { min: 0, max: 21 }),
  P('reset', 'S', 'uint', 'osc', 'Reset osc; RESET_ALL_OSCS / RESET_TIMEBASE / RESET_AMY / RESET_SEQUENCER sentinels.'),
  P('bp0', 'A', 'bplist', 'osc', 'EG0 breakpoints time(ms),value pairs; last pair is release.'),
  P('bp1', 'B', 'bplist', 'osc', 'EG1 breakpoints time(ms),value pairs.'),
  P('feedback', 'b', 'float', 'osc', 'FM ALGO / karplus-strong feedback, or PCM looping (>0 on).', { min: 0, max: 1 }),
  P('chained_osc', 'c', 'uint', 'osc', 'Chained oscillator; note/vel events propagate along the chain.'),
  P('filter_type', 'G', 'uint', 'osc', 'Filter: 0 none, 1 lowpass, 2 bandpass, 3 highpass, 4 double-order lowpass.', { min: 0, max: 4 }),
  P('ratio', 'I', 'float', 'osc', 'ALGO: ratio of modulator frequency to base note frequency.'),
  P('mod_source', 'L', 'uint', 'osc', 'Oscillator used as modulation/LFO source (source becomes silent).'),
  P('portamento', 'm', 'uint', 'osc', 'Pitch glide time constant in ms; 0 = immediate.'),
  P('note', 'n', 'float', 'osc', 'MIDI note (fractional allowed); sets frequency.', { min: 0, max: 127 }),
  P('algorithm', 'o', 'uint', 'osc', 'DX7 FM algorithm for ALGO type.', { min: 1, max: 32 }),
  P('algo_source', 'O', 'string', 'osc', 'Six oscillators for the FM algorithm (starting op 6), empty = unused.'),
  P('preset', 'p', 'int', 'osc', 'PCM/wavetable preset number, or partial count if < 0 (BYO_PARTIALS).'),
  P('phase', 'P', 'float', 'osc', 'Cycle start phase 0-1; for PCM, sample start point consumed by next note-on.', { min: 0, max: 1 }),
  P('resonance', 'R', 'float', 'osc', 'Filter Q, 0.5-16.0, default 0.7.', { min: 0.5, max: 16 }),
  P('eg0_type', 'T', 'uint', 'osc', 'EG0 type: 0 normal (RC), 1 linear, 2 DX7, 3 exponential.', { min: 0, max: 3 }),
  P('eg1_type', 'X', 'uint', 'osc', 'EG1 type: 0 normal (RC), 1 linear, 2 DX7, 3 exponential.', { min: 0, max: 3 }),
  P('bus', 'y', 'int', 'osc', 'Bus this osc/synth outputs to (default 0).'),
  P('vel', 'l', 'float', 'osc', 'Note-on velocity; starts envelope / sets amplitude. 0 = note off.', { min: 0 }),

  // --- ControlCoefficients ---
  P('pan', 'Q', 'coefs', 'coefs', 'Stereo pan CtrlCoefs, 0=left 1=right, default 0.5.'),
  P('amp', 'a', 'coefs', 'coefs', 'Amplitude CtrlCoefs; default 1,0,1,1 (gain × vel × EG0); const 0 mutes; combined in dB domain.'),
  P('duty', 'd', 'coefs', 'coefs', 'Pulse duty CtrlCoefs, default 0.5.'),
  P('freq', 'f', 'coefs', 'coefs', 'Frequency CtrlCoefs; default 440,1,0,0,0,0,1 (note pitch + bend).'),
  P('filter_freq', 'F', 'coefs', 'coefs', 'Filter cutoff/center frequency CtrlCoefs.'),

  // --- PCM sampling ---
  P('load_sample', 'z', 'string', 'pcm', 'Start sample load: preset,length,samplerate,channels,midinote,loopstart,loopend; then base64 frames.'),
  P('disk_sample', 'zF', 'string', 'pcm', 'Play PCM preset live from WAV file on host disk: preset,filename,midinote.'),
  P('start_sample', 'zS', 'string', 'pcm', 'Start sampling into a stereo PCM preset: preset,source,maxframes,midinote,loopstart,loopend.'),
  P('stop_sample', 'zO', 'uint', 'pcm', 'Stop sampling (param ignored).'),

  // --- per-bus effects ---
  P('reverb', 'h', 'floatlist', 'effects', 'Reverb: level, liveness, damping, xover_hz.'),
  P('chorus', 'k', 'floatlist', 'effects', 'Chorus: level, max_delay(samples), lfo_freq(Hz), depth.'),
  P('echo', 'M', 'floatlist', 'effects', 'Echo: level, delay_ms, max_delay_ms, feedback, filter_coef (-1 HPF..+1 LPF).'),
  P('eq', 'x', 'floatlist', 'effects', 'EQ dB low(~800Hz)/mid(~2500Hz)/high(~7500Hz), -15..15.'),

  // --- other / global ---
  P('sequence', 'H', 'intlist', 'other', 'Sequencer slot: tick offset, period, tag.'),
  P('tempo', 'j', 'float', 'other', 'Sequencer tempo in BPM, default 108.'),
  P('sequencer_run', 'zY', 'uint', 'other', 'Sequencer transport: 1 start, 0 stop.', { min: 0, max: 1 }),
  P('external_midi_sync', 'zC', 'uint', 'other', 'MIDI clock sync: 0 internal, 1 follow, 2 master.', { min: 0, max: 2 }),
  P('latency_ms', 'N', 'uint', 'other', 'Latency in ms, default 0.'),
  P('pitch_bend', 's', 'float', 'other', 'Global pitch bend in (fractional) octaves.'),
  P('time', 't', 'uint', 'other', 'Playback time (ms) for future scheduling.'),
  P('volume', 'V', 'floatlist', 'other', 'Final mixdown volume per bus, default 1.0.'),
  P('client', 'g', 'uint', 'other', 'Client number for Alles distributed synthesis.'),
  P('external_channel', 'W', 'uint', 'other', 'External channel routing (CV output on Tulip/AMYboard).'),
  P('debug', 'D', 'uint', 'other', 'Debug output level 2-4 (interrupts audio).', { min: 2, max: 4 }),
  P('transfer_file', 'zT', 'string', 'other', 'Transfer file to host: destination filename, size; then base64 chunks.'),
  P('update_file', 'zA', 'string', 'other', 'Update host file with current AMY state (default /user/current/sketch.py).'),
  P('dump_sysex', 'zD', 'string', 'other', 'Dump state (no arg) or file (filename) over SysEx.'),
  P('exec', 'zP', 'string', 'other', 'Execute code string on host (max 255 chars).'),
  P('ping', 'zI', 'string', 'other', 'Ping host; replies F0 00 03 45 4F 4B F7.'),
  P('reboot', 'zB', 'string', 'other', 'Reboot host: empty/0 bootloader, 1 normal, 2 flash mode.'),
];

export const PARAM_BY_NAME: ReadonlyMap<string, ParamDef> = new Map(PARAMS.map((p) => [p.name, p]));
export const PARAM_BY_WIRE: ReadonlyMap<string, ParamDef> = new Map(PARAMS.map((p) => [p.wire, p]));

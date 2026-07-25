# AMY / AMYboard Reference (verified condensed facts)

Primary sources — consult these when extending, cite file+line when adding params:
- AMY engine & API: https://github.com/shorepine/amy (README = full parameter reference)
- AMYboard docs: https://github.com/shorepine/tulipcc/tree/main/docs/amyboard
  (`control_api.md`, `python.md`, `modular.md`, `online.md`, `firmware.md`)
- Reference SysEx client: `tulipcc/tools/amyboardctl`
- Protocol implementation: `amy/src/parse.c`, `amy/src/amy_midi.c`, `amy/src/transfer.c`

## AMY engine essentials

- Small C synth library; official builds for Python (`pip install amy` / local build), Arduino,
  **JavaScript/WASM via emscripten** (`make docs/amy.js`, AudioWorklet-ready; minimal example
  `minimal.html` in the AMY repo). GDScript too (irrelevant here).
- Synthesis: analog-style oscillators (sine, pulse w/ duty, saw up/down, triangle, noise),
  wavetable/PCM sampler, DX7-style operator/algorithm FM, partials, piano.
- Per oscillator: biquad filter (LPF/BPF/HPF, cutoff, resonance), **two envelope generators
  (bp0, bp1)** assignable to amp, freq, PWM duty, filter cutoff, pan; oscillators can modulate
  other oscillators (LFO = an osc used as mod source).
- Global effects: reverb, chorus, echo, EQ.
- **Presets**: Juno-6 patches 0–127, DX7 patches 128–255, piano 256, GM drum kits 384–390.
  Selected via `patch` number + `synth`/`num_voices` for polyphony management.
- **Wire protocol**: terse ASCII messages, one letter per field, e.g. `v0n50l1K130r0Z`
  (`v`=osc, `n`=midi note, `l`=velocity, `K`=load patch, `r`=voices, `Z`=terminator). Python
  `amy.send(**kwargs)` maps kwarg names to these fields 1:1. Wire messages are the
  serialization format — the board's state dump and our compiler both speak it.
- Sequencer: built-in event sequencer (timestamped/looped events) — used for our step/drum
  sequencer modules; start/stop is exposed on the board via SysEx `zY1Z`/`zY0Z`.

> **Task for P0-03:** generate `packages/amy-protocol/src/params.ts` — the complete typed table
> of amy.send kwargs ↔ wire letters ↔ value ranges/enums — by transcribing the AMY README
> parameter reference. This table is the app-wide source of truth; nothing else may hardcode
> parameter names.

## AMYboard hardware

- ESP32-S3, MicroPython userland; 10HP Eurorack form factor.
- Audio: line-level 3.5mm stereo analog + S/PDIF.
- MIDI: USB-C gadget MIDI + TRS in/out.
- **CV: 2 in / 2 out, ±10 V, 12-bit** (ADC ADS1015 @0x48, DAC GP8413 @0x58). ~6 cent min pitch
  step over 20 V span. Line-level (1Vpp) by default; DIP switches 1–4 enable 10Vpp Eurorack mode.
- MicroSD storage, I2C Grove port (encoders, OLED display), USB-C / Eurorack 10-pin power.

## Sketch model (what our doc→python compiler emits)

`/user/current/sketch.py` runs at boot: top-level statements once, then optional
`def loop():` called ~every 60 ms.

```python
import amy, amyboard
amy.send(synth=1, patch=0, num_voices=6)      # setup: instruments, routing, effects

def loop():
    v = amyboard.cv_in(channel=0)             # poll CV, map to params
    ...
```

APIs available on-board: `amy.send(...)`; `amyboard.cv_in(channel)` / `amyboard.cv_out(voltage,
channel)` / `amyboard.set_cv_out(channel, synth)` (route synth audio to CV DAC);
`amyboard.encoder()`; `amyboard.init_display()` / `display_refresh()` /
`set_display_rotation()`; `tulip.midi_callback()` for raw MIDI events. CV can also trigger AMY
events directly via `amy.send(cv_trigger=...)`, and `CtrlCoefs` `ext0/ext1` let params follow
CV inputs inside the engine (1V/oct: `freq = const * 2**(ext0 * volts)`).

## Board control protocol (WebMIDI SysEx) — the contract for `packages/board`

Board appears as MIDI port named **`AMYboard`**. Frame envelope:

```
F0 00 03 45 <7-bit ASCII payload> F7        (binary payloads base64-encoded)
```

**Flow control:** board ACKs every frame with `F0 00 03 45 'A' 'K' F7`. Send one frame, await
ACK (5 s timeout), then next. Exceptions: `zB*` (reboot) and `zI` (ping) don't ACK normally.

Host→board commands (payload shown):

| Command | Purpose |
|---|---|
| `zT<path>,<size>Z` | begin file write, then base64 chunks of ≤188 raw bytes, each ACKed |
| `zD Z` | dump full synth state as newline-separated wire commands |
| `zD<path>Z` | read a file from board FS |
| `zA Z` | persist current state into the sketch (knob block) |
| `zP<python≤255B>Z` | execute one Python line (realtime control path) |
| `zY1Z` / `zY0Z` | sequencer start/stop |
| `zBZ` / `zB1Z` | reboot to bootloader / normal reboot running sketch |
| `zIZ` | ping (board answers `OK`) |

Board→host tags: `AK` ack, `OK` pong, `X<base64 traceback>` sketch error, `V<version>`,
`0`/`C`/`E` single/continuation/final dump frames.

**Sketch upload sequence:** `zT/user/current/sketch.py,<size>Z` → ACK → chunks (base64, ACK
each) → `zPimport amyboard; amyboard.environment_transfer_done()Z`.

**Patch import from board:** send `zD Z`, collect `0|C…E` frames, concatenate → wire-command
lines → feed `patchdoc` wire→doc importer.

## Realtime control

- Standard (non-SysEx) MIDI works alongside: NoteOn `0x90 n v`, NoteOff `0x80 n 0`, CC, program
  change, pitch bend; sketches conventionally listen on channel 1.
- For arbitrary parameter changes push `zPamy.send(...)Z` (fits in 255 bytes) or a raw wire
  message via the same path; prefer MIDI CC when a param has a CC mapping (lower overhead).

## Existing amyboard.com editor (differentiation context)

Official web editor offers: WebMIDI control mode with sketch/knob sync, browser simulate mode
(full AMYboard incl. MicroPython REPL, virtual OLED/encoder/CV), a **rigid** 16-channel
knob-column patch editor, community sharing ("AMYboard World"). It has no modular canvas, no
drum-machine UI, no module library, no LLM features. **We treat it as the baseline to beat,
not a scope boundary** — we build the better patch-building experience across the board, and
its existence never justifies deferring a feature. What we do keep is protocol compatibility:
same sketch format, same SysEx protocol, so sketches we emit remain loadable/editable on
amyboard.com and vice versa. Its simulate mode is also proof that full MicroPython-in-browser
simulation is feasible (our Phase 6).

## Unverified / to confirm during implementation

- Exact chunk ACK timing tolerances and dump frame ordering under load → validate against
  `amyboardctl` source in ticket P3-02.
- Whether the WASM build in the AMY repo exposes sequencer + `ext0/ext1` CV hooks in JS →
  validate in ticket P0-05; if missing, patch the emscripten exports (documented in AMY's
  Makefile) and record in DECISIONS.md.

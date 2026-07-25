# Hardware QA Checklist — AMYboard

Manual smoke test for a real AMYboard (docs/06 §6). The agent keeps the exact steps and expected
observations here; **the owner runs them with the board connected** and ticks each box. This is
Milestone **M3**.

## Setup

- [ ] Use a Chromium-based browser (Web MIDI required). Chrome/Edge on desktop.
- [ ] Connect the AMYboard over USB-C. It should enumerate as a MIDI port named **`AMYboard`**.
- [ ] `npm run dev`, open the app, go to **Patch**.
- [ ] Top-right chip shows **no board** with a **Connect** button (not "MIDI unsupported" —
      if it does, the browser lacks Web MIDI).

## 1. Connect

- [ ] Click **Connect**. The browser prompts for MIDI (with SysEx) access — allow it.
- [ ] The chip dot turns green and the label reads **AMYboard**. Extra buttons appear:
      **⬆ Upload**, **⬇ Import**, **Board ▾**.
- **If it fails:** the chip shows `board error` and hovering it shows the reason (e.g. no
      `AMYboard` port found). Re-seat the cable and retry.

## 2. Ping (`zI` → `OK`)

- [ ] Open **Board ▾** → **Ping**. Within ~1 s the menu item shows **pong ✓**.
- Expected on the wire: host sends `F0 00 03 45 'z' 'I' 'Z' F7`; board replies
      `F0 00 03 45 'O' 'K' F7`.

## 3. Import current board state (`zD` dump)

- [ ] Click **⬇ Import**. The canvas replaces its contents with a patch named **Board Import**.
- [ ] The reconstructed graph is plausible: oscillators, filters, envelopes and any preset voice
      the board currently holds, cabled left→right.
- Expected: host sends `zD Z`; board streams `0…`/`C…`/`E…` frames; the app concatenates them and
      runs `parseWireDump`.

## 4. Upload a sketch (`zT` sequence)

- [ ] Build or generate a simple patch (e.g. a saw → filter → out with an amp envelope).
- [ ] Click **⬆ Upload**. The button shows **Uploading n/total** and returns to **⬆ Upload**.
- [ ] No error panel appears.
- Expected: `zT/user/current/sketch.py,<size>Z` → base64 chunks (each ACKed) →
      `zP…environment_transfer_done()Z`.

## 5. Realtime knob → audible change

- [ ] Set the output selector (**Out**) to **Both** (or **Board**).
- [ ] Play a note on the on-screen **Keyboard** module — the board makes sound.
- [ ] Turn the filter **Cutoff** knob while holding a note — the timbre changes **in real time**
      on the board's audio output.
- Expected: knob → `zP amy.send(...)Z`; keyboard → `zP amy.send(osc=…, note=…, vel=…)Z`.

## 6. Sequencer transport (`zY`)

- [ ] With a sequenced patch, click **▶ Seq** (board output). The sequence starts on the board.
- [ ] Click **⏹**. It stops.
- Expected: `zY1Z` / `zY0Z`.

## 7. Error path (broken sketch → `X` traceback)

- [ ] In the **Code** workspace, paste a sketch with a deliberate error (e.g. `def loop(): x = 1/0`
      as custom code), go to **Patch**, click **⬆ Upload**.
- [ ] A red **traceback panel** appears top-right with the Python error and a line number, plus a
      **View code** link.
- Expected: the board replies with an `X<base64 traceback>` frame after the transfer-done exec.

## 8. Save + reboot recovery

- [ ] Open **Board ▾** → **Save state to board (zA)**. No error.
- [ ] Open **Board ▾** → **Reboot (run sketch)**. The board reboots and comes back running the
      saved sketch (audio resumes / re-connect the chip if the port drops).
- [ ] (Optional) **Reboot to bootloader** enters DFU/flash mode for firmware updates.
- Expected: `zA Z`; `zB1Z` (normal) / `zBZ` (bootloader). Reboot/ping are not ACKed.

## Recording deltas

If any observed byte sequence differs from the "Expected" notes above (validated against docs/02 /
`amyboardctl`), record the delta in `docs/DECISIONS.md` under a P3-06 entry and adjust
`packages/board` accordingly.

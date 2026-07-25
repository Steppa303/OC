import { describe, expect, it } from 'vitest';
import { parseMidiMessage } from './midiInput';

describe('parseMidiMessage', () => {
  it('parses a note-on on the matching channel', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 127]), 1)).toEqual({ note: 60, vel: 1, on: true });
    expect(parseMidiMessage(new Uint8Array([0x94, 67, 64]), 5)).toMatchObject({ note: 67, on: true });
  });

  it('treats note-on with velocity 0 and note-off as note-off', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 0]), 1)).toEqual({ note: 60, vel: 0, on: false });
    expect(parseMidiMessage(new Uint8Array([0x80, 60, 40]), 1)).toEqual({ note: 60, vel: 0, on: false });
  });

  it('routes by channel: drops notes on other channels (PatchDoc io)', () => {
    // status 0x90 = channel 1; asking for channel 2 → dropped
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 100]), 2)).toBeNull();
    // status 0x91 = channel 2 → passes when routing to channel 2
    expect(parseMidiMessage(new Uint8Array([0x91, 60, 100]), 2)).toMatchObject({ note: 60, on: true });
  });

  it('ignores non-note messages (CC, clock, malformed)', () => {
    expect(parseMidiMessage(new Uint8Array([0xb0, 7, 100]), 1)).toBeNull(); // CC
    expect(parseMidiMessage(new Uint8Array([0xf8]), 1)).toBeNull(); // clock
    expect(parseMidiMessage(new Uint8Array([]), 1)).toBeNull();
  });
});

# AMYboard Sketch
# DESCRIPTION: Valhalla Shimmer + CV gate drums: kick triggered by gate on CV1 In,
# snare triggered by gate on CV2 In. Lush near-infinite reverb shimmer pads auto-play
# a dreamy pentatonic scale. Encoder 0 = reverb liveness, Encoder 1 = shimmer note rate.

import amy
import amyboard
import sequencer

amyboard.set_display_rotation(90)

amyboard.init_display()
amyboard.display.fill(0)
amyboard.display.text("Valhalla", 16, 32, 255)
amyboard.display.text("Shimmer", 20, 44, 255)
amyboard.display.text("CV1:Kick", 8, 68, 180)
amyboard.display.text("CV2:Snare", 4, 80, 180)
amyboard.display_refresh()

sequencer.tempo(60)

REVERB_LEVEL = 0.0
REVERB_LIVENESS = 0.97
REVERB_DAMPING = 0.15
amy.send(reverb="0.0,0.970,0.150")
amy.send(chorus="0.0,320,0.3,0.5")
amy.send(echo="0.0,480,1000,0.55,0.3")

# Audio pass-through
amy.send(synth=18, num_voices=1, oscs_per_voice=2)
amy.send(synth=18, osc=0, wave=amy.AUDIO_IN0, pan=0.0, amp=10)
amy.send(synth=18, osc=1, wave=amy.AUDIO_IN1, pan=1.0, amp=10)
amy.send(synth=18, vel=1, note=60)

# Shimmer synth 1: at-pitch saw pads (3 Juno voices = 3/8 budget)
amy.send(synth=1, num_voices=3, oscs_per_voice=2, grab_midi_notes=0)
amy.send(synth=1, osc=0, wave=amy.SILENT, chained_osc=1,
 filter_type=amy.FILTER_LPF,
 filter_freq=1800.0,
 resonance=0.6,
 amp={'const': 0.0, 'vel': 1, 'eg0': 1},
 bp0='3000,1,0,1,4000,0')
amy.send(synth=1, osc=1, wave=amy.SAW_DOWN,
 amp={'const': 0.35, 'note': 0, 'vel': 0, 'eg0': 0},
 freq={'const': 440, 'note': 1, 'bend': 1},
 pan=0.3)

# Shimmer synth 2: octave-up sine pads (3 Juno voices = 3/8 budget)
# Total Juno: 3+3 = 6/8 = 0.75, within budget
amy.send(synth=2, num_voices=3, oscs_per_voice=2, grab_midi_notes=0)
amy.send(synth=2, osc=0, wave=amy.SILENT, chained_osc=1,
 filter_type=amy.FILTER_LPF,
 filter_freq=3500.0,
 resonance=0.5,
 amp={'const': 0.0, 'vel': 1, 'eg0': 1},
 bp0='5000,1,0,1,6000,0')
amy.send(synth=2, osc=1, wave=amy.SINE,
 amp={'const': 0.22, 'note': 0, 'vel': 0, 'eg0': 0},
 freq={'const': 880, 'note': 1, 'bend': 1},
 pan=0.7)

# TR-808 drum synth on synth 15 (free from MIDI channels 1-16)
# synth_flags=3: GM drum note map + ignore note-offs (one-shot samples)
amy.send(synth=15, patch=384, num_voices=4, synth_flags=3)

# CV gate triggers: rising edge above 3V fires note, rearms when CV drops below 1V
# CV1 (channel 0) -> kick drum (GM note 36)
amy.send(cv_trigger='0,3.0,1.0,i15l1n36')
# CV2 (channel 1) -> snare drum (GM note 38)
amy.send(cv_trigger='1,3.0,1.0,i15l1n38')

SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81]
SCALE_UP = [n + 12 for n in SCALE]

scale_idx = 0
prev_note1 = None
prev_note2 = None
shimmer_steps = 16

enc = amyboard.encoder()
_last_enc = [enc.read(i) for i in range(enc.encoders)]
_reverb_liveness = REVERB_LIVENESS


def _clamp(v, lo, hi):
 if v < lo:
  return lo
 if v > hi:
  return hi
 return v


def loop(step):
 global scale_idx, prev_note1, prev_note2
 global shimmer_steps, _reverb_liveness, _last_enc

 for i in range(enc.encoders):
  pos = enc.read(i)
  delta = pos - _last_enc[i]
  _last_enc[i] = pos
  if delta:
   if i == 0:
    _reverb_liveness = _clamp(_reverb_liveness + delta * 0.01, 0.50, 0.999)
    amy.send(reverb="%.3f,%.3f,%.3f" % (REVERB_LEVEL, _reverb_liveness, REVERB_DAMPING))
   elif i == 1:
    rates = [4, 8, 12, 16, 24, 32]
    if shimmer_steps in rates:
     cur = rates.index(shimmer_steps)
    else:
     cur = 3
    cur = _clamp(cur + (1 if delta > 0 else -1), 0, len(rates) - 1)
    shimmer_steps = rates[cur]
   if i < enc.leds:
    r = int((_reverb_liveness - 0.5) / 0.499 * 255)
    enc.led(i, r, 0, 255 - r)

 if step % shimmer_steps == 0:
  if prev_note1 is not None:
   amy.send(synth=1, note=prev_note1, vel=0)
  if prev_note2 is not None:
   amy.send(synth=2, note=prev_note2, vel=0)

  idx = scale_idx % len(SCALE)
  if (scale_idx // len(SCALE)) % 2 == 1:
   idx = len(SCALE) - 1 - idx
  n1 = SCALE[idx]
  n2 = SCALE_UP[idx]

  amy.send(synth=1, note=n1, vel=0.55)
  amy.send(synth=2, note=n2, vel=0.40)

  prev_note1 = n1
  prev_note2 = n2
  scale_idx += 1
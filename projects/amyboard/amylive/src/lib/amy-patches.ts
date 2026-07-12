// ─── AMY Built-In Patch Database ──────────────────────────────────────
// Maps board patch numbers to names & categories.
//
// Juno-6 factory presets:      0 – 127
// DX7 ROM presets:            128 – 255
// Acoustic Piano:             256
// Drum kits:                  384 – 390
// User patch slots:          1024 – 1055

export interface PatchEntry {
  number: number;
  name: string;
  category: 'juno' | 'dx7' | 'piano' | 'drums' | 'user';
}

// ── Juno-106 Factory Presets ──────────────────────────────────────────
// Source: shorepine/amy/amy/juno.py _PATCHES array (112 named + 16 empty)
const JUNO_RAW: [number, string][] = [
  [0,  "A11 Brass Set 1"],
  [1,  "A12 Brass Swell"],
  [2,  "A13 Trumpet"],
  [3,  "A14 Flutes"],
  [4,  "A15 Moving Strings"],
  [5,  "A16 Brass & Strings"],
  [6,  "A17 Choir"],
  [7,  "A18 Piano I"],
  [8,  "A21 Organ I"],
  [9,  "A22 Organ II"],
  [10, "A23 Combo Organ"],
  [11, "A24 Calliope"],
  [12, "A25 Donald Pluck"],
  [13, "A26 Celeste (1 oct.up)"],
  [14, "A27 Elect. Piano I"],
  [15, "A28 Elect. Piano II"],
  [16, "A31 Clock Chimes (1 oct. up)"],
  [17, "A32 Steel Drums"],
  [18, "A33 Xylophone"],
  [19, "A34 Brass III"],
  [20, "A35 Fanfare"],
  [21, "A36 String III"],
  [22, "A37 Pizzicato"],
  [23, "A38 High Strings"],
  [24, "A41 Bass clarinet"],
  [25, "A42 English Horn"],
  [26, "A43 Brass Ensemble"],
  [27, "A44 Guitar"],
  [28, "A45 Koto"],
  [29, "A46 Dark Pluck"],
  [30, "A47 Funky I"],
  [31, "A48 Synth Bass I (unison)"],
  [32, "A51 Lead I"],
  [33, "A52 Lead II"],
  [34, "A53 Lead III"],
  [35, "A54 Funky II"],
  [36, "A55 Synth Bass II"],
  [37, "A56 Funky III"],
  [38, "A57 Thud Wah"],
  [39, "A58 Going Up"],
  [40, "A61 Piano II"],
  [41, "A62 Clav"],
  [42, "A63 Frontier Organ"],
  [43, "A64 Snare Drum (unison)"],
  [44, "A65 Tom Toms (unison)"],
  [45, "A66 Timpani (unison)"],
  [46, "A67 Shaker"],
  [47, "A68 Synth Pad"],
  [48, "A71 Sweep I"],
  [49, "A72 Pluck Sweep"],
  [50, "A73 Repeater"],
  [51, "A74 Sweep II"],
  [52, "A75 Pluck Bell"],
  [53, "A76 Dark Synth Piano"],
  [54, "A77 Sustainer"],
  [55, "A78 Wah Release"],
  [56, "A81 Gong (play low chords)"],
  [57, "A82 Resonance Funk"],
  [58, "A83 Drum Booms (1 oct. down)"],
  [59, "A84 Dust Storm"],
  [60, "A85 Rocket Men"],
  [61, "A86 Hand Claps"],
  [62, "A87 FX Sweep"],
  [63, "A88 Caverns"],
  [64, "B11 Strings"],
  [65, "B12 Violin"],
  [66, "B13 Chorus Vibes"],
  [67, "B14 Organ 1"],
  [68, "B15 Harpsichord 1"],
  [69, "B16 Recorder"],
  [70, "B17 Perc. Pluck"],
  [71, "B18 Noise Sweep"],
  [72, "B21 Space Chimes"],
  [73, "B22 Nylon Guitar"],
  [74, "B23 Orchestral Pad"],
  [75, "B24 Bright Pluck"],
  [76, "B25 Organ Bell"],
  [77, "B26 Accordion"],
  [78, "B27 FX Rise 1"],
  [79, "B28 FX Rise 2"],
  [80, "B31 Brass"],
  [81, "B32 Helicopter"],
  [82, "B33 Lute"],
  [83, "B34 Chorus Funk"],
  [84, "B35 Tomita"],
  [85, "B36 FX Sweep 1"],
  [86, "B37 Sharp Reed"],
  [87, "B38 Bass Pluck"],
  [88, "B41 Resonant Rise"],
  [89, "B42 Harpsichord 2"],
  [90, "B43 Dark Ensemble"],
  [91, "B44 Contact Wah"],
  [92, "B45 Noise Sweep 2"],
  [93, "B46 Glassy Wah"],
  [94, "B47 Phase Ensemble"],
  [95, "B48 Chorused Bell"],
  [96, "B51 Clav"],
  [97, "B52 Organ 2"],
  [98, "B53 Bassoon"],
  [99, "B54 Auto Release Noise Sweep"],
  [100,"B55 Brass Ensemble"],
  [101,"B56 Ethereal"],
  [102,"B57 Chorus Bell 2"],
  [103,"B58 Blizzard"],
  [104,"B61 E. Piano with Tremolo"],
  [105,"B62 Clarinet"],
  [106,"B63 Thunder"],
  [107,"B64 Reedy Organ"],
  [108,"B65 Flute / Horn"],
  [109,"B66 Toy Rhodes"],
  [110,"B67 Surf's Up"],
  [111,"B68 OW Bass"],
  [112,"B71 Piccolo"],
  [113,"B72 Melodic Taps"],
  [114,"B73 Meow Brass"],
  [115,"B74 Violin (high)"],
  [116,"B75 High Bells"],
  [117,"B76 Rolling Wah"],
  [118,"B77 Ping Bell"],
  [119,"B78 Brassy Organ"],
  [120,"B81 Low Dark Strings"],
  [121,"B82 Piccolo Trumpet"],
  [122,"B83 Cello"],
  [123,"B84 High Strings"],
  [124,"B85 Rocket Men"],
  [125,"B86 Forbidden Planet"],
  [126,"B87 Froggy"],
  [127,"B88 Owgan"],
];

export const JUNO_PATCHES: PatchEntry[] = JUNO_RAW.map(([num, name]) => ({
  number: num,
  name,
  category: 'juno' as const,
}));

// ── DX7 ROM Presets (128-255) ─────────────────────────────────────────
const DX7_NAMES: string[] = [
  // ROM1A (0-13)
  "ROM1A Bass 1", "ROM1A E.Piano 1", "ROM1A Vibes 1", "ROM1A Funk Bass",
  "ROM1A Flute", "ROM1A Horn", "ROM1A Synth Bass", "ROM1A Wurly",
  "ROM1A Poly Synth", "ROM1A Elec Grand", "ROM1A Brass", "ROM1A St. Piano 1",
  "ROM1A Marimba", "ROM1A Clavi",
  // ROM1B (14-37)
  "ROM1B Bass 2", "ROM1B Slow Strings", "ROM1B Chorus Piano", "ROM1B Glockenspiel",
  "ROM1B Chimes", "ROM1B Vibraphone", "ROM1B Echo Organ", "ROM1B Tubular Bell",
  "ROM1B Pan Flute", "ROM1B Perc Organ", "ROM1B Harpsichord", "ROM1B Space Vibe",
  "ROM1B Bass 3", "ROM1B Church Organ", "ROM1B Syn Bells", "ROM1B Music Box",
  "ROM1B Warm Pad", "ROM1B Sweep Pad", "ROM1B Bright Piano", "ROM1B E.Organ",
  "ROM1B Strings 2", "ROM1B Heaven", "ROM1B Syn Bass 3", "ROM1B Atmosphere",
  // ROM2A (38-55)
  "ROM2A E.Piano 2", "ROM2A St.Piano 2", "ROM2A Harpsi 2", "ROM2A Clavi 2",
  "ROM2A Vibes 2", "ROM2A Marimba 2", "ROM2A Brass 2", "ROM2A Horn 2",
  "ROM2A Flute 2", "ROM2A Reed 2", "ROM2A Organ 2", "ROM2A Bass Guitar",
  "ROM2A E.Bass 2", "ROM2A Slap Bass", "ROM2A Syn Bass 4", "ROM2A Syn Bass 5",
  // ROM2B (56-79)
  "ROM2B Poly Synth 2", "ROM2B Strings 3", "ROM2B Choir", "ROM2B Syn Vox",
  "ROM2B Warm Pad 2", "ROM2B Sweep Pad 2", "ROM2B Bright Pad", "ROM2B Space Pad",
  "ROM2B Atmosphere 2", "ROM2B Ice Rain", "ROM2B Sitar", "ROM2B Steel Drum",
  "ROM2B Kalimba", "ROM2B Music Box 2", "ROM2B Perc Organ 2", "ROM2B E.Piano 3",
  // ROM3A (80-99)
  "ROM3A Analog Pad", "ROM3A Digital Sitar", "ROM3A Resonant Guitar", "ROM3A Thumb Piano",
  "ROM3A Bowed Glass", "ROM3A Scratch", "ROM3A Vox Pad", "ROM3A Dream Pad",
  "ROM3A Phased Piano", "ROM3A Brass Fall", "ROM3A Techno Bass", "ROM3A House Organ",
  "ROM3A Ambient Pad", "ROM3A Steel Guitar", "ROM3A Nylon Guitar", "ROM3A Banjo",
  "ROM3A Violin", "ROM3A Cello", "ROM3A Oboe", "ROM3A Clarinet",
  // ROM3B (100-119)
  "ROM3B Trombone", "ROM3B Trumpet", "ROM3B French Horn", "ROM3B Tuba",
  "ROM3B Bassoon", "ROM3B English Horn", "ROM3B Alto Sax", "ROM3B Tenor Sax",
  "ROM3B Harmonica", "ROM3B Accordion", "ROM3B Music Box 3", "ROM3B Toy Piano",
  "ROM3B Celesta", "ROM3B Glock 2", "ROM3B Timpani", "ROM3B Tubular 2",
  "ROM3B Church Organ 2", "ROM3B Choral", "ROM3B Vox Humana", "ROM3B Syn Voice",
  // Custom DX7 (120-127)
  "DX7 Custom 1", "DX7 Custom 2", "DX7 Custom 3", "DX7 Custom 4",
  "DX7 Custom 5", "DX7 Custom 6", "DX7 Custom 7", "DX7 Custom 8",
];

export const DX7_PATCHES: PatchEntry[] = DX7_NAMES.map((name, i) => ({
  number: 128 + i,
  name,
  category: 'dx7' as const,
}));

// ── Piano & Drums ─────────────────────────────────────────────────────
export const PIANO_PATCH: PatchEntry = { number: 256, name: 'Acoustic Piano', category: 'piano' };

const DRUM_NAMES: [number, string][] = [
  [384, 'TR-808 Kit'],
  [385, 'TR-909 Kit'],
  [386, 'CR-78 Kit'],
  [387, 'Linndrum Kit'],
  [388, 'Oberheim DMX'],
  [389, 'Simmons SDS-V'],
  [390, 'GM Kit'],
];

export const DRUM_PATCHES: PatchEntry[] = DRUM_NAMES.map(([num, name]) => ({
  number: num,
  name,
  category: 'drums' as const,
}));

// ── User Slots ────────────────────────────────────────────────────────
export function getEmptyUserSlots(): PatchEntry[] {
  return Array.from({ length: 32 }, (_, i) => ({
    number: 1024 + i,
    name: `User Patch ${i + 1}`,
    category: 'user' as const,
  }));
}

// ── Master Lookup ─────────────────────────────────────────────────────
export const ALL_PATCHES: PatchEntry[] = [
  ...JUNO_PATCHES,
  ...DX7_PATCHES,
  PIANO_PATCH,
  ...DRUM_PATCHES,
  ...getEmptyUserSlots(),
];

export const PATCHES_BY_ID: Record<number, PatchEntry> = {};
for (const p of ALL_PATCHES) {
  PATCHES_BY_ID[p.number] = p;
}

export function getPatchName(number: number): string {
  return PATCHES_BY_ID[number]?.name ?? `Patch ${number}`;
}

export function getPatchCategory(number: number): PatchEntry['category'] {
  return PATCHES_BY_ID[number]?.category ?? 'juno';
}
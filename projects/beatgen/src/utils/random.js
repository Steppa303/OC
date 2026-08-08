/**
 * Seeded pseudo-random number generator (Mulberry32)
 * Deterministic: same seed → same sequence → reproducible patterns
 */

/**
 * Create a seeded random function
 * @param {number} seed - Integer seed value
 * @returns {function} - Function that returns 0-1 on each call
 */
export function seededRandom(seed) {
  let state = seed | 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash a set of parameters into a numeric seed
 * @param {...any} args - Values to hash
 * @returns {number} - Integer seed
 */
export function hashParams(...args) {
  const str = JSON.stringify(args);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return hash;
}

export type MovementMode = 'fly' | 'walk';

// Metres per second. Speed is deliberately restrained until Shift is held.
export function movementSpeed(mode: MovementMode, boost: boolean) {
  return mode === 'fly' ? (boost ? 28 : 4.5) : (boost ? 5.5 : 1.8);
}

export function windSettings(_speed: number, altitude: number, time = 0) {
  const height = Math.min(Math.max(altitude, 0) / 1100, 1);
  const breeze = .5 + .3 * Math.sin(time * .071) + .2 * Math.sin(time * .113 + 1.9);
  return {
    // Air changes slowly with the weather, never surging when a movement key is held.
    gain: .012 + breeze * .004 + height * .003,
    cutoff: 620 + height * 160 + breeze * 50,
  };
}

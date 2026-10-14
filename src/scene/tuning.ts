export type MovementMode = 'fly' | 'walk';

// Metres per second. Speed is deliberately restrained until Shift is held.
export function movementSpeed(mode: MovementMode, boost: boolean) {
  return mode === 'fly' ? (boost ? 28 : 4.5) : (boost ? 5.5 : 1.8);
}

export function windSettings(speed: number, altitude: number) {
  const movement = Math.min(Math.max(speed, 0) / 28, 1);
  const height = Math.min(Math.max(altitude, 0) / 1100, 1);
  return {
    // Even at full sprint or flight boost, wind remains a quiet background layer.
    gain: .065 + movement * .025 + height * .01,
    cutoff: 270 + movement * 65 + height * 30,
  };
}

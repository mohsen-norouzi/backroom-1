import { EYE_HEIGHT, FLOOR, TOP, NOTCH_END, notchBackZ } from './physics.ts';

export const LADDER_Z = NOTCH_END + .5;
export const LADDER_CAMERA_Z = LADDER_Z + 1.05;
export function ladderZAt(y: number) { return notchBackZ(y) + .5; }
export function ladderCameraZ(eyeY: number) { return ladderZAt(eyeY - EYE_HEIGHT) + 1.05; }
export const LADDER_SPEED = 1.25;
type Position = { x: number; y: number; z: number };

// Attachment is independent of movement keys and camera orientation.
export class LadderController {
  attached = false;
  speed = 0;
  private cooldown = 0;

  reset() { this.attached = false; this.speed = 0; this.cooldown = .6; }

  release(position: Position) {
    this.reset();
    position.z = ladderCameraZ(position.y) + .75;
  }

  update(position: Position, input: number, dt: number, grab = false) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.speed = 0;
    const top = TOP + EYE_HEIGHT, bottom = FLOOR + EYE_HEIGHT;
    if (!this.attached && this.cooldown === 0) {
      const cameraZ = ladderCameraZ(position.y);
      const near = Math.abs(position.x) < 1.3 && position.z > cameraZ - 3.05 && position.z < cameraZ + 1.2;
      const atTop = position.y > top - .3;
      const atBottom = position.y < bottom + .3;
      const intention = grab || (atTop ? input < -.1 : atBottom ? input > .1 : Math.abs(input) > .1);
      if (near && position.y >= bottom - .1 && position.y <= top + .35 && intention) this.attached = true;
    }
    if (!this.attached) return false;

    position.x = 0;
    const climb = Math.max(-1, Math.min(1, input));
    const previousY = position.y;
    position.y = Math.max(bottom, Math.min(top, position.y + climb * LADDER_SPEED * dt));
    position.z = ladderCameraZ(position.y);
    this.speed = Math.abs(position.y - previousY) / Math.max(dt, .001);
    if (climb > 0 && position.y >= top) {
      position.z = NOTCH_END - 1.35;
      this.reset();
    } else if (climb < 0 && position.y <= bottom) {
      position.z = ladderCameraZ(position.y) + 1.35;
      this.reset();
    }
    return true;
  }
}

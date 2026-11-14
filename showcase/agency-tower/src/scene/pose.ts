import type { ActivityKind } from './activity';
import type { RobotParts } from './robot';

// Procedural limb animation per activity state.
export function applyPose(p: RobotParts, kind: ActivityKind, walkPhase: number, timeSec: number): void {
  p.armL.rotation.set(0, 0, 0);
  p.armR.rotation.set(0, 0, 0);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.body.position.y = 0;
  p.head.rotation.set(0, 0, 0);

  switch (kind) {
    case 'walk': {
      // Short legs: a quicker cadence than the sim phase so steps match the walking speed.
      const s = Math.sin(walkPhase * 2.2);
      p.legL.rotation.x = s * 0.7;
      p.legR.rotation.x = -s * 0.7;
      p.armL.rotation.x = -s * 0.55;
      p.armR.rotation.x = s * 0.55;
      p.body.position.y = Math.abs(s) * 0.025;
      p.head.rotation.z = s * 0.04;
      break;
    }
    case 'work':
      p.body.position.y = 0.07; // seated on the chair: torso on the seat, legs hidden below it
      p.armL.rotation.x = -1.15 + Math.sin(timeSec * 13) * 0.14;
      p.armR.rotation.x = -1.15 + Math.sin(timeSec * 13 + Math.PI) * 0.14;
      p.head.rotation.x = 0.15;
      break;
    case 'coffee':
      p.armR.rotation.x = -2.0 + Math.sin(timeSec * 2) * 0.1;
      p.head.rotation.x = -0.1;
      break;
    case 'raise':
      p.armR.rotation.z = -2.7; // static raised arm (reduced motion)
      break;
    case 'wave':
      p.armR.rotation.z = -2.7 + Math.sin(timeSec * 10) * 0.35;
      break;
    case 'idle':
      p.body.position.y = Math.sin(timeSec * 2) * 0.008;
      p.armL.rotation.z = 0.05 + Math.sin(timeSec * 1.5) * 0.03;
      p.armR.rotation.z = -0.05 - Math.sin(timeSec * 1.5) * 0.03;
      break;
  }
}

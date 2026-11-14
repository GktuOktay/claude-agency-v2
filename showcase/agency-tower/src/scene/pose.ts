import type { PoseKind } from './activity';
import type { RobotParts } from './robot';

// Procedural limb animation per activity state.
export function applyPose(p: RobotParts, kind: PoseKind, walkPhase: number, timeSec: number): void {
  p.armL.rotation.set(0, 0, 0);
  p.armR.rotation.set(0, 0, 0);
  p.legL.rotation.set(0, 0, 0);
  p.legR.rotation.set(0, 0, 0);
  p.body.position.y = 0;
  p.body.rotation.set(0, 0, 0);
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
      p.armR.rotation.z = -2.7; // static raised arm (reduced motion; stamp raised)
      break;
    case 'press':
      p.armR.rotation.x = -1.0; // stamp press / call button: arm forward and down, static
      break;
    case 'reach':
      p.armR.rotation.x = -1.4; // hand-over: arm held out, static
      p.armL.rotation.x = -1.4;
      break;
    case 'sit':
      p.body.position.y = 0.07; // seated still (meeting)
      break;
    case 'wave':
      p.armR.rotation.z = -2.7 + Math.sin(timeSec * 10) * 0.35;
      break;
    // ---- campus break poses (KARARLAR rev 31); motion comes from timeSec (0 under reduced motion)
    case 'run': {
      // Running in place on the treadmill belt: quick, wide leg swing, pumping bent arms, forward lean.
      const s = Math.sin(timeSec * 14);
      p.legL.rotation.x = s * 0.9;
      p.legR.rotation.x = -s * 0.9;
      p.armL.rotation.x = -0.9 - s * 0.6;
      p.armR.rotation.x = -0.9 + s * 0.6;
      p.body.rotation.x = 0.18;
      p.body.position.y = Math.abs(s) * 0.04;
      break;
    }
    case 'lift': {
      // Overhead press: both arms go up together and down to the shoulders.
      const up = 0.5 + 0.5 * Math.sin(timeSec * 3);
      p.armL.rotation.z = 1.0 + up * 1.6;
      p.armR.rotation.z = -(1.0 + up * 1.6);
      p.head.rotation.x = -0.15;
      break;
    }
    case 'paddle': {
      // Ping-pong: paddle arm forward, swinging across the body; ready stance.
      const s = Math.sin(timeSec * 4);
      p.armR.rotation.x = -1.1;
      p.armR.rotation.y = s * 0.9;
      p.armL.rotation.x = -0.4;
      p.body.rotation.y = s * 0.15;
      p.body.position.y = -0.015;
      break;
    }
    case 'sleep': {
      // Reclined in the nap pod: torso back, legs stretched out, head to one side, slow breathing.
      p.body.position.y = 0.07 + Math.sin(timeSec * 0.9) * 0.006;
      p.body.rotation.x = -1.1;
      p.legL.rotation.x = -1.45;
      p.legR.rotation.x = -1.45;
      p.armL.rotation.z = 0.25;
      p.armR.rotation.z = -0.25;
      p.head.rotation.z = 0.35;
      break;
    }
    case 'eat':
      // Seated at a table or stool: right hand up to the mouth and back, left hand on the table.
      p.body.position.y = 0.07;
      p.armR.rotation.x = -1.9 + Math.max(0, Math.sin(timeSec * 2.2)) * -0.5;
      p.armL.rotation.x = -1.0;
      p.head.rotation.x = 0.1;
      break;
    case 'play': {
      // Foosball rods or arcade controls: both hands forward, quick jiggle.
      const s = Math.sin(timeSec * 11);
      p.armL.rotation.x = -1.2 + s * 0.12;
      p.armR.rotation.x = -1.2 - s * 0.12;
      p.head.rotation.x = 0.12;
      break;
    }
    case 'read':
      // Lab or archive: a folder held in both hands, head down, an occasional page turn.
      p.armL.rotation.x = -1.0;
      p.armR.rotation.x = -1.0 + Math.max(0, Math.sin(timeSec * 0.8)) * -0.3;
      p.head.rotation.x = 0.35;
      break;
    case 'idle':
      p.body.position.y = Math.sin(timeSec * 2) * 0.008;
      p.armL.rotation.z = 0.05 + Math.sin(timeSec * 1.5) * 0.03;
      p.armR.rotation.z = -0.05 - Math.sin(timeSec * 1.5) * 0.03;
      break;
  }
}

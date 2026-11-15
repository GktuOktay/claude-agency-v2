import type { PoseKind } from './activity';
import type { RobotParts } from './robot';

/**
 * Sip curve (Rev 43 B): 0 = cup held at the chest, 1 = cup at the mouth. A short sip about every 4.5 s; 0 at
 * time 0 (reduced motion renders the static hold). The hand props read it to tilt the cup.
 */
export function sipAmount(timeSec: number): number {
  const s = Math.max(0, Math.sin(timeSec * 1.4));
  return s * s * s * s;
}

/** Walking legs (shared by the plain walk and the walks with a cup, a tray or a phone). */
function walkLegs(p: RobotParts, walkPhase: number, armSwing: number): number {
  const s = Math.sin(walkPhase * 2.2);
  p.legL.rotation.x = s * 0.7;
  p.legR.rotation.x = -s * 0.7;
  p.armL.rotation.x = -s * armSwing;
  p.armR.rotation.x = s * armSwing;
  p.body.position.y = Math.abs(s) * 0.025;
  return s;
}

/** Cup in the right hand: at the chest, raised to the mouth by the sip curve, wrist turned in. */
function cupArm(p: RobotParts, timeSec: number): void {
  const s = sipAmount(timeSec);
  p.armR.rotation.x = -0.9 - s * 1.5;
  p.armR.rotation.z = 0.3 * s;
  p.head.rotation.x = -0.15 * s;
}

/** Right hand at the ear (phone), head tilted toward it. */
function phoneArm(p: RobotParts): void {
  p.armR.rotation.x = -2.6;
  p.armR.rotation.z = 0.25;
  p.head.rotation.z = -0.12;
}

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
    // ---- object poses (KARARLAR Rev 43 B); motion from timeSec / walkPhase (both 0 under reduced motion)
    case 'pour':
      // At the coffee machine: right hand forward on the machine, left at the side, looking down at the cup.
      p.armR.rotation.x = -1.3 + Math.sin(timeSec * 3) * 0.05;
      p.armL.rotation.x = -0.5;
      p.head.rotation.x = 0.2;
      break;
    case 'sip':
    case 'cup-stand':
      cupArm(p, timeSec);
      p.armL.rotation.z = 0.06;
      break;
    case 'cup-walk':
      walkLegs(p, walkPhase, 0.45);
      cupArm(p, timeSec);
      break;
    case 'tray-walk': {
      const s = walkLegs(p, walkPhase, 0);
      p.armL.rotation.x = -1.25 + s * 0.03;
      p.armR.rotation.x = -1.25 + s * 0.03;
      break;
    }
    case 'tray-stand':
      p.armL.rotation.x = -1.25;
      p.armR.rotation.x = -1.25;
      break;
    case 'phone-walk':
      walkLegs(p, walkPhase * 0.6, 0.3);
      phoneArm(p);
      break;
    case 'phone-stand':
      phoneArm(p);
      p.head.rotation.x = Math.max(0, Math.sin(timeSec * 1.3)) * 0.08;
      p.armL.rotation.z = 0.08;
      break;
    case 'stretch': {
      // Mat stretch: both arms overhead, slow side bend.
      const b = Math.sin(timeSec * 0.8);
      p.armL.rotation.z = 2.8;
      p.armR.rotation.z = -2.8;
      p.body.rotation.z = b * 0.22;
      p.head.rotation.z = b * 0.1;
      break;
    }
    case 'write':
      // Whiteboard: marker hand up on the board, short strokes across it; left hand at the side.
      p.armR.rotation.x = -1.85 + Math.sin(timeSec * 7) * 0.08;
      p.armR.rotation.z = 0.15 + Math.sin(timeSec * 2.3) * 0.25;
      p.armL.rotation.x = -0.3;
      p.head.rotation.x = -0.1;
      p.head.rotation.y = Math.sin(timeSec * 2.3) * 0.1;
      break;
    case 'chat':
      // Face to face: nods and open-hand gestures.
      p.head.rotation.x = Math.max(0, Math.sin(timeSec * 2.6)) * 0.18;
      p.armR.rotation.x = -0.7 + Math.sin(timeSec * 1.7) * 0.35;
      p.armR.rotation.y = Math.sin(timeSec * 1.1) * 0.3;
      p.armL.rotation.x = -0.3 + Math.sin(timeSec * 1.3 + 1) * 0.15;
      p.body.rotation.y = Math.sin(timeSec * 0.7) * 0.05;
      break;
    case 'arms-up':
      // Desk stretch: seated, both arms straight up, leaning back a little.
      p.body.position.y = 0.07;
      p.body.rotation.x = -0.08;
      p.armL.rotation.x = -2.9;
      p.armR.rotation.x = -2.9;
      p.head.rotation.x = -0.2;
      break;
    case 'work-sip':
      // Seated: left hand types, right hand holds the tea glass and sips.
      p.body.position.y = 0.07;
      p.armL.rotation.x = -1.15 + Math.sin(timeSec * 13) * 0.14;
      cupArm(p, timeSec);
      p.head.rotation.x = p.head.rotation.x + 0.1;
      break;
    case 'idle':
      p.body.position.y = Math.sin(timeSec * 2) * 0.008;
      p.armL.rotation.z = 0.05 + Math.sin(timeSec * 1.5) * 0.03;
      p.armR.rotation.z = -0.05 - Math.sin(timeSec * 1.5) * 0.03;
      break;
  }
}

// Rev 43 B over a real office day (the app wiring at high, 420 s): every object activity shows up, and the
// action layer is a pure observer (the day's stats and the final ambient state are identical without it).
import { describe, it, expect } from 'vitest';
import { createActionLayer, type ActionInput, type ActionLayer, type HandProp } from '../src/scene/actions';
import type { PoseKind } from '../src/scene/activity';
import { describeDay, runOfficeDay } from './occupancyHelpers';

describe('object activities over an office day (Rev 43 B)', () => {
  it('cups, dumbbells, trays, phones, markers, chats and stretches all appear; the sims are untouched', () => {
    let layer: ActionLayer | null = null;
    const props = new Map<HandProp, number>();
    const poses = new Map<PoseKind, number>();
    let belt = 0;
    const day = runOfficeDay({
      seconds: 420,
      each: (_t, ambient, specs) => {
        layer ??= createActionLayer(specs);
        const inputs: ActionInput[] = specs.map((s) => {
          const view = ambient.get(s.id);
          const busy = ambient.isReserved(s.id) || view.kind === 'wave' || view.kind === 'raise';
          return { id: s.id, busy, view, spot: ambient.onBreak(s.id), phase: ambient.breakPhase(s.id) };
        });
        layer.update(ambient.time, inputs, false);
        for (const s of specs) {
          const a = layer.get(s.id);
          if (!a) continue;
          for (const p of a.props) props.set(p, (props.get(p) ?? 0) + 1);
          poses.set(a.pose, (poses.get(a.pose) ?? 0) + 1);
          if (a.dy > 0.1 && a.pose === 'run') belt++;
        }
      },
    });
    const plain = runOfficeDay({ seconds: 420 });
    console.info(`[actions] props ${[...props].map(([k, v]) => `${k}=${v}`).join(' ')}; poses ${[...poses].map(([k, v]) => `${k}=${v}`).join(' ')}; belt=${belt}`);
    for (const p of ['cup', 'dumbbell', 'tray', 'phone', 'marker'] as const) expect(props.get(p) ?? 0, p).toBeGreaterThan(0);
    for (const p of ['pour', 'sip', 'chat', 'stretch', 'arms-up', 'write', 'phone-stand'] as const) expect(poses.get(p) ?? 0, p).toBeGreaterThan(0);
    expect(belt).toBeGreaterThan(0);
    // Pure overlay: same day with and without it.
    expect(describeDay(day)).toBe(describeDay(plain));
    expect(JSON.stringify(day.ambient.drainEvents())).toBe(JSON.stringify(plain.ambient.drainEvents()));
  }, 120_000);
});

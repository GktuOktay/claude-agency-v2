import { describe, it, expect } from 'vitest';
import { TOOLS_TR, toolLabel, MODELS_TR, modelLabel } from '../src/data/toolsTr';

describe('tool and model glossary', () => {
  it('glosses the named tools', () => {
    expect(TOOLS_TR.Read).toBe('dosya okuma');
    expect(TOOLS_TR.Grep).toBe('metin arama');
    expect(TOOLS_TR.Bash).toBe('komut çalıştırma');
  });
  it('toolLabel keeps the original name and appends the gloss', () => {
    expect(toolLabel('Read')).toBe('Read · dosya okuma');
  });
  it('toolLabel on an unknown tool shows the bare name', () => {
    expect(toolLabel('Mystery')).toBe('Mystery');
  });
  it('modelLabel keeps the model id with a gloss', () => {
    expect(modelLabel('sonnet')).toBe('sonnet · dengeli model');
    expect(modelLabel('opus')).toContain('opus · ');
    expect(modelLabel('haiku')).toContain('haiku · ');
    expect(MODELS_TR.sonnet).toBe('dengeli model');
  });
  it('modelLabel on an unknown model shows the bare id', () => {
    expect(modelLabel('zzz')).toBe('zzz');
  });
});

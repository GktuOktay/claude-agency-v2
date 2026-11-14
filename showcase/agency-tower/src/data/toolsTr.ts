// Turkish glosses for tool names and model ids shown on the robot card. Original names stay visible.
export const TOOLS_TR: Readonly<Record<string, string>> = {
  Read: 'dosya okuma',
  Grep: 'metin arama',
  Glob: 'dosya bulma',
  Write: 'dosya yazma',
  Edit: 'düzenleme',
  MultiEdit: 'toplu düzenleme',
  Bash: 'komut çalıştırma',
  WebSearch: 'web araması',
  WebFetch: 'web sayfası okuma',
};

export const MODELS_TR: Readonly<Record<string, string>> = {
  haiku: 'hızlı, hafif model',
  sonnet: 'dengeli model',
  opus: 'en güçlü model',
};

export function toolLabel(tool: string): string {
  const g = Object.hasOwn(TOOLS_TR, tool) ? TOOLS_TR[tool] : undefined;
  return g ? `${tool} · ${g}` : tool;
}

export function modelLabel(model: string): string {
  const g = Object.hasOwn(MODELS_TR, model) ? MODELS_TR[model] : undefined;
  return g ? `${model} · ${g}` : model;
}

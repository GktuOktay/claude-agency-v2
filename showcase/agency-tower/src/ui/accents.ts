// Department accent per floor (used sparingly: chairs, cushions, label dots, chest lights, panel dots).
const ACCENTS = [0x4fa37a, 0x3f86c8, 0xd0667a, 0x8a6fd0, 0xe08d3c, 0xcfa23a];
export const floorAccent = (id: number): number => ACCENTS[id] ?? 0x888888;
export const accentCss = (id: number): string => `#${floorAccent(id).toString(16).padStart(6, '0')}`;

export interface RosterAgent { name: string; description: string; tools: string[]; model: string | null }
export interface Roster { schemaVersion: 1; sourceSha256: string; agents: RosterAgent[] }
export class RosterError extends Error {}
export function parseAgentFile(text: string, file: string): RosterAgent;
export function buildRoster(agentsDir: string): Roster;
export function serializeRoster(roster: Roster): string;
export function run(opts: { root: string; agentsDir?: string; check?: boolean }): { code: number; message: string };
export const DEFAULT_AGENTS_DIR: string;

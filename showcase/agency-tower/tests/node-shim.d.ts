// Minimal ambient typings for the Node built-ins used by tests; avoids adding @types/node (no new dependency).
declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
  export function writeFileSync(path: string, data: string): void;
  export function readFileSync(path: string, enc: 'utf8'): string;
  export function readFileSync(path: string): Uint8Array;
  export function mkdirSync(path: string, opts?: { recursive?: boolean }): void;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
  export function rmSync(path: string, opts?: { recursive?: boolean; force?: boolean }): void;
  export function cpSync(src: string, dest: string, opts?: { recursive?: boolean }): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...p: string[]): string;
  export function dirname(p: string): string;
  export function resolve(...p: string[]): string;
}
declare module 'node:url' {
  export function fileURLToPath(u: string | URL): string;
}
declare module 'node:child_process' {
  export function spawnSync(
    cmd: string,
    args: string[],
    opts?: { encoding?: 'utf8'; cwd?: string },
  ): { status: number | null; stdout: string; stderr: string };
}
declare module 'node:crypto' {
  export function createHash(a: 'sha256'): { update(s: string): { digest(e: 'hex'): string } };
}
declare const process: { execPath: string };

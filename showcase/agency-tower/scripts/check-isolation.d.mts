export interface Violation { file: string; message: string }
export function checkIsolation(root: string): Violation[];

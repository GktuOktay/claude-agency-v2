export const BUDGET_BYTES: number;
export interface BudgetResult { ok: boolean; file: string | null; bytes: number | null; limit: number; message: string }
export function checkBudget(distDir: string, limit?: number): BudgetResult;

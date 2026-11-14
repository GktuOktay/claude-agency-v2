export type Tier = 'ceo' | 'management' | 'lead' | 'specialist';
export const TIERS: readonly Tier[] = ['ceo', 'management', 'lead', 'specialist'];

export interface Unit {
  id: string;
  name: string;
  floor: number;
  tier: Tier;
  reportsTo: string | null;
  independent: boolean;
  roleTr: string;
  phrasesTr: string[];
  description: string;
  tools: string[];
  model: string | null;
}

export interface Floor {
  id: number;
  nameTr: string;
}

export interface TowerData {
  floors: Floor[];
  units: Unit[];
}

export type LoadResult = { ok: true; data: TowerData } | { ok: false; error: string };

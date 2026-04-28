// Typed shapes for the raw JSON content under src/data/*.json, plus tiny
// hand-rolled validators. No external dependency yet — if we add `zod` later,
// it goes here.

export interface BuildingDef {
  name: string;
  cost: number;
  benefit: string;
  note: string;
}

export interface UnitDef {
  name: string;
  cost: number;
  initiative: number;
  attack: number;
  defense: number;
  altStats: string;
  requires: string;
  note: string;
}

export interface TechnologyDef {
  branch: string;
  name: string;
  order: string;
  cost: string;
  buildings: string;
  units: string;
  blueEvent: string;
  greenEvent: string;
  redEvent: string;
  goldEvent: string;
}

// --- helpers ---------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const requireString = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): string => {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(
      `${type}[${index}]: field "${key}" must be a string, got ${typeof v}`,
    );
  }
  return v;
};

const requireNumber = (
  obj: Record<string, unknown>,
  key: string,
  index: number,
  type: string,
): number => {
  const v = obj[key];
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new Error(
      `${type}[${index}]: field "${key}" must be a number, got ${typeof v}`,
    );
  }
  return v;
};

const requireArray = (raw: unknown, type: string): unknown[] => {
  if (!Array.isArray(raw)) {
    throw new Error(`${type}: expected an array, got ${typeof raw}`);
  }
  return raw;
};

const requireObject = (
  v: unknown,
  index: number,
  type: string,
): Record<string, unknown> => {
  if (!isPlainObject(v)) {
    throw new Error(`${type}[${index}]: expected an object, got ${typeof v}`);
  }
  return v;
};

// --- validators ------------------------------------------------------------

export const validateBuildings = (raw: unknown): BuildingDef[] => {
  const arr = requireArray(raw, 'BuildingDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'BuildingDef');
    return {
      name: requireString(obj, 'name', i, 'BuildingDef'),
      cost: requireNumber(obj, 'cost', i, 'BuildingDef'),
      benefit: requireString(obj, 'benefit', i, 'BuildingDef'),
      note: requireString(obj, 'note', i, 'BuildingDef'),
    };
  });
};

export const validateUnits = (raw: unknown): UnitDef[] => {
  const arr = requireArray(raw, 'UnitDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'UnitDef');
    return {
      name: requireString(obj, 'name', i, 'UnitDef'),
      cost: requireNumber(obj, 'cost', i, 'UnitDef'),
      initiative: requireNumber(obj, 'initiative', i, 'UnitDef'),
      attack: requireNumber(obj, 'attack', i, 'UnitDef'),
      defense: requireNumber(obj, 'defense', i, 'UnitDef'),
      altStats: requireString(obj, 'altStats', i, 'UnitDef'),
      requires: requireString(obj, 'requires', i, 'UnitDef'),
      note: requireString(obj, 'note', i, 'UnitDef'),
    };
  });
};

export const validateTechnologies = (raw: unknown): TechnologyDef[] => {
  const arr = requireArray(raw, 'TechnologyDef');
  return arr.map((entry, i) => {
    const obj = requireObject(entry, i, 'TechnologyDef');
    return {
      branch: requireString(obj, 'branch', i, 'TechnologyDef'),
      name: requireString(obj, 'name', i, 'TechnologyDef'),
      order: requireString(obj, 'order', i, 'TechnologyDef'),
      cost: requireString(obj, 'cost', i, 'TechnologyDef'),
      buildings: requireString(obj, 'buildings', i, 'TechnologyDef'),
      units: requireString(obj, 'units', i, 'TechnologyDef'),
      blueEvent: requireString(obj, 'blueEvent', i, 'TechnologyDef'),
      greenEvent: requireString(obj, 'greenEvent', i, 'TechnologyDef'),
      redEvent: requireString(obj, 'redEvent', i, 'TechnologyDef'),
      goldEvent: requireString(obj, 'goldEvent', i, 'TechnologyDef'),
    };
  });
};

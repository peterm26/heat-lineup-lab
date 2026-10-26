export const DEFAULT_FIVE = [1630558, 202691, 203952, 203507, 1628389];
export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
export function validLineup(ids, players) {
  return Array.isArray(ids) && ids.length === 5 && new Set(ids).size === 5
    && ids.every(id => Number.isSafeInteger(id) && players.some(p => p.id === id));
}
export function substitute(ids, incomingId, slot, players) {
  if (!validLineup(ids, players) || !Number.isInteger(slot) || slot < 0 || slot > 4
      || !players.some(p => p.id === incomingId)) throw new Error('Invalid substitution');
  const result = [...ids];
  const existingSlot = result.indexOf(incomingId);
  if (existingSlot !== -1) result[existingSlot] = result[slot];
  result[slot] = incomingId;
  return result;
}
export function difference(current, baseline) {
  return Number.isFinite(current) && Number.isFinite(baseline) ? current - baseline : null;
}

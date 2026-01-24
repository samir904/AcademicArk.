export function extractUnitFromTitle(title = "") {
  if (!title) return null;

  // unit 1, unit-2, Unit 03, UNIT 4
  const match = title.match(/unit[\s\-]?(\d+)/i);

  if (!match) return null;

  const unit = Number(match[1]);
  if (Number.isNaN(unit)) return null;

  return unit;
}
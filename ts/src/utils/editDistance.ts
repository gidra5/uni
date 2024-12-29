import { memoize } from ".";

export const editDistance = memoize((a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  if (a === b) return 0;

  const prefixCost = a[0] === b[0] ? 0 : 1;
  const costs: number[] = [
    editDistance(a.slice(1), b) + 1,
    editDistance(a, b.slice(1)) + 1,
    editDistance(a.slice(1), b.slice(1)) + prefixCost,
  ];
  if (a.length > 1 && b.length > 1 && a[0] === b[1] && a[1] === b[0])
    costs.push(editDistance(a.slice(2), b.slice(2)) + prefixCost);

  return Math.min(...costs);
});

export function getClosestName(name: any, declaredNames: string[]): string | undefined {
  const distance = editDistance;
  const compare = (a: string, b: string) => {
    const aDistance = distance(name, a);
    const bDistance = distance(name, b);
    return aDistance - bDistance;
  };

  const closestName = declaredNames.reduce((acc, declaredName) => {
    if (compare(acc, declaredName) > 0) return declaredName;
    return acc;
  }, declaredNames[0]);

  if (!closestName || distance(name, closestName) > 3) return undefined;

  return closestName;
}

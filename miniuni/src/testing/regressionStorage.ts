import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type RegressionCase = {
  seed: number;
  path: string;
};

type RegressionEntry = {
  propertyPath: string[];
  cases: RegressionCase[];
};

type RegressionFile = {
  version: 1;
  entries: RegressionEntry[];
};

const emptyRegressionFile = (): RegressionFile => ({
  version: 1,
  entries: [],
});

const samePropertyPath = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((part, index) => part === right[index]);

const dedupeRegressionCases = (cases: RegressionCase[]): RegressionCase[] => {
  const unique = new Set<string>();
  const deduped: RegressionCase[] = [];

  for (const entry of cases) {
    const key = `${entry.seed}:${entry.path}`;
    if (unique.has(key)) continue;
    unique.add(key);
    deduped.push(entry);
  }

  return deduped;
};

const regressionFilePath = (root: string, sourceFile: string) =>
  join(root, `${sourceFile}.json`);

const readRegressionFile = async (
  root: string,
  sourceFile: string
): Promise<RegressionFile> => {
  const filePath = regressionFilePath(root, sourceFile);

  try {
    const json = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(json) as RegressionFile;
    return {
      version: 1,
      entries: parsed.entries ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyRegressionFile();
    }
    throw error;
  }
};

const writeRegressionFile = async (
  root: string,
  sourceFile: string,
  data: RegressionFile
) => {
  const filePath = regressionFilePath(root, sourceFile);

  if (data.entries.length === 0) {
    await rm(filePath, { force: true });
    return;
  }

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

export const loadRegressionCases = async (
  root: string,
  sourceFile: string,
  propertyPath: string[]
): Promise<RegressionCase[]> => {
  const data = await readRegressionFile(root, sourceFile);
  const entry = data.entries.find((item) =>
    samePropertyPath(item.propertyPath, propertyPath)
  );

  return dedupeRegressionCases(entry?.cases ?? []);
};

export const saveRegressionCases = async (
  root: string,
  sourceFile: string,
  propertyPath: string[],
  cases: RegressionCase[]
) => {
  const data = await readRegressionFile(root, sourceFile);
  const normalizedCases = dedupeRegressionCases(cases);
  const nextEntries = data.entries.filter(
    (item) => !samePropertyPath(item.propertyPath, propertyPath)
  );

  if (normalizedCases.length > 0) {
    nextEntries.push({
      propertyPath,
      cases: normalizedCases,
    });
  }

  await writeRegressionFile(root, sourceFile, {
    version: 1,
    entries: nextEntries,
  });
};

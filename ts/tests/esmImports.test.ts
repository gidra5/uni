import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageDir = fileURLToPath(new URL("../", import.meta.url));
const srcDir = join(packageDir, "src");

const walkTsFiles = (dir: string): string[] => {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTsFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(entryPath);
  }

  return files;
};

const importSpecifierPattern = /(?:import|export)\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["']([^"']+)["']/g;
const validRuntimeExtension = /\.(?:c|m)?js$/;

describe("source ESM imports", () => {
  it("uses explicit runtime extensions for every relative import in src", () => {
    const offenders: string[] = [];

    for (const filePath of walkTsFiles(srcDir)) {
      const source = readFileSync(filePath, "utf8");
      for (const match of source.matchAll(importSpecifierPattern)) {
        const specifier = match[1];
        if (!specifier.startsWith(".")) continue;
        if (validRuntimeExtension.test(specifier)) continue;

        offenders.push(`${relative(packageDir, filePath)} -> ${specifier}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

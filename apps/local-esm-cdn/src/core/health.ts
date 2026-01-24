import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileExists } from './utils.js';

/**
 * Health check status
 */
export type Health = {
  ok: boolean;
  pieElementsNgPath: string;
  elementsReactPath: string;
  libReactPath: string;
  builtElementPackages: number;
  builtLibPackages: number;
  sampleElement?: string;
  sampleLib?: string;
};

/**
 * Find any built packages in a directory
 * @param packagesDir - Directory to search for packages
 * @param max - Maximum number of packages to check
 * @returns Count of built packages and a sample package name
 */
export async function findAnyBuiltPackages(
  packagesDir: string,
  max = 200
): Promise<{ count: number; sample?: string }> {
  let count = 0;
  let sample: string | undefined;

  let entries: string[];
  try {
    entries = await readdir(packagesDir);
  } catch {
    return { count: 0 };
  }

  for (const pkgName of entries.slice(0, max)) {
    const candidate = path.join(packagesDir, pkgName, 'dist', 'index.js');
    if (await fileExists(candidate)) {
      count++;
      if (!sample) sample = pkgName;
    }
  }
  return { count, sample };
}

/**
 * Cached health check result
 */
let cachedHealth: { at: number; value: Health } | null = null;

/**
 * Get the health status of the local ESM CDN
 * @param pieElementsNgPath - Root path to the pie-elements-ng repository
 * @returns Health status
 */
export async function getHealth(pieElementsNgPath: string): Promise<Health> {
  const now = Date.now();
  if (cachedHealth && now - cachedHealth.at < 1500) return cachedHealth.value;

  const elementsReactPath = path.join(pieElementsNgPath, 'packages', 'elements-react');
  const libReactPath = path.join(pieElementsNgPath, 'packages', 'lib-react');

  const elements = await findAnyBuiltPackages(elementsReactPath);
  const libs = await findAnyBuiltPackages(libReactPath);

  const ok = existsSync(pieElementsNgPath) && existsSync(elementsReactPath) && elements.count > 0;

  const value: Health = {
    ok,
    pieElementsNgPath,
    elementsReactPath,
    libReactPath,
    builtElementPackages: elements.count,
    builtLibPackages: libs.count,
    sampleElement: elements.sample,
    sampleLib: libs.sample,
  };

  cachedHealth = { at: now, value };
  return value;
}

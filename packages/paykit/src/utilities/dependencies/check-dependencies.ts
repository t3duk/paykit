import picocolors from "picocolors";

import { getDependencies } from "./get-dependencies";

export async function checkDependencies(
  dependencies: string[],
  targetVersionDependency: string,
): Promise<void> {
  const { resolved } = await getDependencies(process.cwd(), dependencies);

  const foundVersions: Record<string, string> = {};

  for (const [pkg, { version }] of resolved) {
    if (!(version in foundVersions)) {
      foundVersions[version] = pkg;
    }
  }

  const versionCount = Object.keys(foundVersions).length;
  if (versionCount <= 1) return;

  const targetVersion = resolved.get(targetVersionDependency)?.version;

  const mismatched = targetVersion
    ? Object.entries(foundVersions).filter(([version]) => version !== targetVersion)
    : Object.entries(foundVersions);

  const lines = mismatched.map(([version, pkg]) =>
    targetVersion ? `  ${pkg}@${version} (expected ${targetVersion})` : `  ${pkg}@${version}`,
  );

  const fixPkgs = mismatched
    .map(([_, pkg]) => (targetVersion ? `${pkg}@${targetVersion}` : pkg))
    .join(" ");

  console.warn(
    `${picocolors.red("[paykit]")} Mismatching dependency versions:\n` +
      `${lines.join("\n")}\n` +
      `  Run ${picocolors.bold(`pnpm install ${fixPkgs}`)} to fix.`,
  );
}

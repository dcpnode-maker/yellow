export const ALLOWED_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "PostgreSQL",
  "MPL-2.0",
]);

type PackageManifest = {
  name?: unknown;
  version?: unknown;
  license?: unknown;
  licenses?: unknown;
};

type Token = "(" | ")" | "AND" | "OR" | "WITH" | string;

export function isPackageRootManifestPath(packagePath: string): boolean {
  const segments = packagePath.split(/[\\/]/);
  const nodeModulesIndex = segments.lastIndexOf("node_modules");
  if (nodeModulesIndex === -1) {
    return false;
  }

  const packageSegments = segments.slice(nodeModulesIndex + 1);
  return (
    (packageSegments.length === 2 && packageSegments[1] === "package.json") ||
    (packageSegments.length === 3 &&
      packageSegments[0]?.startsWith("@") === true &&
      packageSegments[2] === "package.json")
  );
}

export function extractLicenseExpressions(manifest: PackageManifest): string[] {
  if (typeof manifest.license === "string" && manifest.license.trim() !== "") {
    return [manifest.license.trim()];
  }

  if (!Array.isArray(manifest.licenses)) {
    return [];
  }

  return manifest.licenses.flatMap((entry): string[] => {
    if (typeof entry === "string" && entry.trim() !== "") {
      return [entry.trim()];
    }

    if (
      typeof entry === "object" &&
      entry !== null &&
      "type" in entry &&
      typeof entry.type === "string" &&
      entry.type.trim() !== ""
    ) {
      return [entry.type.trim()];
    }

    return [];
  });
}

function tokenize(expression: string): Token[] | undefined {
  const tokens = expression.match(/\(|\)|AND|OR|WITH|[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? [];
  const unmatched = expression.replace(/\(|\)|AND|OR|WITH|[A-Za-z0-9][A-Za-z0-9.+-]*/g, "").replace(/\s/g, "");

  return tokens.length > 0 && unmatched === "" ? tokens : undefined;
}

export function isAllowedLicenseExpression(expression: string): boolean {
  const tokens = tokenize(expression.trim());
  if (tokens === undefined || tokens.includes("WITH")) {
    return false;
  }

  let cursor = 0;

  const parsePrimary = (): boolean => {
    const token = tokens[cursor];
    if (token === undefined) {
      return false;
    }

    if (token === "(") {
      cursor += 1;
      if (!parseOr() || tokens[cursor] !== ")") {
        return false;
      }
      cursor += 1;
      return true;
    }

    if (token === ")" || token === "AND" || token === "OR") {
      return false;
    }

    cursor += 1;
    return ALLOWED_LICENSES.has(token);
  };

  const parseAnd = (): boolean => {
    if (!parsePrimary()) {
      return false;
    }

    while (tokens[cursor] === "AND") {
      cursor += 1;
      if (!parsePrimary()) {
        return false;
      }
    }

    return true;
  };

  const parseOr = (): boolean => {
    if (!parseAnd()) {
      return false;
    }

    while (tokens[cursor] === "OR") {
      cursor += 1;
      if (!parseAnd()) {
        return false;
      }
    }

    return true;
  };

  return parseOr() && cursor === tokens.length;
}

type AuditFailure = {
  packagePath: string;
  reason: string;
};

export async function auditInstalledPackages(root = process.cwd()): Promise<{
  packageCount: number;
  failures: AuditFailure[];
}> {
  const packages = new Set<string>();
  const failures: AuditFailure[] = [];
  const glob = new Bun.Glob("node_modules/**/package.json");

  for await (const packagePath of glob.scan({ cwd: root, onlyFiles: true })) {
    if (!isPackageRootManifestPath(packagePath)) {
      continue;
    }

    let manifest: PackageManifest;
    try {
      manifest = (await Bun.file(`${root}/${packagePath}`).json()) as PackageManifest;
    } catch {
      failures.push({ packagePath, reason: "invalid package.json" });
      continue;
    }

    if (typeof manifest.name !== "string" || manifest.name.trim() === "") {
      failures.push({ packagePath, reason: "missing package name" });
      continue;
    }

    if (typeof manifest.version !== "string" || manifest.version.trim() === "") {
      failures.push({ packagePath, reason: "missing package version" });
      continue;
    }

    const expressions = extractLicenseExpressions(manifest);
    if (expressions.length === 0) {
      failures.push({ packagePath, reason: `${manifest.name}@${manifest.version}: missing license` });
      continue;
    }

    const rejected = expressions.filter((expression) => !isAllowedLicenseExpression(expression));
    if (rejected.length > 0) {
      failures.push({
        packagePath,
        reason: `${manifest.name}@${manifest.version}: rejected license ${rejected.join(", ")}`,
      });
      continue;
    }

    packages.add(`${manifest.name}@${manifest.version}:${expressions.slice().sort().join(" OR ")}`);
  }

  return {
    packageCount: packages.size,
    failures: failures.sort(
      (left, right) => left.packagePath.localeCompare(right.packagePath) || left.reason.localeCompare(right.reason),
    ),
  };
}

if (import.meta.main) {
  const result = await auditInstalledPackages();

  if (result.failures.length > 0) {
    console.error(`Dependency license policy failed with ${result.failures.length} violation(s):`);
    for (const failure of result.failures) {
      console.error(`- ${failure.packagePath}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log(`Dependency license policy passed for ${result.packageCount} installed package(s).`);
}

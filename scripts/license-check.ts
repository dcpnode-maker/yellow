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
  const extractDeclaration = (declaration: unknown): string | undefined => {
    if (typeof declaration === "string" && declaration.trim() !== "") {
      return declaration.trim();
    }

    if (
      typeof declaration === "object" &&
      declaration !== null &&
      "type" in declaration &&
      typeof declaration.type === "string" &&
      declaration.type.trim() !== ""
    ) {
      return declaration.type.trim();
    }

    return undefined;
  };

  const singularLicense = extractDeclaration(manifest.license);
  if (singularLicense !== undefined) {
    return [singularLicense];
  }

  if (!Array.isArray(manifest.licenses)) {
    return [];
  }

  return manifest.licenses.flatMap((entry): string[] => {
    const expression = extractDeclaration(entry);
    return expression === undefined ? [] : [expression];
  });
}

function tokenize(expression: string): Token[] | undefined {
  const tokens = expression.match(/\(|\)|AND|OR|WITH|[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? [];
  const unmatched = expression.replace(/\(|\)|AND|OR|WITH|[A-Za-z0-9][A-Za-z0-9.+-]*/g, "").replace(/\s/g, "");

  return tokens.length > 0 && unmatched === "" ? tokens : undefined;
}

type LicenseNode =
  | { kind: "license"; identifier: string }
  | { kind: "and"; left: LicenseNode; right: LicenseNode }
  | { kind: "or"; left: LicenseNode; right: LicenseNode };

type LicenseResolution = {
  acceptedExpression: string;
  choseAlternative: boolean;
};

export function resolveAllowedLicenseExpression(expression: string): LicenseResolution | undefined {
  const tokens = tokenize(expression.trim());
  if (tokens === undefined || tokens.includes("WITH")) {
    return undefined;
  }

  let cursor = 0;

  const parsePrimary = (): LicenseNode | undefined => {
    const token = tokens[cursor];
    if (token === undefined) {
      return undefined;
    }

    if (token === "(") {
      cursor += 1;
      const nested = parseOr();
      if (nested === undefined || tokens[cursor] !== ")") {
        return undefined;
      }
      cursor += 1;
      return nested;
    }

    if (token === ")" || token === "AND" || token === "OR") {
      return undefined;
    }

    cursor += 1;
    return { kind: "license", identifier: token };
  };

  const parseAnd = (): LicenseNode | undefined => {
    let node = parsePrimary();
    if (node === undefined) {
      return undefined;
    }

    while (tokens[cursor] === "AND") {
      cursor += 1;
      const right = parsePrimary();
      if (right === undefined) {
        return undefined;
      }
      node = { kind: "and", left: node, right };
    }

    return node;
  };

  const parseOr = (): LicenseNode | undefined => {
    let node = parseAnd();
    if (node === undefined) {
      return undefined;
    }

    while (tokens[cursor] === "OR") {
      cursor += 1;
      const right = parseAnd();
      if (right === undefined) {
        return undefined;
      }
      node = { kind: "or", left: node, right };
    }

    return node;
  };

  const root = parseOr();
  if (root === undefined || cursor !== tokens.length) {
    return undefined;
  }

  const evaluate = (node: LicenseNode): LicenseResolution | undefined => {
    if (node.kind === "license") {
      return ALLOWED_LICENSES.has(node.identifier)
        ? { acceptedExpression: node.identifier, choseAlternative: false }
        : undefined;
    }

    const left = evaluate(node.left);
    const right = evaluate(node.right);

    if (node.kind === "or") {
      const selected = left ?? right;
      return selected === undefined
        ? undefined
        : { acceptedExpression: selected.acceptedExpression, choseAlternative: true };
    }

    if (left === undefined || right === undefined) {
      return undefined;
    }

    return {
      acceptedExpression: `${left.acceptedExpression} AND ${right.acceptedExpression}`,
      choseAlternative: left.choseAlternative || right.choseAlternative,
    };
  };

  return evaluate(root);
}

export function isAllowedLicenseExpression(expression: string): boolean {
  return resolveAllowedLicenseExpression(expression) !== undefined;
}

type AuditFailure = {
  packagePath: string;
  reason: string;
};

type AuditChoice = {
  packagePath: string;
  packageName: string;
  declaredExpression: string;
  acceptedExpression: string;
};

export async function auditInstalledPackages(root = process.cwd()): Promise<{
  packageCount: number;
  failures: AuditFailure[];
  choices: AuditChoice[];
}> {
  const packages = new Set<string>();
  const failures: AuditFailure[] = [];
  const choices: AuditChoice[] = [];
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

    const selected = expressions
      .map((expression) => ({ expression, resolution: resolveAllowedLicenseExpression(expression) }))
      .find(({ resolution }) => resolution !== undefined);

    if (selected?.resolution === undefined) {
      failures.push({
        packagePath,
        reason: `${manifest.name}@${manifest.version}: rejected license ${expressions.join(", ")}`,
      });
      continue;
    }

    const packageName = `${manifest.name}@${manifest.version}`;
    if (expressions.length > 1 || selected.resolution.choseAlternative) {
      choices.push({
        packagePath,
        packageName,
        declaredExpression: expressions.join(" OR "),
        acceptedExpression: selected.resolution.acceptedExpression,
      });
    }

    packages.add(`${packageName}:${selected.resolution.acceptedExpression}`);
  }

  return {
    packageCount: packages.size,
    failures: failures.sort(
      (left, right) => left.packagePath.localeCompare(right.packagePath) || left.reason.localeCompare(right.reason),
    ),
    choices: choices.sort(
      (left, right) => left.packagePath.localeCompare(right.packagePath) || left.packageName.localeCompare(right.packageName),
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

  for (const choice of result.choices) {
    console.log(
      `Accepted license choice for ${choice.packageName}: ${choice.acceptedExpression} (declared: ${choice.declaredExpression})`,
    );
  }
  console.log(`Dependency license policy passed for ${result.packageCount} installed package(s).`);
}

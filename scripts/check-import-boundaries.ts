import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  isStringLiteralLikeNode,
  type Node,
  type SourceFile,
  SyntaxKind,
} from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";

export interface BoundaryViolation {
  readonly sourceFile: string;
  readonly specifier: string;
  readonly reason: string;
}

export interface BoundaryCheckResult {
  readonly filesScanned: number;
  readonly violations: readonly BoundaryViolation[];
}

type SourceArea =
  | { readonly kind: "context"; readonly name: string; readonly root: string }
  | { readonly kind: "kernel"; readonly root: string };

function pathSegmentsWithin(projectRoot: string, candidate: string): string[] | undefined {
  const pathFromRoot = relative(resolve(projectRoot), resolve(candidate));
  if (
    isAbsolute(pathFromRoot) ||
    pathFromRoot === ".." ||
    pathFromRoot.startsWith(`..${sep}`)
  ) {
    return undefined;
  }

  return pathFromRoot === "" ? [] : pathFromRoot.split(/[\\/]+/);
}

function classifyPath(projectRoot: string, candidate: string): SourceArea | undefined {
  const segments = pathSegmentsWithin(projectRoot, candidate);
  if (!segments || segments[0] !== "src") return undefined;

  if (segments[1] === "contexts" && segments[2]) {
    return {
      kind: "context",
      name: segments[2],
      root: resolve(projectRoot, "src", "contexts", segments[2]),
    };
  }

  if (segments[1] === "kernel") {
    return { kind: "kernel", root: resolve(projectRoot, "src", "kernel") };
  }

  return undefined;
}

function collectModuleSpecifiers(sourceFile: SourceFile): string[] {
  const specifiers: string[] = [];

  const visit = (node: Node): void => {
    if (isImportDeclaration(node) && isStringLiteralLikeNode(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      isExportDeclaration(node) &&
      node.moduleSpecifier &&
      isStringLiteralLikeNode(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      isCallExpression(node) &&
      node.expression.kind === SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      isStringLiteralLikeNode(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    node.forEachChild(visit);
  };

  visit(sourceFile);
  return specifiers;
}

function violationForSpecifier(
  projectRoot: string,
  sourceFile: string,
  specifier: string,
): BoundaryViolation | undefined {
  if (!specifier.startsWith(".")) return undefined;

  const sourceArea = classifyPath(projectRoot, sourceFile);
  const targetPath = resolve(dirname(sourceFile), specifier);
  const targetArea = classifyPath(projectRoot, targetPath);
  if (!sourceArea || !targetArea) return undefined;

  const displaySource = relative(projectRoot, sourceFile).split(sep).join("/");

  if (sourceArea.kind === "kernel" && targetArea.kind === "context") {
    return {
      sourceFile: displaySource,
      specifier,
      reason: `kernel must not import context '${targetArea.name}'`,
    };
  }

  if (
    sourceArea.kind !== "context" ||
    targetArea.kind !== "context" ||
    sourceArea.name === targetArea.name
  ) {
    return undefined;
  }

  const targetWithinContext = relative(targetArea.root, targetPath).split(sep).join("/");
  if (
    targetWithinContext === "" ||
    targetWithinContext === "index" ||
    targetWithinContext === "index.ts"
  ) {
    return undefined;
  }

  return {
    sourceFile: displaySource,
    specifier,
    reason: `cross-context import must use the '${targetArea.name}' public index`,
  };
}

async function sourceFilesUnder(projectRoot: string): Promise<string[]> {
  const files = new Set<string>();
  const patterns = ["src/contexts/**/*.ts", "src/kernel/**/*.ts"];

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    for await (const file of glob.scan({ cwd: projectRoot, onlyFiles: true })) {
      files.add(resolve(projectRoot, file));
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right));
}

export async function checkImportBoundaries(projectRoot = process.cwd()): Promise<BoundaryCheckResult> {
  const resolvedRoot = resolve(projectRoot);
  const files = await sourceFilesUnder(resolvedRoot);
  if (files.length === 0) return { filesScanned: 0, violations: [] };

  const api = new API({ cwd: resolvedRoot });
  const violations: BoundaryViolation[] = [];

  try {
    const snapshot = api.updateSnapshot({ openFiles: files });

    try {
      for (const file of files) {
        const project = snapshot.getDefaultProjectForFile(file);
        const sourceFile = project?.program.getSourceFile(file);
        if (!sourceFile) {
          throw new Error(`TypeScript could not parse ${relative(resolvedRoot, file)}`);
        }

        for (const specifier of collectModuleSpecifiers(sourceFile)) {
          const violation = violationForSpecifier(resolvedRoot, file, specifier);
          if (violation) violations.push(violation);
        }
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }

  violations.sort(
    (left, right) =>
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.specifier.localeCompare(right.specifier) ||
      left.reason.localeCompare(right.reason),
  );

  return { filesScanned: files.length, violations };
}

async function runCli(): Promise<void> {
  const projectRoot = process.argv[2] ?? process.cwd();
  const result = await checkImportBoundaries(projectRoot);

  if (result.violations.length > 0) {
    for (const violation of result.violations) {
      console.error(`${violation.sourceFile}: ${JSON.stringify(violation.specifier)} — ${violation.reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Import boundaries OK: ${result.filesScanned} TypeScript files scanned`);
}

if (import.meta.main) {
  await runCli();
}

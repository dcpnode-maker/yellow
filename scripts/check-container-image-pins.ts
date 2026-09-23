import { readFileSync } from "node:fs";
import { join } from "node:path";

export const EXPECTED_BUN =
  "oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0";
export const EXPECTED_VALKEY =
  "valkey/valkey:8.1.9-alpine@sha256:e0eb7c480958d32bdc4357a74bdd70653ae15f2f9b4c93c4a5a9fad1dc471c84";
export const EXPECTED_POSTGRES =
  "postgres:16.15-alpine@sha256:ab5c955e9e57ae9879d4411ab49a912be9d162455676f7bf56e951b11ac73785";

const DIGEST = /@sha256:[0-9a-f]{64}$/;

function dockerfileImages(text: string): string[] {
  return [...text.matchAll(/^\s*FROM\s+(?:--[^\s]+\s+)?(\S+)/gim)].map(
    (match) => match[1]!,
  );
}

function composeImages(text: string): string[] {
  return [...text.matchAll(/^\s*image:\s*(\S+)/gim)].map((match) => match[1]!);
}

function checkReferences(
  kind: string,
  references: string[],
  expected: string[],
): string[] {
  const errors: string[] = [];
  for (const reference of references) {
    if (!DIGEST.test(reference)) {
      errors.push(`${kind} reference is mutable or undigested: ${reference}`);
    }
  }
  for (const reference of references) {
    if (!expected.includes(reference)) {
      errors.push(`${kind} reference is unexpected: ${reference}`);
    }
  }
  for (const reference of expected) {
    if (!references.includes(reference)) {
      errors.push(`${kind} reference is missing: ${reference}`);
    }
  }
  return errors;
}

export function validateContainerImagePins(
  dockerfile: string,
  compose: string,
): string[] {
  const from = dockerfileImages(dockerfile);
  const images = composeImages(compose);
  const errors = [
    ...checkReferences("Dockerfile FROM", from, [EXPECTED_BUN, EXPECTED_BUN, EXPECTED_BUN]),
    ...checkReferences("Compose image", images, [EXPECTED_POSTGRES, EXPECTED_VALKEY]),
  ];
  if (from.length !== 3 || from.some((reference) => reference !== EXPECTED_BUN)) {
    errors.push(`Dockerfile must contain exactly three Bun stages: found ${from.length}`);
  }
  if (images.length !== 2 || !images.includes(EXPECTED_POSTGRES) || !images.includes(EXPECTED_VALKEY)) {
    errors.push(`Compose must contain exactly the pinned PostgreSQL and Valkey images: found ${images.length}`);
  }
  return [...new Set(errors)];
}

export function validateContainerImagePinFiles(root: string): string[] {
  return validateContainerImagePins(
    readFileSync(join(root, "Dockerfile"), "utf8"),
    readFileSync(join(root, "docker-compose.yml"), "utf8"),
  );
}

if (import.meta.main) {
  const errors = validateContainerImagePinFiles(join(import.meta.dir, ".."));
  if (errors.length > 0) {
    console.error(errors.map((error) => `container-image-pins: ${error}`).join("\n"));
    process.exit(1);
  }
  console.log("container-image-pins: all external images are exact digest pins");
}

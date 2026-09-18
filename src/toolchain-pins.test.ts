// Guards the Bun toolchain pin, which lives in three files that Docker and
// package managers each read for their own purpose. Nothing enforces that they
// agree, so a bump to one silently leaves the others behind — CI would then
// test a different runtime than production ships.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (file: string) => readFileSync(join(root, file), "utf8");

test("Bun version is pinned consistently", () => {
  const pkg = JSON.parse(read("package.json")) as {
    packageManager: string;
    engines: { bun: string };
  };

  const fromPackageManager = pkg.packageManager.replace(/^bun@/, "");
  const fromBunVersionFile = read(".bun-version").trim();
  const fromEngines = pkg.engines.bun.replace(/^[^\d]*/, "");
  const fromDockerfile = [
    ...read("Dockerfile").matchAll(/FROM\s+oven\/bun:([\w.-]+)-debian/g),
  ].map((match) => match[1]);

  expect(fromDockerfile.length).toBeGreaterThan(0);
  expect({
    packageManager: fromPackageManager,
    bunVersionFile: fromBunVersionFile,
    engines: fromEngines,
    dockerfile: fromDockerfile,
  }).toEqual({
    packageManager: fromPackageManager,
    bunVersionFile: fromPackageManager,
    engines: fromPackageManager,
    dockerfile: fromDockerfile.map(() => fromPackageManager),
  });
});

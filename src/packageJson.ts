import fs from "fs/promises";
import { findUp } from "find-up";
import * as utils from "./utils.js";

export async function getDependenciesMap(): Promise<DependenciesMap> {
  const jsonPath = await findUp("package.json");

  if (!jsonPath) {
    throw new Error("package.json を作成してください");
  }

  const data = await fs.readFile(jsonPath, "utf-8");
  const packageJson = JSON.parse(data.toString());

  return {
    dependencies: packageJson?.dependencies,
    devDependencies: packageJson?.devDependencies,
  };
}

export async function writeDependenciesMap(dependenciesMap: DependenciesMap) {
  const jsonPath = await findUp("package.json");

  if (!jsonPath) {
    throw new Error("package.json を作成してください");
  }

  const data = await fs.readFile(jsonPath, "utf-8");
  const oldPackageJson = JSON.parse(data.toString());

  const newPackageJson = removeEmptyParams({
    ...oldPackageJson,
    dependencies: dependenciesMap.dependencies
      ? utils.sortKeys(dependenciesMap.dependencies)
      : {},
    devDependencies: dependenciesMap.devDependencies
      ? utils.sortKeys(dependenciesMap.devDependencies)
      : {},
  });

  await fs.writeFile(jsonPath, JSON.stringify(newPackageJson, null, 2));
}

function removeEmptyParams(obj: { [name: string]: { [k: string]: string } }) {
  const removed = Object.entries(obj).filter(
    ([, val]) => Object.keys(val).length !== 0
  );
  return Object.fromEntries(removed);
}

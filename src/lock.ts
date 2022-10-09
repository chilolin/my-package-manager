import { findUp } from "find-up";
import fs from "fs/promises";
import * as utils from "./utils.js";

export type LockFile = {
  [dep: string]: LockFileInfo;
};

export type LockFileInfo = {
  version: Version;
  resolved: string;
  integrity: string;
  dependencies?: Dependencies;
};

const LOCKFILE_NAME = "my-package-manager-lock.json";

const lockJson: LockFile = {};

export async function read() {
  const lockPath = await findUp(LOCKFILE_NAME);
  const data = lockPath ? await fs.readFile(lockPath) : "{}";
  const newLockJson = JSON.parse(data.toString());
  Object.assign(lockJson, newLockJson);
}

export async function write() {
  await fs.writeFile(
    `./${LOCKFILE_NAME}`,
    JSON.stringify(utils.sortKeys(lockJson), null, 2)
  );
}

export function getOneManifest(
  name: PackageName,
  constraint: VersionConstraint
): Manifest | undefined {
  const dependencyName = createDependencyName(name, constraint);

  const dependencyInfo = lockJson?.[dependencyName];

  if (!dependencyInfo) {
    return;
  }

  return {
    [dependencyInfo.version]: {
      dist: {
        shasum: dependencyInfo.integrity,
        tarball: dependencyInfo.resolved,
      },
      dependencies: dependencyInfo.dependencies,
    },
  };
}

export function add(
  name: PackageName,
  constraint: VersionConstraint,
  info: LockFileInfo
) {
  const dependencyName = createDependencyName(name, constraint);
  return (lockJson[dependencyName] = info);
}

function createDependencyName(name: PackageName, vc: VersionConstraint) {
  return `${name}@${vc}`;
}

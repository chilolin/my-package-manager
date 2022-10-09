import * as semver from "semver";
import * as lock from "./lock.js";
import * as npm from "./npm.js";
import * as log from "./log.js";

type DependencyStack = Array<{
  name: string;
  version: string;
  dependencies: Dependencies;
}>;

const topLevel: { [name: string]: { url: string; version: string } } =
  Object.create(null);

const conflicts: Array<{ name: string; parent: string; url: string }> = [];

/**
 * 深さ優先探索を再帰を利用して実装する
 * 1. lock ファイルのマニフェストを取得
 * 2. npm のマニフェストを取得
 * 3. マニフェストとバージョン制約の照らし合わせを行う
 * 4. パッケージの依存関係を topLevel と conflicts に分ける
 * 		a. topLevel に存在しない場合は topLevel　に
 * 		b. topLevel に存在していて、それはバージョン制約とコンフリクトしないが、依存関係が親であるものがバージョン制約とコンフリクトを起こす場合は conflicts に
 * 		c. topLevel に存在していて、それがバージョン制約とコンフリクトする場合は conflicts に
 * 5. lock ファイルにマニフェストを追加する
 * 6. 依存関係のあるパッケージにも 1 ~ 5 の操作を行う
 * 7. 新たなパッケージは返却する
 */

async function collectDeps(
  name: PackageName,
  constraint: VersionConstraint,
  stack: DependencyStack = []
) {
  // 1. lock ファイルのマニフェストを取得
  const lockManifest = lock.getOneManifest(name, constraint);

  // 2. npm のマニフェストを取得
  const manifest = lockManifest || (await npm.getManifest(name));

  log.logResolving(name);

  // 3. マニフェストとバージョン制約の照らし合わせを行う
  const versions = Object.keys(manifest);
  const matched = constraint
    ? semver.maxSatisfying(versions, constraint)
    : versions[versions.length - 1];
  if (!matched) {
    throw new Error(`${name} の ${constraint} は使用することができません`);
  }

  // 4. パッケージの依存関係を topLevel と conflicts に分ける
  if (!topLevel[name]) {
    const { tarball: url } = manifest[matched].dist;
    topLevel[name] = { url, version: matched };
  } else if (semver.satisfies(topLevel[name].version, constraint)) {
    const conflictIndex = checkStackDependencies(name, matched, stack);
    if (conflictIndex === -1) {
      return;
    }

    conflicts.push({
      name,
      parent: stack
        .map(({ name }) => name)
        .slice(conflictIndex - 2)
        .join("/node_modules/"),
      url: manifest[matched].dist.tarball,
    });
  } else {
    conflicts.push({
      name,
      parent: stack[stack.length - 1].name,
      url: manifest[matched].dist.tarball,
    });
  }

  const dependencies = manifest[matched].dependencies;

  // 5. lock ファイルにマニフェストを追加する
  lock.add(name, constraint, {
    version: matched,
    dependencies,
    resolved: manifest[matched].dist.tarball,
    integrity: manifest[matched].dist.shasum,
  });

  // 6. 依存関係のあるパッケージにも 1 ~ 5 の操作を行う
  if (dependencies) {
    stack.push({ name, version: matched, dependencies: dependencies });

    // 依存関係が解決ずみであるパッケージに関しては探索は行わない
    await Promise.all(
      Object.entries(dependencies)
        .filter(
          ([name, constraint]) => !hasCirculation(name, constraint, stack)
        )
        .map(([name, constraint]) => collectDeps(name, constraint, stack))
    );

    stack.pop();
  }

  if (!constraint) {
    return { name, version: `^${matched}` };
  }
}

function checkStackDependencies(
  name: PackageName,
  range: VersionConstraint,
  stack: DependencyStack
) {
  return stack.findIndex(({ dependencies }) => {
    if (!dependencies[name]) {
      return true;
    }

    return semver.satisfies(range, dependencies[name]);
  });
}

// 子孫にあたるパッケージに同様の依存関係がないか調べる
function hasCirculation(
  name: PackageName,
  range: VersionConstraint,
  stack: DependencyStack
) {
  return stack.some(
    (dep) => dep.name === name && semver.satisfies(dep.version, range)
  );
}

export default async function (rootManifest: DependenciesMap) {
  if (rootManifest.dependencies) {
    (
      await Promise.all(
        Object.entries(rootManifest.dependencies).map((pair) =>
          collectDeps(...pair)
        )
      )
    )
      .filter(Boolean)
      .forEach(
        (item) => (rootManifest.dependencies![item!.name] = item!.version)
      );
  }

  if (rootManifest.devDependencies) {
    (
      await Promise.all(
        Object.entries(rootManifest.devDependencies).map((pair) =>
          collectDeps(...pair)
        )
      )
    )
      .filter(Boolean)
      .forEach(
        (item) => (rootManifest.devDependencies![item!.name] = item!.version)
      );
  }

  return { topLevel, conflicts };
}

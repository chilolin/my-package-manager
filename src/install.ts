import * as packageJson from "./packageJson.js";
import * as lock from "./lock.js";
import list from "./list.js";
import * as npm from "./npm.js";
import * as log from "./log.js";

type Options = { saveDev: boolean; production: boolean };

/**
 * 1. package.json　の dependencies と devDependencies　を取得
 * 2. 新たにインストールするパッケージを追加する
 * 3. production の場合は devDependencies を削除
 * 4. lock ファイルを読み込む
 * 5. dependencies の依存関係を topLevel と conflicts に分離する
 * 6. lock ファイルに書き出す
 * 7. node_modules にパッケージを追加する
 * 8. package.json に書き出す
 */

export default async function (
  addtionalPackages: string[],
  options: Options = { saveDev: false, production: false }
) {
  // 1. package.json　の dependencies と devDependencies　を取得
  const oldDependenciesMap = await packageJson.getDependenciesMap();

  // 2. 新たにインストールするパッケージを追加する
  const newDependenciesMap = addNewPackageToDependenciesMap(
    addtionalPackages,
    oldDependenciesMap,
    options
  );

  // 3. production の場合は devDependencies を削除
  if (options.production) {
    delete newDependenciesMap.devDependencies;
  }

  // 4. lock ファイルを読み込む
  await lock.read();

  // 5. dependencies の依存関係を topLevel と conflicts に分ける
  const info = await list(newDependenciesMap);

  // 6. lock ファイルに書き出す
  await lock.write();

  log.prepareInstall(Object.keys(info.topLevel).length + info.conflicts.length);

  // 7. node_modules にパッケージを追加する
  await Promise.all(
    Object.entries(info.topLevel).map(([name, { url }]) =>
      npm.install(name, url)
    )
  );

  await Promise.all(
    info.conflicts.map(({ name, parent, url }) =>
      npm.install(name, url, `/node_modules/${parent}`)
    )
  );

  // 8. package.json に書き出す
  await packageJson.writeDependenciesMap(newDependenciesMap);
}

function addNewPackageToDependenciesMap(
  addtionalPackages: Array<PackageName>,
  dependenciesMap: DependenciesMap,
  options: Options
): DependenciesMap {
  const { dependencies, devDependencies } = dependenciesMap;
  const { saveDev } = options;

  if (!addtionalPackages.length) {
    return dependenciesMap;
  }

  const addionalDependencies = addtionalPackages.reduce(
    (addedDevDependencies: Dependencies, addtionalPackage) =>
      Object.assign(addedDevDependencies, { [addtionalPackage]: "" }),
    Object.create(null)
  );

  if (saveDev) {
    return {
      ...dependenciesMap,
      devDependencies: devDependencies
        ? Object.assign(devDependencies, addionalDependencies)
        : addionalDependencies,
    };
  }

  return {
    ...dependenciesMap,
    dependencies: dependencies
      ? Object.assign(dependencies, addionalDependencies)
      : addionalDependencies,
  };
}

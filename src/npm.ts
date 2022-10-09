import fetch from "node-fetch";
import * as tar from "tar";
import * as fs from "fs-extra";

const REGISTRY = "https://registry.npmjs.org/";

const manifestCache: { [dep: PackageName]: Manifest } = Object.create(null);

export async function getManifest(name: PackageName): Promise<Manifest> {
  if (manifestCache[name]) {
    return manifestCache[name];
  }

  const response = await fetch(`${REGISTRY}/${name}`);
  const json = (await response.json()) as { versions: Manifest };

  return (manifestCache[name] = json.versions);
}

export async function install(
  name: string,
  url: string,
  location: string = ""
) {
  const path = `${process.cwd()}${location}/node_modules/${name}`;

  await fs.mkdirp(path);

  const response = await fetch(url);

  response.body?.pipe(tar.extract({ cwd: path, strip: 1 }));
}

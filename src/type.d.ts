type PackageName = string;
type Version = string;
type VersionConstraint = string;

type Dependencies = { [dep: PackageName]: Version | VersionConstraint };
type DependenciesMap = {
  dependencies?: Dependencies;
  devDependencies?: Dependencies;
};

interface Manifest {
  [version: Version]: {
    dependencies?: Dependencies;
    dist: { shasum: string; tarball: string };
  };
}

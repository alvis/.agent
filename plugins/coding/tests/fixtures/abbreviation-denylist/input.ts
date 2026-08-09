export function loadApp(): void {
  // violation: `cfg` is not an allowlisted abbreviation
  const cfg = readConfiguration();

  // violation: `repo` is not an allowlisted abbreviation
  const repo = createRepository();

  // compliant: full words, plus allowlisted `params`
  const configuration = readConfiguration();
  const repository = createRepository();
  const params = { id: "u1" };

  void cfg;
  void repo;
  void configuration;
  void repository;
  void params;
}

declare function readConfiguration(): unknown;
declare function createRepository(): unknown;

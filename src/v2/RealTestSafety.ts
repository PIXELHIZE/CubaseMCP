export const DISPOSABLE_FIXTURE_ATTESTATION = "disposable-safe14-fixture";

export function assertRealTestFixtureAuthorization(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.CUBASE_REAL_DESTRUCTIVE !== "true") return;
  if (env.CUBASE_FIXTURE_ATTESTATION !== DISPOSABLE_FIXTURE_ATTESTATION) {
    throw new Error(
      "Destructive real-Cubase evidence requires " +
      `CUBASE_FIXTURE_ATTESTATION=${DISPOSABLE_FIXTURE_ATTESTATION}. ` +
      "Open a disposable fixture project before providing this attestation."
    );
  }
}

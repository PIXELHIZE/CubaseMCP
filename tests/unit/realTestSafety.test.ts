import { describe, expect, it } from "vitest";
import {
  DISPOSABLE_FIXTURE_ATTESTATION,
  assertRealTestFixtureAuthorization
} from "../../src/v2/RealTestSafety.js";

describe("real Cubase fixture authorization", () => {
  it("does not require an attestation for read-only collection", () => {
    expect(() => assertRealTestFixtureAuthorization({
      CUBASE_REAL_DESTRUCTIVE: "false"
    } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it("fails closed before destructive collection without the exact attestation", () => {
    expect(() => assertRealTestFixtureAuthorization({
      CUBASE_REAL_DESTRUCTIVE: "true"
    } as NodeJS.ProcessEnv)).toThrow(/disposable fixture/i);

    expect(() => assertRealTestFixtureAuthorization({
      CUBASE_REAL_DESTRUCTIVE: "true",
      CUBASE_FIXTURE_ATTESTATION: DISPOSABLE_FIXTURE_ATTESTATION
    } as NodeJS.ProcessEnv)).not.toThrow();
  });
});

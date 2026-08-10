import type { CubaseHandshakeEvidence } from "../diagnostics/CubaseConnectionDoctor.js";
import { parseHostHandshake } from "./HostHandshake.js";

export const SAFE14_PREFLIGHT_TARGET = {
  appName: "Cubase",
  edition: "Pro",
  version: "14.0.41",
  releaseProfile: "safe14",
  scriptBuild: "2.0.0-safe14",
  mcpProtocolVersion: 2,
  transportVersion: 1
} as const;

export type Safe14PreflightCheckId =
  | "midi_ports"
  | "bridge_ping"
  | "host_application"
  | "host_edition_attestation"
  | "host_version"
  | "release_profile"
  | "script_build"
  | "mcp_protocol"
  | "transport_protocol";

export interface Safe14PreflightCheck {
  id: Safe14PreflightCheckId;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface Safe14PreflightReport {
  schemaVersion: 1;
  checkedAt: string;
  target: typeof SAFE14_PREFLIGHT_TARGET;
  passed: boolean;
  screenAutomationUsed: false;
  mutatingOperationsExecuted: false;
  checks: Safe14PreflightCheck[];
  blockers: Array<{ code: Safe14PreflightCheckId; message: string }>;
  handshake: CubaseHandshakeEvidence;
}

export interface Safe14PreflightOptions {
  edition?: string;
  checkedAt?: string;
}

function versionFromLabel(label: string | undefined): string | undefined {
  return label?.match(/\d+\.\d+\.\d+/)?.[0];
}

function check(
  id: Safe14PreflightCheckId,
  expected: unknown,
  actual: unknown,
  message: string
): Safe14PreflightCheck {
  return {
    id,
    passed: actual === expected,
    expected,
    actual,
    message
  };
}

export function evaluateSafe14Preflight(
  handshake: CubaseHandshakeEvidence,
  options: Safe14PreflightOptions = {}
): Safe14PreflightReport {
  const protocol = handshake.mcpProtocol ?? parseHostHandshake(handshake.response?.payload);
  const checks: Safe14PreflightCheck[] = [
    check(
      "midi_ports",
      true,
      handshake.ports.valid,
      handshake.ports.valid
        ? "Both configured virtual MIDI ports are available in the correct direction."
        : handshake.ports.diagnoses.join(" ") || "The virtual MIDI port configuration is invalid."
    ),
    check(
      "bridge_ping",
      true,
      handshake.connected,
      handshake.connected
        ? "The Cubase MIDI Remote bridge answered a correlated ping."
        : handshake.error?.message ?? "The Cubase MIDI Remote bridge did not answer ping."
    ),
    check(
      "host_application",
      SAFE14_PREFLIGHT_TARGET.appName,
      handshake.appName,
      "The official MIDI Remote application-name value must identify Cubase rather than Nuendo or an unknown host."
    ),
    check(
      "host_edition_attestation",
      SAFE14_PREFLIGHT_TARGET.edition,
      options.edition,
      "MIDI Remote does not expose the licensed edition; the self-hosted runner must provide the operator-verified Pro attestation."
    ),
    check(
      "host_version",
      SAFE14_PREFLIGHT_TARGET.version,
      versionFromLabel(handshake.appVersion),
      "The safe14 release profile is bound to the exact Cubase 14.0.41 patch."
    ),
    check(
      "release_profile",
      SAFE14_PREFLIGHT_TARGET.releaseProfile,
      protocol?.releaseProfile,
      "The active bridge must identify the safe14 release profile."
    ),
    check(
      "script_build",
      SAFE14_PREFLIGHT_TARGET.scriptBuild,
      protocol?.scriptBuild,
      "The active MIDI Remote bridge must be the exact v2 safe14 script build."
    ),
    check(
      "mcp_protocol",
      SAFE14_PREFLIGHT_TARGET.mcpProtocolVersion,
      protocol?.version,
      "The application handshake must use MCP protocol v2."
    ),
    check(
      "transport_protocol",
      SAFE14_PREFLIGHT_TARGET.transportVersion,
      protocol?.transportVersion,
      "The application handshake must use transport protocol v1."
    )
  ];
  const blockers = checks
    .filter((item) => !item.passed)
    .map((item) => ({ code: item.id, message: item.message }));
  return {
    schemaVersion: 1,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    target: SAFE14_PREFLIGHT_TARGET,
    passed: blockers.length === 0,
    screenAutomationUsed: false,
    mutatingOperationsExecuted: false,
    checks,
    blockers,
    handshake
  };
}

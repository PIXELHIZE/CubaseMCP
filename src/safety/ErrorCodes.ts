export enum ErrorCode {
  ValidationFailed = "VALIDATION_FAILED",
  CubaseNotConnected = "CUBASE_NOT_CONNECTED",
  ProjectNotOpen = "PROJECT_NOT_OPEN",
  CapabilityUnsupported = "CAPABILITY_UNSUPPORTED",
  BlockedByCubaseApi = "BLOCKED_BY_CUBASE_API",
  BlockedByNoHeadlessApi = "BLOCKED_BY_NO_HEADLESS_API",
  NeedsCubaseSideBridge = "NEEDS_CUBASE_SIDE_BRIDGE",
  NeedsUserSetup = "NEEDS_USER_SETUP",
  ExistingSelectionRequired = "REQUIRES_EXISTING_SELECTION",
  DialogRequired = "BLOCKED_BY_DIALOG_REQUIRED",
  ConfirmationRequired = "CONFIRMATION_REQUIRED",
  PermissionDenied = "PERMISSION_DENIED",
  ObjectNotFound = "OBJECT_NOT_FOUND",
  AdapterTimeout = "ADAPTER_TIMEOUT",
  AdapterFailed = "ADAPTER_FAILED",
  RaceConditionPrevented = "RACE_CONDITION_PREVENTED",
  JobNotFound = "JOB_NOT_FOUND",
  Unknown = "UNKNOWN"
}

export class CubaseMcpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "CubaseMcpError";
  }
}

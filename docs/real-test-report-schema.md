# Real Cubase Report Schema

각 실행은 `reports/real-cubase/YYYY-MM-DD_HH-mm-ss/`에 독립 evidence bundle을 만든다. JSON은 UTF-8, 2-space indentation을 사용한다.

## Status

`tool-capability-matrix.json`과 `summary.md`는 다음 상태만 사용한다.

| Status | 의미 |
| --- | --- |
| `real` | 실제 Cubase에서 operation의 기대 효과가 관측되었고, 필요한 경우 복구까지 확인됨 |
| `partial_direct_access` | 실제 DirectAccess object/parameter 범위에서만 검증됨 |
| `partial_command_binding` | command binding으로 동작하지만 세부 인자를 전달할 수 없음 |
| `partial_current_setting_only` | Cubase에 현재 저장된 설정만 사용 가능 |
| `partial_selection_dependent` | 현재 선택/focus object에서만 검증됨 |
| `partial_bridge_required` | server-side protocol/route는 있으나 production Cubase-side companion이 필요함 |
| `unknown_not_tested` | operation-level real evidence 없음 |
| `blocked_by_no_headless_api` | DirectAccess와 command evidence가 모두 headless path 부재를 입증함 |
| `blocked_by_missing_cubase_side_bridge` | MIDI Remote만으로 부족하고 허용된 Cubase-side binary/plugin bridge가 필요함 |
| `blocked_by_cubase_api` | 연결된 Cubase가 명시적인 API-not-exposed 오류를 반환함 |
| `mock_only` | mock adapter에서만 구현됨 |

`testedWithRealCubase: false`와 `status: real` 조합은 schema invariant 위반이며 `ReportWriter`가 report 생성을 거부한다.

## Files

### `summary.md`

Run timestamp, mode, 연결 여부와 다음 표를 포함한다.

```text
| Tool | Status | Adapter | Tested With Real Cubase | Evidence File | Limitation |
```

### `raw-handshake.json`

```ts
type HandshakeEvidence = {
  connected: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  ports: {
    expected: { input: string; output: string };
    available: { inputs: string[]; outputs: string[] };
    inputFound: boolean;
    outputFound: boolean;
    likelyDirectionMismatch: boolean;
    diagnoses: string[];
  };
  response?: CubaseMidiProtocolMessage;
  appVersion?: string;
  midiRemoteApiVersion?: string;
  directAccessAvailable?: boolean;
  bridgeActive?: boolean;
  protocol?: unknown;
  routerDiagnostics: unknown;
  error?: { code: string; message: string };
};
```

MIDI Remote API version은 Cubase module이 직접 version number를 제공하지 않는 경우 feature detection 결과(`1.2_feature_detected`, `1.3_feature_detected`)로 기록한다.

### `direct-access-tree.json`

API/version capability, 네 root의 raw tree, flattened object metadata, category index, object/parameter subscription ACK를 포함한다.

```ts
type ObjectEvidence = {
  root: "transport" | "trackSelection" | "mixConsole" | "focusedQuickControls";
  path: string;
  objectId: number;
  title?: string;
  typeName?: string;
  uniqueId?: string;
  childCount: number;
  parameterCount: number;
};
```

Root별 5,000 object 또는 depth 12를 넘으면 `truncated: true`가 기록되며 전체 탐색으로 간주하지 않는다.

### `direct-access-parameters.json`

Flattened parameter와 write test를 포함한다. Discovery의 기본 write test는 현재 process value를 동일하게 다시 쓰고 read-back한 뒤 복구를 확인한다. Smoke test는 작은 값을 실제 변경하고 원래 값으로 복구한다.

```ts
type ParameterEvidence = {
  objectId: number;
  parameterTag: number;
  title?: string;
  processValue?: number;
  defaultProcessValue?: number;
  plainValue?: number;
  displayValue?: string;
  units?: string;
  processValueType?: string;
  automatable?: boolean;
  editLocked?: boolean;
  writable: boolean;
  writeTestPossible: boolean;
};
```

### `command-bindings.json`

각 candidate는 다음 구조를 사용한다.

```ts
type CommandAuditResult = {
  category: string;
  name: string;
  bindingCreated: boolean;
  canPerformSupported: boolean;
  canPerform?: boolean;
  executedInAudit: boolean;
  stateBefore?: unknown;
  stateAfter?: unknown;
  stateDiff?: unknown;
  requiresSelection?: boolean;
  opensDialog?: boolean;
  result: "real" | "partial" | "not_performable" | "dialog_required" | "unknown" | "error";
  error?: string;
};
```

`--execute-destructive`가 없으면 destructive candidate는 실행되지 않는다. Dialog 여부는 화면 감지로 추론하지 않으며, known dialog-risk metadata 또는 command effect 부재를 별도로 기록한다.

### `plugin-manager.json`

Plugin manager feature detection, slot 수, collection 수, active/default collection, entry UID/title/vendor, assignment/reset 지원 여부를 기록한다. `assignmentExecuted`는 `--execute-plugin-assignment`가 있고 현재 plugin UID와 복구 UID를 안전하게 식별했을 때만 true가 될 수 있다. 긍정 evidence에는 `assignmentRestored: true`도 필요하다.

### `tool-capability-matrix.json`

```ts
type ToolCapabilityEvidence = {
  tool: string;
  status: RealCapabilityStatus;
  adapter: string;
  testedWithRealCubase: boolean;
  evidenceFile: string;
  limitation: string;
};
```

### `errors.json`

```ts
type DiagnosticError = {
  stage: string;
  code: string;
  message: string;
  timestamp: string;
  details?: unknown;
};
```

Error가 있어도 가능한 evidence 파일은 모두 생성한다. Handshake 실패 시 process exit code는 1이다.

### `next-actions.md`

Port, handshake, DirectAccess, plugin manager, command, smoke 결과에서 자동 생성한 후속 조치를 순서대로 기록한다.

### `smoke-tests.json`

`cubase:discover`와 `cubase:smoke`가 추가로 생성한다.

```ts
type SmokeTestResult = {
  name: string;
  passed: boolean;
  before?: unknown;
  executionValue?: unknown;
  after?: unknown;
  restoreAttempted: boolean;
  restored?: boolean;
  restoredValue?: unknown;
  error?: string;
};
```

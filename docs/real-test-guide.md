# Real Cubase Headless Test Guide

이 절차는 Windows의 실제 Cubase/Nuendo 프로세스와 MIDI Remote script를 사용한다. 화면, 키보드, 마우스, dialog, OCR 자동화는 사용하지 않는다.

## 사전 조건

- Node.js 22 이상
- Cubase 또는 Nuendo 12 이상. DirectAccess 기본 탐색은 API feature detection 결과에 따라 달라지며, plugin manager와 `canPerform`은 Cubase/Nuendo 15 MIDI Remote API 1.3이 필요하다.
- Tobias Erichsen loopMIDI 또는 동등한 virtual MIDI driver
- 테스트 전 프로젝트 백업. Smoke test는 값을 복구하지만 실제 DAW와 plugin 상태는 외부 요인의 영향을 받을 수 있다.

## 실행 순서

1. loopMIDI 포트 생성

   loopMIDI에서 정확히 다음 두 포트를 만든다.

   - `AI MCP Bridge To Cubase`
   - `AI MCP Bridge From Cubase`

   한 포트만 양방향으로 재사용하지 않는다. Echo와 request/response 방향 혼동을 피하기 위해 두 포트를 분리한다.

2. Cubase MIDI Remote script 설치

   Cubase를 한 번 실행해 MIDI Remote 폴더를 생성한 뒤 종료한다. 다음 Local driver 폴더를 만든다.

   ```powershell
   $driverRoot = "$env:USERPROFILE\Documents\Steinberg\Cubase\MIDI Remote\Driver Scripts\Local\OpenAI\AI_MCP_DirectAccess_Bridge"
   New-Item -ItemType Directory -Force $driverRoot | Out-Null
   Copy-Item ".\src\cubase-remote-script\direct-access-bridge.js" "$driverRoot\OpenAI_AI_MCP_DirectAccess_Bridge.js" -Force
   ```

   Nuendo 또는 버전별 Documents 폴더를 사용하는 설치에서는 `Cubase` 경로 부분을 실제 생성된 Steinberg host 폴더 이름으로 바꾼다.

3. Cubase에서 MIDI Remote device 추가

   Cubase를 시작하고 `Studio > Studio Setup` 또는 lower zone의 `MIDI Remote`에서 `OpenAI / AI MCP DirectAccess Bridge` script를 로드한다. Script Console에 예외가 없어야 한다. Script를 수정한 뒤에는 `Reload Scripts`를 실행한다.

4. input/output port 지정

   Cubase MIDI Remote device 기준으로 다음과 같이 지정한다.

   - Input: `AI MCP Bridge To Cubase`
   - Output: `AI MCP Bridge From Cubase`

   Node discovery process의 방향은 반대 관점이다. Node input은 `From Cubase`, Node output은 `To Cubase`다.

5. Cubase 프로젝트 열기

   테스트 전용 프로젝트를 열고 저장한다. 다른 프로젝트를 닫거나 저장하지 않은 변경을 폐기하는 command는 이 audit에서 실행하지 않는다.

6. 최소 테스트 객체 준비

   다음을 준비하고 audio track을 선택한다.

   - audio track 1개 이상
   - instrument track 1개 이상
   - 선택된 track의 insert plugin 1개 이상
   - focused Quick Control에 숫자 parameter 1개 이상
   - 모든 track의 record enable 해제 (`npm run test:real`은 record transport를 짧게 검증하고 즉시 stop한다.)

   Command selection audit까지 수행하려면 테스트용 MIDI/audio event도 선택할 수 있다. Destructive command는 기본 실행되지 않는다.

7. PowerShell 환경 변수 설정

   저장소 루트에서 실행한다.

   ```powershell
   $env:CUBASE_REQUIRE_REAL = "true"
   $env:CUBASE_ADAPTER = "composite"
   $env:CUBASE_MIDI_IN = "AI MCP Bridge From Cubase"
   $env:CUBASE_MIDI_OUT = "AI MCP Bridge To Cubase"
   $env:CUBASE_MIDI_TIMEOUT_MS = "3000"
   $env:CUBASE_MIDI_RETRIES = "2"
   npm install
   ```

8. Discovery 실행

   ```powershell
   npm run cubase:discover
   ```

   이 명령은 transport와 선택된 channel/Quick Control 값을 잠시 변경한 뒤 원래 값으로 복구한다. Plugin assignment와 destructive command는 실행하지 않는다. 명시적으로 허용할 경우에만 다음 옵션을 사용한다.

   ```powershell
   npm run cubase:discover -- --execute-destructive
   npm run cubase:direct-access -- --execute-plugin-assignment
   ```

9. 생성된 report 폴더 확인

   출력된 절대 경로 또는 다음 폴더를 확인한다.

   ```text
   reports/real-cubase/YYYY-MM-DD_HH-mm-ss/
   ```

   `summary.md`에서 `Tested With Real Cubase`와 evidence 파일을 먼저 확인한다. `npm test` 결과만으로 `real`이 되지 않는다.

10. 실패 자료 전달

   우선 다음 파일을 AI에게 전달한다.

   - `summary.md`
   - `raw-handshake.json`
   - `errors.json`
   - `next-actions.md`

   Handshake 이후 실패했다면 `direct-access-tree.json`, `direct-access-parameters.json`, `command-bindings.json`, `plugin-manager.json`, `smoke-tests.json`도 함께 전달한다. Cubase project 파일, audio 원본, plugin preset은 진단에 필요하지 않다.

## 개별 명령

```powershell
npm run cubase:smoke
npm run cubase:commands
npm run cubase:direct-access
npm run test:real
```

`npm run test:real`은 npm lifecycle 이름을 감지해 integration suite를 강제 실행한다. Cubase 또는 MIDI bridge가 없으면 skip하지 않고 실패한다. 직접 Vitest를 호출할 때는 `$env:CUBASE_REQUIRE_REAL = "true"`를 유지한다.
이 명령은 `realEvidence.report.test.ts`에서 timestamped discovery evidence도 생성한다. 전용 테스트 프로젝트에서만 실행한다.

## SysEx 진단

`raw-handshake.json`의 `routerDiagnostics`에서 다음을 확인한다.

- `framesSent` / `framesReceived`: 0이면 포트 방향 또는 device 연결 문제
- `malformedFrames`: JSON/framing 손상
- `duplicateResponses` / `orphanResponses`: timeout 이후 늦은 응답 또는 중복 응답
- `chunking.completedTransfers`: 큰 DirectAccess 응답 재조립 횟수
- `chunking.expiredTransfers`: 누락된 chunk 또는 script reload 중단
- `chunking.checksumFailures`: payload 손상 또는 서로 다른 bridge 버전 혼용

Script reload 뒤에는 bridge가 `hello`를 다시 전송하며 router는 이를 reconnect event로 기록한다. 진행 중 request는 timeout/retry 규칙에 따라 재시도된다.

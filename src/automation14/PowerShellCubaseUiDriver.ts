import { spawn } from "node:child_process";
import type { Automation14PlaybackProbe, Automation14Preflight, Automation14UiDriver } from "./types.js";

export interface PowerShellCubaseUiDriverOptions {
  processName?: string;
  testedHostVersion?: string;
  midiPort?: string;
  operationTimeoutMs?: number;
}

const shell = String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$nativeSource=@'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class CubaseAutomation14Native {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint command);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint f,uint a,uint b,int c,UIntPtr d);
  public struct RECT { public int Left,Top,Right,Bottom; }
  public static void Click(int x,int y) { SetCursorPos(x,y); mouse_event(2,0,0,0,UIntPtr.Zero); mouse_event(4,0,0,0,UIntPtr.Zero); }
}
'@
Add-Type $nativeSource
$payloadText=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($PayloadBase64))
$payload=$payloadText | ConvertFrom-Json

function Get-CubaseProcess {
  $candidate=Get-Process -Name $payload.processName -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object -First 1
  if(-not $candidate){throw "Cubase process with a main window was not found."}
  return $candidate
}
function Get-Rect([IntPtr]$handle) {
  $rect=New-Object CubaseAutomation14Native+RECT
  if(-not [CubaseAutomation14Native]::GetWindowRect($handle,[ref]$rect)){throw "Could not read window rectangle."}
  return $rect
}
function Find-Window([uint32]$wantedPid,[string]$pattern) {
  $script:found=[IntPtr]::Zero
  [CubaseAutomation14Native]::EnumWindows({param($h,$l)
    $windowPid=0;[CubaseAutomation14Native]::GetWindowThreadProcessId($h,[ref]$windowPid)|Out-Null
    if($windowPid -eq $wantedPid -and [CubaseAutomation14Native]::IsWindowVisible($h)){
      $title=New-Object Text.StringBuilder 512;[CubaseAutomation14Native]::GetWindowText($h,$title,512)|Out-Null
      if($title.ToString() -match $pattern){$script:found=$h;return $false}
    }
    return $true
  },[IntPtr]::Zero)|Out-Null
  return $script:found
}
function Wait-Window([uint32]$wantedPid,[string]$pattern,[int]$timeoutMs=12000) {
  $timer=[Diagnostics.Stopwatch]::StartNew()
  while($timer.ElapsedMilliseconds -lt $timeoutMs){
    $handle=Find-Window $wantedPid $pattern
    if($handle -ne [IntPtr]::Zero){return $handle}
    Start-Sleep -Milliseconds 100
  }
  throw "Timed out waiting for window: $pattern"
}
function Focus([IntPtr]$handle){[CubaseAutomation14Native]::SetForegroundWindow($handle)|Out-Null;Start-Sleep -Milliseconds 250}
function Click([int]$x,[int]$y){[CubaseAutomation14Native]::Click($x,$y);Start-Sleep -Milliseconds 220}
function Paste-Text([string]$value){
  [Windows.Forms.SendKeys]::SendWait('^a')
  if([string]::IsNullOrEmpty($value)){[Windows.Forms.SendKeys]::SendWait('{BACKSPACE}')}
  else{[Windows.Forms.Clipboard]::SetText($value);[Windows.Forms.SendKeys]::SendWait('^v')}
  Start-Sleep -Milliseconds 180
}
function Main-Window($process){
  $handle=[IntPtr]$process.MainWindowHandle
  for($index=0;$index -lt 8 -and $handle -ne [IntPtr]::Zero;$index++){
    $title=New-Object Text.StringBuilder 512;[CubaseAutomation14Native]::GetWindowText($handle,$title,512)|Out-Null
    if($title.ToString() -match '^Cubase Pro Project -'){return $handle}
    $handle=[CubaseAutomation14Native]::GetWindow($handle,4)
  }
  $projectWindow=Find-Window ([uint32]$process.Id) '^Cubase Pro Project -'
  if($projectWindow -eq [IntPtr]::Zero){throw 'Cubase project window was not found.'}
  return $projectWindow
}
function Open-AddTrack($process,[int]$subMenuY){
  $main=Main-Window $process;Focus $main;Click 118 40;[CubaseAutomation14Native]::SetCursorPos(145,58)|Out-Null;Start-Sleep -Milliseconds 450;Click 452 $subMenuY
  return Wait-Window ([uint32]$process.Id) '^Add Track$'
}
function Set-NameAndConfirm([IntPtr]$dialog,[string]$name,[int]$nameOffsetY){
  $rect=Get-Rect $dialog;Focus $dialog;Click ($rect.Left+310) ($rect.Top+$nameOffsetY);Paste-Text $name;Click ($rect.Left+300) ($rect.Bottom-27);Start-Sleep -Milliseconds 900
}
function Select-DialogSearchResult([IntPtr]$dialog,[int]$fieldOffsetY,[string]$query,[int]$resultOffsetY,[switch]$Arrow){
  $rect=Get-Rect $dialog;Focus $dialog
  if($Arrow){Click ($rect.Right-40) ($rect.Top+$fieldOffsetY)}else{Click ($rect.Left+310) ($rect.Top+$fieldOffsetY)}
  Paste-Text $query;Start-Sleep -Milliseconds 500;Click ($rect.Left+300) ($rect.Top+$resultOffsetY);Start-Sleep -Milliseconds 350
}
function Capture-Screen {
  $bounds=[Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap=New-Object Drawing.Bitmap $bounds.Width,$bounds.Height
  $graphics=[Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Location,[Drawing.Point]::Empty,$bounds.Size)
  $graphics.Dispose()
  return $bitmap
}
function Clear-GlobalSolo {
  $sample=New-Object Drawing.Bitmap 1,1;$graphics=[Drawing.Graphics]::FromImage($sample)
  $graphics.CopyFromScreen((New-Object Drawing.Point 620,62),[Drawing.Point]::Empty,(New-Object Drawing.Size 1,1));$graphics.Dispose()
  $color=$sample.GetPixel(0,0);$sample.Dispose()
  if($color.R -gt 150 -and $color.G -lt 120){Click 628 62;Start-Sleep -Milliseconds 350}
}
function Count-MeterDelta([Drawing.Bitmap]$baseline,[Drawing.Bitmap]$frame,$rect){
  $count=0
  $left=[Math]::Max(0,[int]$rect.Left);$right=[Math]::Min($frame.Width,[int]$rect.Right)
  $top=[Math]::Max(0,[int]$rect.Bottom-330);$bottom=[Math]::Min($frame.Height,[int]$rect.Bottom-105)
  for($x=$left;$x -lt $right;$x+=2){
    for($y=$top;$y -lt $bottom;$y+=2){
      $before=$baseline.GetPixel($x,$y);$after=$frame.GetPixel($x,$y)
      $delta=[Math]::Abs([int]$before.R-[int]$after.R)+[Math]::Abs([int]$before.G-[int]$after.G)+[Math]::Abs([int]$before.B-[int]$after.B)
      if($delta -gt 50 -and $after.G -gt 105 -and $after.B -gt 65 -and $after.G -gt ($after.R+25)){$count++}
    }
  }
  return $count
}
function Count-ActiveMeterPixels([Drawing.Bitmap]$frame,$rect){
  $count=0
  $left=[Math]::Max(0,[int]$rect.Left);$right=[Math]::Min($frame.Width,[int]$rect.Right)
  $top=[Math]::Max(0,[int]$rect.Bottom-330);$bottom=[Math]::Min($frame.Height,[int]$rect.Bottom-105)
  for($x=$left;$x -lt $right;$x+=2){
    for($y=$top;$y -lt $bottom;$y+=2){
      $color=$frame.GetPixel($x,$y)
      if($color.G -gt 125 -and $color.B -gt 85 -and $color.R -lt 110 -and $color.G -gt ($color.R+35)){$count++}
    }
  }
  return $count
}
function Test-HalionProgramResult($rect){
  $width=360;$height=42;$bitmap=New-Object Drawing.Bitmap $width,$height;$graphics=[Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen((New-Object Drawing.Point ($rect.Left+820),($rect.Top+345)),[Drawing.Point]::Empty,(New-Object Drawing.Size $width,$height));$graphics.Dispose()
  $bright=0
  for($x=0;$x -lt $width;$x+=2){for($y=0;$y -lt $height;$y+=2){$color=$bitmap.GetPixel($x,$y);if($color.R -gt 105 -or $color.G -gt 105 -or $color.B -gt 105){$bright++}}}
  $bitmap.Dispose();return $bright -ge 18
}

$process=Get-CubaseProcess
$result=[ordered]@{ok=$true;action=$ActionName;processId=$process.Id}
switch($ActionName){
  'preflight' {
    $main=Main-Window $process;$rect=Get-Rect $main;$bounds=[Windows.Forms.Screen]::PrimaryScreen.Bounds
    $version=[Diagnostics.FileVersionInfo]::GetVersionInfo($process.Path).ProductVersion
    $semantic=([regex]::Match($version,'\d+\.\d+\.\d+')).Value
    $failures=New-Object Collections.Generic.List[string]
    if($semantic -ne [string]$payload.testedHostVersion){$failures.Add("Expected Cubase $($payload.testedHostVersion), found $semantic")}
    if($bounds.Width -ne 2560 -or $bounds.Height -ne 1080){$failures.Add("Expected 2560x1080 primary display, found $($bounds.Width)x$($bounds.Height)")}
    if(($rect.Right-$rect.Left) -lt 2500 -or ($rect.Bottom-$rect.Top) -lt 1000){$failures.Add('Cubase must be maximized on the primary display.')}
    $result.hostVersion=$semantic;$result.display=@{width=$bounds.Width;height=$bounds.Height};$result.mainWindow=@{left=$rect.Left;top=$rect.Top;right=$rect.Right;bottom=$rect.Bottom};$result.midiPort=[string]$payload.midiPort;$result.failures=@($failures);$result.ok=$failures.Count -eq 0
  }
  'setTempo' {
    Focus (Main-Window $process);Click 1702 1011;Click 1702 1011;Paste-Text ([string]$payload.bpm);[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 400
  }
  'locateStart' {
    Focus (Main-Window $process);Click 1302 1011;Click 1535 1011;Click 1535 1011;Paste-Text '1.1.1.0';[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 350
  }
  'addInstrumentTrack' {
    if([string]$payload.plugin -ne 'HALion Sonic'){throw "automation14 currently requires HALion Sonic for deterministic program selection."}
    $dialog=Open-AddTrack $process 77
    Select-DialogSearchResult $dialog 158 ([string]$payload.plugin) 276 -Arrow
    if(-not [string]::IsNullOrWhiteSpace([string]$payload.midiInput)){Select-DialogSearchResult $dialog 188 ([string]$payload.midiInput) 312}
    if(-not [string]::IsNullOrWhiteSpace([string]$payload.output)){
      $rect=Get-Rect $dialog;Focus $dialog;Click ($rect.Left+310) ($rect.Top+218);Paste-Text ([string]$payload.output);Start-Sleep -Milliseconds 500
      [Windows.Forms.SendKeys]::SendWait('{DOWN}');[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 350
    }
    Set-NameAndConfirm $dialog ([string]$payload.name) 280
    $plugin=Wait-Window ([uint32]$process.Id) 'HALion Sonic' 20000
    $pluginRect=Get-Rect $plugin;$result.pluginWindow=@{left=$pluginRect.Left;top=$pluginRect.Top;right=$pluginRect.Right;bottom=$pluginRect.Bottom}
  }
  'loadHalionProgram' {
    $plugin=Wait-Window ([uint32]$process.Id) 'HALion Sonic';$rect=Get-Rect $plugin;Focus $plugin
    Click ($rect.Left+987) ($rect.Top+246)
    Click ($rect.Left+1100) ($rect.Top+180);Paste-Text ''
    Click ($rect.Left+967) ($rect.Top+390);Click ($rect.Left+967) ($rect.Top+390);Start-Sleep -Milliseconds 900
    Click ($rect.Left+1100) ($rect.Top+180);Paste-Text ([string]$payload.program);Start-Sleep -Milliseconds 1200
    if(-not (Test-HalionProgramResult $rect)){throw "HALion MediaBay returned no visible result for program: $([string]$payload.program)"}
    Click ($rect.Left+995) ($rect.Top+367);Click ($rect.Left+995) ($rect.Top+367);Start-Sleep -Milliseconds 3500
    $result.program=[string]$payload.program
    Focus $plugin;[Windows.Forms.SendKeys]::SendWait('{ESC}');Start-Sleep -Milliseconds 500
  }
  'setSelectedMidiInput' {
    [Windows.Forms.SendKeys]::SendWait('{ESC}');Start-Sleep -Milliseconds 500;Focus (Main-Window $process)
    Click 220 509;Click 220 545;Paste-Text ([string]$payload.port);Start-Sleep -Milliseconds 500;Click 275 630
  }
  'setSelectedOutput' {
    Focus (Main-Window $process);Click 220 674;Click 220 710;Paste-Text ([string]$payload.destination);Start-Sleep -Milliseconds 500;Click 220 755
  }
  'startRecording' {Focus (Main-Window $process);Click 1400 1011;Start-Sleep -Milliseconds 30}
  'stopTransport' {Focus (Main-Window $process);Click 1302 1011;Start-Sleep -Milliseconds 350}
  'addGroupTrack' {
    $dialog=Open-AddTrack $process 193
    if(-not [string]::IsNullOrWhiteSpace([string]$payload.output)){Select-DialogSearchResult $dialog 166 ([string]$payload.output) 284}
    Set-NameAndConfirm $dialog ([string]$payload.name) 225
  }
  'addFxTrack' {
    $dialog=Open-AddTrack $process 170
    if(-not [string]::IsNullOrWhiteSpace([string]$payload.effect)){Select-DialogSearchResult $dialog 135 ([string]$payload.effect) 253}
    if(-not [string]::IsNullOrWhiteSpace([string]$payload.output)){Select-DialogSearchResult $dialog 195 ([string]$payload.output) 274}
    Set-NameAndConfirm $dialog ([string]$payload.name) 255
    Start-Sleep -Milliseconds 1500
    $effectWindow=Find-Window ([uint32]$process.Id) ([regex]::Escape([string]$payload.effect))
    if($effectWindow -ne [IntPtr]::Zero){Focus $effectWindow;[Windows.Forms.SendKeys]::SendWait('{ESC}');Start-Sleep -Milliseconds 400}
  }
  'addMarkerTrack' {
    $dialog=Wait-Window ([uint32]$process.Id) '^Add Track$'
    $rect=Get-Rect $dialog;Focus $dialog;Click ($rect.Left+310) ($rect.Top+135);Paste-Text ([string]$payload.name)
    Click ($rect.Left+300) ($rect.Bottom-18);Start-Sleep -Milliseconds 900
  }
  'commitRename' {Start-Sleep -Milliseconds 700;Paste-Text ([string]$payload.name);[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 500}
  'saveProject' {Focus (Main-Window $process);[Windows.Forms.SendKeys]::SendWait('^s');Start-Sleep -Milliseconds 4000}
  'playFromStart' {
    $main=Main-Window $process;Focus $main;Clear-GlobalSolo
    $startPosition=if([string]::IsNullOrWhiteSpace([string]$payload.startPosition)){'1.1.1.0'}else{[string]$payload.startPosition}
    Click 1535 1011;Click 1535 1011;Paste-Text $startPosition;[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 350
    $mix=Find-Window ([uint32]$process.Id) '^MixConsole -'
    if($mix -eq [IntPtr]::Zero){[Windows.Forms.SendKeys]::SendWait('{F3}');$mix=Wait-Window ([uint32]$process.Id) '^MixConsole -' 8000}
    $mixRect=Get-Rect $mix;Focus $mix
    $mixTitle=New-Object Text.StringBuilder 512;[CubaseAutomation14Native]::GetWindowText($mix,$mixTitle,512)|Out-Null
    $baseline=Capture-Screen;[Windows.Forms.SendKeys]::SendWait(' ')
    $best=0;$bestActive=0;$bestFrame=$null;$sampled=0;$sampleBudget=[Math]::Min([int]$payload.durationMs,2600);$timer=[Diagnostics.Stopwatch]::StartNew()
    while($timer.ElapsedMilliseconds -lt $sampleBudget){
      Start-Sleep -Milliseconds 300;$frame=Capture-Screen;$sampled++;$changed=Count-MeterDelta $baseline $frame $mixRect;$active=Count-ActiveMeterPixels $frame $mixRect
      if($changed -gt $best -or ($changed -eq $best -and $active -gt $bestActive)){
        if($bestFrame){$bestFrame.Dispose()};$best=$changed;$bestActive=$active;$bestFrame=$frame
      }else{$frame.Dispose()}
    }
    $remaining=[int]$payload.durationMs-[int]$timer.ElapsedMilliseconds;if($remaining -gt 0){Start-Sleep -Milliseconds $remaining}
    Focus $mix;[Windows.Forms.SendKeys]::SendWait(' ');Start-Sleep -Milliseconds 250
    $evidencePath=Join-Path $env:TEMP ('cubase-automation14-meter-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.png')
    if($bestFrame){$bestFrame.Save($evidencePath);$bestFrame.Dispose()}else{$baseline.Save($evidencePath)};$baseline.Dispose()
    $result.verified=($best -ge 8 -and $bestActive -ge 12);$result.startPosition=$startPosition;$result.durationMs=[int]$payload.durationMs;$result.sampledFrames=$sampled;$result.changedMeterPixels=$best;$result.activeMeterPixels=$bestActive;$result.mixConsoleTitle=$mixTitle.ToString();$result.screenshotPath=$evidencePath
  }
  default {throw "Unknown automation14 action: $ActionName"}
}
$result | ConvertTo-Json -Depth 8 -Compress
`;

export class PowerShellCubaseUiDriver implements Automation14UiDriver {
  private readonly processName: string;
  private readonly testedHostVersion: string;
  private readonly midiPort: string;
  private readonly operationTimeoutMs: number;

  constructor(options: PowerShellCubaseUiDriverOptions = {}) {
    this.processName = options.processName ?? "Cubase14";
    this.testedHostVersion = options.testedHostVersion ?? "14.0.32";
    this.midiPort = options.midiPort ?? "AI MCP Bridge To Cubase";
    this.operationTimeoutMs = options.operationTimeoutMs ?? 30_000;
  }

  preflight(): Promise<Automation14Preflight> {
    return this.invoke<Automation14Preflight>("preflight", {});
  }

  async setTempo(bpm: number): Promise<void> { await this.invoke("setTempo", { bpm }); }
  async locateStart(): Promise<void> { await this.invoke("locateStart", {}); }
  async addInstrumentTrack(name: string, plugin: string, midiInput?: string, output?: string): Promise<void> { await this.invoke("addInstrumentTrack", { name, plugin, midiInput, output }); }
  async loadHalionProgram(program: string): Promise<void> { await this.invoke("loadHalionProgram", { program }, 45_000); }
  async setSelectedMidiInput(port: string): Promise<void> { await this.invoke("setSelectedMidiInput", { port }); }
  async setSelectedOutput(destination: string): Promise<void> { await this.invoke("setSelectedOutput", { destination }); }
  async startRecording(): Promise<void> { await this.invoke("startRecording", {}); }
  async stopTransport(): Promise<void> { await this.invoke("stopTransport", {}); }
  async addGroupTrack(name: string, output?: string): Promise<void> { await this.invoke("addGroupTrack", { name, output }); }
  async addFxTrack(name: string, effect?: string, output = "Stereo Out"): Promise<void> { await this.invoke("addFxTrack", { name, effect, output }); }
  async addMarkerTrack(name: string): Promise<void> { await this.invoke("addMarkerTrack", { name }); }
  async commitRename(name: string): Promise<void> { await this.invoke("commitRename", { name }); }
  async saveProject(): Promise<void> { await this.invoke("saveProject", {}); }
  playFromStart(durationMs: number): Promise<Automation14PlaybackProbe> { return this.playFromPosition("1.1.1.0", durationMs); }
  playFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> {
    return this.invoke<Automation14PlaybackProbe>("playFromStart", { startPosition: position, durationMs }, durationMs + 20_000);
  }

  private async invoke<T = unknown>(action: string, payload: Record<string, unknown>, timeoutMs = this.operationTimeoutMs): Promise<T> {
    if (process.platform !== "win32") throw new Error("automation14 requires Windows.");
    const merged = {
      processName: this.processName,
      testedHostVersion: this.testedHostVersion,
      midiPort: this.midiPort,
      ...payload
    };
    const encodedPayload = Buffer.from(JSON.stringify(merged), "utf8").toString("base64");
    const command = `$ActionName='${action}';$PayloadBase64='${encodedPayload}'\n${shell}`;
    const stdout = await this.runPowerShell(command, timeoutMs);
    const line = stdout.trim().split(/\r?\n/).at(-1);
    if (!line) throw new Error(`automation14 ${action} returned no result.`);
    return JSON.parse(line) as T;
  }

  private runPowerShell(command: string, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`automation14 PowerShell timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => { stdout += chunk; });
      child.stderr.on("data", (chunk: string) => { stderr += chunk; });
      child.on("error", (error) => { clearTimeout(timer); reject(error); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(stdout);
        else reject(new Error(`automation14 PowerShell exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
      });
      child.stdin.end(`${command}\r\n`, "utf8");
    });
  }
}

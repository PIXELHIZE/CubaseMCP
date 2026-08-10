import { spawn } from "node:child_process";
import type {
  Automation14ExportUiResult,
  Automation14MixerGainResult,
  Automation14PlaybackProbe,
  Automation14Preflight,
  Automation14ProgramLoadResult,
  Automation14ProjectCreateResult,
  Automation14UiDriver
} from "./types.js";

export interface PowerShellCubaseUiDriverOptions {
  processName?: string;
  testedHostVersion?: string;
  midiPort?: string;
  projectTitle?: string;
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
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr h, uint command);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint message, IntPtr wParam, IntPtr lParam);
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
function Close-VisibleWindows([uint32]$wantedPid,[string]$pattern) {
  for($attempt=0;$attempt -lt 12;$attempt++){
    $handle=Find-Window $wantedPid $pattern
    if($handle -eq [IntPtr]::Zero){return}
    [CubaseAutomation14Native]::PostMessage($handle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null
    Start-Sleep -Milliseconds 250
  }
  if((Find-Window $wantedPid $pattern) -ne [IntPtr]::Zero){throw "Could not close stale window: $pattern"}
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
  $pattern=if([string]::IsNullOrWhiteSpace([string]$payload.projectTitle)){'^Cubase Pro Project -'}else{'^Cubase Pro Project - '+[regex]::Escape([string]$payload.projectTitle)+'$'}
  $handle=[IntPtr]$process.MainWindowHandle
  for($index=0;$index -lt 8 -and $handle -ne [IntPtr]::Zero;$index++){
    $title=New-Object Text.StringBuilder 512;[CubaseAutomation14Native]::GetWindowText($handle,$title,512)|Out-Null
    if($title.ToString() -match $pattern){return $handle}
    $handle=[CubaseAutomation14Native]::GetWindow($handle,4)
  }
  $projectWindow=Find-Window ([uint32]$process.Id) $pattern
  if($projectWindow -eq [IntPtr]::Zero){throw "Cubase project window was not found: $pattern"}
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
function Count-BrightPixels([int]$left,[int]$top,[int]$width,[int]$height){
  $bitmap=New-Object Drawing.Bitmap $width,$height;$graphics=[Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen((New-Object Drawing.Point $left,$top),[Drawing.Point]::Empty,(New-Object Drawing.Size $width,$height));$graphics.Dispose()
  $bright=0
  for($x=0;$x -lt $width;$x++){for($y=0;$y -lt $height;$y++){
    $color=$bitmap.GetPixel($x,$y)
    if($color.R -gt 100 -and $color.G -gt 100 -and $color.B -gt 100){$bright++}
  }}
  $bitmap.Dispose();return $bright
}
function Ensure-Checkbox([int]$centerX,[int]$centerY,[bool]$checked){
  $bright=Count-BrightPixels ($centerX-4) ($centerY-4) 9 9
  $currentlyChecked=$bright -ge 4
  if($currentlyChecked -ne $checked){Click $centerX $centerY;Start-Sleep -Milliseconds 250}
}
function Save-ScreenEvidence([string]$prefix){
  $bitmap=Capture-Screen
  $path=Join-Path $env:TEMP ($prefix+'-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')+'.png')
  $bitmap.Save($path);$bitmap.Dispose();return $path
}
function Save-HalionEvidence($rect){
  $width=[Math]::Max(1,$rect.Right-$rect.Left);$height=[Math]::Max(1,$rect.Bottom-$rect.Top)
  $bitmap=New-Object Drawing.Bitmap $width,$height;$graphics=[Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen((New-Object Drawing.Point $rect.Left,$rect.Top),[Drawing.Point]::Empty,(New-Object Drawing.Size $width,$height));$graphics.Dispose()
  $path=Join-Path $env:TEMP ('cubase-automation14-program-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')+'.png')
  $bitmap.Save($path);$bitmap.Dispose();return $path
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
    $result.hostVersion=$semantic;$result.projectTitle=[string]$payload.projectTitle;$result.display=@{width=$bounds.Width;height=$bounds.Height};$result.mainWindow=@{left=$rect.Left;top=$rect.Top;right=$rect.Right;bottom=$rect.Bottom};$result.midiPort=[string]$payload.midiPort;$result.failures=@($failures);$result.ok=$failures.Count -eq 0
  }
  'createEmptyProject' {
    $name=[string]$payload.name;$directory=[IO.Path]::GetFullPath([string]$payload.directory)
    if([string]::IsNullOrWhiteSpace($name) -or $name.IndexOfAny([IO.Path]::GetInvalidFileNameChars()) -ge 0){throw 'Invalid Cubase project name.'}
    if(-not [IO.Directory]::Exists($directory)){[IO.Directory]::CreateDirectory($directory)|Out-Null}
    $expectedProject=Join-Path (Join-Path $directory $name) ($name+'.cpr')
    $expectedDirectory=Join-Path $directory $name
    if([IO.File]::Exists($expectedProject)){throw "Refusing to overwrite existing Cubase project: $expectedProject"}
    $projectPattern='^Cubase Pro Project - '+[regex]::Escape($name)+'$'
    $project=Find-Window ([uint32]$process.Id) $projectPattern
    $saveDialog=Find-Window ([uint32]$process.Id) '^Save As$'
    $untitled=Find-Window ([uint32]$process.Id) '^Cubase Pro Project - Untitled\d+$'
    $recoverableUntitled=[IO.Directory]::Exists((Join-Path $expectedDirectory 'Audio'))
    if(($saveDialog -ne [IntPtr]::Zero -or $untitled -ne [IntPtr]::Zero) -and -not $recoverableUntitled){
      throw 'An unrelated unsaved Cubase project is open; refusing to claim it for project.create.'
    }
    if($project -eq [IntPtr]::Zero -and $saveDialog -eq [IntPtr]::Zero -and $untitled -eq [IntPtr]::Zero){
      Close-VisibleWindows ([uint32]$process.Id) '^Set default location$'
      $hub=Find-Window ([uint32]$process.Id) '^Cubase Pro Hub$'
      if($hub -eq [IntPtr]::Zero){Focus (Main-Window $process);[Windows.Forms.SendKeys]::SendWait('^n');$hub=Wait-Window ([uint32]$process.Id) '^Cubase Pro Hub$' 12000}
      $rect=Get-Rect $hub;Focus $hub
      # Fixed automation14 Hub profile: default-location radio, base directory,
      # project-folder name, and Create Empty button.
      Click ($rect.Left+918) ($rect.Top+619)
      Click ($rect.Left+980) ($rect.Top+619)
      $location=Wait-Window ([uint32]$process.Id) '^Set default location$' 12000;$locationRect=Get-Rect $location;Focus $location
      [Windows.Forms.SendKeys]::SendWait('^l');Start-Sleep -Milliseconds 200;Paste-Text $directory
      [Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 800
      Click ($locationRect.Right-165) ($locationRect.Bottom-26);Start-Sleep -Milliseconds 900
      $hub=Wait-Window ([uint32]$process.Id) '^Cubase Pro Hub$' 12000;$rect=Get-Rect $hub;Focus $hub
      Click ($rect.Left+1200) ($rect.Top+619);Paste-Text $name
      Click ($rect.Left+876) ($rect.Top+685)
      $untitled=Wait-Window ([uint32]$process.Id) '^Cubase Pro Project - Untitled\d+$' 30000
    }
    if($project -eq [IntPtr]::Zero){
      if($saveDialog -eq [IntPtr]::Zero){Focus $untitled;[Windows.Forms.SendKeys]::SendWait('^s');$saveDialog=Wait-Window ([uint32]$process.Id) '^Save As$' 12000}
      Focus $saveDialog;[Windows.Forms.SendKeys]::SendWait('%n');Start-Sleep -Milliseconds 200;Paste-Text $name
      [Windows.Forms.SendKeys]::SendWait('%s');Start-Sleep -Milliseconds 2500
      $project=Wait-Window ([uint32]$process.Id) $projectPattern 20000
    }
    Focus $project;[Windows.Forms.SendKeys]::SendWait('^s');Start-Sleep -Milliseconds 2500
    $timer=[Diagnostics.Stopwatch]::StartNew()
    while($timer.ElapsedMilliseconds -lt 15000 -and -not [IO.File]::Exists($expectedProject)){Start-Sleep -Milliseconds 500}
    if(-not [IO.File]::Exists($expectedProject)){throw "Cubase project file was not created at expected path: $expectedProject"}
    $evidencePath=Save-ScreenEvidence 'cubase-automation14-empty-project'
    $result.name=$name;$result.directory=$directory;$result.projectPath=$expectedProject;$result.created=$true
    $result.projectWindowTitle='Cubase Pro Project - '+$name;$result.screenshotPath=$evidencePath
  }
  'setTempo' {
    Focus (Main-Window $process);Click 1702 1011;Click 1702 1011;Paste-Text ([string]$payload.bpm);[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 400
  }
  'setProjectRange' {
    if([int]$payload.bars -lt 1){throw 'Project range requires at least one bar.'}
    Focus (Main-Window $process)
    Click 900 1011;Click 900 1011;Paste-Text '1.1.1.0';[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 250
    Click 1060 1011;Click 1060 1011;Paste-Text (([int]$payload.bars+1).ToString()+'.1.1.0');[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 350
  }
  'locateStart' {
    Focus (Main-Window $process);Click 1302 1011;Click 1535 1011;Click 1535 1011;Paste-Text '1.1.1.0';[Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 350
  }
  'addInstrumentTrack' {
    if([string]$payload.plugin -ne 'HALion Sonic'){throw "automation14 currently requires HALion Sonic for deterministic program selection."}
    Close-VisibleWindows ([uint32]$process.Id) 'HALion Sonic'
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
    # Every newly-created HALion Sonic instance opens on the MediaBay source tiles.
    # Enter the unfiltered All source before searching; the old profile accidentally
    # clicked a category chip here, so some exact programs never reached the result list.
    Click ($rect.Left+1100) ($rect.Top+180);Paste-Text ''
    Click ($rect.Left+967) ($rect.Top+390);Click ($rect.Left+967) ($rect.Top+390);Start-Sleep -Milliseconds 900
    Click ($rect.Left+1100) ($rect.Top+180);Paste-Text ([string]$payload.program);Start-Sleep -Milliseconds 1200
    Click ($rect.Left+995) ($rect.Top+367);Click ($rect.Left+995) ($rect.Top+367);Start-Sleep -Milliseconds 3500
    # The first slot text area is almost blank when no program is loaded. A populated
    # exact-result row produces well over 120 bright text pixels in the fixed profile.
    $slotTextPixels=Count-BrightPixels ($rect.Left+68) ($rect.Top+184) 205 25
    $slotOccupied=$slotTextPixels -ge 120
    $evidencePath=Save-HalionEvidence $rect
    $result.requestedProgram=[string]$payload.program;$result.loaded=$slotOccupied
    $result.slotOccupied=$slotOccupied;$result.slotTextPixels=$slotTextPixels;$result.screenshotPath=$evidencePath
    if(-not $slotOccupied){throw "HALion did not populate slot 1 after selecting exact program: $([string]$payload.program); evidence=$evidencePath"}
    [CubaseAutomation14Native]::PostMessage($plugin,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null
    Start-Sleep -Milliseconds 500
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
  'setStereoOutGain' {
    $requested=[double]$payload.db
    if($requested -gt 0 -or $requested -lt -24){throw 'Stereo Out gain must be between -24 dB and 0 dB.'}
    Close-VisibleWindows ([uint32]$process.Id) 'HALion Sonic|Key Editor|^Export Audio Mixdown$|^Perform Audio Export'
    $main=Main-Window $process;Focus $main
    $mix=Find-Window ([uint32]$process.Id) '^MixConsole -'
    if($mix -eq [IntPtr]::Zero){[Windows.Forms.SendKeys]::SendWait('{F3}');$mix=Wait-Window ([uint32]$process.Id) '^MixConsole -' 8000}
    [CubaseAutomation14Native]::ShowWindow($mix,3)|Out-Null;Focus $mix;Start-Sleep -Milliseconds 600
    # Fixed automation14 profile: 2560x1080, the generated 11-track recipe, MixConsole maximized.
    # The Stereo Out pre-gain field is the centered output-channel value at this coordinate.
    Click 1280 895;Click 1280 895;Paste-Text ($requested.ToString('0.00',[Globalization.CultureInfo]::InvariantCulture))
    [Windows.Forms.SendKeys]::SendWait('{ENTER}');Start-Sleep -Milliseconds 650
    Click 1280 895;[Windows.Forms.SendKeys]::SendWait('^a');[Windows.Forms.SendKeys]::SendWait('^c');Start-Sleep -Milliseconds 200
    $observedText=[Windows.Forms.Clipboard]::GetText().Trim().Replace(',','.')
    $observed=0.0;$parsed=[double]::TryParse($observedText,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$observed)
    $applied=$parsed -and [Math]::Abs($observed-$requested) -le 0.01
    $evidencePath=Save-ScreenEvidence 'cubase-automation14-master-gain'
    $result.requestedDb=$requested;$result.observedDb=if($parsed){$observed}else{$null};$result.applied=$applied;$result.screenshotPath=$evidencePath
    if(-not $applied){throw "Stereo Out gain verification failed. Requested=$requested Observed=$observedText Evidence=$evidencePath"}
    [CubaseAutomation14Native]::PostMessage($mix,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null
    Start-Sleep -Milliseconds 500;Focus $main;[Windows.Forms.SendKeys]::SendWait('^s');Start-Sleep -Milliseconds 2500
  }
  'exportAudioMixdown' {
    $expected=[IO.Path]::GetFullPath([string]$payload.expectedFile)
    if([IO.Path]::GetExtension($expected).ToLowerInvariant() -ne '.wav'){throw 'automation14 mixdown currently requires a .wav expected file.'}
    if([IO.File]::Exists($expected)){throw "Refusing to overwrite existing export evidence: $expected"}
    $directory=[IO.Path]::GetDirectoryName($expected);if(-not [IO.Directory]::Exists($directory)){[IO.Directory]::CreateDirectory($directory)|Out-Null}
    $baseName=[IO.Path]::GetFileNameWithoutExtension($expected)
    Close-VisibleWindows ([uint32]$process.Id) 'HALion Sonic|Key Editor|^MixConsole -|^Export Audio Mixdown$|^Perform Audio Export'
    $main=Main-Window $process;Focus $main;Click 1302 1011
    Click 20 32;[CubaseAutomation14Native]::SetCursorPos(75,314)|Out-Null;Start-Sleep -Milliseconds 600;Click 335 315
    $dialog=Wait-Window ([uint32]$process.Id) '^Export Audio Mixdown$' 12000;$rect=Get-Rect $dialog;Focus $dialog
    # Fixed automation14 export-dialog offsets captured from Cubase Pro 14.0.32.
    Click ($rect.Left+663) ($rect.Top+104);Paste-Text $baseName
    # The Path control opens Cubase's native "Choose location and filename" dialog.
    # Use its keyboard accelerators and an absolute filename so localized shell folders
    # do not affect the result, then return to the Cubase export window.
    Click ($rect.Left+663) ($rect.Top+134);Start-Sleep -Milliseconds 800
    [Windows.Forms.SendKeys]::SendWait('%n');Start-Sleep -Milliseconds 200;Paste-Text $expected
    [Windows.Forms.SendKeys]::SendWait('%s');Start-Sleep -Milliseconds 1200
    $dialog=Wait-Window ([uint32]$process.Id) '^Export Audio Mixdown$' 12000;$rect=Get-Rect $dialog;Focus $dialog
    Ensure-Checkbox ($rect.Left+44) ($rect.Top+183) $true
    Ensure-Checkbox ($rect.Left+488) ($rect.Top+742) ([bool]$payload.realtime)
    $evidencePath=Save-ScreenEvidence 'cubase-automation14-export-settings'
    Click ($rect.Left+858) ($rect.Top+799)
    $performObserved=$false;$stableSamples=0;$lastLength=-1L;$timer=[Diagnostics.Stopwatch]::StartNew()
    while($timer.ElapsedMilliseconds -lt [int]$payload.timeoutMs){
      Start-Sleep -Milliseconds 1000
      if((Find-Window ([uint32]$process.Id) '^Perform Audio Export') -ne [IntPtr]::Zero){$performObserved=$true}
      if([IO.File]::Exists($expected)){
        $length=(Get-Item -LiteralPath $expected).Length
        if($length -gt 0 -and $length -eq $lastLength){$stableSamples++}else{$stableSamples=0}
        $lastLength=$length
        if($stableSamples -ge 3 -and (Find-Window ([uint32]$process.Id) '^Perform Audio Export') -eq [IntPtr]::Zero){break}
      }
    }
    if(-not [IO.File]::Exists($expected)){throw "Cubase export did not create expected file: $expected"}
    $bytes=(Get-Item -LiteralPath $expected).Length
    if($bytes -le 0 -or $stableSamples -lt 3){throw "Cubase export did not reach a stable completed file: $expected"}
    $result.expectedFile=$expected;$result.realtime=[bool]$payload.realtime;$result.exportWindowObserved=$performObserved
    $result.completed=$true;$result.bytes=$bytes;$result.screenshotPath=$evidencePath
  }
  'playFromStart' {
    $main=Main-Window $process;Focus $main;Clear-GlobalSolo
    $soloSelected=[bool]$payload.soloSelected
    if($soloSelected){[Windows.Forms.SendKeys]::SendWait('s');Start-Sleep -Milliseconds 350}
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
    if($soloSelected){Focus $main;[Windows.Forms.SendKeys]::SendWait('s');Start-Sleep -Milliseconds 250;Clear-GlobalSolo}
    $evidencePath=Join-Path $env:TEMP ('cubase-automation14-meter-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')+'.png')
    if($bestFrame){$bestFrame.Save($evidencePath);$bestFrame.Dispose()}else{$baseline.Save($evidencePath)};$baseline.Dispose()
    $result.verified=($best -ge 8 -and $bestActive -ge 12);$result.startPosition=$startPosition;$result.durationMs=[int]$payload.durationMs;$result.sampledFrames=$sampled;$result.changedMeterPixels=$best;$result.activeMeterPixels=$bestActive;$result.mixConsoleTitle=$mixTitle.ToString();$result.screenshotPath=$evidencePath;$result.soloSelected=$soloSelected
  }
  default {throw "Unknown automation14 action: $ActionName"}
}
$result | ConvertTo-Json -Depth 8 -Compress
`;

export class PowerShellCubaseUiDriver implements Automation14UiDriver {
  private readonly processName: string;
  private readonly testedHostVersion: string;
  private readonly midiPort: string;
  private readonly projectTitle?: string;
  private readonly operationTimeoutMs: number;

  constructor(options: PowerShellCubaseUiDriverOptions = {}) {
    this.processName = options.processName ?? "Cubase14";
    this.testedHostVersion = options.testedHostVersion ?? "14.0.32";
    this.midiPort = options.midiPort ?? "AI MCP Bridge To Cubase";
    this.projectTitle = options.projectTitle ?? process.env.CUBASE_AUTOMATION14_PROJECT_TITLE;
    this.operationTimeoutMs = options.operationTimeoutMs ?? 30_000;
  }

  preflight(): Promise<Automation14Preflight> {
    return this.invoke<Automation14Preflight>("preflight", {});
  }

  createEmptyProject(name: string, directory: string): Promise<Automation14ProjectCreateResult> {
    return this.invoke<Automation14ProjectCreateResult>("createEmptyProject", { name, directory }, 60_000);
  }

  async setTempo(bpm: number): Promise<void> { await this.invoke("setTempo", { bpm }); }
  async setProjectRange(bars: number): Promise<void> { await this.invoke("setProjectRange", { bars }); }
  async locateStart(): Promise<void> { await this.invoke("locateStart", {}); }
  async addInstrumentTrack(name: string, plugin: string, midiInput?: string, output?: string): Promise<void> { await this.invoke("addInstrumentTrack", { name, plugin, midiInput, output }); }
  loadHalionProgram(program: string): Promise<Automation14ProgramLoadResult> {
    return this.invoke<Automation14ProgramLoadResult>("loadHalionProgram", { program }, 45_000);
  }
  async setSelectedMidiInput(port: string): Promise<void> { await this.invoke("setSelectedMidiInput", { port }); }
  async setSelectedOutput(destination: string): Promise<void> { await this.invoke("setSelectedOutput", { destination }); }
  async startRecording(): Promise<void> { await this.invoke("startRecording", {}); }
  async stopTransport(): Promise<void> { await this.invoke("stopTransport", {}); }
  async addGroupTrack(name: string, output?: string): Promise<void> { await this.invoke("addGroupTrack", { name, output }); }
  async addFxTrack(name: string, effect?: string, output = "Stereo Out"): Promise<void> { await this.invoke("addFxTrack", { name, effect, output }); }
  async addMarkerTrack(name: string): Promise<void> { await this.invoke("addMarkerTrack", { name }); }
  async commitRename(name: string): Promise<void> { await this.invoke("commitRename", { name }); }
  async saveProject(): Promise<void> { await this.invoke("saveProject", {}); }
  setStereoOutGain(db: number): Promise<Automation14MixerGainResult> {
    return this.invoke<Automation14MixerGainResult>("setStereoOutGain", { db }, 45_000);
  }
  exportAudioMixdown(expectedFile: string, realtime: boolean, timeoutMs: number): Promise<Automation14ExportUiResult> {
    return this.invoke<Automation14ExportUiResult>("exportAudioMixdown", { expectedFile, realtime, timeoutMs }, timeoutMs + 30_000);
  }
  playFromStart(durationMs: number): Promise<Automation14PlaybackProbe> { return this.playFromPosition("1.1.1.0", durationMs); }
  playFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> {
    return this.invoke<Automation14PlaybackProbe>("playFromStart", { startPosition: position, durationMs, soloSelected: false }, durationMs + 20_000);
  }
  playSelectedTrackFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> {
    return this.invoke<Automation14PlaybackProbe>("playFromStart", { startPosition: position, durationMs, soloSelected: true }, durationMs + 20_000);
  }

  private async invoke<T = unknown>(action: string, payload: Record<string, unknown>, timeoutMs = this.operationTimeoutMs): Promise<T> {
    if (process.platform !== "win32") throw new Error("automation14 requires Windows.");
    const merged = {
      processName: this.processName,
      testedHostVersion: this.testedHostVersion,
      midiPort: this.midiPort,
      projectTitle: this.projectTitle,
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

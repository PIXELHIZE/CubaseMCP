import { Permission } from "../safety/PermissionModel.js";
import { EmptyInputShape, SetCycleInputShape, SetLocatorsInputShape, SetMetronomeInputShape, SetPositionInputShape, SetPunchInOutInputShape, NudgePositionInputShape, CountInInputShape, RollInputShape } from "../schemas/transportSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const transportTools: ToolDefinition[] = [
  writeTool("cubase.transport_play", "Transport Play", "Start playback through MIDI Remote.", "transportPlay", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.transport_stop", "Transport Stop", "Stop playback through MIDI Remote.", "transportStop", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.transport_pause", "Transport Pause", "Pause playback using the verified transport stop/pause host value available to the bridge.", "transportPause", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.transport_record", "Transport Record", "Start recording through MIDI Remote.", "transportRecord", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.transport_rewind", "Transport Rewind", "Trigger rewind through MIDI Remote.", "transportRewind", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.transport_forward", "Transport Forward", "Trigger forward through MIDI Remote.", "transportForward", EmptyInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_position", "Set Position", "Set transport position through user-mapped command surface or Cubase-side bridge.", "setPosition", SetPositionInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  readTool("cubase.get_position", "Get Position", "Return the cached bars/beats, seconds, and timecode position.", "getPosition", EmptyInputShape, Permission.Transport),
  writeTool("cubase.nudge_position", "Nudge Position", "Nudge transport position through a bridge or parameterized command mapping.", "nudgePosition", NudgePositionInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_locators", "Set Locators", "Set locators through user-mapped command surface or Cubase-side bridge.", "setLocators", SetLocatorsInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_cycle", "Set Cycle", "Set cycle active state through MIDI Remote.", "setCycle", SetCycleInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_metronome", "Set Metronome", "Set metronome active state through MIDI Remote.", "setMetronome", SetMetronomeInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_punch_in_out", "Set Punch In Out", "Set punch in/out through user-mapped command surface or Cubase-side bridge.", "setPunchInOut", SetPunchInOutInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_count_in", "Set Count In", "Set count-in state and bars through exposed host parameters or a bridge.", "setCountIn", CountInInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_preroll", "Set Preroll", "Set transport preroll bars through exposed host parameters or a bridge.", "setPreroll", RollInputShape, Permission.Transport, { createsUndoSnapshot: false }),
  writeTool("cubase.set_postroll", "Set Postroll", "Set transport postroll bars through exposed host parameters or a bridge.", "setPostroll", RollInputShape, Permission.Transport, { createsUndoSnapshot: false })
];

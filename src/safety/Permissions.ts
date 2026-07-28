export enum Permission {
  Read = "read",
  Transport = "transport",
  Project = "project",
  Track = "track",
  EditAudio = "editAudio",
  EditMidi = "editMidi",
  Mixer = "mixer",
  Plugin = "plugin",
  Automation = "automation",
  Media = "media",
  Export = "export",
  Macro = "macro",
  Destructive = "destructive"
}

export interface SafetyPolicy {
  allowedPermissions: Set<Permission>;
  requireConfirmationForDestructive: boolean;
}

export const defaultSafetyPolicy: SafetyPolicy = {
  allowedPermissions: new Set(Object.values(Permission)),
  requireConfirmationForDestructive: true
};

export interface ToolSafety {
  permission: Permission;
  changesState: boolean;
  destructive?: boolean;
  supportsDryRun: boolean;
  createsUndoSnapshot?: boolean;
  requiresProject?: boolean;
  longRunning?: boolean;
  mayOverwriteFiles?: boolean;
}

import { readdir, stat } from "node:fs/promises";
import { delimiter, resolve } from "node:path";

export interface CrashDumpFile {
  path: string;
  bytes: number;
  modifiedAt: string;
}

export interface CrashDumpSnapshot {
  capturedAt: string;
  directories: string[];
  files: CrashDumpFile[];
}

export interface CrashDumpAudit {
  checked: boolean;
  passed: boolean;
  checkedAt: string;
  directories: string[];
  beforeCount: number;
  afterCount: number;
  newOrChangedDumps: CrashDumpFile[];
}

function defaultDirectories(env: NodeJS.ProcessEnv): string[] {
  const configured = env.CUBASE_CRASH_DUMP_DIRS
    ?.split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  if (configured?.length) return configured.map((item) => resolve(item));

  const directories: string[] = [];
  if (env.LOCALAPPDATA) directories.push(resolve(env.LOCALAPPDATA, "CrashDumps"));
  if (env.USERPROFILE) directories.push(resolve(env.USERPROFILE, "Documents", "Steinberg", "CrashDumps"));
  if (env.APPDATA) directories.push(resolve(env.APPDATA, "Steinberg", "CrashDumps"));
  return [...new Set(directories)];
}

function isCubaseDump(name: string): boolean {
  return /cubase/i.test(name) && /\.(?:dmp|dump|crash|ips)$/i.test(name);
}

async function filesIn(directory: string): Promise<CrashDumpFile[]> {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: CrashDumpFile[] = [];
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        files.push(...await filesIn(path));
      } else if (entry.isFile() && isCubaseDump(entry.name)) {
        const info = await stat(path);
        files.push({
          path,
          bytes: info.size,
          modifiedAt: info.mtime.toISOString()
        });
      }
    }
    return files;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES" || code === "EPERM") return [];
    throw error;
  }
}

export class CrashDumpMonitor {
  readonly directories: string[];

  constructor(
    directories: string[] = defaultDirectories(process.env)
  ) {
    this.directories = [...new Set(directories.map((item) => resolve(item)))];
  }

  async snapshot(): Promise<CrashDumpSnapshot> {
    const files = (await Promise.all(this.directories.map((directory) => filesIn(directory))))
      .flat()
      .sort((left, right) => left.path.localeCompare(right.path));
    return {
      capturedAt: new Date().toISOString(),
      directories: [...this.directories],
      files
    };
  }

  audit(before: CrashDumpSnapshot, after: CrashDumpSnapshot): CrashDumpAudit {
    const previous = new Map(before.files.map((file) => [file.path.toLowerCase(), file]));
    const newOrChangedDumps = after.files.filter((file) => {
      const old = previous.get(file.path.toLowerCase());
      return !old || old.bytes !== file.bytes || old.modifiedAt !== file.modifiedAt;
    });
    const checked = this.directories.length > 0;
    return {
      checked,
      passed: checked && newOrChangedDumps.length === 0,
      checkedAt: after.capturedAt,
      directories: [...this.directories],
      beforeCount: before.files.length,
      afterCount: after.files.length,
      newOrChangedDumps
    };
  }
}

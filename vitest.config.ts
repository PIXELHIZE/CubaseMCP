import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Real integration files share one exclusive Windows MIDI input port.
    fileParallelism: false
  }
});

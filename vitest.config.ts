import { defineConfig } from "vitest/config";

// Loading the sample conference writes a whole year of records; on a busy machine that test
// alone can pass five seconds, so backend tests get more room than the default.
export default defineConfig({ test: { testTimeout: 30000 } });

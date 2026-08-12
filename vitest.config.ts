import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "server-only": path.resolve(__dirname, "test/stubs/server-only.js"),
            "@": __dirname,
        },
    },
    test: {
        environment: "node",
        include: ["lib/**/__tests__/**/*.test.ts", "app/**/__tests__/**/*.test.ts"],
        testTimeout: 20_000,
        hookTimeout: 20_000,
    },
});

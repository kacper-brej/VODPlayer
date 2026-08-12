import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(__dirname, "..");

const routeFiles = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return entry.name === "__tests__" ? [] : routeFiles(path);
        return entry.name === "route.ts" ? [path] : [];
    });

const MUTATING_METHODS = /export\s+const\s+(POST|PUT|PATCH|DELETE)\b/u;

interface RouteFact {
    route: string;
    mutates: boolean;
    hasRateLimit: boolean;
    adminGated: boolean;
    workerSigned: boolean;
}

const facts: RouteFact[] = routeFiles(apiRoot).map((path) => {
    const source = readFileSync(path, "utf8");
    return {
        route: relative(apiRoot, path).replaceAll("\\", "/"),
        mutates: MUTATING_METHODS.test(source),
        hasRateLimit: source.includes("consumeWriteRateLimit"),
        adminGated: /role !== "admin"|requireAdminRoute/u.test(source),
        workerSigned: source.includes("authenticateMediaRegistryRequest"),
    };
});

describe("pokrycie limitem zapisu", () => {
    it("znajduje trasy API do sprawdzenia", () => {
        expect(facts.length).toBeGreaterThan(20);
        expect(facts.some((fact) => fact.mutates)).toBe(true);
    });

    it("kazda trasa mutujaca ma limit zapisu, gate admina albo podpis workera", () => {
        const unguarded = facts
            .filter((fact) => fact.mutates && !fact.hasRateLimit && !fact.adminGated && !fact.workerSigned)
            .map((fact) => fact.route);
        expect(unguarded).toEqual([]);
    });
});

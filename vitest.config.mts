import { defineConfig } from "vitest/config";

/**
 * Unit tests only, and deliberately so.
 *
 * Everything covered here is a pure function that decides something
 * consequential: who earns points, who may claim a reserved bounty, who gets a
 * seat, and which rows a roster import will create. Those rules have to be
 * testable without a database so they run on every push, and readable by
 * someone who is not a programmer when a student appeals a decision.
 *
 * Integration paths (route handlers, Prisma) are exercised against real
 * Postgres by the scripts in prisma/.checks.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    reporters: "dot",
  },
});

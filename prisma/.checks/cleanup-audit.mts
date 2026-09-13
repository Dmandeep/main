import { PrismaClient } from "@prisma/client";

/**
 * Remove the rows the HTTP audit writes.
 *
 * Matched on the exact probe title. A `contains: "audit"` match looks tidier
 * and is wrong: it also matches seeded content like "Accessibility audit of
 * the department website", which it silently deletes.
 */
const PROBE_TITLE = "Audit probe bounty please ignore";

const p = new PrismaClient();
const probes = await p.bounty.findMany({ where: { title: PROBE_TITLE }, select: { id: true } });
for (const b of probes) {
  await p.bounty.delete({ where: { id: b.id } });
  console.log("deleted", b.id);
}
console.log(`${probes.length} probe bounty row(s) removed`);
await p.$disconnect();

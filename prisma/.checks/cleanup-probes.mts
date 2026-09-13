import { PrismaClient } from "@prisma/client";

/** Removes rows created by manual probing. Matched on exact titles only. */
const TITLES = [
  "Probe idea from the new idea form",
  "Probe revival of an archived project",
  "Probe revival with a bogus ancestor",
];

const p = new PrismaClient();
const rows = await p.project.findMany({ where: { title: { in: TITLES } }, select: { id: true, title: true } });
for (const r of rows) {
  await p.project.delete({ where: { id: r.id } });
  console.log("deleted", r.title);
}
console.log(`${rows.length} probe project(s) removed`);
await p.$disconnect();

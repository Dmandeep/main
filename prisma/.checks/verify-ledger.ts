import { PrismaClient } from "@prisma/client";
import { awardStanding, reverseAward, standingProvenance } from "../../src/lib/standing/award";
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirstOrThrow();
  const m = await prisma.membership.findFirstOrThrow({ where: { role: "STUDENT" } });
  const before = await prisma.standing.findUniqueOrThrow({ where: { membershipId: m.id } });

  const input = { tenantId: tenant.id, userId: m.userId, type: "BOUNTY_COMPLETED" as const, sourceType: "test", sourceId: "bounty-xyz" };

  console.log("first  :", await awardStanding(input));
  console.log("replay :", await awardStanding(input));
  console.log("replay :", await awardStanding(input));

  const after = await prisma.standing.findUniqueOrThrow({ where: { membershipId: m.id } });
  const rows = await prisma.reputationEvent.count({ where: { tenantId: tenant.id, userId: m.userId, sourceId: "bounty-xyz" } });
  console.log(`ledger rows for that cause: ${rows}  (must be 1)`);
  console.log(`balance ${before.points} -> ${after.points}  (delta ${after.points - before.points}, must be 40)`);

  let capped: unknown = "NOT REACHED";
  for (let i = 0; i < 12; i++) {
    const r = await awardStanding({ ...input, sourceId: `cap-probe-${i}` });
    if (r.status === "capped") { capped = { probe: i, ...r }; break; }
  }
  console.log("cap    :", capped);

  const ev = await prisma.reputationEvent.findFirstOrThrow({ where: { sourceId: "bounty-xyz" } });
  console.log("reverse:", await reverseAward(ev.id, "verification test"));
  console.log("balance after reversal:", (await prisma.standing.findUniqueOrThrow({ where: { membershipId: m.id } })).points);

  const prov = await standingProvenance(tenant.id, m.userId);
  console.log(`provenance rows: ${prov.length}, marked reversed: ${prov.filter((p) => p.reversedById).length}`);

  await prisma.reputationEvent.deleteMany({ where: { OR: [
    { sourceId: { startsWith: "cap-probe" } },
    { sourceId: "bounty-xyz" },
    { sourceType: "reputation_event", sourceId: ev.id },
  ] } });
  console.log("cleaned up probe rows");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const u = await prisma.user.findUniqueOrThrow({ where: { email: "rohit2@lendi.edu.in" }, select: { id: true, name: true } });
  const st = await prisma.standing.findFirstOrThrow({ where: { membership: { userId: u.id } }, select: { points: true, tier: true } });
  const rows = await prisma.reputationEvent.findMany({
    where: { userId: u.id, type: "BOUNTY_COMPLETED" },
    select: { id: true, points: true, sourceType: true, sourceId: true, idempotencyKey: true },
  });
  console.log(`${u.name}: points now ${st.points} (was 70), tier ${st.tier}`);
  console.log(`BOUNTY_COMPLETED ledger rows: ${rows.length}  (must be 1)`);
  rows.forEach(r => console.log(`   +${r.points}  ${r.sourceType}:${r.sourceId}`));
  const audit = await prisma.auditLog.findMany({
    where: { action: { startsWith: "bounty" } },
    orderBy: { createdAt: "desc" }, take: 4,
    select: { action: true, targetType: true, actor: { select: { name: true } } },
  });
  console.log("audit trail:");
  audit.forEach(a => console.log(`   ${a.action}  by ${a.actor?.name}`));
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());

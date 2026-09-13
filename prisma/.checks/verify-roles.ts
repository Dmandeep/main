import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.membership.groupBy({ by: ["role"], _count: true });
  console.log("role distribution:");
  for (const r of rows) console.log("  ", r.role, "=", r._count);

  const rao = await prisma.membership.findFirstOrThrow({
    where: { user: { email: "a.rao@lendi.org" } },
    select: { role: true, user: { select: { name: true, username: true } } },
  });
  console.log(`\n${rao.user.name} (@${rao.user.username}) role: ${rao.role}`);

  const reviews = await prisma.verificationReview.groupBy({
    by: ["reviewerId"], _count: true,
  });
  for (const r of reviews) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.reviewerId }, select: { username: true } });
    console.log(`  reviews by @${u.username}: ${r._count}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

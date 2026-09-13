import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.evidence.groupBy({ by: ["creatorId"], _count: true, orderBy: { _count: { creatorId: "desc" } }, take: 3 });
  for (const r of rows) {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.creatorId }, select: { email: true, name: true } });
    const st = await prisma.standing.findFirst({ where: { membership: { userId: r.creatorId } }, select: { points: true } });
    const ev = await prisma.evidence.findMany({ where: { creatorId: r.creatorId }, select: { id: true }, take: 2 });
    console.log(`${u.email}  ${u.name}  evidence=${r._count}  points=${st?.points ?? 0}  ids=${ev.map(e=>e.id).join(",")}`);
  }
}
main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());

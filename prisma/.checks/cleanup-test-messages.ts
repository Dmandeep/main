import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const r = await prisma.communityMessage.deleteMany({
    where: { body: { contains: "Testing the composer" } },
  });
  console.log("removed test messages:", r.count);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

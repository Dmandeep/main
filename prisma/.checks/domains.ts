import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.institution
  .findMany({ select: { name: true, domains: true } })
  .then((r) => console.log(JSON.stringify(r, null, 1)))
  .catch((e) => console.error(String(e)))
  .finally(() => prisma.$disconnect());

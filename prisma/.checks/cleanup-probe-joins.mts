import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const rows = await p.joinRequest.deleteMany({ where: { message: "probe request" } });
console.log(`${rows.count} probe join request(s) removed`);
await p.$disconnect();

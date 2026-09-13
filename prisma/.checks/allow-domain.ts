/**
 * Add or remove a sign-in domain for the institution.
 *
 *   npx tsx prisma/.checks/allow-domain.ts add gmail.com
 *   npx tsx prisma/.checks/allow-domain.ts remove gmail.com
 *   npx tsx prisma/.checks/allow-domain.ts list
 *
 * The allowlist is the only thing standing between "campus network" and "any
 * stranger with an email address", so adding a public domain like gmail.com
 * means ANY Google account can sign in. That is fine while testing OAuth on a
 * local database and wrong everywhere else — hence the loud warning and the
 * refusal to run against production.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to edit the sign-in allowlist in production.");
}

const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
  "icloud.com",
]);

async function main() {
  const [action, domainArg] = process.argv.slice(2);
  const institution = await prisma.institution.findFirstOrThrow({
    select: { id: true, name: true, domains: true },
  });

  if (!action || action === "list") {
    console.log(`${institution.name}\n  ${institution.domains.join("\n  ")}`);
    return;
  }

  const domain = (domainArg ?? "").trim().toLowerCase().replace(/^@/, "");
  if (!domain || !domain.includes(".")) {
    throw new Error("Give a domain, e.g. gmail.com");
  }

  const current = new Set(institution.domains);

  if (action === "add") {
    if (PUBLIC_DOMAINS.has(domain)) {
      console.warn(
        `\n  WARNING: ${domain} is a public email provider.\n` +
          `  Adding it lets ANY ${domain} account sign in and be placed in this department.\n` +
          `  Use it for local OAuth testing only, and remove it before any pilot.\n`
      );
    }
    current.add(domain);
  } else if (action === "remove") {
    current.delete(domain);
  } else {
    throw new Error(`Unknown action "${action}". Use add, remove or list.`);
  }

  const domains = [...current].sort();
  await prisma.institution.update({
    where: { id: institution.id },
    data: { domains },
  });

  console.log(`${action === "add" ? "Added" : "Removed"} ${domain}`);
  console.log(`Allowlist is now:\n  ${domains.join("\n  ")}`);
}

main()
  .catch((e) => {
    console.error(String(e instanceof Error ? e.message : e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

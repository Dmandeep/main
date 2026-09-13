/**
 * Refuse to seed anything that is not a local database.
 *
 * The seed creates accounts — including an ADMIN and an HOD — with a password
 * written in this repository. That is exactly right for local development and
 * catastrophic anywhere else: anyone who can read the source can sign in as
 * the department administrator.
 *
 * The original guard checked `NODE_ENV === "production"`, which protects
 * against the wrong mistake. Nobody seeds a database by setting NODE_ENV; they
 * do it by running `npm run db:seed` on their laptop with a production
 * DATABASE_URL in the shell — and there NODE_ENV is "development", so the
 * guard passes and the seed runs against production.
 *
 * So this checks where the database actually is. Local hosts are allowed;
 * everything else needs a deliberate override, which exists only so that a
 * throwaway staging database is still seedable by someone who means it.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

export function assertLocalDatabase(): void {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set, so there is nothing to seed.");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed with NODE_ENV=production.");
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a URL this guard can read; refusing to seed.");
  }

  if (LOCAL_HOSTS.has(host)) return;

  if (process.env.ALLOW_REMOTE_SEED === "true") {
    console.warn(
      `\n  Seeding a REMOTE database at ${host} because ALLOW_REMOTE_SEED=true.\n` +
        `  Every account created here uses a password committed to this repository.\n` +
        `  Do not do this to anything real.\n`
    );
    return;
  }

  throw new Error(
    `Refusing to seed ${host}: it is not a local database.\n` +
      `The seed creates an admin account whose password is in this repository, so running it ` +
      `against a deployed database hands that account to anyone who can read the source.\n` +
      `If this really is a throwaway database, set ALLOW_REMOTE_SEED=true.`
  );
}

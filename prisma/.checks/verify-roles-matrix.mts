import { PrismaClient } from "@prisma/client";

/**
 * The cross-role matrix.
 *
 * Every module, exercised as every role, with one expectation per cell. The
 * existing audit proves individual routes behave; this proves the *shape* of
 * the product is right — that the same URL gives a student, a faculty member,
 * an HOD and an admin four correct and different answers.
 *
 * It is written as a table on purpose. A reviewer asking "can an HOD verify
 * evidence" should be able to read the answer, not reconstruct it from a
 * hundred assertions.
 *
 * Expectations:
 *   "ok"      — must succeed (2xx)
 *   "denied"  — must be refused on authorization (401/403)
 *   "absent"  — must not exist for anyone (404)
 *
 * A 429 is never an acceptable answer here: the limiter is cleared before the
 * run, so a throttle means the run is measuring the wrong thing.
 */

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";
const PASSWORD = "ideaspace-dev-password";

const ACTORS = {
  student: "harshith0@lendi.edu.in",
  senior: "priya17@lendi.edu.in",
  faculty: "k.suneetha@lendi.org",
  hod: "hod.cse@lendi.org",
  admin: "a.rao@lendi.org",
} as const;

type ActorName = keyof typeof ACTORS;
type Expect = "ok" | "denied" | "absent";

const prisma = new PrismaClient();
let failures = 0;
const rows: { area: string; label: string; actor: string; want: string; got: string; pass: boolean }[] = [];

type Jar = Map<string, string>;

function jarHeader(jar: Jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function req(jar: Jar, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: { ...(init.headers ?? {}), ...(jar.size ? { cookie: jarHeader(jar) } : {}) },
  });
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    const i = pair!.indexOf("=");
    if (i > 0) jar.set(pair!.slice(0, i), pair!.slice(i + 1));
  }
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, json };
}

async function login(email: string): Promise<Jar> {
  const jar: Jar = new Map();
  const csrf = await req(jar, "/api/auth/csrf");
  await req(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken: (csrf.json?.csrfToken as string) ?? "",
      email,
      password: PASSWORD,
      redirect: "false",
    }).toString(),
  });
  return jar;
}

async function clearRateLimits() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return;
  try {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(url, { maxRetriesPerRequest: 2 });
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
  } catch {
    /* best effort */
  }
}

function satisfied(want: Expect, status: number): boolean {
  if (want === "ok") return status >= 200 && status < 300;
  if (want === "denied") return status === 401 || status === 403;
  return status === 404;
}

async function cell(
  area: string,
  label: string,
  actor: ActorName,
  jar: Jar,
  path: string,
  want: Expect,
  init: RequestInit = {}
) {
  const { status } = await req(jar, path, init);
  const pass = satisfied(want, status);
  rows.push({ area, label, actor, want, got: String(status), pass });
  if (!pass) failures++;
}

const jars = {} as Record<ActorName, Jar>;

async function main() {
  await clearRateLimits();

  for (const [name, email] of Object.entries(ACTORS) as [ActorName, string][]) {
    jars[name] = await login(email);
  }

  // Confirm each actor is who we think. A matrix run against five student
  // sessions would pass almost everything and prove nothing.
  for (const [name, jar] of Object.entries(jars) as [ActorName, Jar][]) {
    const me = await req(jar, "/api/auth/session");
    const role = ((me.json?.user as { role?: string } | undefined)?.role ?? "none").toLowerCase();
    const expected = name === "senior" ? "student" : name;
    const pass = role === expected;
    rows.push({ area: "identity", label: `${name} signs in`, actor: name, want: expected, got: role, pass });
    if (!pass) failures++;
  }

  const everyone = Object.keys(ACTORS) as ActorName[];
  const staff: ActorName[] = ["faculty", "hod", "admin"];
  const students: ActorName[] = ["student", "senior"];

  // ---- Reads every member gets -------------------------------------------
  for (const path of ["/api/feed", "/api/pulse", "/api/bounties", "/api/events", "/api/communities", "/api/leaderboard", "/api/archive", "/api/dashboard"]) {
    for (const actor of everyone) {
      await cell("reads", `GET ${path}`, actor, jars[actor], path, "ok");
    }
  }

  // ---- Evidence verification: faculty and admin only ----------------------
  for (const actor of everyone) {
    const want: Expect = actor === "faculty" || actor === "admin" ? "ok" : "denied";
    await cell("verify", "GET /api/admin/review", actor, jars[actor], "/api/admin/review", want);
  }

  // ---- Membership approval: HOD and admin only ---------------------------
  for (const actor of everyone) {
    const want: Expect = actor === "hod" || actor === "admin" ? "ok" : "denied";
    await cell("approve", "GET /api/admin/access-requests", actor, jars[actor], "/api/admin/access-requests", want);
  }

  // ---- Roster import: HOD and admin only ---------------------------------
  for (const actor of everyone) {
    const { status } = await req(jars[actor], "/api/admin/roster/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: [] }),
    });
    // An empty roster is a validation failure, which still proves the gate
    // opened. Anything in the 4xx authorization range proves it did not.
    const opened = status === 200 || status === 400 || status === 422;
    const refused = status === 401 || status === 403;
    const shouldOpen = actor === "hod" || actor === "admin";
    const pass = shouldOpen ? opened : refused;
    rows.push({
      area: "roster",
      label: "POST /api/admin/roster/import",
      actor,
      want: shouldOpen ? "reaches handler" : "denied",
      got: String(status),
      pass,
    });
    if (!pass) failures++;
  }

  // ---- Seat allocation: staff only ---------------------------------------
  const event = await prisma.campusEvent.findFirst({
    where: { status: "SCHEDULED" },
    select: { id: true },
  });
  if (event) {
    for (const actor of everyone) {
      const want: Expect = staff.includes(actor) ? "ok" : "denied";
      await cell("allocate", "GET /api/events/[id]/roster", actor, jars[actor], `/api/events/${event.id}/roster`, want);
    }
  }

  // ---- Posting a bounty: staff and alumni, never a student ---------------
  for (const actor of students) {
    const { status } = await req(jars[actor], "/api/bounties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Matrix probe bounty",
        description: "Created by the cross-role matrix. Should never succeed as a student.",
        kind: "BUILD",
        rewardPoints: 10,
      }),
    });
    const pass = status === 401 || status === 403;
    rows.push({ area: "bounty", label: "POST /api/bounties", actor, want: "denied", got: String(status), pass });
    if (!pass) failures++;
  }

  // ---- The student's own surfaces ----------------------------------------
  for (const actor of everyone) {
    await cell("self", "GET /api/notifications", actor, jars[actor], "/api/notifications", "ok");
  }

  // ---- Cross-tenant / nonexistent ids answer 404, not 500 ----------------
  for (const actor of ["student", "admin"] as ActorName[]) {
    await cell("missing", "GET /api/ideas/does-not-exist", actor, jars[actor], "/api/ideas/does-not-exist", "absent");
    await cell("missing", "GET /api/users/nobody-here", actor, jars[actor], "/api/users/nobody-here", "absent");
  }

  // ---- Report ------------------------------------------------------------
  const areas = [...new Set(rows.map((r) => r.area))];
  console.log(`Cross-role matrix against ${BASE}\n`);

  for (const area of areas) {
    const inArea = rows.filter((r) => r.area === area);
    const bad = inArea.filter((r) => !r.pass);
    console.log(`${bad.length === 0 ? "PASS" : "FAIL"}  ${area}  (${inArea.length - bad.length}/${inArea.length})`);
    for (const r of bad) {
      console.log(`        ${r.actor} · ${r.label}`);
      console.log(`          wanted ${r.want}, got ${r.got}`);
    }
  }

  console.log(`\n${rows.length - failures}/${rows.length} cells passed`);

  // Leave nothing behind.
  await prisma.bounty.deleteMany({ where: { title: "Matrix probe bounty" } });

  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error("matrix failed to run:", error);
  await prisma.$disconnect();
  process.exit(1);
});

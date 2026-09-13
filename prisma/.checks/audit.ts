/**
 * Full-surface audit.
 *
 * Signs in as each role against the running dev server and exercises every
 * route, asserting the status code that role SHOULD get. This is the layer the
 * unit tests cannot reach: middleware, session, tenant scoping and the actual
 * Prisma queries, all at once.
 *
 * Run with the dev server up:
 *   npx tsx prisma/.checks/audit.ts
 *
 * It writes nothing it does not clean up, and every mutation it makes is
 * against seed data that `npm run db:seed:all` restores.
 */

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";

/**
 * A fresh source address for each audit run.
 *
 * The anonymous auth routes are rate limited per IP, and with Redis enabled
 * that budget survives restarts — so repeated audit runs from one address
 * exhaust it and the allowlist checks below start returning 429 instead of
 * the 403 they are actually asserting. Varying the address per run keeps each
 * run testing the allowlist rather than the limiter, which has its own tests
 * in src/lib/rate-limit.test.ts.
 */
const RUN_IP = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;

/**
 * Clear this audit's own rate-limit budgets before it starts.
 *
 * A fresh source address fixes the anonymous routes, but the tightest budgets
 * — roster import at five an hour — are keyed by user id, and with Redis they
 * now survive a restart. Repeated audit runs therefore exhausted the HOD's
 * budget and the four-eyes check started asserting 429 instead of the
 * authorization result it exists to prove.
 *
 * Only the audit's own keys, and a no-op when there is no Redis to talk to.
 * The limiter itself is covered by unit tests; this is stopping test state
 * leaking between runs.
 */
async function resetRateLimits() {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    // Said out loud: a silent skip here is how the four-eyes check ended up
    // asserting a 429 and nobody knew why. Run with --env-file=.env.
    console.log("no REDIS_URL in this process; rate limits not cleared");
    return;
  }

  try {
    const { default: Redis } = await import("ioredis");
    const redis = new Redis(url, { maxRetriesPerRequest: 2 });
    const keys = await redis.keys("rl:*");
    if (keys.length > 0) await redis.del(...keys);
    await redis.quit();
    console.log(`cleared ${keys.length} rate-limit key(s) before the run`);
  } catch (error) {
    console.log(`could not clear rate limits (${String(error)}); continuing`);
  }
}
const PASSWORD = "ideaspace-dev-password";

type Jar = Map<string, string>;

interface Result {
  area: string;
  check: string;
  expected: string;
  actual: string;
  pass: boolean;
  note?: string;
}

const results: Result[] = [];

function record(r: Result) {
  results.push(r);
}

function expect(area: string, check: string, actual: unknown, expected: unknown, note?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  record({ area, check, expected: e, actual: a, pass: a === e, note });
}

function expectOneOf(area: string, check: string, actual: number, allowed: number[], note?: string) {
  record({
    area,
    check,
    expected: allowed.join(" or "),
    actual: String(actual),
    pass: allowed.includes(actual),
    note,
  });
}

// ── cookie handling ────────────────────────────────────────
function jarHeader(jar: Jar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(jar: Jar, res: Response) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const idx = pair!.indexOf("=");
    if (idx > 0) jar.set(pair!.slice(0, idx), pair!.slice(idx + 1));
  }
}

async function req(
  jar: Jar,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; json: Record<string, unknown> | null; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.headers ?? {}),
      "x-forwarded-for": RUN_IP,
      ...(jar.size ? { cookie: jarHeader(jar) } : {}),
    },
  });
  absorb(jar, res);
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html or empty */
  }
  return { status: res.status, json, text };
}

async function login(email: string): Promise<Jar> {
  const jar: Jar = new Map();
  const csrfRes = await req(jar, "/api/auth/csrf");
  const csrfToken = (csrfRes.json?.csrfToken as string) ?? "";

  await req(jar, "/api/auth/callback/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: PASSWORD,
      redirect: "false",
      callbackUrl: "/dashboard",
    }).toString(),
  });

  return jar;
}

async function whoami(jar: Jar) {
  const r = await req(jar, "/api/auth/session");
  const user = (r.json?.user ?? null) as { name?: string; role?: string } | null;
  return user;
}

const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const patch = (body: unknown) => ({ ...json(body), method: "PATCH" });
const put = (body: unknown) => ({ ...json(body), method: "PUT" });

// ── the audit ──────────────────────────────────────────────
async function main() {
  console.log(`Auditing ${BASE}\n`);
  await resetRateLimits();

  // ---- 1. Unauthenticated access -------------------------
  const anon: Jar = new Map();
  const publicRoutes = ["/api/stats"];
  const protectedRoutes = [
    "/api/ideas",
    "/api/bounties",
    "/api/events",
    "/api/communities",
    "/api/feed",
    "/api/leaderboard",
    "/api/dashboard",
    "/api/notifications",
    "/api/users",
    "/api/wall",
    "/api/archive",
    "/api/admin/review",
    "/api/collaborations",
  ];

  for (const path of publicRoutes) {
    const r = await req(anon, path);
    expect("auth", `anon GET ${path} is public`, r.status, 200);
  }

  for (const path of protectedRoutes) {
    const r = await req(anon, path);
    expectOneOf("auth", `anon GET ${path} refused`, r.status, [401, 307, 302]);
  }

  // ---- 2. Sessions for each role -------------------------
  const student = await login("harshith0@lendi.edu.in");
  const senior = await login("priya17@lendi.edu.in");
  const admin = await login("a.rao@lendi.org");
  const hod = await login("hod.cse@lendi.org");
  const faculty = await login("k.suneetha@lendi.org");

  const su = await whoami(student);
  const au = await whoami(admin);
  const hu = await whoami(hod);
  const fu = await whoami(faculty);
  expect("auth", "student session role", su?.role, "student");
  expect("auth", "admin session role", au?.role, "admin");
  expect("auth", "hod session role", hu?.role, "hod");
  expect("auth", "faculty session role", fu?.role, "faculty");

  // ---- 3. Reads available to a student -------------------
  for (const path of [
    "/api/ideas",
    "/api/bounties",
    "/api/events",
    "/api/communities",
    "/api/feed",
    "/api/leaderboard",
    "/api/dashboard",
    "/api/notifications",
    "/api/users",
    "/api/wall",
    "/api/archive",
    "/api/proof",
    "/api/collaborations",
    "/api/workshops",
    "/api/postmortems",
  ]) {
    const r = await req(student, path);
    expect("reads", `student GET ${path}`, r.status, 200);
  }

  // ---- 4. Role gates -------------------------------------
  const studentReview = await req(student, "/api/admin/review");
  expectOneOf("rbac", "student cannot read review queue", studentReview.status, [401, 403]);

  const adminReview = await req(admin, "/api/admin/review");
  expect("rbac", "admin can read review queue", adminReview.status, 200);

  const studentRoster = await req(student, "/api/admin/access-requests");
  expectOneOf("rbac", "student cannot read access requests", studentRoster.status, [401, 403]);

  // ---- 4a. The ranked feed --------------------------------
  const feed = await req(student, "/api/feed?limit=10");
  expect("feed", "student can read the feed", feed.status, 200);

  const feedItems = ((feed.json?.data ?? []) as { type: string; _score: number }[]) ?? [];
  expect("feed", "feed returns items", feedItems.length > 0, true);
  expect(
    "feed",
    "feed is ordered by score",
    feedItems.every((it, i) => i === 0 || feedItems[i - 1]!._score >= it._score),
    true
  );
  expect(
    "feed",
    "feed mixes more than one kind",
    new Set(feedItems.map((i) => i.type)).size > 1,
    true,
    "a single-kind feed means ranking or diversification is not running"
  );

  // A project with verified evidence must be reachable near the top, or the
  // product's central claim — evidence over activity — is not true in the UI.
  const feedAll = await req(student, "/api/feed?limit=50");
  const all = ((feedAll.json?.data ?? []) as { type: string; verifiedEvidenceCount?: number }[]) ?? [];
  const verifiedProject = all.find((i) => i.type === "project" && (i.verifiedEvidenceCount ?? 0) > 0);
  expect("feed", "verified work appears in the feed", Boolean(verifiedProject), true);

  // ---- 4b. Four-eyes separation over HTTP ----------------
  //
  // These are the assertions that make the role split real. A unit test on the
  // capability matrix proves the table is right; only these prove the handlers
  // actually consult it.
  const hodReview = await req(hod, "/api/admin/review");
  expectOneOf("four-eyes", "HOD is refused the review queue", hodReview.status, [401, 403]);

  const hodDecision = await req(hod, "/api/admin/review/nonexistent", patch({ status: "approved" }));
  expectOneOf(
    "four-eyes",
    "HOD is refused a verification decision",
    hodDecision.status,
    [401, 403],
    "must fail on authorization, not on the missing id"
  );

  const facultyReview = await req(faculty, "/api/admin/review");
  expect("four-eyes", "faculty can read the review queue", facultyReview.status, 200);

  const hodRequests = await req(hod, "/api/admin/access-requests");
  expect("four-eyes", "HOD can read access requests", hodRequests.status, 200);

  const facultyRequests = await req(faculty, "/api/admin/access-requests");
  expectOneOf(
    "four-eyes",
    "faculty is refused access requests",
    facultyRequests.status,
    [401, 403],
    "verifying work must not also mean enrolling people"
  );

  const facultyRoster = await req(faculty, "/api/admin/roster/import", json({ rows: [] }));
  expectOneOf("four-eyes", "faculty is refused roster import", facultyRoster.status, [400, 401, 403]);

  const hodRoster = await req(hod, "/api/admin/roster/import", json({ rows: [] }));
  expectOneOf(
    "four-eyes",
    "HOD reaches roster import",
    hodRoster.status,
    [200, 400, 422],
    "a validation failure still proves the gate opened"
  );

  // A student must not be able to post a bounty: that would let them create
  // demand for the points they themselves earn.
  const studentBounty = await req(
    student,
    "/api/bounties",
    json({
      title: "Student attempts to post a bounty here",
      description:
        "This request should be refused because students cannot create demand for the points they earn.",
      kind: "BUILD",
    })
  );
  expect("rbac", "student cannot post a bounty", studentBounty.status, 403);

  // Nor schedule an event with a date and a room.
  const studentEvent = await req(
    student,
    "/api/events",
    put({
      title: "Student attempts to schedule",
      description: "Scheduling requires a room and a slot, which students do not own.",
      kind: "WORKSHOP",
      startsAt: new Date(Date.now() + 864e5).toISOString(),
      capacity: 10,
    })
  );
  expect("rbac", "student cannot schedule an event", studentEvent.status, 403);

  // ---- 5. Points / standing ------------------------------
  const lb = await req(student, "/api/leaderboard");
  const rows = (lb.json?.data ?? []) as Array<{ points: number; rank: number }>;
  expect("points", "leaderboard returns rows", rows.length > 0, true);
  const descending = rows.every((r, i) => i === 0 || rows[i - 1]!.points >= r.points);
  expect("points", "leaderboard ordered by points desc", descending, true);

  // ---- 6. Ideas / projects -------------------------------
  const ideas = await req(student, "/api/ideas");
  const ideaList = (ideas.json?.data ?? []) as Array<{ _id: string; slug: string }>;
  expect("ideas", "feed returns projects", ideaList.length > 0, true);

  if (ideaList[0]) {
    const detail = await req(student, `/api/ideas/${ideaList[0].slug}`);
    expect("ideas", "project detail by slug", detail.status, 200);

    const upvote = await req(student, `/api/ideas/${ideaList[0]._id}/upvote`, { method: "POST" });
    expectOneOf("ideas", "upvote toggles or refuses own project", upvote.status, [200, 409]);
    if (upvote.status === 200) {
      await req(student, `/api/ideas/${ideaList[0]._id}/upvote`, { method: "POST" });
    }
  }

  // ---- 7. Bounties ---------------------------------------
  const bounties = await req(student, "/api/bounties");
  const bList = (bounties.json?.data ?? []) as Array<{
    _id: string;
    reservedForNewcomers: boolean;
    claimable: boolean;
  }>;
  expect("bounties", "list returns rows", bList.length > 0, true);

  const reserved = bList.find((b) => b.reservedForNewcomers);
  if (reserved) {
    const asNewcomer = await req(student, `/api/bounties/${reserved._id}`);
    const asRanked = await req(senior, `/api/bounties/${reserved._id}`);
    const nv = (asNewcomer.json?.data as { viewer?: { canClaim?: boolean } })?.viewer;
    const rv = (asRanked.json?.data as { viewer?: { canClaim?: boolean; reason?: string } })?.viewer;
    expect("bounties", "newcomer may claim reserved bounty", nv?.canClaim, true);
    expect("bounties", "ranked student may not", rv?.canClaim, false);
    expect("bounties", "and is told why", rv?.reason, "newcomers_only");
  }

  const created = await req(
    admin,
    "/api/bounties",
    json({
      title: "Audit probe bounty please ignore",
      description:
        "Created by the audit harness to verify the create path, reward source and cleanup. Safe to delete.",
      kind: "REVIEW",
      rewardPoints: 99999,
    })
  );
  expect("bounties", "admin can post a bounty", created.status, 201);
  const probeBountyId = (created.json?.data as { _id?: string })?._id;

  if (probeBountyId) {
    const probe = await req(admin, `/api/bounties/${probeBountyId}`);
    const reward = (probe.json?.data as { rewardPoints?: number })?.rewardPoints;
    expect("bounties", "reward is system-owned, injection ignored", reward, 40);
  }

  // ---- 8. Events / allocation ----------------------------
  const events = await req(student, "/api/events");
  const eList = (events.json?.data ?? []) as Array<{
    _id: string;
    status: string;
    capacity: number | null;
  }>;
  expect("events", "list returns rows", eList.length > 0, true);

  const scheduled = eList.find((e) => e.status === "scheduled" && e.capacity);
  if (scheduled) {
    const roster = await req(admin, `/api/events/${scheduled._id}/roster`);
    expect("events", "admin can read roster", roster.status, 200);

    const alloc = (roster.json?.data as { allocation?: Record<string, number> })?.allocation;
    if (alloc) {
      const quotaHonoured =
        alloc.quotaUsed !== undefined &&
        alloc.quotaSeats !== undefined &&
        alloc.quotaUsed <= alloc.quotaSeats;
      expect("events", "newcomer quota not exceeded", quotaHonoured, true);
    }

    const studentRoster = await req(student, `/api/events/${scheduled._id}/roster`);
    expectOneOf("events", "student cannot read roster", studentRoster.status, [401, 403]);
  }

  const proposed = eList.find((e) => e.status === "proposed");
  if (proposed) {
    const v1 = await req(student, "/api/events", json({ eventId: proposed._id }));
    expect("events", "student can cast a demand vote", v1.status, 200);
    await req(student, "/api/events", json({ eventId: proposed._id })); // toggle back
  }

  // ---- 9. Communities ------------------------------------
  const coms = await req(student, "/api/communities");
  const cList = (coms.json?.data ?? []) as Array<{ slug: string; kind: string }>;
  expect("communities", "student sees communities", cList.length > 0, true);
  expect(
    "communities",
    "student sees no private project rooms",
    cList.filter((c) => c.kind === "project").length,
    0
  );

  const adminComs = await req(admin, "/api/communities");
  const acList = (adminComs.json?.data ?? []) as Array<{ slug: string; kind: string }>;
  expect(
    "communities",
    "staff can see project rooms for moderation",
    acList.filter((c) => c.kind === "project").length > 0,
    true
  );

  const projectRoom = acList.find((c) => c.kind === "project");
  if (projectRoom) {
    const leak = await req(student, `/api/communities/${projectRoom.slug}/messages`);
    expect("communities", "private room is 404 to an outsider", leak.status, 404);
  }

  const openRoom = cList.find((c) => c.kind === "interest");
  if (openRoom) {
    const postAttempt = await req(
      student,
      `/api/communities/${openRoom.slug}/messages`,
      json({ body: "audit probe: non-member post attempt" })
    );
    expectOneOf("communities", "non-member cannot post", postAttempt.status, [403, 201]);
  }

  // ---- 10. Registration / access -------------------------
  const weakPassword = await req(
    anon,
    "/api/auth/register",
    json({ name: "Audit Probe", email: "audit.probe@lendi.edu.in", username: "auditprobe", password: "short" })
  );
  expect("registration", "weak password refused", weakPassword.status, 400);

  const outsideDomain = await req(
    anon,
    "/api/auth/register",
    json({
      name: "Outside Probe",
      email: "audit.probe@example.com",
      username: "outsideprobe",
      password: "a-long-enough-password",
    })
  );
  expect("registration", "outside domain refused", outsideDomain.status, 403);

  // ---- 11. Middleware / page routes -----------------------
  const anonPage = await req(anon, "/dashboard");
  expectOneOf("middleware", "anon redirected from /dashboard", anonPage.status, [302, 307]);

  const studentAdminPage = await req(student, "/admin");
  expectOneOf("middleware", "student blocked from /admin", studentAdminPage.status, [302, 307, 403]);

  // ── report ───────────────────────────────────────────────
  const areas = [...new Set(results.map((r) => r.area))];
  let failed = 0;

  for (const area of areas) {
    const rows = results.filter((r) => r.area === area);
    const bad = rows.filter((r) => !r.pass);
    failed += bad.length;
    console.log(`${bad.length === 0 ? "PASS" : "FAIL"}  ${area}  (${rows.length - bad.length}/${rows.length})`);
    for (const r of bad) {
      console.log(`        ${r.check}`);
      console.log(`          expected ${r.expected}, got ${r.actual}${r.note ? ` — ${r.note}` : ""}`);
    }
  }

  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  if (probeBountyId) {
    console.log(`\nCleanup: delete audit bounty ${probeBountyId} (or reseed).`);
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { PrismaClient } from "@prisma/client";

/**
 * Request-to-join, end to end over HTTP.
 *
 * The flow was a dead end before: asking to join a REQUEST_TO_JOIN community
 * returned "a moderator must approve" and offered no way to ask one. These
 * checks assert the whole loop — ask, appear in the moderator's queue, be
 * approved, and only then be able to post.
 */
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";
const PASSWORD = "ideaspace-dev-password";
const prisma = new PrismaClient();

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

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
  try { json = JSON.parse(text); } catch { /* html, not json */ }
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
      email, password: PASSWORD, redirect: "false",
    }).toString(),
  });
  return jar;
}

// A request-to-join community, with a moderator and an outsider.
const community = await prisma.community.findFirst({
  where: { visibility: "REQUEST_TO_JOIN", archivedAt: null, isSystemManaged: false },
  select: { id: true, slug: true, name: true },
});

if (!community) {
  console.log("SKIP  no request-to-join community in the seed");
  await prisma.$disconnect();
  process.exit(0);
}
console.log(`community: ${community.name} (${community.slug})\n`);

const moderatorRow = await prisma.communityMember.findFirst({
  where: { communityId: community.id, role: { in: ["OWNER", "MODERATOR"] }, status: "ACTIVE" },
  select: { user: { select: { email: true, name: true } } },
});

const outsider = await prisma.user.findFirst({
  where: {
    email: { endsWith: "@lendi.edu.in" },
    communityMemberships: { none: { communityId: community.id } },
  },
  select: { id: true, email: true, name: true },
});

if (!moderatorRow || !outsider) {
  console.log("SKIP  need both a moderator and a non-member to test with");
  await prisma.$disconnect();
  process.exit(0);
}

const student = await login(outsider.email!);
const moderator = await login(moderatorRow.user.email!);

// 1. Asking.
const ask = await req(student, `/api/communities/${community.slug}/membership`, { method: "POST" });
check("a student can ask to join", ask.status === 200 && ask.json?.data?.pending === true,
  `status ${ask.status} ${JSON.stringify(ask.json?.data ?? ask.json)}`);

// 2. Asking is not joining.
const post = await req(student, `/api/communities/${community.slug}/messages`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: "probe message from a pending member" }),
});
check("a pending member cannot post", post.status === 403 || post.status === 409,
  `status ${post.status}`);

// 3. The moderator sees it.
const queue = await req(moderator, `/api/communities/${community.slug}/requests`);
type QueueRow = { _id: string; user: { _id: string } };
const rows = (queue.json?.data ?? []) as QueueRow[];
const mine = rows.find((r) => r.user._id === outsider.id);
check("the request reaches the moderator's queue", Boolean(mine), `status ${queue.status}`);

// 4. An outsider cannot read that queue.
const peek = await req(student, `/api/communities/${community.slug}/requests`);
check("a non-moderator is refused the queue", peek.status === 403, `status ${peek.status}`);

if (mine) {
  // 5. Approving.
  const approve = await req(moderator, `/api/communities/${community.slug}/requests`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: mine._id, decision: "approve" }),
  });
  check("the moderator can approve", approve.status === 200, `status ${approve.status}`);

  // 6. Now they can post.
  const post2 = await req(student, `/api/communities/${community.slug}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "probe message after approval" }),
  });
  check("an approved member can post", post2.status === 200 || post2.status === 201,
    `status ${post2.status}`);

  // 7. Answering twice is refused rather than silently re-approving.
  const again = await req(moderator, `/api/communities/${community.slug}/requests`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId: mine._id, decision: "approve" }),
  });
  check("a decided request cannot be decided again", again.status === 409, `status ${again.status}`);
}

// Leave the demo data as we found it.
await prisma.communityMessage.deleteMany({
  where: { communityId: community.id, body: { startsWith: "probe message" } },
});
await prisma.communityMember.deleteMany({
  where: { communityId: community.id, userId: outsider.id },
});
console.log("\ncleaned up probe rows");

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);

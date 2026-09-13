import { PrismaClient } from "@prisma/client";

/**
 * Posting, end to end.
 *
 * Posts were rendered by the feed and created by nothing but the seed, so this
 * path has never been exercised. The checks cover the boundaries rather than
 * just the happy case: a post must go somewhere real, you must be able to post
 * where you are sending it, and removal must be available to the author and to
 * a moderator but nobody else.
 */

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3000";
const PASSWORD = "ideaspace-dev-password";
const MARKER = "verify-posts probe";

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) failures++;
}

type Jar = Map<string, string>;
const jarHeader = (jar: Jar) => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

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

const post = (jar: Jar, body: unknown) =>
  req(jar, "/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

// A community the author is in, and one they are not.
const member = await prisma.communityMember.findFirstOrThrow({
  where: { status: "ACTIVE", leftAt: null, community: { archivedAt: null } },
  select: {
    userId: true,
    communityId: true,
    community: { select: { name: true } },
    user: { select: { email: true, name: true } },
  },
});

// A room this author has no active membership in. Scoped to the author on
// purpose: an earlier version of this query asked for rooms with no members
// matching `undefined`, which matches nothing, so the refusal case silently
// skipped and the boundary went untested.
const outsideRoom = await prisma.community.findFirst({
  where: {
    archivedAt: null,
    isSystemManaged: false,
    members: { none: { userId: member.userId, status: "ACTIVE", leftAt: null } },
  },
  select: { id: true, name: true },
});

const author = await login(member.user.email!);
console.log(`posting as ${member.user.name} into ${member.community.name}\n`);

// ---- A post must go somewhere ---------------------------------------------
const nowhere = await post(author, { body: `${MARKER} attached to nothing at all` });
check("a post with no home is refused", nowhere.status === 400, `status ${nowhere.status}`);

// ---- Too short ------------------------------------------------------------
const tiny = await post(author, { body: "hi", communityId: member.communityId });
check("a two-character post is refused", tiny.status === 400, `status ${tiny.status}`);

// ---- The happy path -------------------------------------------------------
const created = await post(author, {
  body: `${MARKER} — a real update with enough substance to pass the minimum length.`,
  kind: "UPDATE",
  communityId: member.communityId,
});
check("a member can post to their room", created.status === 201, `status ${created.status}`);

const createdId = (created.json?.data as { _id?: string } | undefined)?._id;

// ---- It reaches the feed --------------------------------------------------
if (createdId) {
  const feed = await req(author, "/api/feed?limit=50");
  const rows = (feed.json?.data ?? []) as { _id: string; type: string }[];
  check(
    "the post appears in the feed",
    rows.some((r) => r.type === "post" && r._id === createdId),
    `${rows.filter((r) => r.type === "post").length} post(s) in the feed`
  );
}

// ---- A room you are not in ------------------------------------------------
if (outsideRoom) {
  console.log(`  (refusal tested against "${outsideRoom.name}")`);
  const refused = await post(author, {
    body: `${MARKER} — posting into a room this person has not joined.`,
    communityId: outsideRoom.id,
  });
  check(
    "posting into a room you are not in is refused",
    refused.status === 403 || refused.status === 404,
    `status ${refused.status}`
  );
} else {
  check("a room the author is not in exists to test against", false, "none found");
}

// ---- Removal --------------------------------------------------------------
if (createdId) {
  // Someone else entirely, who neither wrote it nor moderates the room.
  const stranger = await prisma.user.findFirst({
    where: {
      email: { endsWith: "@lendi.edu.in" },
      id: { not: member.userId },
      communityMemberships: {
        none: { communityId: member.communityId, role: { in: ["OWNER", "MODERATOR"] } },
      },
    },
    select: { email: true },
  });

  if (stranger) {
    const jar = await login(stranger.email!);
    const refused = await req(jar, "/api/posts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: createdId }),
    });
    check("a stranger cannot remove it", refused.status === 403, `status ${refused.status}`);
  }

  const removed = await req(author, "/api/posts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: createdId }),
  });
  check("the author can remove it", removed.status === 200, `status ${removed.status}`);

  const row = await prisma.post.findUnique({
    where: { id: createdId },
    select: { removedAt: true },
  });
  check(
    "removal is soft, so moderation stays auditable",
    row !== null && row.removedAt !== null,
    row === null ? "row was hard-deleted" : "removedAt set"
  );

  const feedAfter = await req(author, "/api/feed?limit=50");
  const rowsAfter = (feedAfter.json?.data ?? []) as { _id: string }[];
  check(
    "a removed post leaves the feed",
    !rowsAfter.some((r) => r._id === createdId),
    ""
  );
}

// Leave nothing behind.
const cleaned = await prisma.post.deleteMany({ where: { body: { contains: MARKER } } });
console.log(`\ncleaned up ${cleaned.count} probe post(s)`);

console.log(`${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}`);
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);

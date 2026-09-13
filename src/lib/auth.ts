import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { logger } from "./logger";

/**
 * How long cached role and standing may live in a JWT before being re-read.
 * Short enough that a revoked role stops showing in the UI quickly, long
 * enough that it is not a database read on every single request.
 */
const TOKEN_REFRESH_MS = 5 * 60 * 1000;

/** GitHub's profile carries `login`; the shared `Profile` type does not declare it. */
function githubLogin(profile: unknown): string | undefined {
  if (profile && typeof profile === "object" && "login" in profile) {
    const { login } = profile as { login?: unknown };
    return typeof login === "string" ? login : undefined;
  }
  return undefined;
}

/**
 * Institutional domains permitted to sign in.
 *
 * Read from the database rather than hard-coded, so onboarding a second
 * institution is a row and not a deploy. On a lookup failure this denies
 * sign-in: an allowlist that fails open is not an allowlist.
 */
async function isPermittedDomain(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  // Auto-allow university and college domains
  if (
    domain.endsWith(".edu") || 
    domain.endsWith(".edu.in") || 
    domain.endsWith(".ac.in") ||
    domain === "lendi.org"
  ) {
    return true;
  }

  try {
    const institution = await prisma.institution.findFirst({
      where: { domains: { has: domain } },
      select: { id: true },
    });
    return Boolean(institution);
  } catch (error) {
    logger.error("Domain allowlist lookup failed; denying sign-in", {
      error: String(error),
    });
    return false;
  }
}

/**
 * Whether the passwordless "Google (Dev Simulation)" provider may be loaded.
 *
 * That provider signs a caller in as ANY email address with no password, no
 * token and no OAuth round trip. Registered unconditionally it is a complete
 * authentication bypass: a POST to /api/auth/callback/google-dev with
 * `email=hod.cse@lendi.org` returns an admin session. Verified exploitable on
 * 2026-09-12 before this guard existed.
 *
 * Two independent conditions, so neither a stray env var nor a bad NODE_ENV is
 * enough on its own, and the default in every environment is off.
 */
const DEV_AUTH_ENABLED =
  process.env.NODE_ENV !== "production" && process.env.ALLOW_DEV_AUTH === "true";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_AUTH === "true") {
  // Refuse to boot rather than serve a bypass: a misconfigured deploy must
  // fail loudly, not silently accept impersonation.
  throw new Error(
    "ALLOW_DEV_AUTH must never be set in production. It enables passwordless sign-in as any user."
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? "",
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: { scope: "read:user user:email repo write:repo_hook" }
      }
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    // Spread-in so the provider does not exist at all unless explicitly enabled.
    ...(DEV_AUTH_ENABLED
      ? [CredentialsProvider({
      id: "google-dev",
      name: "Google (Dev Simulation)",
      credentials: {
        email: { label: "Google Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = (credentials.email as string).toLowerCase().trim();
        const name = ((credentials.name as string) || "").trim() || email.split("@")[0]!;

        const existing = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            memberships: { select: { id: true, status: true, tenantId: true } },
          },
        });

        const invitation = await prisma.invitation.findFirst({
          where: { email },
          orderBy: { createdAt: "desc" },
        });

        const approvedRequest = await prisma.accessRequest.findFirst({
          where: { email, status: "APPROVED" },
          orderBy: { createdAt: "desc" },
        });

        const permittedDomain = await isPermittedDomain(email);

        if (!existing && !invitation && !approvedRequest && !permittedDomain) {
          throw new Error(`ACCESS_REQUIRED:${email}:${name}`);
        }

        const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
        const targetTenantId = invitation?.tenantId || approvedRequest?.tenantId || defaultTenant?.id;
        const targetRole = invitation?.role || "STUDENT";
        const targetDept = invitation?.department || approvedRequest?.department || "CSE";
        const targetYear = invitation?.year || approvedRequest?.year || 1;

        if (existing) {
          if (existing.memberships.length === 0 && targetTenantId) {
            await prisma.membership.create({
              data: {
                tenantId: targetTenantId,
                userId: existing.id,
                role: targetRole,
                department: targetDept,
                year: targetYear,
                status: "ACTIVE",
              },
            });
          }

          if (invitation && invitation.status === "PENDING") {
            await prisma.invitation.update({
              where: { id: invitation.id },
              data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: existing.id },
            });
          }

          await prisma.user.update({
            where: { id: existing.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: existing.id,
            name: existing.name,
            email: existing.email,
            username: existing.username,
          };
        } else {
          const base = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9_-]/g, "");
          const prefix = base.length >= 3 ? base : `user_${base}`;
          let username = prefix;
          for (let i = 1; await prisma.user.findUnique({ where: { username } }); i++) {
            username = `${prefix}${i}`;
          }

          const newUser = await prisma.user.create({
            data: {
              email,
              name,
              username,
              ...(targetTenantId
                ? {
                    memberships: {
                      create: {
                        tenantId: targetTenantId,
                        role: targetRole,
                        department: targetDept,
                        year: targetYear,
                        status: "ACTIVE",
                      },
                    },
                  }
                : {}),
            },
          });

          if (invitation && invitation.status === "PENDING") {
            await prisma.invitation.update({
              where: { id: invitation.id },
              data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: newUser.id },
            });
          }

          return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            username: newUser.username,
          };
        }
      },
    })]
      : []),
    CredentialsProvider({
      name: "ideaspace",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase();
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, username: true, passwordHash: true },
        });

        // Deliberately the same error either way. A distinct "no such user"
        // message is an account-enumeration oracle.
        if (!user?.passwordHash) {
          throw new Error("Invalid email or password.");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new Error("Invalid email or password.");

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async jwt({ token, user, trigger, session }) {
      if (user?.id) token.id = user.id;

      if (trigger === "update" && session) {
        return { ...token, ...session };
      }

      // Role, standing and onboarding state live on the membership, not the
      // user, because they are per-tenant.
      //
      // Refreshed on a timer, not only on first sign-in. A role cached for the
      // 30-day life of the token means a demotion does not take effect until
      // the person happens to sign out — and demotion is the direction where
      // staleness matters. Authorization itself never trusts this value:
      // getActiveMembership() re-reads the membership on every request. This
      // keeps the UI and the edge proxy honest.
      const staleAfter = Date.now() - TOKEN_REFRESH_MS;
      const isStale = !token.refreshedAt || token.refreshedAt < staleAfter;

      if (token.id && (!token.username || isStale)) {
        token.refreshedAt = Date.now();

        const membership = await prisma.membership.findFirst({
          where: { userId: token.id, status: "ACTIVE" },
          orderBy: { joinedAt: "asc" },
          select: {
            role: true,
            user: { select: { username: true } },
            standing: { select: { points: true, tier: true } },
          },
        });

        if (membership) {
          token.role = membership.role.toLowerCase() as typeof token.role;
          token.username = membership.user.username;
          token.isOnboarded = true;
          token.points = membership.standing?.points ?? 0;
          token.rankTier = (membership.standing?.tier
            ? membership.standing.tier.charAt(0) + membership.standing.tier.slice(1).toLowerCase()
            : "Bronze") as typeof token.rankTier;
        } else {
          // Signed in, but not yet placed in a department.
          const u = await prisma.user.findUnique({
            where: { id: token.id },
            select: { username: true },
          });
          token.role = "student";
          token.username = u?.username ?? "";
          token.isOnboarded = false;
          token.points = 0;
          token.rankTier = "Bronze";
        }
      }

      return token;
    },

    async signIn({ user, account, profile }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;

      // Check 1: Did admin already dump forms / pre-register this email?
      const existing = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          username: true,
          memberships: { select: { id: true, status: true, tenantId: true, role: true } },
        },
      });

      // Check 2: Did admin dump forms resulting in an invitation?
      const invitation = await prisma.invitation.findFirst({
        where: { email },
        orderBy: { createdAt: "desc" },
      });

      // Check 3: Did admin approve an access request?
      const approvedRequest = await prisma.accessRequest.findFirst({
        where: { email, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
      });

      // Check 4: Institutional domain?
      const permittedDomain = await isPermittedDomain(email);

      // If user does not exist AND no invitation AND no approved access request AND not institutional domain:
      if (!existing && !invitation && !approvedRequest && !permittedDomain) {
        const query = new URLSearchParams({
          email,
          name: user.name || "",
        });
        return `/auth/request-access?${query.toString()}`;
      }

      if (account?.provider === "github" || account?.provider === "google") {
        const defaultTenant = await prisma.tenant.findFirst({ select: { id: true } });
        const targetTenantId = invitation?.tenantId || approvedRequest?.tenantId || defaultTenant?.id;
        const targetRole = invitation?.role || "STUDENT";
        const targetDept = invitation?.department || approvedRequest?.department || "CSE";
        const targetYear = invitation?.year || approvedRequest?.year || 1;

        if (existing) {
          if (existing.memberships.length === 0 && targetTenantId) {
            await prisma.membership.create({
              data: {
                tenantId: targetTenantId,
                userId: existing.id,
                role: targetRole,
                department: targetDept,
                year: targetYear,
                status: "ACTIVE",
              },
            });
          }

          if (invitation && invitation.status === "PENDING") {
            await prisma.invitation.update({
              where: { id: invitation.id },
              data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: existing.id },
            });
          }

          await prisma.user.update({
            where: { id: existing.id },
            data: {
              lastLoginAt: new Date(),
              avatarUrl: user.image ?? undefined,
            },
          });
        } else {
          const login = githubLogin(profile);
          const base = (login ?? email.split("@")[0]!).toLowerCase().replace(/[^a-z0-9_-]/g, "");
          const prefix = base.length >= 3 ? base : `user_${base}`;
          let username = prefix;
          for (let i = 1; await prisma.user.findUnique({ where: { username } }); i++) {
            username = `${prefix}${i}`;
          }

          const newUser = await prisma.user.create({
            data: {
              email,
              name: user.name || invitation?.name || approvedRequest?.name || "Student",
              username,
              avatarUrl: user.image ?? null,
              githubUsername: account.provider === "github" ? (login ?? null) : null,
              githubVerified: account.provider === "github" && Boolean(login),
              ...(targetTenantId
                ? {
                    memberships: {
                      create: {
                        tenantId: targetTenantId,
                        role: targetRole,
                        department: targetDept,
                        year: targetYear,
                        status: "ACTIVE",
                      },
                    },
                  }
                : {}),
            },
          });

          if (invitation && invitation.status === "PENDING") {
            await prisma.invitation.update({
              where: { id: invitation.id },
              data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: newUser.id },
            });
          }
        }
      }

      return true;
    },
  },
});

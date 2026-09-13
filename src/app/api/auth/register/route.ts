import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enforceRateLimit, subjectFromRequest } from "@/lib/rate-limit";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  // 6 characters is not a password policy. 12 with no composition rules is the
  // current NIST-aligned guidance and is easier for students to satisfy honestly.
  password: z.string().min(6, "Use at least 6 characters.").max(200),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, hyphen and underscore only."),
});

export async function POST(req: Request) {
  try {
    // Keyed by IP: there is no user yet. This is the one place an IP subject
    // is right, and it is also the endpoint most worth limiting — unbounded
    // registration is how an allowlisted domain gets enumerated.
    const limited = await enforceRateLimit(
      "auth:register",
      subjectFromRequest(req),
      "Too many registration attempts from this network. Try again later."
    );
    if (limited) return limited;

    const data = registerSchema.parse(await req.json());
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    const domain = email.split("@")[1]?.toLowerCase();

    // Allowlist comes from the database, so onboarding another institution is
    // a row rather than a deploy.
    let institution = domain
      ? await prisma.institution.findFirst({
          where: { domains: { has: domain } },
          select: { id: true, name: true },
        })
      : null;

    // Auto-allow university and college domains
    if (
      !institution &&
      domain &&
      (domain.endsWith(".edu") ||
        domain.endsWith(".edu.in") ||
        domain.endsWith(".ac.in") ||
        domain === "lendi.org")
    ) {
      institution = { id: "auto", name: "University/College" };
    }

    if (!institution) {
      return NextResponse.json(
        { error: "Use your institutional email address to register." },
        { status: 403 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    try {
      const user = await prisma.user.create({
        data: { name: data.name, email, username, passwordHash },
        select: { id: true, username: true },
      });

      logger.info("User registered", { userId: user.id, institution: institution.name });

      // No membership yet: an administrator or the roster import places the
      // student in a department. Until then they can sign in but have no
      // tenant, which every handler treats as unauthorized.
      return NextResponse.json(
        {
          data: {
            id: user.id,
            username: user.username,
            pendingPlacement: true,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = (error.meta?.target as string[] | undefined)?.join(",") ?? "";
        return NextResponse.json(
          {
            error: target.includes("username")
              ? "That username is taken."
              : "An account with that email already exists.",
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.issues }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Registration failed", { error: String(error) });
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}

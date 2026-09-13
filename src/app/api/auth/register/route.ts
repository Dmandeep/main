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
  password: z.string().min(6, "Use at least 6 characters.").max(200),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_-]+$/, "Lowercase letters, numbers, hyphen and underscore only."),
});

/** Check if domain is an educational institution — no DB needed */
function isEducationalDomain(domain: string): boolean {
  return (
    domain.endsWith(".edu") ||
    domain.endsWith(".edu.in") ||
    domain.endsWith(".ac.in") ||
    domain === "lendi.org"
  );
}

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(
      "auth:register",
      subjectFromRequest(req),
      "Too many registration attempts from this network. Try again later."
    );
    if (limited) return limited;

    const data = registerSchema.parse(await req.json());
    const email = data.email.toLowerCase();
    const username = data.username.toLowerCase();
    const domain = email.split("@")[1]?.toLowerCase() ?? "";

    // Step 1: Check educational domain FIRST (no DB call needed)
    let institutionName = "University/College";
    let isPermitted = isEducationalDomain(domain);

    // Step 2: Only hit DB if domain wasn't auto-permitted
    if (!isPermitted) {
      try {
        const institution = domain
          ? await prisma.institution.findFirst({
              where: { domains: { has: domain } },
              select: { id: true, name: true },
            })
          : null;
        if (institution) {
          isPermitted = true;
          institutionName = institution.name;
        }
      } catch (dbError) {
        logger.warn("Institution DB lookup failed, falling back to domain check only", {
          error: String(dbError),
        });
        // DB is unreachable — deny non-.edu domains gracefully
      }
    }

    if (!isPermitted) {
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

      logger.info("User registered", { userId: user.id, institution: institutionName });

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

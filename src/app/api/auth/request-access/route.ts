import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { enforceRateLimit, subjectFromRequest } from "@/lib/rate-limit";

const requestAccessSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Please enter a valid email address"),
  department: z.string().min(2, "Please select or enter your department").default("CSE"),
  year: z.number().int().min(1).max(5).optional(),
  rollNumber: z.string().max(50).optional(),
  reason: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    // Keyed by IP: there is no user yet. This is the one place an IP subject
    // is right, and it is also the endpoint most worth limiting — unbounded
    // registration is how an allowlisted domain gets enumerated.
    const limited = await enforceRateLimit(
      "auth:request-access",
      subjectFromRequest(req),
      "Too many access requests from this network. Try again later."
    );
    if (limited) return limited;

    const body = await req.json();
    const data = requestAccessSchema.parse(body);
    const email = data.email.toLowerCase().trim();

    // 1. Check if user already exists in the system
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: "An account with this email already exists. You can sign in directly.",
          alreadyRegistered: true,
        },
        { status: 409 }
      );
    }

    // 2. Find target tenant (default to first active department/tenant)
    const tenant = await prisma.tenant.findFirst({
      where: { status: { in: ["ACTIVE", "PILOT"] } },
      select: { id: true, name: true },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: "No active department tenant found." },
        { status: 500 }
      );
    }

    // 3. Check if an access request already exists for this email
    const existingRequest = await prisma.accessRequest.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });

    if (existingRequest) {
      if (existingRequest.status === "PENDING") {
        return NextResponse.json(
          {
            error: "An access request for this email is already pending administrator review.",
            isPending: true,
          },
          { status: 409 }
        );
      }

      if (existingRequest.status === "APPROVED") {
        return NextResponse.json(
          {
            error: "Your access request has already been approved! You can sign in now.",
            isApproved: true,
          },
          { status: 409 }
        );
      }
    }

    // 4. Create new pending access request
    const request = await prisma.accessRequest.create({
      data: {
        tenantId: tenant.id,
        email,
        name: data.name.trim(),
        department: data.department.trim(),
        year: data.year ?? null,
        rollNumber: data.rollNumber?.trim() ?? null,
        reason: data.reason?.trim() ?? null,
        status: "PENDING",
      },
    });

    logger.info("Access request submitted", {
      requestId: request.id,
      email,
      department: data.department,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Your access request has been submitted to the department administrator.",
        data: {
          id: request.id,
          email: request.email,
          status: request.status,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input data" },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }

    logger.error("Failed to submit access request", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to submit access request. Please try again." },
      { status: 500 }
    );
  }
}

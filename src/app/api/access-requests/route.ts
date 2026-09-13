import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { email, name, rollNumber, reason } = await request.json();

    if (!email || !name || !reason) {
      return NextResponse.json({ error: "Email, name, and reason are required." }, { status: 400 });
    }

    // Since this is for non-college users before logging in, we find the primary tenant (Pilot)
    const defaultTenant = await prisma.tenant.findFirst({
      where: { status: "PILOT" },
    });

    const tenantId = defaultTenant?.id || (await prisma.tenant.findFirst())?.id;

    if (!tenantId) {
      return NextResponse.json({ error: "System configuration error. No tenant found." }, { status: 500 });
    }

    // Check if the request already exists
    const existing = await prisma.accessRequest.findUnique({
      where: {
        tenantId_email: {
          tenantId: tenantId,
          email,
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: "Access request already submitted for this email." }, { status: 400 });
    }

    const newRequest = await prisma.accessRequest.create({
      data: {
        email,
        name,
        rollNumber: rollNumber || undefined,
        reason,
        tenantId,
      }
    });

    return NextResponse.json({ data: newRequest }, { status: 201 });
  } catch (error: any) {
    console.error("AccessRequest Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

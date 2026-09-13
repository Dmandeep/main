import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: membership.userId },
      select: { githubToken: true },
    });

    if (!user?.githubToken) {
      return NextResponse.json(
        { error: "GitHub not connected or token missing." },
        { status: 403 }
      );
    }

    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${user.githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json(
        { error: "Failed to fetch GitHub repos", details: errorText },
        { status: res.status }
      );
    }

    const repos = await res.json();
    return NextResponse.json({ data: repos });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

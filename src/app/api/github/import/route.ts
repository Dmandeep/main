import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/tenant";
import { slugify } from "@/lib/utils";
import { calculateHealthScore } from "@/lib/health-score";

export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { repos } = body; // Array of { name, description, html_url, language, topics }

    if (!Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json({ error: "No repositories provided" }, { status: 400 });
    }

    const results = [];
    for (const repo of repos) {
      const base = slugify(repo.name);
      let slug = base;
      
      const title = repo.name || "Untitled Repo";
      const tagline = (repo.description || "Imported from GitHub.").slice(0, 120);
      const problem = (repo.description || "Imported repository.").padEnd(50, " ").slice(0, 600);
      const solution = "This project was imported from GitHub. " + (repo.description || "").slice(0, 500);
      const track = "SOFTWARE"; // Default track
      const tags = (repo.topics || []).slice(0, 5);
      const skillsNeeded = repo.language ? [repo.language] : [];
      const githubUrl = repo.html_url;

      const briefCompleteness = calculateHealthScore({
        title, tagline, problem, solution, tags, track, githubUrl,
        collaboratorsCount: 0
      });

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const project = await prisma.project.create({
            data: {
              tenantId: membership.tenantId,
              ownerId: membership.userId,
              slug,
              title,
              tagline,
              problem,
              solution,
              track,
              tags,
              skillsNeeded,
              githubUrl,
              status: "DRAFT", // Import as draft
              briefCompleteness,
              members: {
                create: { userId: membership.userId, role: "Owner" },
              },
            },
          });
          results.push(project);
          break; // Success
        } catch (error) {
          const err = error as { code?: string };
          if (err.code === "P2002") {
            slug = `${base}-${attempt + 2}`;
          } else {
            throw error;
          }
        }
      }
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    console.error("Bulk import failed:", error);
    return NextResponse.json({ error: "Failed to import repositories" }, { status: 500 });
  }
}

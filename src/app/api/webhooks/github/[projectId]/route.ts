import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const projectId = params.projectId;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { webhookSecret: true, ownerId: true, tenantId: true },
    });

    if (!project || !project.webhookSecret) {
      return NextResponse.json({ error: "Project or webhook secret not found" }, { status: 404 });
    }

    const signature = request.headers.get("x-hub-signature-256");
    if (!signature) {
      return NextResponse.json({ error: "No signature found" }, { status: 401 });
    }

    const payloadText = await request.text();
    const hmac = crypto.createHmac("sha256", project.webhookSecret);
    const digest = "sha256=" + hmac.update(payloadText).digest("hex");

    if (
      signature.length !== digest.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = request.headers.get("x-github-event");
    const payload = JSON.parse(payloadText);

    if (event === "push") {
      const commits = payload.commits || [];
      const activeSeason = await prisma.season.findFirst({
        where: { tenantId: project.tenantId, isCurrent: true },
      });

      for (const commit of commits) {
        const externalId = commit.id;
        
        // Gamification Engine Scoring
        const numFiles = (commit.added?.length || 0) + (commit.removed?.length || 0) + (commit.modified?.length || 0);
        const metricLinesChanged = Math.min(25, numFiles * 5); // Metric 1 (0-25)
        
        const hasTs = [...(commit.added || []), ...(commit.modified || [])].some((f: string) => f.endsWith('.ts') || f.endsWith('.tsx'));
        const msgLenScore = Math.min(10, (commit.message || '').length / 10);
        const metricCodeQuality = Math.min(25, msgLenScore + (hasTs ? 15 : 5)); // Metric 2 (0-25)
        
        const metricCodeSummary = Math.min(25, (commit.message || '').split('\\n').length * 5); // Metric 3 (0-25)
        const bonusPoints = (commit.message || '').toLowerCase().includes('fix') ? 10 : 0; // Bonus Points
        const overallScore = Math.min(100, metricLinesChanged + metricCodeQuality + metricCodeSummary + bonusPoints); // Metric 4 (0-100)

        const evidence = await prisma.evidence.upsert({
          where: {
            projectId_sourceType_sourceExternalId: {
              projectId,
              sourceType: "GITHUB_COMMIT",
              sourceExternalId: externalId,
            },
          },
          update: {
            title: `Commit: ${commit.message.split("\n")[0]}`,
            description: commit.message,
            metadata: {
              author: commit.author.name,
              username: commit.author.username,
              added: commit.added,
              removed: commit.removed,
              modified: commit.modified,
            },
            metricLinesChanged,
            metricCodeQuality,
            metricCodeSummary,
            bonusPoints,
            overallScore,
          },
          create: {
            projectId,
            creatorId: project.ownerId,
            title: `Commit: ${commit.message.split("\n")[0]}`,
            description: commit.message,
            sourceType: "GITHUB_COMMIT",
            sourceUrl: commit.url,
            sourceExternalId: externalId,
            producedAt: new Date(commit.timestamp),
            metadata: {
              author: commit.author.name,
              username: commit.author.username,
              added: commit.added,
              removed: commit.removed,
              modified: commit.modified,
            },
            state: "MACHINE_VERIFIED",
            metricLinesChanged,
            metricCodeQuality,
            metricCodeSummary,
            bonusPoints,
            overallScore,
          },
        });

        if (activeSeason && overallScore > 0) {
          await prisma.reputationEvent.upsert({
            where: {
              tenantId_idempotencyKey: {
                tenantId: project.tenantId,
                idempotencyKey: `commit-${externalId}`,
              }
            },
            update: {
              points: Math.round(overallScore),
            },
            create: {
              tenantId: project.tenantId,
              userId: project.ownerId,
              seasonId: activeSeason.id,
              type: "EVIDENCE_VERIFIED",
              points: Math.round(overallScore),
              sourceType: "GITHUB_COMMIT",
              sourceId: evidence.id,
              idempotencyKey: `commit-${externalId}`,
            }
          });
        }
      }
    } else if (event === "pull_request") {
      const pr = payload.pull_request;
      if (payload.action === "opened" || payload.action === "closed" || payload.action === "synchronize") {
        const externalId = pr.id.toString();
        await prisma.evidence.upsert({
          where: {
            projectId_sourceType_sourceExternalId: {
              projectId,
              sourceType: "GITHUB_PR",
              sourceExternalId: externalId,
            },
          },
          update: {
            title: `PR: ${pr.title}`,
            description: pr.body,
            metadata: {
              number: pr.number,
              state: pr.state,
              user: pr.user.login,
              action: payload.action,
            },
          },
          create: {
            projectId,
            creatorId: project.ownerId,
            title: `PR: ${pr.title}`,
            description: pr.body,
            sourceType: "GITHUB_PR",
            sourceUrl: pr.html_url,
            sourceExternalId: externalId,
            producedAt: new Date(pr.created_at),
            metadata: {
              number: pr.number,
              state: pr.state,
              user: pr.user.login,
              action: payload.action,
            },
            state: "MACHINE_VERIFIED",
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

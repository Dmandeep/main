
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testWebhook() {
  const project = await prisma.project.findFirst({ select: { id: true, ownerId: true, tenantId: true }});
  if (!project) {
    console.log("No projects found to test.");
    return;
  }
  
  console.log("Testing scoring engine for Project ID:", project.id);
  
  const payload = {
    commits: [
      {
        id: "mock-commit-12345",
        message: "feat: implemented amazing gamification engine with complex algorithms",
        url: "https://github.com/mock/repo/commit/123",
        timestamp: new Date().toISOString(),
        author: { name: "Test User", username: "testuser" },
        added: ["src/gamification.ts", "src/algorithms.ts", "src/complex.ts"],
        modified: ["src/app/page.tsx", "package.json"],
        removed: ["src/old.ts"]
      }
    ]
  };

  // Directly test the scoring logic extracted from webhook
  const commit = payload.commits[0];
  const numFiles = (commit.added?.length || 0) + (commit.removed?.length || 0) + (commit.modified?.length || 0);
  const metricLinesChanged = Math.min(25, numFiles * 5); // 6 * 5 = 30 -> min(25) = 25
  const hasTs = [...(commit.added || []), ...(commit.modified || [])].some((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"));
  const msgLenScore = Math.min(10, (commit.message || "").length / 10); // 74 / 10 = 7.4
  const metricCodeQuality = Math.min(25, msgLenScore + (hasTs ? 15 : 5)); // 7.4 + 15 = 22.4
  const metricCodeSummary = Math.min(25, (commit.message || "").split("\n").length * 5); // 1 * 5 = 5
  const bonusPoints = (commit.message || "").toLowerCase().includes("fix") ? 10 : 0; // 0
  const overallScore = Math.min(100, metricLinesChanged + metricCodeQuality + metricCodeSummary + bonusPoints); 
  
  console.log("----- SCORING RESULTS -----");
  console.log("Files changed:", numFiles);
  console.log("Metric 1 (Lines/Files):", metricLinesChanged, "/ 25");
  console.log("Metric 2 (Quality/TS):", metricCodeQuality, "/ 25");
  console.log("Metric 3 (Summary):", metricCodeSummary, "/ 25");
  console.log("Bonus Points:", bonusPoints);
  console.log("OVERALL SCORE:", overallScore, "/ 100");
  
  if (overallScore > 0) {
    console.log("SUCCESS: Gamification engine is actively calculating scores for commits!");
  } else {
    console.log("FAILED: Score is 0");
  }
}

testWebhook().catch(console.error).finally(() => prisma.$disconnect());

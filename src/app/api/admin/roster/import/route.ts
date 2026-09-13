import { NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getActiveMembership } from "@/lib/tenant";
import { planImport, commitImport } from "@/lib/roster/import";
import { canManageRoster } from "@/lib/authz/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

const importSchema = z.object({
  csv: z.string().min(1, "CSV data cannot be empty"),
  filename: z.string().default("google-form-dump.csv"),
  defaultDepartment: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const membership = await getActiveMembership();
    if (!membership || !canManageRoster(membership.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limited = await enforceRateLimit(
      "roster:import",
      membership.userId,
      "Roster imports are limited. Try again shortly."
    );
    if (limited) return limited;

    const body = await req.json();
    const { csv, filename, defaultDepartment } = importSchema.parse(body);

    // 1. Plan the import
    const plan = await planImport({
      tenantId: membership.tenantId,
      csv,
      defaultDepartment: defaultDepartment || membership.department || "Computer Science & Engineering",
    });

    if (plan.outcomes.length === 0 && plan.rejected.length > 0) {
      return NextResponse.json(
        {
          error: "No valid rows found in the dumped form data.",
          rejected: plan.rejected,
        },
        { status: 400 }
      );
    }

    // 2. Commit the import
    const result = await commitImport(plan, membership.userId, filename);

    logger.info("Admin committed Google Forms / roster import", {
      adminId: membership.userId,
      created: result.created,
      attached: result.attached,
      skipped: result.skipped,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${plan.summary.rows} rows: ${result.created} students pre-registered/invited and ${result.attached} attached. They can now log in automatically with Google!`,
      data: {
        summary: plan.summary,
        created: result.created,
        attached: result.attached,
        skipped: result.skipped,
        conflicts: result.conflicts,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input" }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
    }
    logger.error("Failed to import Google Form roster", { error: String(error) });
    return NextResponse.json(
      { error: "Failed to process dumped form data: " + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}

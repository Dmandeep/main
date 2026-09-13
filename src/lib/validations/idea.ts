import { z } from "zod";

export const ideaSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(120, "Title is too long"),
  tagline: z.string().min(10, "Tagline must be at least 10 characters").max(120, "Tagline is too long"),
  problem: z.string().min(50, "Problem description must be at least 50 characters").max(600, "Problem description is too long"),
  solution: z.string().min(50, "Solution must be at least 50 characters").max(600, "Solution is too long"),
  track: z.string().min(1, "Please select a track"),
  tags: z.array(z.string()).max(5, "Maximum 5 tags allowed"),
  skillsNeeded: z.array(z.string()).max(10, "Maximum 10 skills allowed"),
  coverImage: z.string().url().optional().or(z.literal("")),
  githubUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  demoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  /**
   * The archived project this one continues.
   *
   * Revival is the archive's whole point — a postmortem nobody can act on is
   * a graveyard. The column and the relation existed from the start but no
   * endpoint ever accepted this, so nothing could be revived.
   */
  revivedFromId: z.string().optional(),
});

export type IdeaFormValues = z.infer<typeof ideaSchema>;

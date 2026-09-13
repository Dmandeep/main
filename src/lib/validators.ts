import { z } from 'zod'

export const RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email().refine(val => val.endsWith('@lendi.org'), {
    message: "Must be a valid @lendi.org email address",
  }),
  rollNumber: z.string().regex(/^[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{4}$/i, "Invalid roll number format (e.g., 24B21A0501)"),
  branch: z.string().min(2, "Branch requires selection"),
  year: z.coerce.number().min(1).max(4),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export const IdeaPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(100),
  description: z.string().min(50, "Please provide a detailed description (min 50 chars)"),
  domain: z.string().min(1, "Please select a domain"),
  skillsNeeded: z.array(z.string()).min(1, "Please specify at least one skill needed"),
  githubRepoUrl: z.string().url().optional().or(z.literal('')),
})

export const EventPostSchema = z.object({
  title: z.string().min(5, "Event title required"),
  description: z.string().min(20, "Detailed description required"),
  domain: z.string().min(1, "Domain selection required"),
  format: z.enum(['WORKSHOP', 'SEMINAR', 'BOOTCAMP']),
  eventDate: z.string().datetime(),
  seatLimit: z.coerce.number().min(5).max(500),
  prerequisites: z.string().optional(),
  resourcesUrl: z.string().url().optional().or(z.literal('')),
})

export const PostmortemSchema = z.object({
  whatWasIdea: z.string().min(20),
  whyStopped: z.string().min(30, "Please provide an honest analysis"),
  lessonsLearned: z.string().min(30),
  nextSteps: z.string().optional(),
})

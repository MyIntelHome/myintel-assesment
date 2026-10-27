import { z } from "zod";

const note = z.string().max(5000);
export const professionalTestSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(200),
  date: z.union([z.literal(""), z.iso.date()]),
  result: z.string().max(1000),
  interpretation: note,
  limitations: note,
  linkedFindings: z.array(z.string().max(300)).max(100).optional(),
});
export const roomDocumentationSchema = z.object({
  observation: note.optional(),
  residentPerspective: note.optional(),
  followUp: note.optional(),
});
/** Clinical archive only. No identity fields, auto-scoring or commercial promises. */
export const professionalDocumentationSchema = z.object({
  visitDate: z.union([z.literal(""), z.iso.date()]).optional(),
  clientSummary: note.optional(),
  goals: note.optional(),
  dailyActivities: note.optional(),
  medicalContext: note.optional(),
  equipment: note.optional(),
  support: note.optional(),
  followUpPlan: note.optional(),
  tests: z.array(professionalTestSchema).max(20).optional(),
  rooms: z
    .record(z.string().min(1).max(200), roomDocumentationSchema)
    .refine((v) => Object.keys(v).length <= 100, "Too many room notes.")
    .optional(),
});
export type ProfessionalDocumentation = z.infer<
  typeof professionalDocumentationSchema
>;
export type RoomDocumentation = z.infer<typeof roomDocumentationSchema>;
export type ProfessionalTest = z.infer<typeof professionalTestSchema>;

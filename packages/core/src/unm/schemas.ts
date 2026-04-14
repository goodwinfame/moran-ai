import { z } from "zod";

const memoryCategoryValues = ["guidance", "world", "characters", "consistency", "summaries", "outline"] as const;
const memoryScopeValues = ["global", "arc", "chapter"] as const;
const memoryStabilityValues = ["immutable", "canon", "evolving", "ephemeral"] as const;
const memoryTierValues = ["hot", "warm", "cold"] as const;

export const writeRequestSchema = z.object({
  projectId: z.string().uuid(),
  category: z.enum(memoryCategoryValues),
  content: z.string().min(1),
  scope: z.enum(memoryScopeValues).optional(),
  stability: z.enum(memoryStabilityValues).optional(),
  tier: z.enum(memoryTierValues).optional(),
  priorityFloor: z.number().min(0).max(100).optional(),
  relevanceTags: z.array(z.string()).optional(),
  sourceChapter: z.number().int().optional(),
  sourceAgent: z.string().optional(),
});

export type WriteRequestInput = z.infer<typeof writeRequestSchema>;

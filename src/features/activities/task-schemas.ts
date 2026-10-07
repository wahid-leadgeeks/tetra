import { z } from "zod";

/**
 * PATCH /api/tasks/:id body. Date transforms preserve `undefined` so an absent
 * field is not treated as an explicit clear by `updateTask`.
 */
export const updateTaskSchema = z.object({
  name: z.string().trim().min(1, "Task name cannot be empty").max(300).optional(),
  categoryId: z.string().uuid("Invalid category ID").optional(),
  status: z
    .enum([
      "backlog",
      "todo",
      "in_progress",
      "blocked",
      "review",
      "done",
      "cancelled",
    ])
    .optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  description: z.string().nullable().optional(),
  isFavorite: z.boolean().optional(),
  dueAt: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? undefined : val ? new Date(val) : null)),
  startedAt: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? undefined : val ? new Date(val) : null)),
  completedAt: z
    .string()
    .nullable()
    .optional()
    .transform((val) => (val === undefined ? undefined : val ? new Date(val) : null)),
});

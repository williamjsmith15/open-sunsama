/**
 * Validation schemas for projects routes
 */

import { z } from "zod";
import { uuidSchema, dateSchema } from "@open-sunsama/utils";

export const projectStatusSchema = z.enum([
  "active",
  "on_hold",
  "completed",
  "archived",
]);

// lucide icon name — letters/digits only (e.g. "Folder", "Rocket")
const iconSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9]+$/, { error: "Invalid icon name" });
const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { error: "Invalid hex color" });

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required" }).max(120),
  description: z.string().max(5000).optional().nullable(),
  color: colorSchema.optional(),
  icon: iconSchema.optional(),
  status: projectStatusSchema.optional(),
  targetDate: dateSchema.optional().nullable(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(5000).optional().nullable(),
  color: colorSchema.optional(),
  icon: iconSchema.optional(),
  status: projectStatusSchema.optional(),
  targetDate: dateSchema.optional().nullable(),
});

export const reorderProjectsSchema = z.object({
  projectIds: z
    .array(uuidSchema)
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "IDs must be unique"),
});

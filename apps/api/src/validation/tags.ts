/**
 * Validation schemas for tags routes
 */

import { z } from "zod";

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, { error: "Invalid hex color" });

export const createTagSchema = z.object({
  name: z.string().trim().min(1, { error: "Name is required" }).max(60),
  color: colorSchema.optional(),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: colorSchema.optional(),
});

import { z } from "zod";
import { BottleSize, Unit } from "@/generated/prisma/client";

export const createPackagingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de l'emballage est requis")
    .max(100, "Le nom de l'emballage est trop long"),

  size: z.enum(BottleSize, {
    message: "La taille de l'emballage est invalide",
  }),

  unit: z.literal(Unit.PIECE),
});

export const updatePackagingSchema = createPackagingSchema.extend({
  isActive: z.boolean().optional(),
});

export const packagingIdSchema = z.object({
  id: z.string().min(1, "L'identifiant de l'emballage est requis"),
});

export type CreatePackagingInput = z.infer<typeof createPackagingSchema>;

export type UpdatePackagingInput = z.infer<typeof updatePackagingSchema>;

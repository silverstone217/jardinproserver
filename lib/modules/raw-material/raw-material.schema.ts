import { z } from "zod";
import { Unit } from "@/generated/prisma/client";

/**
 * Identifiant d'une matière première
 */
export const rawMaterialIdSchema = z.object({
  id: z.string().min(1, "L'identifiant de la matière première est requis"),
});

/**
 * Création d'une matière première
 */
export const createRawMaterialSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la matière première est requis")
    .max(100, "Le nom de la matière première est trop long"),

  unit: z.enum(Unit, {
    message: "L'unité de mesure est invalide",
  }),

  minStock: z
    .number({
      message: "Le stock minimum doit être un nombre",
    })
    .min(0, "Le stock minimum ne peut pas être négatif")
    .finite("Le stock minimum doit être un nombre valide")
    .optional(),
});

/**
 * Modification d'une matière première
 */
export const updateRawMaterialSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de la matière première est requis")
    .max(100, "Le nom de la matière première est trop long")
    .optional(),

  unit: z
    .enum(Unit, {
      message: "L'unité de mesure est invalide",
    })
    .optional(),

  minStock: z
    .number({
      message: "Le stock minimum doit être un nombre",
    })
    .min(0, "Le stock minimum ne peut pas être négatif")
    .finite("Le stock minimum doit être un nombre valide")
    .nullable()
    .optional(),

  isActive: z.boolean().optional(),
});

/**
 * Activation / désactivation d'une matière première
 */
export const updateRawMaterialStatusSchema = z.object({
  isActive: z.boolean({
    message: "Le statut est invalide",
  }),
});

/**
 * Liste / recherche des matières premières
 */
export const getRawMaterialsSchema = z.object({
  search: z.string().trim().max(100, "La recherche est trop longue").optional(),

  isActive: z.boolean().optional(),
});

/**
 * Types
 */
export type CreateRawMaterialInput = z.infer<typeof createRawMaterialSchema>;

export type UpdateRawMaterialInput = z.infer<typeof updateRawMaterialSchema>;

export type UpdateRawMaterialStatusInput = z.infer<
  typeof updateRawMaterialStatusSchema
>;

export type GetRawMaterialsInput = z.infer<typeof getRawMaterialsSchema>;

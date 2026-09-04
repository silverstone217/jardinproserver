import { z } from "zod";

// ============================================================
// CONSTANTES
// ============================================================

const telephoneSchema = z
  .string()
  .trim()
  .regex(
    /^0\d{9}$/,
    "Le numéro doit contenir exactement 10 chiffres et commencer par 0",
  );

// ============================================================
// CRÉATION D'UN POINT DE VENTE
// ============================================================

export const createPointOfSaleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),

  code: z
    .string()
    .trim()
    .min(2, "Le code doit contenir au moins 2 caractères")
    .max(30, "Le code ne peut pas dépasser 30 caractères")
    .regex(
      /^[A-Z0-9_-]+$/,
      "Le code ne peut contenir que des lettres majuscules, chiffres, tirets et underscores",
    ),

  telephone: telephoneSchema.optional(),

  address: z
    .string()
    .trim()
    .max(255, "L'adresse ne peut pas dépasser 255 caractères")
    .optional(),
});

export type CreatePointOfSaleInput = z.infer<typeof createPointOfSaleSchema>;

// ============================================================
// MODIFICATION D'UN POINT DE VENTE
// ============================================================

export const updatePointOfSaleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères")
      .max(100, "Le nom ne peut pas dépasser 100 caractères")
      .optional(),

    code: z
      .string()
      .trim()
      .min(2, "Le code doit contenir au moins 2 caractères")
      .max(30, "Le code ne peut pas dépasser 30 caractères")
      .regex(
        /^[A-Z0-9_-]+$/,
        "Le code ne peut contenir que des lettres majuscules, chiffres, tirets et underscores",
      )
      .optional(),

    telephone: telephoneSchema.optional(),

    address: z
      .string()
      .trim()
      .max(255, "L'adresse ne peut pas dépasser 255 caractères")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.code !== undefined ||
      data.telephone !== undefined ||
      data.address !== undefined,
    {
      message: "Au moins une information doit être modifiée",
    },
  );

export type UpdatePointOfSaleInput = z.infer<typeof updatePointOfSaleSchema>;

// ============================================================
// ACTIVATION / DÉSACTIVATION
// ============================================================

export const updatePointOfSaleStatusSchema = z.object({
  isActive: z.boolean(),
});

export type UpdatePointOfSaleStatusInput = z.infer<
  typeof updatePointOfSaleStatusSchema
>;

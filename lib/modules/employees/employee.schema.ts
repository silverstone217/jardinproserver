import { z } from "zod";

/**
 * Création d'un employé
 */
export const createEmployeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères")
    .max(100, "Le nom ne peut pas dépasser 100 caractères"),

  telephone: z
    .string()
    .trim()
    .min(8, "Le numéro de téléphone est invalide")
    .max(20, "Le numéro de téléphone est invalide"),

  email: z
    .email("L'adresse email est invalide")
    .max(255, "L'adresse email est trop longue"),

  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères")
    .max(100, "Le mot de passe est trop long"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

/**
 * Modification des informations d'un employé
 */
export const updateEmployeeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom doit contenir au moins 2 caractères")
      .max(100, "Le nom ne peut pas dépasser 100 caractères")
      .optional(),

    telephone: z
      .string()
      .trim()
      .min(8, "Le numéro de téléphone est invalide")
      .max(20, "Le numéro de téléphone est invalide")
      .optional(),

    email: z
      .email("L'adresse email est invalide")
      .max(255, "L'adresse email est trop longue")
      .optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.telephone !== undefined ||
      data.email !== undefined,
    {
      message: "Au moins une information doit être modifiée",
    },
  );

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

/**
 * Modification du mot de passe
 */
export const updateEmployeePasswordSchema = z.object({
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères")
    .max(100, "Le mot de passe est trop long"),
});

export type UpdateEmployeePasswordInput = z.infer<
  typeof updateEmployeePasswordSchema
>;

/**
 * Bannissement / débannissement
 */
export const updateEmployeeBanSchema = z.object({
  isBanned: z.boolean(),

  banReason: z
    .string()
    .trim()
    .max(255, "La raison du bannissement est trop longue")
    .optional(),
});

export type UpdateEmployeeBanInput = z.infer<typeof updateEmployeeBanSchema>;

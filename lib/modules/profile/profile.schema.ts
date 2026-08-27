import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(100, "Le nom ne peut pas dépasser 100 caractères."),

  telephone: z
    .string()
    .trim()
    .min(9, "Le numéro de téléphone est invalide.")
    .max(20, "Le numéro de téléphone est invalide."),

  email: z
    .email("L'adresse email est invalide.")
    .trim()
    .max(150, "L'adresse email est trop longue.")
    .transform((email) => email.toLowerCase()),
});

/**
 * ============================================================
 * MODIFICATION DE LA PHOTO DE PROFIL
 * ============================================================
 */
export const updateProfileImageSchema = z.object({
  image: z
    .url("L'URL de l'image est invalide.")
    .trim()
    .max(500, "L'URL de l'image est trop longue."),
});

/**
 * ============================================================
 * TYPES TYPESCRIPT
 * ============================================================
 */

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export type UpdateProfileImageInput = z.infer<typeof updateProfileImageSchema>;

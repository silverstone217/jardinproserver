import { z } from "zod";

export const createShopSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de la boutique doit contenir au moins 2 caractères")
    .max(100, "Le nom de la boutique ne peut pas dépasser 100 caractères"),

  logo: z.url("L'URL du logo est invalide").trim().optional(),

  slogan: z
    .string()
    .trim()
    .max(255, "Le slogan ne peut pas dépasser 255 caractères")
    .optional(),

  telephone: z
    .string()
    .trim()
    .regex(
      /^\d{10}$/,
      "Le numéro de téléphone doit contenir exactement 10 chiffres",
    ),

  email: z.email("L'adresse email est invalide").trim().optional(),

  address: z
    .string()
    .trim()
    .min(2, "L'adresse doit contenir au moins 2 caractères")
    .max(255, "L'adresse ne peut pas dépasser 255 caractères"),

  currency: z.enum(["CDF", "USD", "EUR"]).default("CDF"),
});

export const updateShopSchema = createShopSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Au moins une information doit être fournie",
  });

export const updateShopLogoSchema = z.object({
  logo: z.url("L'URL du logo est invalide").trim(),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;

export type UpdateShopInput = z.infer<typeof updateShopSchema>;

export type UpdateShopLogoInput = z.infer<typeof updateShopLogoSchema>;

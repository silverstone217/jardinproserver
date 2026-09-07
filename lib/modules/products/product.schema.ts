import { z } from "zod";

import { BottleSize } from "@/generated/prisma/client";

/**
 * ============================================================
 * PRODUCT
 * ============================================================
 */

/**
 * Identifiant du produit
 */
export const productIdSchema = z.object({
  id: z.string().min(1, "L'identifiant du produit est requis"),
});

export type ProductIdInput = z.infer<typeof productIdSchema>;

/**
 * Création d'un produit
 *
 * recipeVolumeMl représente le rendement d'une recette complète.
 *
 * Exemple :
 * 4 carottes + 2 pommes + 4 oranges
 * = 2000 ml de jus
 *
 * Donc :
 * recipeVolumeMl = 2000
 */
export const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom du produit est requis")
    .max(100, "Le nom du produit est trop long"),

  description: z
    .string()
    .trim()
    .max(500, "La description est trop longue")
    .optional(),

  recipeVolumeMl: z
    .number({
      message: "Le rendement de la recette doit être un nombre",
    })
    .int("Le rendement doit être un nombre entier")
    .positive("Le rendement doit être supérieur à 0"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Modification d'un produit
 */
export const updateProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom du produit est requis")
    .max(100, "Le nom du produit est trop long")
    .optional(),

  description: z
    .string()
    .trim()
    .max(500, "La description est trop longue")
    .nullable()
    .optional(),

  recipeVolumeMl: z
    .number({
      message: "Le rendement de la recette doit être un nombre",
    })
    .int("Le rendement doit être un nombre entier")
    .positive("Le rendement doit être supérieur à 0")
    .optional(),

  isActive: z.boolean().optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * Modification du statut
 */
export const updateProductStatusSchema = z.object({
  isActive: z.boolean({
    message: "Le statut est invalide",
  }),
});

export type UpdateProductStatusInput = z.infer<
  typeof updateProductStatusSchema
>;

/**
 * Recherche / filtres
 */
export const getProductsSchema = z.object({
  search: z.string().trim().max(100, "La recherche est trop longue").optional(),

  isActive: z.boolean().optional(),
});

export type GetProductsInput = z.infer<typeof getProductsSchema>;

/**
 * ============================================================
 * PRODUCT VARIANT
 * ============================================================
 */

/**
 * Identifiant de la variante
 */
export const productVariantIdSchema = z.object({
  variantId: z.string().min(1, "L'identifiant de la variante est requis"),
});

export type ProductVariantIdInput = z.infer<typeof productVariantIdSchema>;

/**
 * Création d'une variante
 */
export const createProductVariantSchema = z.object({
  packagingId: z.string().min(1, "L'emballage est requis"),

  size: z.enum(BottleSize, {
    message: "Le format de la bouteille est invalide",
  }),

  volumeMl: z
    .number({
      message: "Le volume doit être un nombre",
    })
    .int("Le volume doit être un nombre entier")
    .positive("Le volume doit être supérieur à 0"),

  price: z
    .number({
      message: "Le prix doit être un nombre",
    })
    .nonnegative("Le prix ne peut pas être négatif"),

  sku: z.string().trim().max(50, "Le SKU est trop long").optional(),
});

export type CreateProductVariantInput = z.infer<
  typeof createProductVariantSchema
>;

/**
 * Modification d'une variante
 */
export const updateProductVariantSchema = z.object({
  packagingId: z.string().min(1, "L'emballage est requis").optional(),

  size: z
    .enum(BottleSize, {
      message: "Le format de la bouteille est invalide",
    })
    .optional(),

  volumeMl: z
    .number({
      message: "Le volume doit être un nombre",
    })
    .int("Le volume doit être un nombre entier")
    .positive("Le volume doit être supérieur à 0")
    .optional(),

  price: z
    .number({
      message: "Le prix doit être un nombre",
    })
    .nonnegative("Le prix ne peut pas être négatif")
    .optional(),

  sku: z.string().trim().max(50, "Le SKU est trop long").nullable().optional(),

  isActive: z.boolean().optional(),
});

export type UpdateProductVariantInput = z.infer<
  typeof updateProductVariantSchema
>;

/**
 * Modification du statut d'une variante
 */
export const updateProductVariantStatusSchema = z.object({
  isActive: z.boolean({
    message: "Le statut est invalide",
  }),
});

export type UpdateProductVariantStatusInput = z.infer<
  typeof updateProductVariantStatusSchema
>;

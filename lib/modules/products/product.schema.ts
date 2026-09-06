import { z } from "zod";
import { BottleSize } from "@/generated/prisma/client";

/**
 * ============================================================
 * PRODUCT
 * ============================================================
 */

export const productIdSchema = z.object({
  id: z.string().min(1, "L'identifiant du produit est requis"),
});

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

  image: z.string().trim().url("L'URL de l'image est invalide").optional(),
});

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

  image: z
    .string()
    .trim()
    .url("L'URL de l'image est invalide")
    .nullable()
    .optional(),

  isActive: z.boolean().optional(),
});

export const updateProductStatusSchema = z.object({
  isActive: z.boolean({
    message: "Le statut est invalide",
  }),
});

export const getProductsSchema = z.object({
  search: z.string().trim().max(100, "La recherche est trop longue").optional(),

  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type UpdateProductStatusInput = z.infer<
  typeof updateProductStatusSchema
>;
export type GetProductsInput = z.infer<typeof getProductsSchema>;

/**
 * ============================================================
 * PRODUCT VARIANT
 * ============================================================
 */

export const productVariantIdSchema = z.object({
  variantId: z.string().min(1, "L'identifiant de la variante est requis"),
});

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
    .finite("Le prix doit être un nombre valide")
    .nonnegative("Le prix ne peut pas être négatif"),

  sku: z.string().trim().max(50, "Le SKU est trop long").optional(),
});

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
    .finite("Le prix doit être un nombre valide")
    .nonnegative("Le prix ne peut pas être négatif")
    .optional(),

  sku: z.string().trim().max(50, "Le SKU est trop long").nullable().optional(),

  isActive: z.boolean().optional(),
});

export const updateProductVariantStatusSchema = z.object({
  isActive: z.boolean({
    message: "Le statut est invalide",
  }),
});

export type CreateProductVariantInput = z.infer<
  typeof createProductVariantSchema
>;

export type UpdateProductVariantInput = z.infer<
  typeof updateProductVariantSchema
>;

export type UpdateProductVariantStatusInput = z.infer<
  typeof updateProductVariantStatusSchema
>;

import { z } from "zod";
import { StockMovementType } from "@/generated/prisma/client";

/**
 * Identifiant d'un stock
 */
export const stockIdSchema = z.object({
  id: z.string().min(1, "L'identifiant du stock est requis"),
});

/**
 * Identifiants permettant d'identifier la ressource
 * concernée par le stock.
 *
 * Un seul des trois doit être fourni :
 * - rawMaterialId
 * - packagingId
 * - productVariantId
 */
export const stockResourceSchema = z
  .object({
    rawMaterialId: z.string().min(1).optional(),

    packagingId: z.string().min(1).optional(),

    productVariantId: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      const count = [
        data.rawMaterialId,
        data.packagingId,
        data.productVariantId,
      ].filter(Boolean).length;

      return count === 1;
    },
    {
      message:
        "Une seule ressource doit être spécifiée : matière première, emballage ou produit.",
    },
  );

/**
 * Quantité de stock
 */
export const stockQuantitySchema = z
  .number({
    message: "La quantité doit être un nombre",
  })
  .positive("La quantité doit être supérieure à 0")
  .finite("La quantité doit être un nombre valide");

/**
 * Ajouter du stock
 */
export const addStockSchema = stockResourceSchema.extend({
  pointOfSaleId: z.string().min(1).optional(),

  quantity: stockQuantitySchema,

  reason: z.string().trim().max(255, "La raison est trop longue").optional(),

  referenceId: z
    .string()
    .trim()
    .max(100, "La référence est trop longue")
    .optional(),

  movementType: z
    .enum(StockMovementType, {
      message: "Le type de mouvement est invalide",
    })
    .default(StockMovementType.PURCHASE),
});

/**
 * Retirer du stock
 */
export const removeStockSchema = stockResourceSchema.extend({
  pointOfSaleId: z.string().min(1).optional(),

  quantity: stockQuantitySchema,

  reason: z.string().trim().max(255, "La raison est trop longue").optional(),

  referenceId: z
    .string()
    .trim()
    .max(100, "La référence est trop longue")
    .optional(),

  movementType: z
    .enum(StockMovementType, {
      message: "Le type de mouvement est invalide",
    })
    .default(StockMovementType.ADJUSTMENT),
});

/**
 * Ajustement de stock
 *
 * Ici, quantity représente la nouvelle quantité réelle
 * constatée après inventaire.
 */
export const adjustStockSchema = stockResourceSchema.extend({
  pointOfSaleId: z.string().min(1).optional(),

  quantity: z
    .number({
      message: "La quantité doit être un nombre",
    })
    .min(0, "La quantité ne peut pas être négative")
    .finite("La quantité doit être un nombre valide"),

  reason: z
    .string()
    .trim()
    .min(1, "La raison de l'ajustement est requise")
    .max(255, "La raison est trop longue"),

  referenceId: z
    .string()
    .trim()
    .max(100, "La référence est trop longue")
    .optional(),
});

/**
 * Recherche / filtrage des stocks
 */
export const getStockSchema = z.object({
  pointOfSaleId: z.string().min(1).optional(),

  rawMaterialId: z.string().min(1).optional(),

  packagingId: z.string().min(1).optional(),

  productVariantId: z.string().min(1).optional(),

  lowStockOnly: z.boolean().optional(),
});

/**
 * Historique des mouvements
 */
export const stockMovementsSchema = z.object({
  pointOfSaleId: z.string().min(1).optional(),

  rawMaterialId: z.string().min(1).optional(),

  packagingId: z.string().min(1).optional(),

  productVariantId: z.string().min(1).optional(),

  type: z
    .enum(StockMovementType, {
      message: "Le type de mouvement est invalide",
    })
    .optional(),

  referenceId: z.string().min(1).optional(),

  limit: z
    .number({
      message: "La limite doit être un nombre",
    })
    .int("La limite doit être un entier")
    .min(1)
    .max(100)
    .default(50),

  offset: z
    .number({
      message: "L'offset doit être un nombre",
    })
    .int("L'offset doit être un entier")
    .min(0)
    .default(0),
});

export type StockResourceInput = z.infer<typeof stockResourceSchema>;

export type AddStockInput = z.infer<typeof addStockSchema>;

export type RemoveStockInput = z.infer<typeof removeStockSchema>;

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export type GetStockInput = z.infer<typeof getStockSchema>;

export type StockMovementsInput = z.input<typeof stockMovementsSchema>;

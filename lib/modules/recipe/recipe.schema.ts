import { z } from "zod";
import { Unit } from "@/generated/prisma/client";

/**
 * ============================================================
 * RECIPE / INGREDIENTS
 * ============================================================
 */

/**
 * Identifiant du produit dont on veut gérer la recette.
 */
export const productRecipeIdSchema = z.object({
  productId: z.string().min(1, "L'identifiant du produit est requis"),
});

export type ProductRecipeIdInput = z.infer<typeof productRecipeIdSchema>;

/**
 * Identifiant d'un ingrédient de recette.
 */
export const recipeIngredientIdSchema = z.object({
  ingredientId: z.string().min(1, "L'identifiant de l'ingrédient est requis"),
});

export type RecipeIngredientIdInput = z.infer<typeof recipeIngredientIdSchema>;

/**
 * ============================================================
 * CREATE INGREDIENT
 * ============================================================
 */

export const createRecipeIngredientSchema = z.object({
  rawMaterialId: z.string().min(1, "La matière première est requise"),

  quantity: z
    .number({
      message: "La quantité doit être un nombre",
    })
    .positive("La quantité doit être supérieure à 0"),

  unit: z.enum(Unit, {
    message: "L'unité est invalide",
  }),
});

export type CreateRecipeIngredientInput = z.infer<
  typeof createRecipeIngredientSchema
>;

/**
 * ============================================================
 * UPDATE INGREDIENT
 * ============================================================
 */

export const updateRecipeIngredientSchema = z.object({
  rawMaterialId: z
    .string()
    .min(1, "La matière première est requise")
    .optional(),

  quantity: z
    .number({
      message: "La quantité doit être un nombre",
    })
    .positive("La quantité doit être supérieure à 0")
    .optional(),

  unit: z
    .enum(Unit, {
      message: "L'unité est invalide",
    })
    .optional(),
});

export type UpdateRecipeIngredientInput = z.infer<
  typeof updateRecipeIngredientSchema
>;

/**
 * ============================================================
 * REPLACE RECIPE
 * ============================================================
 *
 * Permet de remplacer l'ensemble des ingrédients
 * d'un produit en une seule opération.
 */

export const updateRecipeSchema = z.object({
  ingredients: z
    .array(
      z.object({
        rawMaterialId: z.string().min(1, "La matière première est requise"),

        quantity: z
          .number({
            message: "La quantité doit être un nombre",
          })
          .positive("La quantité doit être supérieure à 0"),

        unit: z.enum(Unit, {
          message: "L'unité est invalide",
        }),
      }),
    )
    .min(1, "La recette doit contenir au moins un ingrédient"),
});

export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

/**
 * ============================================================
 * LIST / SEARCH
 * ============================================================
 *
 * La liste des recettes correspond aux produits
 * possédant des ingrédients.
 */

export const getRecipesSchema = z.object({
  search: z.string().trim().max(100, "La recherche est trop longue").optional(),
});

export type GetRecipesInput = z.infer<typeof getRecipesSchema>;

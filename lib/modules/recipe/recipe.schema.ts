import { z } from "zod";
import { Unit } from "@/generated/prisma/client";

/**
 * Identifiant du produit
 */
export const productRecipeIdSchema = z.object({
  id: z.string().min(1, "L'identifiant du produit est requis"),
});

export type ProductRecipeIdInput = z.infer<typeof productRecipeIdSchema>;

/**
 * Ingrédient d'une recette
 */
export const recipeIngredientSchema = z.object({
  rawMaterialId: z.string().min(1, "La matière première est requise"),

  quantity: z
    .number({ message: "La quantité doit être un nombre" })
    .positive("La quantité doit être supérieure à 0"),

  unit: z.enum(Unit, {
    message: "L'unité est invalide",
  }),
});

export type RecipeIngredientInput = z.infer<typeof recipeIngredientSchema>;

/**
 * Création / modification complète d'une recette
 */
export const updateProductRecipeSchema = z.object({
  ingredients: z
    .array(recipeIngredientSchema)
    .min(1, "La recette doit contenir au moins un ingrédient"),
});

export type UpdateProductRecipeInput = z.infer<
  typeof updateProductRecipeSchema
>;

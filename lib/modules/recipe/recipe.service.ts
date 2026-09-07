import { prisma } from "@/lib/prisma";

import type {
  CreateRecipeIngredientInput,
  UpdateRecipeIngredientInput,
  UpdateRecipeInput,
} from "./recipe.schema";

/**
 * ============================================================
 * SHOP
 * ============================================================
 */

/**
 * Récupère la boutique unique du projet.
 */
const getMainShop = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  return shop;
};

/**
 * ============================================================
 * PRODUCT
 * ============================================================
 */

/**
 * Vérifie qu'un produit appartient bien à la boutique.
 */
const getProduct = async (productId: string) => {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return {
    shop,
    product,
  };
};

/**
 * ============================================================
 * GET RECIPE
 * ============================================================
 */

/**
 * Récupérer la recette complète d'un produit.
 *
 * Une recette correspond à l'ensemble de ses
 * RecipeIngredient.
 */
export const getProductRecipe = async (productId: string) => {
  const { product } = await getProduct(productId);

  const ingredients = await prisma.recipeIngredient.findMany({
    where: {
      productId: product.id,
    },
    include: {
      rawMaterial: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    product,
    ingredients,
  };
};

/**
 * ============================================================
 * CREATE INGREDIENT
 * ============================================================
 */

/**
 * Ajouter un ingrédient à la recette d'un produit.
 */
export const createRecipeIngredient = async (
  productId: string,
  data: CreateRecipeIngredientInput,
) => {
  const { shop, product } = await getProduct(productId);

  /**
   * Vérifie que la matière première appartient
   * bien à la même boutique.
   */
  const rawMaterial = await prisma.rawMaterial.findFirst({
    where: {
      id: data.rawMaterialId,
      shopId: shop.id,
    },
  });

  if (!rawMaterial) {
    throw new Error("RAW_MATERIAL_NOT_FOUND");
  }

  /**
   * Vérifie qu'une matière première n'est pas
   * déjà présente dans la recette.
   *
   * Correspond à @@unique([productId, rawMaterialId]).
   */
  const existingIngredient = await prisma.recipeIngredient.findUnique({
    where: {
      productId_rawMaterialId: {
        productId: product.id,
        rawMaterialId: data.rawMaterialId,
      },
    },
  });

  if (existingIngredient) {
    throw new Error("RECIPE_INGREDIENT_ALREADY_EXISTS");
  }

  /**
   * Vérifie que l'unité utilisée correspond à
   * l'unité de la matière première.
   */
  if (rawMaterial.unit !== data.unit) {
    throw new Error("RAW_MATERIAL_UNIT_MISMATCH");
  }

  const ingredient = await prisma.recipeIngredient.create({
    data: {
      productId: product.id,
      rawMaterialId: data.rawMaterialId,
      quantity: data.quantity,
      unit: data.unit,
    },
    include: {
      rawMaterial: true,
    },
  });

  return ingredient;
};

/**
 * ============================================================
 * UPDATE INGREDIENT
 * ============================================================
 */

/**
 * Modifier un ingrédient d'une recette.
 *
 * Vérifie que l'ingrédient appartient bien au produit
 * fourni dans l'URL.
 */
export const updateRecipeIngredient = async (
  productId: string,
  ingredientId: string,
  data: UpdateRecipeIngredientInput,
) => {
  const { shop, product } = await getProduct(productId);

  /**
   * Vérifie que l'ingrédient appartient bien
   * à ce produit.
   */
  const existingIngredient = await prisma.recipeIngredient.findFirst({
    where: {
      id: ingredientId,
      productId: product.id,
    },
    include: {
      rawMaterial: true,
    },
  });

  if (!existingIngredient) {
    throw new Error("RECIPE_INGREDIENT_NOT_FOUND");
  }

  /**
   * Si une nouvelle matière première est fournie,
   * on vérifie qu'elle appartient à la boutique.
   */
  let rawMaterial = existingIngredient.rawMaterial;

  if (
    data.rawMaterialId !== undefined &&
    data.rawMaterialId !== existingIngredient.rawMaterialId
  ) {
    const newRawMaterial = await prisma.rawMaterial.findFirst({
      where: {
        id: data.rawMaterialId,
        shopId: shop.id,
      },
    });

    if (!newRawMaterial) {
      throw new Error("RAW_MATERIAL_NOT_FOUND");
    }

    rawMaterial = newRawMaterial;
  }

  /**
   * L'unité finale doit correspondre à
   * l'unité de la matière première.
   */
  const unit = data.unit ?? existingIngredient.unit;

  if (rawMaterial.unit !== unit) {
    throw new Error("RAW_MATERIAL_UNIT_MISMATCH");
  }

  /**
   * Vérifie qu'on ne crée pas un doublon
   * [productId, rawMaterialId].
   */
  if (
    data.rawMaterialId !== undefined &&
    data.rawMaterialId !== existingIngredient.rawMaterialId
  ) {
    const duplicateIngredient = await prisma.recipeIngredient.findUnique({
      where: {
        productId_rawMaterialId: {
          productId: product.id,
          rawMaterialId: data.rawMaterialId,
        },
      },
    });

    if (duplicateIngredient) {
      throw new Error("RECIPE_INGREDIENT_ALREADY_EXISTS");
    }
  }

  const ingredient = await prisma.recipeIngredient.update({
    where: {
      id: ingredientId,
    },
    data: {
      ...(data.rawMaterialId !== undefined && {
        rawMaterialId: data.rawMaterialId,
      }),

      ...(data.quantity !== undefined && {
        quantity: data.quantity,
      }),

      ...(data.unit !== undefined && {
        unit: data.unit,
      }),
    },
    include: {
      rawMaterial: true,
    },
  });

  return ingredient;
};

/**
 * ============================================================
 * DELETE INGREDIENT
 * ============================================================
 */

/**
 * Supprimer un ingrédient d'une recette.
 *
 * Vérifie que l'ingrédient appartient bien au produit
 * fourni dans l'URL avant de le supprimer.
 */
export const deleteRecipeIngredient = async (
  productId: string,
  ingredientId: string,
) => {
  const { product } = await getProduct(productId);

  const existingIngredient = await prisma.recipeIngredient.findFirst({
    where: {
      id: ingredientId,
      productId: product.id,
    },
  });

  if (!existingIngredient) {
    throw new Error("RECIPE_INGREDIENT_NOT_FOUND");
  }

  await prisma.recipeIngredient.delete({
    where: {
      id: ingredientId,
    },
  });

  return {
    id: ingredientId,
  };
};

/**
 * ============================================================
 * REPLACE RECIPE
 * ============================================================
 */

/**
 * Remplacer complètement la recette d'un produit.
 *
 * Cette méthode permet d'envoyer toute la recette
 * en une seule opération.
 */
export const updateProductRecipe = async (
  productId: string,
  data: UpdateRecipeInput,
) => {
  const { shop, product } = await getProduct(productId);

  /**
   * Vérifie qu'il n'y a pas deux fois la même
   * matière première dans la recette.
   */
  const rawMaterialIds = data.ingredients.map(
    (ingredient) => ingredient.rawMaterialId,
  );

  if (new Set(rawMaterialIds).size !== rawMaterialIds.length) {
    throw new Error("RECIPE_DUPLICATE_RAW_MATERIAL");
  }

  /**
   * Récupère toutes les matières premières utilisées.
   */
  const rawMaterials = await prisma.rawMaterial.findMany({
    where: {
      id: {
        in: rawMaterialIds,
      },
      shopId: shop.id,
    },
  });

  /**
   * Vérifie que toutes les matières premières
   * existent dans la boutique.
   */
  if (rawMaterials.length !== rawMaterialIds.length) {
    throw new Error("RAW_MATERIAL_NOT_FOUND");
  }

  /**
   * Vérifie la cohérence des unités.
   */
  const rawMaterialMap = new Map(
    rawMaterials.map((rawMaterial) => [rawMaterial.id, rawMaterial]),
  );

  for (const ingredient of data.ingredients) {
    const rawMaterial = rawMaterialMap.get(ingredient.rawMaterialId);

    if (!rawMaterial) {
      throw new Error("RAW_MATERIAL_NOT_FOUND");
    }

    if (rawMaterial.unit !== ingredient.unit) {
      throw new Error("RAW_MATERIAL_UNIT_MISMATCH");
    }
  }

  /**
   * Transaction :
   *
   * 1. Supprime les anciens ingrédients.
   * 2. Crée les nouveaux.
   *
   * Ainsi, on ne risque pas d'avoir une recette
   * partiellement mise à jour.
   */
  await prisma.$transaction(async (tx) => {
    await tx.recipeIngredient.deleteMany({
      where: {
        productId: product.id,
      },
    });

    await tx.recipeIngredient.createMany({
      data: data.ingredients.map((ingredient) => ({
        productId: product.id,
        rawMaterialId: ingredient.rawMaterialId,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })),
    });
  });

  /**
   * Retourne la recette mise à jour avec
   * les matières premières.
   */
  const ingredients = await prisma.recipeIngredient.findMany({
    where: {
      productId: product.id,
    },
    include: {
      rawMaterial: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return {
    product,
    ingredients,
  };
};

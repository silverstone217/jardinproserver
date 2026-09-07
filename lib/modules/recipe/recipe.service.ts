import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";

import type { UpdateProductRecipeInput } from "./recipe.schema";

const recipeInclude = {
  rawMaterial: {
    select: {
      id: true,
      name: true,
      unit: true,
    },
  },
} satisfies Prisma.RecipeIngredientInclude;

type RecipeIngredientWithRelations = Prisma.RecipeIngredientGetPayload<{
  include: typeof recipeInclude;
}>;

/**
 * Récupère la boutique unique de l'application.
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
 * Récupère la recette d'un produit.
 *
 * Vérifie également que le produit appartient
 * bien à la boutique principale.
 */
export const getProductRecipe = async (productId: string) => {
  const shop = await getMainShop();

  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: {
      id: true,
      shopId: true,
      name: true,
      description: true,
      image: true,
      recipeVolumeMl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      ingredients: {
        include: recipeInclude,
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  return product;
};

/**
 * Crée ou remplace complètement la recette d'un produit.
 *
 * Toutes les matières premières doivent appartenir
 * à la boutique principale et être actives.
 */
export const updateProductRecipe = async (
  productId: string,
  data: UpdateProductRecipeInput,
): Promise<RecipeIngredientWithRelations[]> => {
  const shop = await getMainShop();

  /**
   * Vérifie que le produit existe
   * et appartient à la boutique.
   */
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      shopId: shop.id,
    },
    select: {
      id: true,
    },
  });

  if (!product) {
    throw new Error("PRODUCT_NOT_FOUND");
  }

  /**
   * Récupère les matières premières utilisées
   * dans la recette.
   */
  const rawMaterialIds = data.ingredients.map(
    (ingredient) => ingredient.rawMaterialId,
  );

  const rawMaterials = await prisma.rawMaterial.findMany({
    where: {
      id: {
        in: rawMaterialIds,
      },
      shopId: shop.id,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  /**
   * Vérifie que toutes les matières premières
   * envoyées existent bien dans la boutique.
   */
  if (rawMaterials.length !== rawMaterialIds.length) {
    throw new Error("INVALID_RAW_MATERIAL");
  }

  /**
   * Remplace complètement la recette dans
   * une transaction.
   */
  return prisma.$transaction(async (tx) => {
    await tx.recipeIngredient.deleteMany({
      where: {
        productId: product.id,
      },
    });

    await tx.recipeIngredient.createMany({
      data: data.ingredients.map((ingredient) => ({
        productId: product.id,
        rawMaterialId: ingredient.rawMaterialId,
        quantity: new Prisma.Decimal(ingredient.quantity),
        unit: ingredient.unit,
      })),
    });

    return tx.recipeIngredient.findMany({
      where: {
        productId: product.id,
      },
      include: recipeInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  });
};

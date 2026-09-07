import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";

import { authorize } from "@/lib/auth/permissions";

import {
  recipeIngredientIdSchema,
  updateRecipeIngredientSchema,
} from "@/lib/modules/recipe/recipe.schema";

import {
  deleteRecipeIngredient,
  updateRecipeIngredient,
} from "@/lib/modules/recipe/recipe.service";

type RouteContext = {
  params: Promise<{
    id: string;
    ingredientId: string;
  }>;
};

/**
 * ============================================================
 * PATCH /api/v1/products/:id/recipe/ingredients/:ingredientId
 * ============================================================
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authenticate(request);

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentification requise",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id, ingredientId } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (!ingredientId) {
      return NextResponse.json(
        {
          message: "L'identifiant de l'ingrédient est requis",
          code: "INGREDIENT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const ingredientInput = recipeIngredientIdSchema.parse({
      ingredientId,
    });

    const body = await request.json();

    const input = updateRecipeIngredientSchema.parse(body);

    const ingredient = await updateRecipeIngredient(
      id,
      ingredientInput.ingredientId,
      input,
    );

    return NextResponse.json(
      {
        message: "Ingrédient modifié avec succès",
        ingredient,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "PATCH /products/:id/recipe/ingredients/:ingredientId error:",
      error,
    );

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Authentification invalide",
            code: error.message,
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Accès refusé",
            code: "FORBIDDEN",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
            code: "SHOP_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "RECIPE_INGREDIENT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Ingrédient de recette introuvable",
            code: "RECIPE_INGREDIENT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
            code: "RAW_MATERIAL_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "RECIPE_INGREDIENT_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Cette matière première existe déjà dans la recette",
            code: "RECIPE_INGREDIENT_ALREADY_EXISTS",
          },
          { status: 409 },
        );
      }

      if (error.message === "RAW_MATERIAL_UNIT_MISMATCH") {
        return NextResponse.json(
          {
            message:
              "L'unité de l'ingrédient ne correspond pas à l'unité de la matière première",
            code: "RAW_MATERIAL_UNIT_MISMATCH",
          },
          { status: 400 },
        );
      }

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "Les données de l'ingrédient sont invalides",
            code: "VALIDATION_ERROR",
            errors: error,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message:
          "Une erreur est survenue lors de la modification de l'ingrédient",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * DELETE /api/v1/products/:id/recipe/ingredients/:ingredientId
 * ============================================================
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const user = authenticate(request);

    if (!user) {
      return NextResponse.json(
        {
          message: "Authentification requise",
          code: "AUTHENTICATION_REQUIRED",
        },
        { status: 401 },
      );
    }

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id, ingredientId } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (!ingredientId) {
      return NextResponse.json(
        {
          message: "L'identifiant de l'ingrédient est requis",
          code: "INGREDIENT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const ingredientInput = recipeIngredientIdSchema.parse({
      ingredientId,
    });

    const result = await deleteRecipeIngredient(
      id,
      ingredientInput.ingredientId,
    );

    return NextResponse.json(
      {
        message: "Ingrédient supprimé de la recette avec succès",
        ingredient: result,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "DELETE /products/:id/recipe/ingredients/:ingredientId error:",
      error,
    );

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Authentification invalide",
            code: error.message,
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Accès refusé",
            code: "FORBIDDEN",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
            code: "SHOP_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "RECIPE_INGREDIENT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Ingrédient de recette introuvable",
            code: "RECIPE_INGREDIENT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "L'identifiant de l'ingrédient est invalide",
            code: "VALIDATION_ERROR",
            errors: error,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message:
          "Une erreur est survenue lors de la suppression de l'ingrédient",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

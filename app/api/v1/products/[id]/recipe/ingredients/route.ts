import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  createRecipeIngredientSchema,
  productRecipeIdSchema,
} from "@/lib/modules/recipe/recipe.schema";

import {
  createRecipeIngredient,
  getProductRecipe,
} from "@/lib/modules/recipe/recipe.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * GET /api/v1/products/:id/recipe/ingredients
 * ============================================================
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const input = productRecipeIdSchema.parse({
      productId: id,
    });

    const recipe = await getProductRecipe(input.productId);

    return NextResponse.json(
      {
        message: "Ingrédients de la recette récupérés avec succès",
        ingredients: recipe.ingredients,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products/:id/recipe/ingredients error:", error);

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

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "L'identifiant du produit est invalide",
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
          "Une erreur est survenue lors de la récupération des ingrédients",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * POST /api/v1/products/:id/recipe/ingredients
 * ============================================================
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const productInput = productRecipeIdSchema.parse({
      productId: id,
    });

    const body = await request.json();

    const input = createRecipeIngredientSchema.parse(body);

    const ingredient = await createRecipeIngredient(
      productInput.productId,
      input,
    );

    return NextResponse.json(
      {
        message: "Ingrédient ajouté à la recette avec succès",
        ingredient,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /products/:id/recipe/ingredients error:", error);

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
        message: "Une erreur est survenue lors de l'ajout de l'ingrédient",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

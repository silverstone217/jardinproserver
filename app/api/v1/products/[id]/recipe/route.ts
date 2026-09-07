import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";

import { authorize } from "@/lib/auth/permissions";

import {
  productRecipeIdSchema,
  updateRecipeSchema,
} from "@/lib/modules/recipe/recipe.schema";

import {
  getProductRecipe,
  updateProductRecipe,
} from "@/lib/modules/recipe/recipe.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * GET /api/v1/products/:id/recipe
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
        message: "Recette récupérée avec succès",
        recipe,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products/:id/recipe error:", error);

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
          "Une erreur est survenue lors de la récupération de la recette",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * PUT /api/v1/products/:id/recipe
 * ============================================================
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
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

    const input = updateRecipeSchema.parse(body);

    const recipe = await updateProductRecipe(productInput.productId, input);

    return NextResponse.json(
      {
        message: "Recette modifiée avec succès",
        recipe,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PUT /products/:id/recipe error:", error);

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
            message: "Une ou plusieurs matières premières sont introuvables",
            code: "RAW_MATERIAL_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "RECIPE_DUPLICATE_RAW_MATERIAL") {
        return NextResponse.json(
          {
            message:
              "Une même matière première ne peut pas apparaître plusieurs fois dans la recette",
            code: "RECIPE_DUPLICATE_RAW_MATERIAL",
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
            message: "Les données de la recette sont invalides",
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
          "Une erreur est survenue lors de la modification de la recette",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

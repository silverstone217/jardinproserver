import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  getProductRecipe,
  updateProductRecipe,
} from "@/lib/modules/recipe/recipe.service";

import {
  productRecipeIdSchema,
  updateProductRecipeSchema,
} from "@/lib/modules/recipe/recipe.schema";

/**
 * GET /api/v1/products/:id/recipe
 *
 * Récupère la recette d'un produit.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id } = await params;

    const idValidation = productRecipeIdSchema.safeParse({
      id,
    });

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          errors: idValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const recipe = await getProductRecipe(idValidation.data.id);

    return NextResponse.json(
      {
        message: "Recette récupérée avec succès",
        recipe,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/products/:id/recipe:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/products/:id/recipe
 *
 * Crée ou remplace complètement la recette d'un produit.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id } = await params;

    const idValidation = productRecipeIdSchema.safeParse({
      id,
    });

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          errors: idValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = updateProductRecipeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const ingredients = await updateProductRecipe(
      idValidation.data.id,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Recette enregistrée avec succès",
        ingredients,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PUT /api/v1/products/:id/recipe:", error);

    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Session invalide ou expirée",
          },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "INVALID_RAW_MATERIAL") {
        return NextResponse.json(
          {
            message:
              "Une ou plusieurs matières premières sont invalides, inactives ou n'appartiennent pas à cette boutique",
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

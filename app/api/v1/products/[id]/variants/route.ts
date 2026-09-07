import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import { createProductVariantSchema } from "@/lib/modules/products/product.schema";

import {
  createProductVariant,
  getProductVariants,
} from "@/lib/modules/products/product.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * ============================================================
 * GET /api/v1/products/:id/variants
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

    const variants = await getProductVariants(id);

    return NextResponse.json(
      {
        message: "Variantes récupérées avec succès",
        variants,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products/:id/variants error:", error);

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
    }

    return NextResponse.json(
      {
        message:
          "Une erreur est survenue lors de la récupération des variantes",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * POST /api/v1/products/:id/variants
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

    const body = await request.json();

    const input = createProductVariantSchema.parse(body);

    const variant = await createProductVariant(id, input);

    return NextResponse.json(
      {
        message: "Variante créée avec succès",
        variant,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /products/:id/variants error:", error);

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

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
            code: "PACKAGING_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_SIZE_MISMATCH") {
        return NextResponse.json(
          {
            message:
              "L'emballage sélectionné ne correspond pas au format de la variante",
            code: "PACKAGING_SIZE_MISMATCH",
          },
          { status: 400 },
        );
      }

      if (error.message === "INVALID_VARIANT_VOLUME") {
        return NextResponse.json(
          {
            message: "Le volume ne correspond pas au format de la bouteille",
            code: "INVALID_VARIANT_VOLUME",
          },
          { status: 400 },
        );
      }

      if (error.message === "INVALID_BOTTLE_SIZE") {
        return NextResponse.json(
          {
            message: "Le format de bouteille est invalide",
            code: "INVALID_BOTTLE_SIZE",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Une variante avec ce format existe déjà pour ce produit",
            code: "PRODUCT_VARIANT_ALREADY_EXISTS",
          },
          { status: 409 },
        );
      }

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "Les données de la variante sont invalides",
            code: "VALIDATION_ERROR",
            errors: error,
          },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue lors de la création de la variante",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

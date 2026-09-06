import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import { updateProductVariantSchema } from "@/lib/modules/products/product.schema";

import {
  getProductVariantById,
  updateProductVariant,
} from "@/lib/modules/products/product.service";

type RouteContext = {
  params: Promise<{
    id: string;
    variantId: string;
  }>;
};

/**
 * ============================================================
 * GET /api/v1/products/:id/variants/:variantId
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

    const { id, variantId } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (!variantId) {
      return NextResponse.json(
        {
          message: "L'identifiant de la variante est requis",
          code: "PRODUCT_VARIANT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const variant = await getProductVariantById(id, variantId);

    return NextResponse.json(
      {
        message: "Variante récupérée avec succès",
        variant,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /products/:id/variants/:variantId error:", error);

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

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Variante introuvable",
            code: "PRODUCT_VARIANT_NOT_FOUND",
          },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      {
        message:
          "Une erreur est survenue lors de la récupération de la variante",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * ============================================================
 * PATCH /api/v1/products/:id/variants/:variantId
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

    const { id, variantId } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "L'identifiant du produit est requis",
          code: "PRODUCT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (!variantId) {
      return NextResponse.json(
        {
          message: "L'identifiant de la variante est requis",
          code: "PRODUCT_VARIANT_ID_REQUIRED",
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const input = updateProductVariantSchema.parse(body);

    const variant = await updateProductVariant(id, variantId, input);

    return NextResponse.json(
      {
        message: "Variante modifiée avec succès",
        variant,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /products/:id/variants/:variantId error:", error);

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

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Variante introuvable",
            code: "PRODUCT_VARIANT_NOT_FOUND",
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
        message:
          "Une erreur est survenue lors de la modification de la variante",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

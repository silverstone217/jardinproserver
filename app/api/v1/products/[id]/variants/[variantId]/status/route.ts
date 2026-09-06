import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { updateProductVariantStatusSchema } from "@/lib/modules/products/product.schema";
import { updateProductVariantStatus } from "@/lib/modules/products/product.service";

type RouteContext = {
  params: Promise<{
    id: string;
    variantId: string;
  }>;
};

/**
 * ============================================================
 * PATCH /api/v1/products/:id/variants/:variantId/status
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

    const input = updateProductVariantStatusSchema.parse(body);

    const variant = await updateProductVariantStatus(id, variantId, input);

    return NextResponse.json(
      {
        message: input.isActive
          ? "Variante activée avec succès"
          : "Variante désactivée avec succès",
        variant,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error(
      "PATCH /products/:id/variants/:variantId/status error:",
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

      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Variante introuvable",
            code: "PRODUCT_VARIANT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (error.name === "ZodError") {
        return NextResponse.json(
          {
            message: "Le statut de la variante est invalide",
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
          "Une erreur est survenue lors de la modification du statut de la variante",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

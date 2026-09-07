import { NextRequest, NextResponse } from "next/server";

import { ProductionStatus, Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";

import { authorize } from "@/lib/auth/permissions";

import {
  cancelProduction,
  completeProduction,
  createProduction,
  getProductions,
  startProduction,
} from "@/lib/modules/production/production.service";

import {
  createProductionSchema,
  productionActionSchema,
} from "@/lib/modules/production/production.schema";

/**
 * ============================================================
 * GET /api/v1/production
 * ============================================================
 *
 * Query params:
 * - status
 * - productId
 * - limit
 * - offset
 */
export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status");
    const productId = searchParams.get("productId") || undefined;

    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    let status: ProductionStatus | undefined;

    /**
     * ========================================================
     * STATUS
     * ========================================================
     */
    if (statusParam) {
      if (
        !Object.values(ProductionStatus).includes(
          statusParam as ProductionStatus,
        )
      ) {
        return NextResponse.json(
          {
            message: "Le statut de production est invalide",
          },
          { status: 400 },
        );
      }

      status = statusParam as ProductionStatus;
    }

    /**
     * ========================================================
     * PAGINATION
     * ========================================================
     */
    let limit: number | undefined;
    let offset: number | undefined;

    if (limitParam !== null) {
      const parsedLimit = Number(limitParam);

      if (
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100
      ) {
        return NextResponse.json(
          {
            message: "La limite doit être un entier compris entre 1 et 100",
          },
          { status: 400 },
        );
      }

      limit = parsedLimit;
    }

    if (offsetParam !== null) {
      const parsedOffset = Number(offsetParam);

      if (!Number.isInteger(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json(
          {
            message: "L'offset doit être un entier supérieur ou égal à 0",
          },
          { status: 400 },
        );
      }

      offset = parsedOffset;
    }

    /**
     * ========================================================
     * GET PRODUCTIONS
     * ========================================================
     */
    const productions = await getProductions({
      status,
      productId,
      limit,
      offset,
    });

    return NextResponse.json(
      {
        message: "Productions récupérées avec succès",
        productions,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/production:", error);

    if (error instanceof Error) {
      /**
       * ======================================================
       * AUTHENTICATION
       * ======================================================
       */
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

      /**
       * ======================================================
       * PERMISSIONS
       * ======================================================
       */
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      /**
       * ======================================================
       * SHOP
       * ======================================================
       */
      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
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
 * ============================================================
 * POST /api/v1/production
 * ============================================================
 *
 * Crée une production.
 *
 * La création ne modifie pas le stock.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    /**
     * ========================================================
     * VALIDATION
     * ========================================================
     */
    const validation = createProductionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    /**
     * ========================================================
     * CREATE PRODUCTION
     * ========================================================
     */
    const production = await createProduction(user.userId, validation.data);

    return NextResponse.json(
      {
        message: "Production créée avec succès",
        production,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/v1/production:", error);

    if (error instanceof Error) {
      /**
       * ======================================================
       * AUTHENTICATION
       * ======================================================
       */
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

      /**
       * ======================================================
       * PERMISSIONS
       * ======================================================
       */
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      /**
       * ======================================================
       * SHOP
       * ======================================================
       */
      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      /**
       * ======================================================
       * PRODUCT
       * ======================================================
       */
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Ce produit est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * RECIPE
       * ======================================================
       */
      if (error.message === "RECIPE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune recette n'est configurée pour ce produit",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * RAW MATERIAL
       * ======================================================
       */
      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_INACTIVE") {
        return NextResponse.json(
          {
            message: "Une matière première utilisée est désactivée",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCT VARIANT
       * ======================================================
       */
      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Format de produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_PRODUCT_MISMATCH") {
        return NextResponse.json(
          {
            message: "Un format de sortie n'appartient pas à ce produit",
          },
          { status: 409 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Un format de sortie est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PACKAGING
       * ======================================================
       */
      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_INACTIVE") {
        return NextResponse.json(
          {
            message: "Un emballage utilisé est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * RECIPE VALIDATION
       * ======================================================
       */
      if (error.message === "RECIPE_INGREDIENT_UNIT_MISMATCH") {
        return NextResponse.json(
          {
            message:
              "L'unité d'une matière première ne correspond pas à celle de la recette",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVALID_RECIPE_VOLUME") {
        return NextResponse.json(
          {
            message: "Le volume de recette est invalide",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVALID_PRODUCT_VARIANT_VOLUME") {
        return NextResponse.json(
          {
            message: "Le volume d'un format de produit est invalide",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVALID_RECIPE_INGREDIENT_QUANTITY") {
        return NextResponse.json(
          {
            message: "La quantité d'un ingrédient de la recette est invalide",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCTION VALIDATION
       * ======================================================
       */
      if (
        error.message === "INVALID_PRODUCTION_QUANTITY" ||
        error.message === "INVALID_PRODUCTION_OUTPUT_QUANTITY"
      ) {
        return NextResponse.json(
          {
            message: "La quantité de production est invalide",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCTION_OUTPUTS_REQUIRED") {
        return NextResponse.json(
          {
            message: "La production doit avoir au moins une sortie",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCTION VOLUME
       * ======================================================
       */
      if (error.message.startsWith("INVALID_PRODUCTION_VOLUME:")) {
        const [, expected, actual] = error.message.split(":");

        return NextResponse.json(
          {
            message:
              "Le volume total des sorties ne correspond pas au volume prévu",
            expectedVolume: Number(expected),
            actualVolume: Number(actual),
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

/**
 * ============================================================
 * PATCH /api/v1/production
 * ============================================================
 *
 * Actions:
 * - START
 * - COMPLETE
 * - CANCEL
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    /**
     * ========================================================
     * VALIDATION
     * ========================================================
     */
    const validation = productionActionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const { id, action } = validation.data;

    /**
     * ========================================================
     * PRODUCTION ACTION
     * ========================================================
     */
    let production;

    switch (action) {
      case "START":
        production = await startProduction(id);
        break;

      case "COMPLETE":
        production = await completeProduction(id);
        break;

      case "CANCEL":
        production = await cancelProduction(id);
        break;
    }

    return NextResponse.json(
      {
        message:
          action === "START"
            ? "Production démarrée avec succès"
            : action === "COMPLETE"
              ? "Production terminée avec succès"
              : "Production annulée avec succès",
        production,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/production:", error);

    if (error instanceof Error) {
      /**
       * ======================================================
       * AUTHENTICATION
       * ======================================================
       */
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

      /**
       * ======================================================
       * PERMISSIONS
       * ======================================================
       */
      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "Vous n'avez pas les permissions nécessaires",
          },
          { status: 403 },
        );
      }

      /**
       * ======================================================
       * SHOP
       * ======================================================
       */
      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune boutique configurée",
          },
          { status: 404 },
        );
      }

      /**
       * ======================================================
       * PRODUCTION
       * ======================================================
       */
      if (error.message === "PRODUCTION_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Production introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCTION_CANNOT_BE_STARTED") {
        return NextResponse.json(
          {
            message:
              "Cette production ne peut pas être démarrée dans son état actuel",
          },
          { status: 409 },
        );
      }

      if (error.message === "PRODUCTION_CANNOT_BE_COMPLETED") {
        return NextResponse.json(
          {
            message:
              "Cette production ne peut pas être terminée dans son état actuel",
          },
          { status: 409 },
        );
      }

      if (error.message === "PRODUCTION_CANNOT_BE_CANCELLED") {
        return NextResponse.json(
          {
            message:
              "Cette production ne peut pas être annulée dans son état actuel",
          },
          { status: 409 },
        );
      }

      if (error.message === "PRODUCTION_ALREADY_CANCELLED") {
        return NextResponse.json(
          {
            message: "Cette production est déjà annulée",
          },
          { status: 409 },
        );
      }

      if (error.message === "COMPLETED_PRODUCTION_CANNOT_BE_CANCELLED") {
        return NextResponse.json(
          {
            message: "Une production terminée ne peut pas être annulée",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCT
       * ======================================================
       */
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Ce produit est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * RECIPE
       * ======================================================
       */
      if (error.message === "RECIPE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Aucune recette n'est configurée pour ce produit",
          },
          { status: 409 },
        );
      }

      if (error.message === "RECIPE_INGREDIENT_UNIT_MISMATCH") {
        return NextResponse.json(
          {
            message:
              "L'unité d'une matière première ne correspond pas à celle de la recette",
          },
          { status: 409 },
        );
      }

      if (error.message === "RAW_MATERIAL_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Matière première introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "RAW_MATERIAL_INACTIVE") {
        return NextResponse.json(
          {
            message: "Une matière première utilisée est désactivée",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCT VARIANT
       * ======================================================
       */
      if (error.message === "PRODUCT_VARIANT_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Format de produit introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_PRODUCT_MISMATCH") {
        return NextResponse.json(
          {
            message: "Un format de sortie n'appartient pas à ce produit",
          },
          { status: 409 },
        );
      }

      if (error.message === "PRODUCT_VARIANT_INACTIVE") {
        return NextResponse.json(
          {
            message: "Un format de sortie est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PACKAGING
       * ======================================================
       */
      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_INACTIVE") {
        return NextResponse.json(
          {
            message: "Un emballage utilisé est désactivé",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * RECIPE / VOLUME
       * ======================================================
       */
      if (error.message === "INVALID_RECIPE_VOLUME") {
        return NextResponse.json(
          {
            message: "Le volume de recette est invalide",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVALID_PRODUCT_VARIANT_VOLUME") {
        return NextResponse.json(
          {
            message: "Le volume d'un format de produit est invalide",
          },
          { status: 409 },
        );
      }

      if (error.message === "INVALID_RECIPE_INGREDIENT_QUANTITY") {
        return NextResponse.json(
          {
            message: "La quantité d'un ingrédient de la recette est invalide",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCTION VALIDATION
       * ======================================================
       */
      if (
        error.message === "INVALID_PRODUCTION_QUANTITY" ||
        error.message === "INVALID_PRODUCTION_OUTPUT_QUANTITY"
      ) {
        return NextResponse.json(
          {
            message: "La quantité de production est invalide",
          },
          { status: 400 },
        );
      }

      if (error.message === "PRODUCTION_OUTPUTS_REQUIRED") {
        return NextResponse.json(
          {
            message: "La production doit avoir au moins une sortie",
          },
          { status: 409 },
        );
      }

      /**
       * ======================================================
       * PRODUCTION VOLUME
       * ======================================================
       */
      if (error.message.startsWith("INVALID_PRODUCTION_VOLUME:")) {
        const [, expected, actual] = error.message.split(":");

        return NextResponse.json(
          {
            message:
              "Le volume total des sorties ne correspond pas au volume prévu",
            expectedVolume: Number(expected),
            actualVolume: Number(actual),
          },
          { status: 400 },
        );
      }

      /**
       * ======================================================
       * STOCK
       * ======================================================
       */
      if (error.message.startsWith("INSUFFICIENT_STOCK:")) {
        const [, available, requested] = error.message.split(":");

        return NextResponse.json(
          {
            message: "Stock insuffisant pour terminer la production",
            available: Number(available),
            requested: Number(requested),
          },
          { status: 409 },
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

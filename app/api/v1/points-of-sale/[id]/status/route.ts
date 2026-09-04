import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import { updatePointOfSaleStatusSchema } from "@/lib/modules/point-of-sale/point-of-sale.schema";
import { updatePointOfSaleStatus } from "@/lib/modules/point-of-sale/point-of-sale.service";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * PATCH /api/v1/points-of-sale/:id/status
 *
 * Active ou désactive un point de vente.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    // Authentification
    const user = authenticate(request);

    // Seul le manager peut modifier le statut
    authorize(user.role, Role.MANAGER);

    // Récupération de l'identifiant
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          message: "Identifiant du point de vente requis",
        },
        { status: 400 },
      );
    }

    // Lecture du body
    const body = await request.json();

    // Validation
    const validation = updatePointOfSaleStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    // Mise à jour du statut
    const pointOfSale = await updatePointOfSaleStatus(id, validation.data);

    return NextResponse.json(
      {
        message: validation.data.isActive
          ? "Point de vente activé avec succès"
          : "Point de vente désactivé avec succès",
        pointOfSale,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "AUTHENTICATION_REQUIRED":
        case "INVALID_AUTHORIZATION_HEADER":
        case "INVALID_TOKEN":
        case "INVALID_OR_EXPIRED_TOKEN":
          return NextResponse.json(
            {
              message: "Session invalide ou expirée",
            },
            { status: 401 },
          );

        case "FORBIDDEN":
          return NextResponse.json(
            {
              message: "Vous n'avez pas les permissions nécessaires",
            },
            { status: 403 },
          );

        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Aucune boutique n'a été configurée",
            },
            { status: 404 },
          );

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Point de vente introuvable",
            },
            { status: 404 },
          );
      }
    }

    console.error("Update point of sale status error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

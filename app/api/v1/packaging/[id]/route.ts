import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  getPackagingById,
  updatePackaging,
} from "@/lib/modules/packaging/packaging.service";

import {
  packagingIdSchema,
  updatePackagingSchema,
} from "@/lib/modules/packaging/packaging.schema";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id } = await context.params;

    const validation = packagingIdSchema.safeParse({ id });

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Identifiant invalide",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const packaging = await getPackagingById(validation.data.id);

    return NextResponse.json(
      {
        message: "Emballage récupéré avec succès",
        packaging,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/packaging/[id]:", error);

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

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
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

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const { id } = await context.params;

    const idValidation = packagingIdSchema.safeParse({
      id,
    });

    if (!idValidation.success) {
      return NextResponse.json(
        {
          message: "Identifiant invalide",
          errors: idValidation.error.issues,
        },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validation = updatePackagingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const packaging = await updatePackaging(
      idValidation.data.id,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Emballage modifié avec succès",
        packaging,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("PATCH /api/v1/packaging/[id]:", error);

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

      if (error.message === "PACKAGING_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Emballage introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "PACKAGING_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Un emballage avec ce nom et cette taille existe déjà",
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

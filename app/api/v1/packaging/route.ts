import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";

import {
  createPackaging,
  getPackagings,
} from "@/lib/modules/packaging/packaging.service";
import { createPackagingSchema } from "@/lib/modules/packaging/packaging.schema";

export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const packagings = await getPackagings();

    return NextResponse.json(
      {
        message: "Emballages récupérés avec succès",
        packagings,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /api/v1/packaging:", error);

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
    }

    return NextResponse.json(
      {
        message: "Une erreur est survenue",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER, Role.ADMIN);

    const body = await request.json();

    const validation = createPackagingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const packaging = await createPackaging(validation.data);

    return NextResponse.json(
      {
        message: "Emballage créé avec succès",
        packaging,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/v1/packaging:", error);

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

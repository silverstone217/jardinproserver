import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { createStaffAssignmentSchema } from "@/lib/modules/employees/staff-assignment/staff-assignment.schema";
import { Role } from "@/generated/prisma/enums";
import {
  createStaffAssignment,
  endStaffAssignment,
} from "@/lib/modules/employees/staff-assignment/staff-assignment.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Affecter un employé à un point de vente.
 *
 * PATCH /api/v1/employees/:id/assignment
 *
 * Body :
 * {
 *   "pointOfSaleId": "..."
 * }
 *
 * ou
 *
 * {
 *   "pointOfSaleId": null
 * }
 *
 * Le manager peut également s'affecter lui-même.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const body = await request.json();

    const validated = createStaffAssignmentSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          message: "Données invalides",
          errors: validated.error.flatten(),
        },
        { status: 400 },
      );
    }

    const assignment = await createStaffAssignment(
      id,
      validated.data,
      user.userId,
    );

    return NextResponse.json(
      {
        message: "Affectation créée avec succès",
        assignment,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("PATCH /employees/[id]/assignment:", error);

    if (
      error instanceof Error &&
      [
        "AUTHENTICATION_REQUIRED",
        "INVALID_AUTHORIZATION_HEADER",
        "INVALID_TOKEN",
        "INVALID_OR_EXPIRED_TOKEN",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ message: "Accès interdit" }, { status: 403 });
    }

    if (error instanceof Error) {
      switch (error.message) {
        case "SHOP_NOT_FOUND":
          return NextResponse.json(
            { message: "La boutique n'existe pas" },
            { status: 404 },
          );

        case "USER_NOT_FOUND":
          return NextResponse.json(
            { message: "Utilisateur introuvable" },
            { status: 404 },
          );

        case "USER_NOT_ASSIGNABLE":
          return NextResponse.json(
            {
              message:
                "Cet utilisateur ne peut pas être affecté à un point de vente",
            },
            { status: 400 },
          );

        case "USER_IS_BANNED":
          return NextResponse.json(
            {
              message: "Cet utilisateur est banni et ne peut pas être affecté",
            },
            { status: 400 },
          );

        case "POINT_OF_SALE_NOT_FOUND":
          return NextResponse.json(
            { message: "Point de vente introuvable" },
            { status: 404 },
          );

        case "POINT_OF_SALE_INACTIVE":
          return NextResponse.json(
            {
              message:
                "Ce point de vente est inactif et ne peut pas recevoir d'affectation",
            },
            { status: 400 },
          );

        case "ACTIVE_ASSIGNMENT_ALREADY_EXISTS":
          return NextResponse.json(
            {
              message: "Cet utilisateur possède déjà une affectation active",
            },
            { status: 409 },
          );
      }
    }

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}

/**
 * Terminer l'affectation active d'un employé.
 *
 * DELETE /api/v1/employees/:id/assignment
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const assignment = await endStaffAssignment(id);

    return NextResponse.json({
      message: "Affectation terminée avec succès",
      assignment,
    });
  } catch (error) {
    console.error("DELETE /employees/[id]/assignment:", error);

    if (
      error instanceof Error &&
      [
        "AUTHENTICATION_REQUIRED",
        "INVALID_AUTHORIZATION_HEADER",
        "INVALID_TOKEN",
        "INVALID_OR_EXPIRED_TOKEN",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        { message: "Authentification requise" },
        { status: 401 },
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ message: "Accès interdit" }, { status: 403 });
    }

    if (error instanceof Error) {
      switch (error.message) {
        case "ACTIVE_ASSIGNMENT_NOT_FOUND":
          return NextResponse.json(
            {
              message: "Cet utilisateur n'a aucune affectation active",
            },
            { status: 404 },
          );
      }
    }

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}

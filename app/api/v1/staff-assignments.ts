import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { getStaffAssignments } from "@/lib/modules/employees/staff-assignment/staff-assignment.service";

export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const assignments = await getStaffAssignments();

    return NextResponse.json(
      {
        message: "Affectations récupérées avec succès",
        assignments,
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
              message: "La boutique n'existe pas",
            },
            { status: 404 },
          );
      }
    }

    console.error("GET /api/v1/staff-assignments:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

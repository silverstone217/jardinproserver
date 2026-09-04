import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { Role } from "@/generated/prisma/enums";

import { getStaffAssignments } from "@/lib/modules/employees/staff-assignment/staff-assignment.service";

export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const assignments = await getStaffAssignments();

    return NextResponse.json(
      {
        assignments,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("GET /staff-assignments:", error);

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

    if (error instanceof Error && error.message === "SHOP_NOT_FOUND") {
      return NextResponse.json(
        { message: "La boutique n'existe pas" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}

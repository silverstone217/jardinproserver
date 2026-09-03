import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import {
  createEmployee,
  getEmployees,
} from "@/lib/modules/employees/employee.service";
import { createEmployeeSchema } from "@/lib/modules/employees/employee.schema";

/**
 * GET /api/v1/employees
 *
 * Récupérer la liste des employés.
 */
export async function GET(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const employees = await getEmployees();

    return NextResponse.json(
      {
        employees,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          { message: "Authentication required" },
          { status: 401 },
        );
      }

      if (
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          { message: "Invalid or expired token" },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "You do not have permission to access this resource",
          },
          { status: 403 },
        );
      }
    }

    console.error("Get employees error:", error);

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/v1/employees
 *
 * Créer un nouvel employé.
 */
export async function POST(request: NextRequest) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const body = await request.json();

    const validated = createEmployeeSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json({ message }, { status: 400 });
    }

    const employee = await createEmployee(validated.data);

    return NextResponse.json(
      {
        message: "Employé créé avec succès",
        employee,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          { message: "Authentication required" },
          { status: 401 },
        );
      }

      if (
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          { message: "Invalid or expired token" },
          { status: 401 },
        );
      }

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "You do not have permission to access this resource",
          },
          { status: 403 },
        );
      }

      if (error.message === "TELEPHONE_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Ce numéro de téléphone est déjà utilisé",
          },
          { status: 409 },
        );
      }

      if (error.message === "EMAIL_ALREADY_EXISTS") {
        return NextResponse.json(
          {
            message: "Cette adresse email est déjà utilisée",
          },
          { status: 409 },
        );
      }
    }

    console.error("Create employee error:", error);

    return NextResponse.json(
      { message: "Une erreur interne est survenue" },
      { status: 500 },
    );
  }
}

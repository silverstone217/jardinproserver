import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/client";
import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import {
  getEmployeeById,
  updateEmployee,
} from "@/lib/modules/employees/employee.service";
import { updateEmployeeSchema } from "@/lib/modules/employees/employee.schema";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/v1/employees/[id]
 *
 * Récupérer un employé.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const employee = await getEmployeeById(id);

    return NextResponse.json(
      {
        employee,
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

      if (error.message === "EMPLOYEE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Employé introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "USER_IS_NOT_AN_EMPLOYEE") {
        return NextResponse.json(
          {
            message: "Cet utilisateur n'est pas un employé",
          },
          { status: 400 },
        );
      }
    }

    console.error("Get employee error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/v1/employees/[id]
 *
 * Modifier les informations d'un employé.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const user = authenticate(request);

    authorize(user.role, Role.MANAGER);

    const { id } = await context.params;

    const body = await request.json();

    const validated = updateEmployeeSchema.safeParse(body);

    if (!validated.success) {
      const message = validated.error.issues
        .map((issue) => issue.message)
        .join(" | ");

      return NextResponse.json({ message }, { status: 400 });
    }

    const employee = await updateEmployee(id, validated.data);

    return NextResponse.json(
      {
        message: "Employé modifié avec succès",
        employee,
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

      if (error.message === "EMPLOYEE_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Employé introuvable",
          },
          { status: 404 },
        );
      }

      if (error.message === "USER_IS_NOT_AN_EMPLOYEE") {
        return NextResponse.json(
          {
            message: "Cet utilisateur n'est pas un employé",
          },
          { status: 400 },
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

    console.error("Update employee error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

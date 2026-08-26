import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth/authentification";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const user = requireAuth(request, Role.MANAGER);

    const { id } = await context.params;

    return NextResponse.json(
      {
        message: `Delete employee ${id}`,
        managerId: user.userId,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "AUTHENTICATION_REQUIRED" ||
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Authentication required",
          },
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

    console.error("Delete employee error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { Role } from "@/generated/prisma/client";

import { authenticate } from "@/lib/auth/auth";
import { authorize } from "@/lib/auth/permissions";
import { cloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    const user = authenticate(request);

    // ============================================================
    // AUTORISATION
    // ============================================================

    authorize(user.role, Role.MANAGER);

    // ============================================================
    // RÉCUPÉRATION DU FICHIER
    // ============================================================

    const formData = await request.formData();
    const logo = formData.get("logo");

    if (!(logo instanceof File)) {
      return NextResponse.json(
        {
          message: "Aucun logo valide n'a été fourni.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // VALIDATION DU FORMAT
    // ============================================================

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(logo.type)) {
      return NextResponse.json(
        {
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // VALIDATION DE LA TAILLE
    // ============================================================

    const MAX_LOGO_SIZE = 2 * 1024 * 1024;

    if (logo.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        {
          message: "Le logo ne doit pas dépasser 2 Mo.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // RÉCUPÉRATION DE LA BOUTIQUE
    // ============================================================

    const shop = await prisma.shop.findUnique({
      where: {
        singleton: "MAIN",
      },
    });

    if (!shop) {
      throw new Error("SHOP_NOT_FOUND");
    }

    // ============================================================
    // FILE → BUFFER
    // ============================================================

    const arrayBuffer = await logo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ============================================================
    // UPLOAD CLOUDINARY
    // ============================================================

    const uploadResult = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "jardin-pro/shop",
          public_id: "shop-logo",
          overwrite: true,
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error("CLOUDINARY_UPLOAD_FAILED"));
            return;
          }

          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        },
      );

      uploadStream.end(buffer);
    });

    // ============================================================
    // MISE À JOUR DE LA BOUTIQUE
    // ============================================================

    const updatedShop = await prisma.shop.update({
      where: {
        singleton: "MAIN",
      },
      data: {
        logo: uploadResult.secure_url,
      },
    });

    // ============================================================
    // RÉPONSE
    // ============================================================

    return NextResponse.json(
      {
        message: "Logo modifié avec succès",
        shop: updatedShop,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error) {
      // ----------------------------------------------------------
      // AUTHENTIFICATION
      // ----------------------------------------------------------

      if (error.message === "AUTHENTICATION_REQUIRED") {
        return NextResponse.json(
          {
            message: "Authentication required",
          },
          { status: 401 },
        );
      }

      if (
        error.message === "INVALID_AUTHORIZATION_HEADER" ||
        error.message === "INVALID_TOKEN" ||
        error.message === "INVALID_OR_EXPIRED_TOKEN"
      ) {
        return NextResponse.json(
          {
            message: "Invalid or expired token",
          },
          { status: 401 },
        );
      }

      // ----------------------------------------------------------
      // AUTORISATION
      // ----------------------------------------------------------

      if (error.message === "FORBIDDEN") {
        return NextResponse.json(
          {
            message: "You do not have permission to access this resource",
          },
          { status: 403 },
        );
      }

      // ----------------------------------------------------------
      // BOUTIQUE
      // ----------------------------------------------------------

      if (error.message === "SHOP_NOT_FOUND") {
        return NextResponse.json(
          {
            message: "Boutique introuvable",
          },
          { status: 404 },
        );
      }
    }

    console.error("Update shop logo error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

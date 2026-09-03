import { NextRequest, NextResponse } from "next/server";

import { authenticate } from "@/lib/auth/auth";
import { cloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    // ============================================================
    // AUTHENTIFICATION
    // ============================================================

    const user = authenticate(request);

    // ============================================================
    // RÉCUPÉRATION DU FICHIER
    // ============================================================

    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        {
          message: "Aucune image valide n'a été fournie.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // VALIDATION
    // ============================================================

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(image.type)) {
      return NextResponse.json(
        {
          message: "Format d'image non supporté. Utilisez JPG, PNG ou WebP.",
        },
        { status: 400 },
      );
    }

    // 2 Mo maximum
    if (image.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        {
          message: "L'image ne doit pas dépasser 2 Mo.",
        },
        { status: 400 },
      );
    }

    // ============================================================
    // CONVERSION FILE → BUFFER
    // ============================================================

    const arrayBuffer = await image.arrayBuffer();
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
          folder: "jardin-pro/profile",
          public_id: user.userId,
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
    // ENREGISTREMENT DE L'URL DANS PRISMA
    // ============================================================

    const updatedUser = await prisma.user.update({
      where: {
        id: user.userId,
      },
      data: {
        image: uploadResult.secure_url,
      },
      select: {
        id: true,
        name: true,
        email: true,
        telephone: true,
        image: true,
        role: true,
      },
    });

    // ============================================================
    // RÉPONSE
    // ============================================================

    return NextResponse.json(
      {
        message: "Photo de profil modifiée avec succès",
        user: updatedUser,
      },
      { status: 200 },
    );
  } catch (error) {
    // ============================================================
    // ERREURS D'AUTHENTIFICATION
    // ============================================================

    if (error instanceof Error) {
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
    }

    console.error("Update profile image error:", error);

    return NextResponse.json(
      {
        message: "Une erreur interne est survenue",
      },
      { status: 500 },
    );
  }
}

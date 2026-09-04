import { prisma } from "@/lib/prisma";
import type { CreateStaffAssignmentInput } from "./staff-assignment.schema";

/**
 * Affecter un utilisateur à un point de vente.
 *
 * Règles métier :
 * - l'utilisateur doit exister ;
 * - le point de vente doit exister ;
 * - le point de vente doit appartenir à la boutique ;
 * - le point de vente doit être actif ;
 * - l'utilisateur ne doit pas déjà avoir une affectation active ;
 * - une nouvelle affectation est créée avec isActive = true.
 */
export async function createStaffAssignment(data: CreateStaffAssignmentInput) {
  const { userId, pointOfSaleId } = data;

  // Vérifier que l'utilisateur existe
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      telephone: true,
      role: true,
      isBanned: true,
    },
  });

  if (!user) {
    throw new Error("Personnel introuvable.");
  }

  // Un utilisateur banni ne peut pas être affecté
  if (user.isBanned) {
    throw new Error("Ce personnel est actuellement banni.");
  }

  // Vérifier que le point de vente existe
  const pointOfSale = await prisma.pointOfSale.findUnique({
    where: {
      id: pointOfSaleId,
    },
    select: {
      id: true,
      shopId: true,
      name: true,
      code: true,
      isActive: true,
    },
  });

  if (!pointOfSale) {
    throw new Error("Point de vente introuvable.");
  }

  // Le point de vente doit être actif
  if (!pointOfSale.isActive) {
    throw new Error("Ce point de vente est actuellement désactivé.");
  }

  // Vérifier si le personnel possède déjà une affectation active
  const activeAssignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (activeAssignment) {
    throw new Error(
      `Ce personnel est déjà affecté au point de vente "${activeAssignment.pointOfSale.name}".`,
    );
  }

  // Créer l'affectation
  const assignment = await prisma.staffAssignment.create({
    data: {
      userId,
      shopId: pointOfSale.shopId,
      pointOfSaleId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          image: true,
          role: true,
        },
      },
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          telephone: true,
          address: true,
        },
      },
    },
  });

  return assignment;
}

/**
 * Désaffecter un personnel.
 *
 * On ne supprime pas l'affectation afin de conserver l'historique.
 * On passe simplement isActive à false.
 */
export async function deactivateStaffAssignment(assignmentId: string) {
  const assignment = await prisma.staffAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    select: {
      id: true,
      userId: true,
      shopId: true,
      pointOfSaleId: true,
      isActive: true,
    },
  });

  if (!assignment) {
    throw new Error("Affectation introuvable.");
  }

  if (!assignment.isActive) {
    throw new Error("Cette affectation est déjà désactivée.");
  }

  const updatedAssignment = await prisma.staffAssignment.update({
    where: {
      id: assignmentId,
    },
    data: {
      isActive: false,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          image: true,
          role: true,
        },
      },
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          telephone: true,
          address: true,
        },
      },
    },
  });

  return updatedAssignment;
}

/**
 * Récupérer une affectation par son ID.
 */
export async function getStaffAssignmentById(assignmentId: string) {
  const assignment = await prisma.staffAssignment.findUnique({
    where: {
      id: assignmentId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          image: true,
          role: true,
        },
      },
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          telephone: true,
          address: true,
          isActive: true,
        },
      },
    },
  });

  if (!assignment) {
    throw new Error("Affectation introuvable.");
  }

  return assignment;
}

/**
 * Récupérer l'affectation active d'un utilisateur.
 */
export async function getActiveStaffAssignmentByUserId(userId: string) {
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      isActive: true,
    },
    include: {
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          telephone: true,
          address: true,
          isActive: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          image: true,
          role: true,
        },
      },
    },
  });

  return assignment;
}

/**
 * Récupérer les personnels actuellement affectés
 * à un point de vente.
 */
export async function getActiveStaffAssignmentsByPointOfSale(
  pointOfSaleId: string,
) {
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      pointOfSaleId,
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          image: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return assignments;
}

/**
 * Récupérer toutes les affectations d'un utilisateur.
 *
 * Inclut les affectations actives et désactivées afin
 * de conserver l'historique.
 */
export async function getStaffAssignmentHistory(userId: string) {
  const assignments = await prisma.staffAssignment.findMany({
    where: {
      userId,
    },
    include: {
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
          telephone: true,
          address: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return assignments;
}

/**
 * Desaffecter l'employee a un point de vente
 */
export const deactivateActiveStaffAssignmentByUserId = async (
  userId: string,
) => {
  const assignment = await prisma.staffAssignment.findFirst({
    where: {
      userId,
      isActive: true,
    },
  });

  if (!assignment) {
    throw new Error("ACTIVE_ASSIGNMENT_NOT_FOUND");
  }

  return prisma.staffAssignment.update({
    where: {
      id: assignment.id,
    },
    data: {
      isActive: false,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          telephone: true,
          email: true,
          role: true,
        },
      },
      pointOfSale: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });
};

/**
 * Récupère tous les points de vente de la boutique
 * avec leurs affectations actives.
 *
 * Cette fonction est utilisée par le manager au chargement
 * de l'écran de gestion des affectations.
 */
export const getStaffAssignments = async () => {
  const shop = await prisma.shop.findUnique({
    where: {
      singleton: "MAIN",
    },
  });

  if (!shop) {
    throw new Error("SHOP_NOT_FOUND");
  }

  const pointOfSales = await prisma.pointOfSale.findMany({
    where: {
      shopId: shop.id,
    },
    orderBy: {
      name: "asc",
    },
    include: {
      assignments: {
        where: {
          isActive: true,
        },
        orderBy: {
          createdAt: "asc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              telephone: true,
              image: true,
              role: true,
            },
          },
        },
      },
    },
  });

  return pointOfSales;
};

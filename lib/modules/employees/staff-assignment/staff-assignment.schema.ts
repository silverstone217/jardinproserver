import { z } from "zod";

/**
 * Schéma pour créer une affectation.
 */
export const createStaffAssignmentSchema = z.object({
  userId: z.string().min(1, "L'identifiant du personnel est requis"),

  pointOfSaleId: z
    .string()
    .min(1, "L'identifiant du point de vente est requis"),
});

/**
 * Schéma pour identifier une affectation.
 */
export const staffAssignmentIdSchema = z.object({
  id: z.string().min(1, "L'identifiant de l'affectation est requis"),
});

/**
 * Schéma pour identifier un utilisateur.
 */
export const staffAssignmentUserIdSchema = z.object({
  userId: z.string().min(1, "L'identifiant du personnel est requis"),
});

/**
 * Schéma pour identifier un point de vente.
 */
export const staffAssignmentPointOfSaleIdSchema = z.object({
  pointOfSaleId: z
    .string()
    .min(1, "L'identifiant du point de vente est requis"),
});

export type CreateStaffAssignmentInput = z.infer<
  typeof createStaffAssignmentSchema
>;

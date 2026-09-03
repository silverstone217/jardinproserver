import { z } from "zod";

/**
 * Affecter un utilisateur à un point de vente.
 *
 * pointOfSaleId peut être null :
 * l'utilisateur appartient alors à la boutique
 * sans être affecté à un point de vente précis.
 */
export const createStaffAssignmentSchema = z.object({
  pointOfSaleId: z
    .string()
    .trim()
    .min(1, "Le point de vente est invalide")
    .nullable()
    .optional(),
});

export type CreateStaffAssignmentInput = z.infer<
  typeof createStaffAssignmentSchema
>;

/**
 * Terminer une affectation.
 *
 * La date de fin est normalement définie par le serveur.
 * On ne permet donc pas au client de choisir endDate.
 */
export const endStaffAssignmentSchema = z.object({
  reason: z.string().trim().max(255, "La raison est trop longue").optional(),
});

export type EndStaffAssignmentInput = z.infer<typeof endStaffAssignmentSchema>;

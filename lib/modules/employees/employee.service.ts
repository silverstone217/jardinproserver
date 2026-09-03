import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import type {
  CreateEmployeeInput,
  UpdateEmployeeBanInput,
  UpdateEmployeeInput,
  UpdateEmployeePasswordInput,
} from "./employee.schema";

const employeeSelect = {
  id: true,
  email: true,
  name: true,
  telephone: true,
  image: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  isBanned: true,
  banExpiresAt: true,
  banReason: true,
} as const;

/**
 * Vérifie qu'un utilisateur existe et qu'il est bien un employé.
 */
const getEmployeeOrThrow = async (employeeId: string) => {
  const employee = await prisma.user.findUnique({
    where: {
      id: employeeId,
    },
    select: employeeSelect,
  });

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND");
  }

  if (employee.role !== "EMPLOYEE") {
    throw new Error("USER_IS_NOT_AN_EMPLOYEE");
  }

  return employee;
};

/**
 * Récupérer tous les employés.
 */
export const getEmployees = async () => {
  return prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
    },
    select: employeeSelect,
    orderBy: {
      name: "asc",
    },
  });
};

/**
 * Récupérer un employé par son ID.
 */
export const getEmployeeById = async (employeeId: string) => {
  return getEmployeeOrThrow(employeeId);
};

/**
 * Créer un employé.
 */
export const createEmployee = async (input: CreateEmployeeInput) => {
  const existingTelephone = await prisma.user.findUnique({
    where: {
      telephone: input.telephone,
    },
    select: {
      id: true,
    },
  });

  if (existingTelephone) {
    throw new Error("TELEPHONE_ALREADY_EXISTS");
  }

  const existingEmail = await prisma.user.findUnique({
    where: {
      email: input.email,
    },
    select: {
      id: true,
    },
  });

  if (existingEmail) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const DEFAULT_EMPLOYEE_PASSWORD = "pers01";

  const hashedPassword = await bcrypt.hash(DEFAULT_EMPLOYEE_PASSWORD, 10);

  return prisma.user.create({
    data: {
      name: input.name,
      telephone: input.telephone,
      email: input.email,
      password: hashedPassword,
      role: "EMPLOYEE",
    },
    select: employeeSelect,
  });
};

/**
 * Modifier les informations d'un employé.
 */
export const updateEmployee = async (
  employeeId: string,
  input: UpdateEmployeeInput,
) => {
  await getEmployeeOrThrow(employeeId);

  if (input.telephone !== undefined) {
    const existingTelephone = await prisma.user.findFirst({
      where: {
        telephone: input.telephone,
        NOT: {
          id: employeeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingTelephone) {
      throw new Error("TELEPHONE_ALREADY_EXISTS");
    }
  }

  if (input.email !== undefined) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: input.email,
        NOT: {
          id: employeeId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingEmail) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
  }

  return prisma.user.update({
    where: {
      id: employeeId,
    },
    data: {
      ...(input.name !== undefined && {
        name: input.name,
      }),

      ...(input.telephone !== undefined && {
        telephone: input.telephone,
      }),

      ...(input.email !== undefined && {
        email: input.email,
      }),
    },
    select: employeeSelect,
  });
};

/**
 * Modifier le mot de passe d'un employé.
 */
export const updateEmployeePassword = async (
  employeeId: string,
  input: UpdateEmployeePasswordInput,
) => {
  await getEmployeeOrThrow(employeeId);

  const hashedPassword = await bcrypt.hash(input.password, 10);

  await prisma.user.update({
    where: {
      id: employeeId,
    },
    data: {
      password: hashedPassword,
    },
  });
};

/**
 * Bannir ou débannir un employé.
 */
export const updateEmployeeBan = async (
  employeeId: string,
  input: UpdateEmployeeBanInput,
) => {
  await getEmployeeOrThrow(employeeId);

  return prisma.$transaction(async (tx) => {
    const employee = await tx.user.update({
      where: {
        id: employeeId,
      },
      data: {
        isBanned: input.isBanned,
        banReason: input.isBanned ? (input.banReason ?? null) : null,
        banExpiresAt: null,
      },
      select: employeeSelect,
    });

    /**
     * Si l'employé est banni,
     * ses affectations actives sont terminées.
     */
    if (input.isBanned) {
      await tx.staffAssignment.updateMany({
        where: {
          userId: employeeId,
          isActive: true,
        },
        data: {
          isActive: false,
          endDate: new Date(),
        },
      });
    }

    return employee;
  });
};

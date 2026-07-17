import type { User } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

export function findByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function create(email: string, passwordHash: string): Promise<User> {
  return prisma.user.create({ data: { email, passwordHash } });
}

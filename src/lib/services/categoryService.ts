import { prisma } from "@/lib/prisma";
import { ServiceError } from "./transactionService";

/** System default categories (userId null) plus the user's own custom ones. */
export async function listCategories(userId: string) {
  return prisma.category.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: { name: "asc" },
  });
}

export async function findCategoryByName(userId: string, name: string) {
  return prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, OR: [{ userId: null }, { userId }] },
  });
}

/** Only the user's own custom categories can be created/renamed/removed — system defaults (userId null) are shared and read-only. */
export async function createCategory(userId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ServiceError("Category name is required", 400);
  const existing = await findCategoryByName(userId, trimmed);
  if (existing) throw new ServiceError("A category with that name already exists", 409);
  return prisma.category.create({ data: { userId, name: trimmed } });
}

export async function renameCategory(userId: string, categoryId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new ServiceError("Category name is required", 400);
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new ServiceError("Category not found, or it's a default category that can't be edited", 404);
  return prisma.category.update({ where: { id: categoryId }, data: { name: trimmed } });
}

export async function deleteCategory(userId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!category) throw new ServiceError("Category not found, or it's a default category that can't be deleted", 404);

  const txCount = await prisma.transaction.count({ where: { userId, categoryId } });
  if (txCount > 0) {
    throw new ServiceError(
      `This category is used on ${txCount} transaction${txCount === 1 ? "" : "s"}. Recategorize those first before removing it.`,
      409
    );
  }
  await prisma.category.delete({ where: { id: categoryId } });
}

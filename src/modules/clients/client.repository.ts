import { db } from "@/lib/db";
import type { ClientInput } from "./client.types";

export const clientRepository = {
  list() {
    return db.client.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        galleries: { select: { id: true } },
        account: { select: { status: true } },
      },
    });
  },
  find(id: string) {
    return db.client.findUnique({
      where: { id },
      include: {
        galleries: { orderBy: { createdAt: "desc" } },
        account: {
          include: {
            invitations: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });
  },
  async findLinkedToAccount(accountId: string, clientId: string) {
    const account = await db.account.findFirst({
      where: { id: accountId, clientId },
      select: {
        client: {
          select: { id: true, name: true },
        },
      },
    });
    return account?.client ?? null;
  },
  create(data: ClientInput) {
    return db.client.create({ data });
  },
  update(id: string, data: ClientInput) {
    return db.client.update({ where: { id }, data });
  },
};

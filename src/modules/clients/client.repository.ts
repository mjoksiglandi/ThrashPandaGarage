import { db } from "@/lib/db";
import type { ClientInput } from "./client.types";

export const clientRepository = {
  list() {
    return db.client.findMany({
      orderBy: { createdAt: "desc" },
      include: { galleries: { select: { id: true } } },
    });
  },
  find(id: string) {
    return db.client.findUnique({
      where: { id },
      include: { galleries: { orderBy: { createdAt: "desc" } } },
    });
  },
  findIdentity(id: string) {
    return db.client.findUnique({
      where: { id },
      select: { id: true },
    });
  },
  findByEmail(email: string) {
    return db.client.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      include: { galleries: { orderBy: { createdAt: "desc" } } },
    });
  },
  create(data: ClientInput) {
    return db.client.create({ data });
  },
  update(id: string, data: ClientInput) {
    return db.client.update({ where: { id }, data });
  },
};

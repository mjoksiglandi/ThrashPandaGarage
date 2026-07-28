import { clientSchema } from "@/lib/validators";
import { clientRepository } from "./client.repository";

export async function createClientFromForm(formData: FormData) {
  const parsed = clientSchema.parse(Object.fromEntries(formData));
  return clientRepository.create({
    name: parsed.name,
    email: parsed.email || null,
    phone: parsed.phone || null,
    notes: parsed.notes || null,
  });
}

export async function updateClientFromForm(id: string, formData: FormData) {
  const parsed = clientSchema.parse(Object.fromEntries(formData));
  return clientRepository.update(id, {
    name: parsed.name,
    email: parsed.email || null,
    phone: parsed.phone || null,
    notes: parsed.notes || null,
  });
}

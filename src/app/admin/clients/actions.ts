"use server";

import { requireAdmin } from "@/lib/auth";
import {
  BulkClientInvitationSelectionError,
  bulkInviteClients,
  type BulkClientInvitationActionState,
} from "@/modules/accounts/bulk-client-invitations";

export async function inviteSelectedClients(
  _previousState: BulkClientInvitationActionState,
  formData: FormData
): Promise<BulkClientInvitationActionState> {
  const admin = await requireAdmin();

  try {
    const result = await bulkInviteClients({
      clientIds: formData.getAll("clientIds"),
      actorId: admin.id,
    });
    return { status: "complete", ...result };
  } catch (error) {
    if (error instanceof BulkClientInvitationSelectionError) {
      return { status: "validation-error", message: error.message };
    }
    throw error;
  }
}

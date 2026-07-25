import { GalleryStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = { id: "transaction-client" };
  return {
    tx,
    db: {
      $transaction: vi.fn(),
    },
    createTransport: vi.fn(),
    sendMail: vi.fn(),
    findForInvitationForUpdate: vi.fn(),
    update: vi.fn(),
    event: vi.fn(),
  };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/env", () => ({
  env: {
    APP_BASE_URL: "https://trashpanda.example",
    SMTP_HOST: "smtp.example",
    SMTP_PORT: 587,
    SMTP_USER: "smtp-user",
    SMTP_PASS: "smtp-pass",
    MAIL_FROM: "Trashpanda <mail@example.com>",
  },
}));
vi.mock("@/modules/galleries/gallery.repository", () => ({
  galleryRepository: {
    findForInvitationForUpdate: mocks.findForInvitationForUpdate,
    update: mocks.update,
    event: mocks.event,
  },
}));

import {
  resendGalleryInvitation,
  sendInitialGalleryInvitation,
} from "./mail.service";
import { InvalidGalleryInvitationStatusError } from "./mail-workflow";

const baseGallery = {
  id: "gallery-1",
  accessToken: "tpg_gallery",
  status: GalleryStatus.DRAFT,
  emailSentAt: null,
  client: {
    id: "client-1",
    name: "Karim",
    email: "karim@example.com",
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (callback) => callback(mocks.tx));
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "message-1" });
  mocks.findForInvitationForUpdate.mockResolvedValue(baseGallery);
  mocks.update.mockResolvedValue({
    ...baseGallery,
    status: GalleryStatus.EMAIL_SENT,
  });
  mocks.event.mockResolvedValue({ id: "event-1" });
});

describe("gallery invitation mutations", () => {
  it("sends the initial invitation, moves DRAFT to EMAIL_SENT, and audits the actor", async () => {
    await sendInitialGalleryInvitation({
      galleryId: baseGallery.id,
      actorId: "admin-1",
    });

    expect(mocks.findForInvitationForUpdate).toHaveBeenCalledWith(baseGallery.id, mocks.tx);
    expect(
      mocks.findForInvitationForUpdate.mock.invocationCallOrder[0]
    ).toBeLessThan(mocks.sendMail.mock.invocationCallOrder[0]);
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: baseGallery.client.email,
        subject: "Tu galería está lista — Trashpanda Garage",
      })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      baseGallery.id,
      {
        status: GalleryStatus.EMAIL_SENT,
        emailSentAt: expect.any(Date),
      },
      mocks.tx
    );
    expect(mocks.event).toHaveBeenCalledWith(
      {
        galleryId: baseGallery.id,
        type: "GALLERY_EMAIL_SENT",
        actorType: "ADMIN",
        actorId: "admin-1",
        metadata: {
          fromStatus: GalleryStatus.DRAFT,
          toStatus: GalleryStatus.EMAIL_SENT,
        },
      },
      mocks.tx
    );
  });

  it("writes neither state nor event when SMTP fails", async () => {
    mocks.sendMail.mockRejectedValueOnce(new Error("SMTP unavailable"));

    await expect(
      sendInitialGalleryInvitation({
        galleryId: baseGallery.id,
        actorId: "admin-1",
      })
    ).rejects.toThrow("SMTP unavailable");

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it.each([GalleryStatus.EMAIL_SENT, GalleryStatus.PROOFING])(
    "resends from %s without changing status and records a distinct event",
    async (status) => {
      mocks.findForInvitationForUpdate.mockResolvedValueOnce({ ...baseGallery, status });

      await resendGalleryInvitation({
        galleryId: baseGallery.id,
        actorId: "admin-1",
      });

      expect(mocks.update).toHaveBeenCalledWith(
        baseGallery.id,
        { emailSentAt: expect.any(Date) },
        mocks.tx
      );
      expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("status");
      expect(mocks.event).toHaveBeenCalledWith(
        {
          galleryId: baseGallery.id,
          type: "GALLERY_EMAIL_RESENT",
          actorType: "ADMIN",
          actorId: "admin-1",
          metadata: { status },
        },
        mocks.tx
      );
    }
  );

  it("cannot use a manipulated initial-send invocation to degrade PROOFING", async () => {
    mocks.findForInvitationForUpdate.mockResolvedValueOnce({
      ...baseGallery,
      status: GalleryStatus.PROOFING,
    });

    await expect(
      sendInitialGalleryInvitation({
        galleryId: baseGallery.id,
        actorId: "admin-1",
      })
    ).rejects.toThrow(InvalidGalleryInvitationStatusError);

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.event).not.toHaveBeenCalled();
  });

  it("requires actorId before opening a transaction", async () => {
    await expect(
      resendGalleryInvitation({
        galleryId: baseGallery.id,
        actorId: " ",
      })
    ).rejects.toThrow("Admin actorId is required");

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
});

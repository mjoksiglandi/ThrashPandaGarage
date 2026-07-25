CREATE TYPE "GalleryEventActorType" AS ENUM ('ADMIN', 'GALLERY_TOKEN', 'SYSTEM');

ALTER TABLE "GalleryEvent"
ADD COLUMN "actorType" "GalleryEventActorType" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN "actorId" TEXT;

CREATE INDEX "GalleryEvent_galleryId_createdAt_idx" ON "GalleryEvent"("galleryId", "createdAt");

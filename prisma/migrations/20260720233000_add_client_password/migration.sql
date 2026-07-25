CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "UserRole" AS ENUM ('ADMIN');
CREATE TYPE "GalleryStatus" AS ENUM ('DRAFT', 'EMAIL_SENT', 'PROOFING', 'SELECTION_CONFIRMED', 'EDITING', 'READY_FOR_DELIVERY', 'DELIVERED', 'ARCHIVED');
CREATE TYPE "PhotoStatus" AS ENUM ('PROOF', 'SELECTED', 'EDITING', 'READY', 'DELIVERED', 'REJECTED');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Gallery" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "status" "GalleryStatus" NOT NULL DEFAULT 'DRAFT',
    "selectionLimit" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "proofingLocalPath" TEXT,
    "thumbnailLocalPath" TEXT,
    "previewLocalPath" TEXT,
    "googleDriveFolderUrl" TEXT,
    "deliveryDriveUrl" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "selectionConfirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "previewPath" TEXT,
    "driveFileUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "PhotoStatus" NOT NULL DEFAULT 'PROOF',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryEvent" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GalleryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Gallery_accessToken_key" ON "Gallery"("accessToken");
CREATE UNIQUE INDEX "Photo_galleryId_baseName_key" ON "Photo"("galleryId", "baseName");
CREATE UNIQUE INDEX "Selection_photoId_key" ON "Selection"("photoId");

ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryEvent" ADD CONSTRAINT "GalleryEvent_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

import { db } from "@/lib/db";
import { buildRelativePhotoPath } from "@/modules/storage/storage.service";
import { importGalleryPhotos } from "@/modules/photos/photo-import.service";

async function main() {
  const folder = process.argv[2];
  if (!folder) throw new Error("Usage: npm run gallery:import -- <gallery-folder-or-gallery-id>");

  const byId = await db.gallery.findUnique({ where: { id: folder } });
  const gallery =
    byId ??
    (await db.gallery.findFirst({
      where: {
        OR: [
          { proofingLocalPath: folder },
          { thumbnailLocalPath: buildRelativePhotoPath(folder, "thumbs") },
          { slug: folder },
        ],
      },
    }));

  if (!gallery) throw new Error(`Gallery not found for ${folder}`);
  const result = await importGalleryPhotos(gallery.id, { actorType: "SYSTEM" }, folder);
  console.log(
    `Processed ${result.totalProcessed} photos for ${gallery.title}: ` +
      `${result.importedCount} imported, ${result.updatedCount} updated, ` +
      `${result.skippedCount} skipped`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());

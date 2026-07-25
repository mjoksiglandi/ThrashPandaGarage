const categories = [
  {
    num: "01",
    key: "photo",
    name: "Photography",
    href: "/work/photo",
    desc: "Editorial, cosplay, retrato de personaje",
    copy: "Retratos, cosplay, producto y escenas construidas con direccion visual de taller.",
    tags: ["Cosplay", "Retrato", "Editorial"],
  },
] as const;

const photoFiles = [
  "0001-01-festi25-ahri-festi25-34.webp",
  "0002-02-festi25-jinx-festi25-39.webp",
  "0003-03-fer-fer-blood-fer-blood-19.webp",
  "0004-04-fer-lilith-rm-0405.webp",
  "0005-05-calaca-calaca-1.webp",
  "0006-06-comicon-25-red-rose-cosplay-comicon-25-2-2.webp",
  "0007-07-neon-neon-6.webp",
  "0008-08-lelouch-lelouch-4.webp",
  "0009-09-lelouch-lelouch-1.webp",
  "0010-10-lelouch-lelouch-8.webp",
  "0011-11-snowmiku-snowmiku-17.webp",
  "0012-12-snowmiku-snowmiku-11.webp",
  "0013-13-cata-rm-8630.webp",
  "0014-14-fer-lilith-rm-0445.webp",
  "0015-15-fer-lilith-rm-0463.webp",
  "0016-16-fer-rumi2-rm-9763.webp",
  "0017-17-fer-rumi2-rm-9752.webp",
  "0018-18-fer-rumi2-rm-9753.webp",
  "0019-19-fer-fer-blood-fer-blood-37.webp",
  "0020-20-fer-fer-blood-fer-blood-29.webp",
  "0021-21-fer-fer-ragnarok-fer-ragnarok-17.webp",
  "0022-22-fer-fer-ragnarok-fer-ragnarok-23.webp",
  "0023-23-fer-fer-ragnarok-fer-ragnarok-6.webp",
  "0024-24-fer-misato-rm-1991-1.webp",
  "0025-25-fer-misato-rm-1988.webp",
  "0026-26-fer-misato-rm-2001.webp",
  "0027-27-fer-fer-shisuku-fer-shisuku-5.webp",
  "0028-28-fer-fer-shisuku-fer-shisuku-2.webp",
  "0029-29-fer-fer-shisuku-fer-shisuku-24.webp",
  "0030-30-emiria-emiria-15.webp",
  "0031-31-emiria-emiria-16.webp",
  "0032-32-emiria-emiria-4.webp",
  "0033-33-bere-bere-4.webp",
  "0034-34-bere-bere-8.webp",
  "0035-35-bere-bere-5.webp",
  "0036-36-calaca-calaca-2.webp",
  "0037-37-calaca-calaca-3.webp",
  "0038-38-miochi-miochin-8.webp",
  "0039-39-brrynana-brrynana-5.webp",
  "0040-40-corto-onepiece-op-2.webp",
  "0041-41-fay-rojo-fay-3.webp",
  "0042-42-hanabi-edit-rm-1655.webp",
  "0043-43-festi25-paradise-festi25-30.webp",
  "0044-44-festi25-hopito-festi25-08.webp",
  "0045-45-festi25-zelda-festi25-13.webp",
  "0046-46-festi25-dead-festi25-27.webp",
  "0047-47-comicon-25-fengari-comicon-25-36.webp",
  "0048-48-comicon-25-etcetera-cos-comicon-25-22.webp",
  "0049-49-cyborg-cyborg-2.webp",
  "0050-50-neon-neon-2.webp",
] as const;

const heroPhotoFiles = new Set<string>(photoFiles.slice(0, 10));

function titleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.webp$/, "");
  const withoutIndex = withoutExtension.replace(/^\d+-\d+-/, "");
  const withoutCameraSuffix = withoutIndex.replace(/-(rm|festi25|comicon-25|fer-blood|fer-ragnarok|fer-shisuku)-?\d.*$/i, "");
  const words = withoutCameraSuffix.split("-").filter(Boolean);
  const uniqueWords = words.filter((word, index) => words.indexOf(word) === index);
  return uniqueWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

export const publicPortfolioItems = [
  ...photoFiles.map((filename) => {
    const title = titleFromFilename(filename);
    const exif = (portfolioExif as Record<string, { focalLength: string | null; aperture: string | null; shutterSpeed: string | null; iso: number | null; captureDate: string | null }>)[filename];
    const exifText = exif
      ? [`${exif.focalLength} mm`, `f/${exif.aperture}`, exif.shutterSpeed, `ISO ${exif.iso}`].filter(Boolean).join(" · ")
      : "";
    return {
      ratio: "4/5",
      category: "Photo",
      key: "photo",
      tag: "photo - cosplay",
      title,
      year: "2026",
      image: `/${heroPhotoFiles.has(filename) ? "hero" : "photos"}/${filename}`,
      alt: `Trashpanda Garage photo: ${title}`,
      exifText,
      captureDate: exif?.captureDate ?? "",
    };
  }),
] as const;

export const publicCategories = categories;
import portfolioExif from "./portfolio-exif.json";

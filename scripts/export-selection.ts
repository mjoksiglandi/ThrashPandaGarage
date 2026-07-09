import fs from "fs/promises";
import { db } from "@/lib/db";
import { exportSelectionText } from "@/modules/selections/selection.service";

async function main() {
  const galleryId = process.argv[2];
  const out = process.argv[3];
  if (!galleryId) throw new Error("Usage: npm run selection:export -- <gallery-id> [out.txt]");
  const text = await exportSelectionText(galleryId);
  if (out) {
    await fs.writeFile(out, text, "utf8");
    console.log(`Wrote ${out}`);
  } else {
    console.log(text);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());

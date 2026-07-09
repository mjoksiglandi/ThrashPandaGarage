import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

async function main() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  await db.user.upsert({
    where: { email: env.ADMIN_EMAIL },
    update: { passwordHash },
    create: { email: env.ADMIN_EMAIL, passwordHash, name: "Admin" },
  });
  console.log(`Admin ready: ${env.ADMIN_EMAIL}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());

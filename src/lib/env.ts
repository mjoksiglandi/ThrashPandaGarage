import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  PHOTO_STORAGE_ROOT: z.string().default("/data/photos"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("Trashpanda Garage <noreply@example.com>"),
  CONTACT_EMAIL: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().optional()
  ),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters long"),
  TRUSTED_CLIENT_IP_HEADER: z
    .enum(["none", "cf-connecting-ip", "x-forwarded-for"])
    .default("none"),
});

export const env = envSchema.parse(process.env);

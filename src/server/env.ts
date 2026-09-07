import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_SPREADSHEET_ID: z.string().optional().default(""),
  GOOGLE_SHEET_NAME: z.string().optional().default(""),
  GOOGLE_SHEET_GID: z.string().optional().default(""),
  APP_URL: z.string().optional().default("http://localhost:3000"),
  DEFAULT_TIMEZONE: z.string().optional().default("Asia/Jakarta"),
  AUTH_URL: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),
  ALLOW_DEV_LOGIN: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);

import { defineConfig } from "drizzle-kit";

/**
 * Cấu hình cho drizzle-kit: sinh migration và mở Drizzle Studio.
 *
 * DATABASE_URL đọc từ môi trường, nên đổi sang cơ sở dữ liệu trên mạng chỉ là
 * đổi một biến, không phải sửa mã.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://cotyphu:cotyphu@localhost:5432/cotyphu",
  },
  verbose: true,
  strict: true,
});

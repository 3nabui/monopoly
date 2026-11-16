import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as bang from "./schema.js";

/**
 * Kết nối cơ sở dữ liệu.
 *
 * Không có DATABASE_URL, hoặc không nối được, thì game vẫn chạy bình thường —
 * chỉ là không lưu lại gì. Làm vậy để người mới tải mã về có thể chơi thử ngay
 * mà chưa cần dựng Postgres.
 */

export type DB = NodePgDatabase<typeof bang>;

let pool: Pool | null = null;
let db: DB | null = null;
let daThu = false;

export function coDatabase(): boolean {
  return db !== null;
}

export function layDB(): DB | null {
  return db;
}

export async function moDatabase(): Promise<DB | null> {
  if (daThu) return db;
  daThu = true;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] Chưa đặt DATABASE_URL — chạy ở chế độ không lưu trữ.");
    return null;
  }

  try {
    pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 4000 });
    // Thử một truy vấn thật để biết chắc nối được, chứ không chỉ tạo đối tượng.
    await pool.query("select 1");
    db = drizzle(pool, { schema: bang });
    console.log("[db] Đã kết nối PostgreSQL.");
    return db;
  } catch (e) {
    console.warn(
      "[db] Không nối được PostgreSQL nên chạy ở chế độ không lưu trữ.",
      (e as Error)?.message,
    );
    await pool?.end().catch(() => {});
    pool = null;
    db = null;
    return null;
  }
}

export async function dongDatabase(): Promise<void> {
  await pool?.end().catch(() => {});
  pool = null;
  db = null;
  daThu = false;
}

export { bang };

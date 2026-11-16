import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";
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

/**
 * Thư mục migration nằm ở apps/backend/drizzle. File này nằm ở src/db khi
 * chạy bằng tsx và ở build/db sau khi biên dịch — cả hai đều cách thư mục
 * đó đúng hai cấp, nên một đường dẫn tương đối là đủ cho cả hai.
 */
const THU_MUC_MIGRATION = fileURLToPath(new URL("../../drizzle", import.meta.url));

/**
 * Có phải nối tới Postgres ngoài mạng hay không. Chạy ở máy mình thì không
 * bật TLS, còn dịch vụ trên mạng thì gần như luôn bắt buộc.
 */
function canSSL(url: string): boolean {
  if (/[?&]sslmode=disable/.test(url)) return false;
  if (/[?&]sslmode=/.test(url)) return true;
  return !/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
}

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
    pool = new Pool({
      connectionString: url,
      max: 10,
      connectionTimeoutMillis: 4000,
      // Hầu hết dịch vụ Postgres trên mạng bắt buộc TLS nhưng dùng chứng chỉ
      // nội bộ của họ, nên không kiểm chuỗi chứng chỉ. Ở máy mình thì tắt hẳn.
      ssl: canSSL(url) ? { rejectUnauthorized: false } : undefined,
    });
    // Thử một truy vấn thật để biết chắc nối được, chứ không chỉ tạo đối tượng.
    await pool.query("select 1");
    db = drizzle(pool, { schema: bang });

    // Tự dựng bảng lúc khởi động. Nhờ vậy deploy lên một cơ sở dữ liệu trống
    // là chạy được ngay, không phải nhớ chạy tay `npm run db:day`.
    await migrate(db, { migrationsFolder: THU_MUC_MIGRATION });

    console.log("[db] Đã kết nối PostgreSQL và dựng xong bảng.");
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

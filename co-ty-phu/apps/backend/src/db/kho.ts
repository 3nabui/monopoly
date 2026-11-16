import { and, desc, eq, sql } from "drizzle-orm";
import { bang, layDB } from "./index.js";
import type { NguoiDung } from "../config/auth.js";

/**
 * Mọi câu truy vấn của game gom ở đây.
 *
 * Mỗi hàm đều chịu được trường hợp không có database: khi đó nó lặng lẽ không
 * làm gì (hoặc trả về rỗng) để ván chơi vẫn tiếp tục. Lưu trữ là phần thêm,
 * không phải điều kiện để chơi.
 */

export async function luuNguoiDung(nd: NguoiDung): Promise<void> {
  const db = layDB();
  if (!db) return;
  try {
    await db.insert(bang.nguoiDung).values({
      id: nd.id,
      ten: nd.ten,
      email: nd.email ?? null,
      anh: nd.anh ?? null,
      khach: Boolean(nd.khach),
    }).onConflictDoUpdate({
      target: bang.nguoiDung.id,
      // Tên và ảnh có thể đổi bên Google, nên lần nào đăng nhập cũng cập nhật.
      set: {
        ten: nd.ten,
        email: nd.email ?? null,
        anh: nd.anh ?? null,
        vaoLanCuoi: new Date(),
      },
    });
  } catch (e) {
    console.warn("[db] Không lưu được người dùng:", (e as Error)?.message);
  }
}

export async function docNguoiDung(id: string): Promise<NguoiDung | undefined> {
  const db = layDB();
  if (!db) return undefined;
  try {
    const [r] = await db.select().from(bang.nguoiDung).where(eq(bang.nguoiDung.id, id)).limit(1);
    if (!r) return undefined;
    return { id: r.id, ten: r.ten, email: r.email ?? undefined, anh: r.anh ?? undefined, khach: r.khach };
  } catch {
    return undefined;
  }
}

export interface NguoiTrongVan {
  nguoiDungId: string;
  thuTu: number;
  taiSan: number;
  soO: number;
  soNha: number;
  phaSan: boolean;
  thang: boolean;
}

export interface VanKetThuc {
  maPhong: string;
  tenPhong: string;
  coMatKhau: boolean;
  batDauLuc: Date;
  soLuot: number;
  nguoiThang?: string;
  nguoiChoi: NguoiTrongVan[];
}

/** Ghi lại một ván đã kết thúc cùng kết quả của từng người. */
export async function luuVan(v: VanKetThuc): Promise<void> {
  const db = layDB();
  if (!db) return;
  try {
    await db.transaction(async (tx) => {
      const [van] = await tx.insert(bang.vanDau).values({
        maPhong: v.maPhong,
        tenPhong: v.tenPhong,
        coMatKhau: v.coMatKhau,
        batDauLuc: v.batDauLuc,
        ketThucLuc: new Date(),
        nguoiThang: v.nguoiThang ?? null,
        soLuot: v.soLuot,
      }).returning({ id: bang.vanDau.id });

      if (v.nguoiChoi.length) {
        await tx.insert(bang.ketQua).values(
          v.nguoiChoi.map((p) => ({ vanId: van.id, ...p })),
        );
      }

      for (const p of v.nguoiChoi) {
        await tx.update(bang.nguoiDung).set({
          soVan: sql`${bang.nguoiDung.soVan} + 1`,
          soVanThang: p.thang
            ? sql`${bang.nguoiDung.soVanThang} + 1`
            : bang.nguoiDung.soVanThang,
        }).where(eq(bang.nguoiDung.id, p.nguoiDungId));
      }
    });
  } catch (e) {
    console.warn("[db] Không lưu được ván:", (e as Error)?.message);
  }
}

/** Bảng xếp hạng theo số ván thắng, dùng cho trang thống kê sau này. */
export async function bangXepHang(gioiHan = 20) {
  const db = layDB();
  if (!db) return [];
  try {
    return await db.select({
      id: bang.nguoiDung.id,
      ten: bang.nguoiDung.ten,
      anh: bang.nguoiDung.anh,
      soVan: bang.nguoiDung.soVan,
      soVanThang: bang.nguoiDung.soVanThang,
    })
      .from(bang.nguoiDung)
      .where(and(eq(bang.nguoiDung.khach, false), sql`${bang.nguoiDung.soVan} > 0`))
      .orderBy(desc(bang.nguoiDung.soVanThang), desc(bang.nguoiDung.soVan))
      .limit(gioiHan);
  } catch {
    return [];
  }
}

/** Vài ván gần nhất, để xem nhanh server có đang ghi dữ liệu hay không. */
export async function vanGanDay(gioiHan = 10) {
  const db = layDB();
  if (!db) return [];
  try {
    return await db.select({
      id: bang.vanDau.id,
      tenPhong: bang.vanDau.tenPhong,
      batDauLuc: bang.vanDau.batDauLuc,
      ketThucLuc: bang.vanDau.ketThucLuc,
      soLuot: bang.vanDau.soLuot,
      nguoiThang: bang.vanDau.nguoiThang,
    })
      .from(bang.vanDau)
      .orderBy(desc(bang.vanDau.batDauLuc))
      .limit(gioiHan);
  } catch {
    return [];
  }
}

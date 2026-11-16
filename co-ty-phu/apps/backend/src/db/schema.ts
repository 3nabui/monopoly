import {
  boolean, index, integer, pgTable, text, timestamp, uuid,
} from "drizzle-orm/pg-core";

/**
 * Lược đồ cơ sở dữ liệu.
 *
 * Ba bảng: người chơi, ván đấu, và bảng nối ghi kết quả của từng người trong
 * từng ván. Mật khẩu phòng không bao giờ được lưu ở đây — nó chỉ sống trong
 * bộ nhớ của phòng và mất khi phòng đóng.
 */

export const nguoiDung = pgTable("nguoi_dung", {
  /** Khoá do nhà cung cấp đăng nhập cấp, ví dụ "google:1234567890". */
  id: text("id").primaryKey(),
  ten: text("ten").notNull(),
  email: text("email"),
  anh: text("anh"),
  khach: boolean("khach").notNull().default(false),

  /** Thống kê cộng dồn, cập nhật mỗi khi một ván kết thúc. */
  soVan: integer("so_van").notNull().default(0),
  soVanThang: integer("so_van_thang").notNull().default(0),

  taoLuc: timestamp("tao_luc", { withTimezone: true }).notNull().defaultNow(),
  vaoLanCuoi: timestamp("vao_lan_cuoi", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("nguoi_dung_email_idx").on(t.email),
]);

export const vanDau = pgTable("van_dau", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** roomId của Colyseus, tiện đối chiếu với log server. */
  maPhong: text("ma_phong").notNull(),
  tenPhong: text("ten_phong").notNull(),
  coMatKhau: boolean("co_mat_khau").notNull().default(false),

  batDauLuc: timestamp("bat_dau_luc", { withTimezone: true }).notNull().defaultNow(),
  ketThucLuc: timestamp("ket_thuc_luc", { withTimezone: true }),
  /** id người thắng; null nghĩa là ván bỏ dở. */
  nguoiThang: text("nguoi_thang").references(() => nguoiDung.id),
  soLuot: integer("so_luot").notNull().default(0),
}, (t) => [
  index("van_dau_bat_dau_idx").on(t.batDauLuc),
]);

export const ketQua = pgTable("ket_qua", {
  id: uuid("id").primaryKey().defaultRandom(),
  vanId: uuid("van_id").notNull().references(() => vanDau.id, { onDelete: "cascade" }),
  nguoiDungId: text("nguoi_dung_id").notNull().references(() => nguoiDung.id),

  /** Thứ tự ngồi trong ván, 0 là người đi đầu. */
  thuTu: integer("thu_tu").notNull(),
  /** Tổng tài sản lúc ván kết thúc. */
  taiSan: integer("tai_san").notNull().default(0),
  soO: integer("so_o").notNull().default(0),
  soNha: integer("so_nha").notNull().default(0),
  phaSan: boolean("pha_san").notNull().default(false),
  thang: boolean("thang").notNull().default(false),
}, (t) => [
  index("ket_qua_van_idx").on(t.vanId),
  index("ket_qua_nguoi_idx").on(t.nguoiDungId),
]);

export type NguoiDungRow = typeof nguoiDung.$inferSelect;
export type VanDauRow = typeof vanDau.$inferSelect;
export type KetQuaRow = typeof ketQua.$inferSelect;

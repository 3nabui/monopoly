import assert from "assert";
import { eq, inArray } from "drizzle-orm";
import { bang, coDatabase, layDB, moDatabase } from "../src/db/index.js";
import { bangXepHang, docNguoiDung, luuNguoiDung, luuVan, vanGanDay } from "../src/db/kho.js";

/**
 * Kiểm tra lớp lưu trữ chạy thật với PostgreSQL.
 *
 * Chưa bật database thì cả nhóm test này tự bỏ qua, để người mới tải mã về
 * vẫn chạy được `npm test` mà không cần dựng Docker.
 */
describe("Lưu trữ PostgreSQL", function () {
  const A = "test:nguoi-a";
  const B = "test:nguoi-b";
  let co = false;

  before(async function () {
    await moDatabase();
    co = coDatabase();
    if (!co) this.skip();
  });

  /** Dọn sạch dấu vết của test, kể cả khi test giữa chừng hỏng. */
  async function don() {
    const db = layDB();
    if (!db) return;
    const van = await db.select({ id: bang.vanDau.id })
      .from(bang.vanDau).where(eq(bang.vanDau.maPhong, "phong-test"));
    if (van.length) {
      await db.delete(bang.ketQua).where(inArray(bang.ketQua.vanId, van.map((v) => v.id)));
      await db.delete(bang.vanDau).where(eq(bang.vanDau.maPhong, "phong-test"));
    }
    await db.delete(bang.nguoiDung).where(inArray(bang.nguoiDung.id, [A, B]));
  }

  beforeEach(async function () { if (co) await don(); });
  after(async function () { if (co) await don(); });

  it("lưu rồi đọc lại được người dùng", async () => {
    await luuNguoiDung({ id: A, ten: "Người A", email: "a@example.com" });
    const r = await docNguoiDung(A);
    assert.ok(r, "phải đọc lại được");
    assert.strictEqual(r!.ten, "Người A");
    assert.strictEqual(r!.email, "a@example.com");
  });

  it("đăng nhập lần sau thì cập nhật tên chứ không tạo bản ghi mới", async () => {
    await luuNguoiDung({ id: A, ten: "Tên cũ" });
    await luuNguoiDung({ id: A, ten: "Tên mới", anh: "https://example.com/a.png" });

    const db = layDB()!;
    const rows = await db.select().from(bang.nguoiDung).where(eq(bang.nguoiDung.id, A));
    assert.strictEqual(rows.length, 1, "chỉ được có một bản ghi cho mỗi tài khoản");
    assert.strictEqual(rows[0].ten, "Tên mới");
    assert.strictEqual(rows[0].anh, "https://example.com/a.png");
  });

  it("ghi ván xong thì cộng đúng số ván và số ván thắng", async () => {
    await luuNguoiDung({ id: A, ten: "Người A" });
    await luuNguoiDung({ id: B, ten: "Người B" });

    await luuVan({
      maPhong: "phong-test",
      tenPhong: "Phòng kiểm thử",
      coMatKhau: false,
      batDauLuc: new Date(Date.now() - 60_000),
      soLuot: 23,
      nguoiThang: A,
      nguoiChoi: [
        { nguoiDungId: A, thuTu: 0, taiSan: 3_200_000, soO: 9, soNha: 7, phaSan: false, thang: true },
        { nguoiDungId: B, thuTu: 1, taiSan: 0, soO: 0, soNha: 0, phaSan: true, thang: false },
      ],
    });

    const db = layDB()!;
    const [a] = await db.select().from(bang.nguoiDung).where(eq(bang.nguoiDung.id, A));
    const [b] = await db.select().from(bang.nguoiDung).where(eq(bang.nguoiDung.id, B));
    assert.strictEqual(a.soVan, 1);
    assert.strictEqual(a.soVanThang, 1);
    assert.strictEqual(b.soVan, 1);
    assert.strictEqual(b.soVanThang, 0, "người thua không được cộng ván thắng");

    const van = await vanGanDay(10);
    const cua = van.find((v) => v.tenPhong === "Phòng kiểm thử");
    assert.ok(cua, "ván vừa ghi phải nằm trong danh sách gần đây");
    assert.strictEqual(cua!.soLuot, 23);

    const xh = await bangXepHang(50);
    assert.ok(xh.some((r) => r.id === A), "người thắng phải có trong bảng xếp hạng");
  });

  it("xoá ván thì xoá luôn kết quả của ván đó", async () => {
    await luuNguoiDung({ id: A, ten: "Người A" });
    await luuVan({
      maPhong: "phong-test", tenPhong: "Phòng kiểm thử", coMatKhau: false,
      batDauLuc: new Date(), soLuot: 1, nguoiThang: A,
      nguoiChoi: [{ nguoiDungId: A, thuTu: 0, taiSan: 1, soO: 0, soNha: 0, phaSan: false, thang: true }],
    });

    const db = layDB()!;
    const [van] = await db.select({ id: bang.vanDau.id })
      .from(bang.vanDau).where(eq(bang.vanDau.maPhong, "phong-test"));
    await db.delete(bang.vanDau).where(eq(bang.vanDau.id, van.id));

    const conLai = await db.select().from(bang.ketQua).where(eq(bang.ketQua.vanId, van.id));
    assert.strictEqual(conLai.length, 0, "kết quả phải bị xoá theo ván");
  });

  it("tài khoản khách không lên bảng xếp hạng", async () => {
    await luuNguoiDung({ id: A, ten: "Khách A", khach: true });
    await luuVan({
      maPhong: "phong-test", tenPhong: "Phòng kiểm thử", coMatKhau: false,
      batDauLuc: new Date(), soLuot: 1, nguoiThang: A,
      nguoiChoi: [{ nguoiDungId: A, thuTu: 0, taiSan: 1, soO: 0, soNha: 0, phaSan: false, thang: true }],
    });

    const xh = await bangXepHang(50);
    assert.ok(!xh.some((r) => r.id === A), "khách chỉ chơi tạm, không xếp hạng");
  });
});

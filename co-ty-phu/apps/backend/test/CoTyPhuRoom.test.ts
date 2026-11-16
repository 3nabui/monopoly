import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { JWT } from "@colyseus/auth";
import { BAN_CO, TIEN_BAN_DAU, bangThue, giaMua, tienThue } from "@co-ty-phu/shared";
import appConfig from "../src/app.config.js";
import type { GameState } from "../src/rooms/schema/GameState.js";

describe("Phòng cờ tỷ phú", () => {
  let colyseus: ColyseusTestServer;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => { await colyseus.shutdown(); });
  beforeEach(async () => { await colyseus.cleanup(); });

  /**
   * Phòng yêu cầu đăng nhập, nên mỗi client thử nghiệm cần một JWT riêng.
   * Đặt token ngay trước khi nối để hai client mang hai danh tính khác nhau.
   */
  async function noi(room: any, ten: string, options: any = {}) {
    colyseus.sdk.auth.token = await JWT.sign({ id: `test:${ten}`, ten });
    return colyseus.connectTo(room, options);
  }

  /* ---------------------------------------------------- dữ liệu bàn cờ */

  it("bàn cờ có đúng 36 ô với 16 ô đất, 4 ô biển, 2 tiện ích", () => {
    assert.strictEqual(BAN_CO.length, 36);
    const dem = (loai: string) => BAN_CO.filter((o) => o.loai === loai).length;
    assert.strictEqual(dem("dat"), 16);
    assert.strictEqual(dem("bien"), 4);
    assert.strictEqual(dem("tienich"), 2);
    assert.strictEqual(dem("goc"), 4);
  });

  it("mỗi nhóm tỉnh thành có đúng 2 ô", () => {
    const theoNhom = new Map<string, number>();
    for (const o of BAN_CO) {
      if (!o.nhom) continue;
      theoNhom.set(o.nhom, (theoNhom.get(o.nhom) ?? 0) + 1);
    }
    assert.strictEqual(theoNhom.size, 8);
    for (const [nhom, so] of theoNhom) {
      assert.strictEqual(so, 2, `nhóm ${nhom} phải có 2 ô`);
    }
  });

  it("bảng tiền thuê tăng dần theo số nhà", () => {
    const b = bangThue(400);
    for (let i = 1; i < b.length; i++) {
      assert.ok(b[i] > b[i - 1], `mức ${i} phải cao hơn mức ${i - 1}`);
    }
  });

  /* ------------------------------------------------- đăng nhập và phòng */

  it("không có token thì không vào được phòng", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    colyseus.sdk.auth.token = "";
    await assert.rejects(
      () => colyseus.connectTo(room, {}),
      /CHUA_DANG_NHAP/,
      "khách chưa đăng nhập phải bị từ chối",
    );
  });

  it("phòng có mật khẩu chỉ cho vào khi nhập đúng", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {
      tenPhong: "Phòng kín", matKhau: "vietnam",
    });
    assert.strictEqual(room.state.coMatKhau, true);

    // Chủ phòng vào trước, nếu không phòng rỗng sẽ tự đóng sau lần từ chối đầu.
    const chu = await noi(room, "A", { matKhau: "vietnam" });
    assert.ok(chu.sessionId, "nhập đúng mật khẩu thì phải vào được");

    await assert.rejects(() => noi(room, "B", { matKhau: "sai" }), /SAI_MAT_KHAU/);
    await assert.rejects(() => noi(room, "B", {}), /SAI_MAT_KHAU/);
    assert.strictEqual(room.state.nguoiChoi.size, 1, "người sai mật khẩu không được tính vào phòng");
  });

  it("thông tin phòng ở sảnh không lộ mật khẩu", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {
      tenPhong: "Phòng kín", matKhau: "vietnam",
    });
    await noi(room, "A", { matKhau: "vietnam" });
    await room.waitForNextPatch();

    const mota = JSON.stringify(room.metadata ?? {});
    assert.ok(mota.includes("Phòng kín"), "phải có tên phòng");
    assert.ok(mota.includes("coMatKhau"), "phải có cờ báo phòng khoá");
    assert.ok(!mota.includes("vietnam"), "không được lộ mật khẩu");

    const state = JSON.stringify(room.state.toJSON());
    assert.ok(!state.includes("vietnam"), "state gửi cho client cũng không được lộ mật khẩu");
  });

  it("ván đã bắt đầu thì người thứ ba không vào được", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();
    assert.strictEqual(room.state.giaiDoan, "tung");

    // Ván bắt đầu thì phòng bị khoá ở tầng ghép trận, nên lời từ chối đến
    // trước cả onAuth. Chấp nhận cả hai thông điệp.
    await assert.rejects(() => noi(room, "C"), /locked|DA_BAT_DAU/);
    assert.strictEqual(room.state.nguoiChoi.size, 2);
  });

  it("người chơi lấy tên từ tài khoản đăng nhập, không phải từ client gửi lên", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "Hùng", { ten: "KẺ GIẢ MẠO" });
    const p = room.state.nguoiChoi.get(a.sessionId)!;
    assert.strictEqual(p.ten, "Hùng");
    assert.strictEqual(p.uid, "test:Hùng");
    assert.strictEqual(p.tien, TIEN_BAN_DAU);
    assert.strictEqual(p.viTri, 0);
  });

  it("hai người vào cùng phòng thì không trùng màu", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    const ma = room.state.nguoiChoi.get(a.sessionId)!.mau;
    const mb = room.state.nguoiChoi.get(b.sessionId)!.mau;
    assert.notStrictEqual(ma, mb);
  });

  /* ------------------------------------------------------- luồng ván chơi */

  it("ván chỉ bắt đầu khi đủ 2 người và tất cả sẵn sàng", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");

    a.send("sanSang");
    await room.waitForNextPatch();
    assert.strictEqual(room.state.giaiDoan, "cho", "một người sẵn sàng là chưa đủ");

    b.send("sanSang");
    await room.waitForNextPatch();
    assert.strictEqual(room.state.giaiDoan, "tung");
    assert.ok(room.state.luotCua.length > 0);
  });

  it("không phải lượt mình thì tung xúc xắc bị bỏ qua", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();

    const khongDenLuot = room.state.luotCua === a.sessionId ? b : a;
    const viTriTruoc = room.state.nguoiChoi.get(khongDenLuot.sessionId)!.viTri;

    khongDenLuot.send("tungXucXac");
    await room.waitForNextPatch();

    assert.strictEqual(
      room.state.nguoiChoi.get(khongDenLuot.sessionId)!.viTri,
      viTriTruoc,
      "quân của người chưa tới lượt không được di chuyển",
    );
  });

  it("tung xúc xắc thì quân di chuyển và mở quyết định", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();

    const dangDi = room.state.luotCua === a.sessionId ? a : b;
    dangDi.send("tungXucXac");
    await room.waitForNextPatch();

    const tong = room.state.xx1 + room.state.xx2;
    assert.ok(tong >= 2 && tong <= 12, `điểm xúc xắc phải từ 2 tới 12, nhận ${tong}`);
    assert.ok(room.state.hanhDong.length > 0, "phải có ít nhất một hành động hợp lệ");
  });

  it("mua đất thì trừ đúng tiền và ghi nhận chủ sở hữu", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();

    let dangDi = room.state.luotCua === a.sessionId ? a : b;
    let vong = 0;
    while (!room.state.hanhDong.split(",").includes("mua") && vong++ < 40) {
      if (room.state.giaiDoan === "tung") dangDi.send("tungXucXac");
      else dangDi.send(room.state.hanhDong.split(",").includes("tra") ? "tra" : "tieptuc");
      await room.waitForNextPatch();
      dangDi = room.state.luotCua === a.sessionId ? a : b;
    }
    assert.ok(vong < 40, "sau 40 lượt vẫn chưa gặp ô trống nào để mua");

    const sid = room.state.luotCua;
    const i = room.state.oChoQuyet;
    const gia = giaMua(BAN_CO[i]);
    const truoc = room.state.nguoiChoi.get(sid)!.tien;

    dangDi.send("mua");
    await room.waitForNextPatch();

    assert.strictEqual(room.state.o[i].chu, sid, "ô phải thuộc về người vừa mua");
    assert.strictEqual(room.state.nguoiChoi.get(sid)!.tien, truoc - gia);
  });

  /* ----------------------------------------------------- công thức luật */

  it("tiền thuê đất lẻ bằng mức cơ bản, trọn nhóm thì nhân đôi", () => {
    const o = BAN_CO.find((x) => x.ten === "Đồng Văn")!;
    const khac = BAN_CO.find((x) => x.ten === "Mèo Vạc")!;
    const coBan = bangThue(o.gia!)[0];

    const trangThai = BAN_CO.map(() => ({ chu: "", nha: 0, theChap: false }));
    trangThai[o.i].chu = "A";
    const doc = (i: number) => trangThai[i];

    assert.strictEqual(tienThue(doc, o.i, "B", 7), coBan * 1000);

    trangThai[khac.i].chu = "A";
    assert.strictEqual(tienThue(doc, o.i, "B", 7), coBan * 2 * 1000);

    assert.strictEqual(tienThue(doc, o.i, "A", 7), 0);

    trangThai[o.i].theChap = true;
    assert.strictEqual(tienThue(doc, o.i, "B", 7), 0);
  });

  it("ô tiện ích tính tiền thuê theo điểm xúc xắc", () => {
    const dien = BAN_CO.find((x) => x.ten === "NHÀ MÁY ĐIỆN")!;
    const nuoc = BAN_CO.find((x) => x.ten === "NHÀ MÁY NƯỚC")!;
    const trangThai = BAN_CO.map(() => ({ chu: "", nha: 0, theChap: false }));
    const doc = (i: number) => trangThai[i];

    trangThai[dien.i].chu = "A";
    assert.strictEqual(tienThue(doc, dien.i, "B", 8), 8 * 4 * 1000);

    trangThai[nuoc.i].chu = "A";
    assert.strictEqual(tienThue(doc, dien.i, "B", 8), 8 * 10 * 1000);
  });
});

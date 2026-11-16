import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { BAN_CO, TIEN_BAN_DAU, bangThue, giaMua, tienThue } from "@co-ty-phu/shared";
import appConfig from "../src/app.config.js";
import type { GameState } from "../src/rooms/schema/GameState.js";

describe("Phòng cờ tỷ phú", () => {
  let colyseus: ColyseusTestServer;

  before(async () => { colyseus = await boot(appConfig); });
  after(async () => { await colyseus.shutdown(); });
  beforeEach(async () => { await colyseus.cleanup(); });

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

  it("người mới vào có đủ tiền ban đầu và đứng ở ô Xuất phát", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const client = await colyseus.connectTo(room, { ten: "Hùng" });
    const p = room.state.nguoiChoi.get(client.sessionId)!;
    assert.strictEqual(p.ten, "Hùng");
    assert.strictEqual(p.tien, TIEN_BAN_DAU);
    assert.strictEqual(p.viTri, 0);
    assert.strictEqual(room.state.giaiDoan, "cho");
    assert.strictEqual(room.state.o.length, 36);
  });

  it("ván chỉ bắt đầu khi đủ 2 người và tất cả sẵn sàng", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await colyseus.connectTo(room, { ten: "A" });
    const b = await colyseus.connectTo(room, { ten: "B" });

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
    const a = await colyseus.connectTo(room, { ten: "A" });
    const b = await colyseus.connectTo(room, { ten: "B" });
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
    const a = await colyseus.connectTo(room, { ten: "A" });
    const b = await colyseus.connectTo(room, { ten: "B" });
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
    const a = await colyseus.connectTo(room, { ten: "A" });
    const b = await colyseus.connectTo(room, { ten: "B" });
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();

    // Tung cho tới khi dừng ở một ô mua được còn trống.
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

    // Chủ đứng trên đất của chính mình thì không phải trả gì.
    assert.strictEqual(tienThue(doc, o.i, "A", 7), 0);

    // Đang thế chấp thì không thu được tiền thuê.
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

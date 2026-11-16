import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { JWT } from "@colyseus/auth";
import {
  BAC_KHACH_SAN, BAN_CO, O_DAO_HOANG, SO_BIEN, SO_NHOM_THANG, SO_O, TIEN_BAN_DAU,
  bangThue, coTheXay, giaMua, giaMuaDut, giaXay, thangNgay, tienThue,
} from "@co-ty-phu/shared";
import type { TrangThaiO } from "@co-ty-phu/shared";
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

  it("bàn cờ có đúng 32 ô: 21 ô đất, 3 ô biển, 4 góc, 3 cơ hội, 1 thuế", () => {
    assert.strictEqual(BAN_CO.length, 32);
    const dem = (loai: string) => BAN_CO.filter((o) => o.loai === loai).length;
    assert.strictEqual(dem("dat"), 21);
    assert.strictEqual(dem("bien"), 3);
    assert.strictEqual(dem("goc"), 4);
    assert.strictEqual(dem("cohoi"), 3);
    assert.strictEqual(dem("thue"), 1);
    assert.strictEqual(SO_BIEN, 3, "SO_BIEN phải đếm đúng số ô biển trên bàn");
  });

  it("bốn ô góc nằm đúng ở bốn góc, mỗi cạnh 7 ô thường", () => {
    for (const i of [0, 8, 16, 24]) {
      assert.strictEqual(BAN_CO[i].loai, "goc", `ô ${i} phải là ô góc`);
    }
    assert.strictEqual(O_DAO_HOANG, 8);
  });

  it("mỗi nhóm tỉnh thành có 2 hoặc 3 ô", () => {
    const theoNhom = new Map<string, number>();
    for (const o of BAN_CO) {
      if (!o.nhom) continue;
      theoNhom.set(o.nhom, (theoNhom.get(o.nhom) ?? 0) + 1);
    }
    assert.strictEqual(theoNhom.size, 8);
    for (const [nhom, so] of theoNhom) {
      assert.ok(so === 2 || so === 3, `nhóm ${nhom} có ${so} ô, phải là 2 hoặc 3`);
    }
  });

  it("bảng tiền thuê có 5 bậc và tăng dần", () => {
    const b = bangThue(400);
    assert.strictEqual(b.length, 5, "mua đất, 1 nhà, 2 nhà, 3 nhà, khách sạn");
    assert.strictEqual(BAC_KHACH_SAN, 4);
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

  /** Bàn cờ trắng để thử các hàm luật mà không cần mở phòng. */
  function banTrang(): { o: TrangThaiO[]; doc: (i: number) => TrangThaiO } {
    const o: TrangThaiO[] = BAN_CO.map(() => ({
      chu: "", nha: 0, theChap: false, matDien: 0,
    }));
    return { o, doc: (i: number) => o[i] };
  }

  const timO = (ten: string) => BAN_CO.find((x) => x.ten === ten)!;

  it("tiền thuê đất lẻ bằng mức cơ bản, trọn nhóm thì nhân đôi", () => {
    const o = timO("Đồng Văn");
    const coBan = bangThue(o.gia!)[0];
    const { o: tt, doc } = banTrang();

    tt[o.i].chu = "A";
    assert.strictEqual(tienThue(doc, o.i, "B"), coBan * 1000);

    // Hà Giang có ba ô, phải đủ cả ba mới được tính là trọn nhóm.
    tt[timO("Mèo Vạc").i].chu = "A";
    assert.strictEqual(tienThue(doc, o.i, "B"), coBan * 1000, "thiếu một ô thì chưa trọn nhóm");
    tt[timO("Lũng Cú").i].chu = "A";
    assert.strictEqual(tienThue(doc, o.i, "B"), coBan * 2 * 1000);

    assert.strictEqual(tienThue(doc, o.i, "A"), 0, "chủ ô không tự trả tiền mình");

    tt[o.i].theChap = true;
    assert.strictEqual(tienThue(doc, o.i, "B"), 0);
  });

  it("ô mất điện thì chủ không thu được tiền thuê", () => {
    const o = timO("Hoàn Kiếm");
    const { o: tt, doc } = banTrang();
    tt[o.i].chu = "A";
    tt[o.i].nha = BAC_KHACH_SAN;
    assert.ok(tienThue(doc, o.i, "B") > 0, "khách sạn bình thường phải thu được tiền");

    tt[o.i].matDien = 5;
    assert.strictEqual(tienThue(doc, o.i, "B"), 0, "mất điện thì miễn phí");
  });

  it("giá mua đứt bằng gấp đôi vốn chủ cũ đã bỏ ra", () => {
    const o = timO("Hoàn Kiếm");
    const { o: tt } = banTrang();
    tt[o.i].chu = "A";

    // Mới cắm cờ: gấp đôi giá mua.
    assert.strictEqual(giaMuaDut(o, tt[o.i]), giaMua(o) * 2);

    // Có hai nhà: gấp đôi cả giá mua lẫn tiền đã xây.
    tt[o.i].nha = 2;
    assert.strictEqual(giaMuaDut(o, tt[o.i]), (giaMua(o) + 2 * giaXay(o)) * 2);
  });

  it("vòng đầu không ai được xây tới bậc 3 nhà", () => {
    const { o: tt, doc } = banTrang();
    const nhom = BAN_CO.filter((x) => x.nhom === "hagiang");
    for (const x of nhom) { tt[x.i].chu = "A"; tt[x.i].nha = 2; }

    const tien = 10_000_000;
    const vong1 = coTheXay(doc, nhom[0].i, "A", tien, 32, 12, 1);
    assert.strictEqual(vong1.ok, false);
    assert.match(vong1.lyDo!, /[Vv]òng đầu/);

    const vong2 = coTheXay(doc, nhom[0].i, "A", tien, 32, 12, 2);
    assert.strictEqual(vong2.ok, true, "qua Xuất phát rồi thì xây tiếp được");
  });

  it("gom đủ toàn bộ ô biển là thắng ngay", () => {
    const { o: tt, doc } = banTrang();
    const bien = BAN_CO.filter((x) => x.loai === "bien");
    for (const x of bien.slice(0, bien.length - 1)) tt[x.i].chu = "A";
    assert.strictEqual(thangNgay(doc, "A"), null, "thiếu một ô biển thì chưa thắng");

    tt[bien[bien.length - 1].i].chu = "A";
    assert.strictEqual(thangNgay(doc, "A"), "bien");
  });

  it("sở hữu trọn ba nhóm đất là thắng ngay", () => {
    const { o: tt, doc } = banTrang();
    const nhom = ["hagiang", "laocai", "ninhbinh"] as const;

    for (const k of nhom.slice(0, SO_NHOM_THANG - 1)) {
      for (const x of BAN_CO.filter((o) => o.nhom === k)) tt[x.i].chu = "A";
    }
    assert.strictEqual(thangNgay(doc, "A"), null, "hai nhóm thì chưa thắng");

    for (const x of BAN_CO.filter((o) => o.nhom === nhom[SO_NHOM_THANG - 1])) {
      tt[x.i].chu = "A";
    }
    assert.strictEqual(thangNgay(doc, "A"), "nhom");
  });

  /* ------------------------------------------------- hướng di chuyển */

  /**
   * `buocCuoi` là số ô của nước đi vừa rồi, có dấu. Client dựa vào nó để chạy
   * hoạt ảnh, nên dấu phải khớp với điều luật chơi thực sự làm. Trước đây
   * client tự đoán bằng đường ngắn nhất: thẻ "đi thẳng về ô Xuất phát" từ ô 14
   * là đi tới 18 ô và được nhận lương, nhưng đường ngắn nhất là lùi 14 ô nên
   * quân chạy ngược trong khi nhật ký báo đã qua Xuất phát.
   */
  async function vanHaiNguoi() {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();
    return { room, a, b };
  }

  it("đi bằng xúc xắc thì buocCuoi bằng tổng điểm và luôn dương", async () => {
    const { room, a, b } = await vanHaiNguoi();
    const dangDi = room.state.luotCua === a.sessionId ? a : b;
    const sid = room.state.luotCua;

    dangDi.send("tungXucXac");
    await room.waitForNextPatch();

    const p = room.state.nguoiChoi.get(sid)!;
    const tong = room.state.xx1 + room.state.xx2;
    // Thẻ bài hoặc ba lần đôi có thể dời quân tiếp; chỉ kiểm khi chưa bị dời.
    if (!p.oDao && p.buocCuoi === tong) {
      assert.ok(p.buocCuoi > 0, "đi bằng xúc xắc luôn là đi tới");
    }
  });

  it("mọi nước đi đều khớp giữa vị trí mới và số bước báo ra", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const p = room.state.nguoiChoi.get(a.sessionId)!;
    const phong: any = room;

    // Gọi thẳng từng cách dời quân, không qua mạng, để kết quả tất định.
    for (const batDau of [0, 7, 13, 20, 27, 31]) {
      for (const soO of [1, 2, 7, 12]) {
        p.viTri = batDau;
        phong.diChuyen(p, soO);
        const mong = (batDau + soO) % SO_O;
        assert.strictEqual(p.viTri, mong, `đi ${soO} ô từ ${batDau}`);
        assert.strictEqual(p.buocCuoi, soO, `số bước báo ra khi đi ${soO} ô từ ${batDau}`);
      }

      for (const dich of [0, 8, 18, 21]) {
        p.viTri = batDau;
        phong.nhayToi(p, dich);
        assert.strictEqual(p.viTri, dich);
        assert.ok(p.buocCuoi >= 0, "đi thẳng tới một ô không bao giờ là lùi");
        assert.strictEqual(
          ((batDau + p.buocCuoi) % SO_O + SO_O) % SO_O, dich,
          `từ ${batDau} đi ${p.buocCuoi} bước phải tới ${dich}`,
        );
      }
    }
  });

  it("thẻ đi thẳng tới một ô được tính là đi tới, không phải lùi", async () => {
    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const a = await noi(room, "A");
    const b = await noi(room, "B");
    a.send("sanSang"); b.send("sanSang");
    await room.waitForNextPatch();

    const sid = room.state.luotCua;
    const p = room.state.nguoiChoi.get(sid)!;
    const phong: any = room;

    // Đứng ở ô 14, thẻ đưa về ô Xuất phát: đi tới 18 ô chứ không phải lùi 14.
    p.viTri = 14;
    phong.nhayToi(p, 0);
    assert.strictEqual(p.viTri, 0);
    assert.strictEqual(p.buocCuoi, SO_O - 14, "phải là đi tới để khớp với tiền lương");
    assert.ok(p.buocCuoi > 0);

    // Bị đưa thẳng vào Đảo Hoang thì không bước qua ô nào.
    phong.vaoDao(p);
    assert.strictEqual(p.viTri, O_DAO_HOANG);
    assert.strictEqual(p.buocCuoi, 0, "dời thẳng thì client nhảy một nhịp, không đi bộ");
    void b;
  });
});

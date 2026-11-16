import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { JWT } from "@colyseus/auth";
import {
  BAC_KHACH_SAN, BAN_CO, O_DAO_HOANG, SO_BIEN, SO_NHOM_THANG, SO_O, TIEN_BAN_DAU,
  HE_SO_LE_HOI, HE_SO_LE_HOI_TOAN_QUOC, SO_LE_HOI_THUONG,
  SO_NHA_TOI_DA, SO_KHACH_SAN_TOI_DA,
  bangThue, bangThueBien, coTheGiangCo, coTheMuaDut, coTheXay, giaMua,
  giaMuaDut, giaMuaThucTe, giaXay, thangNgay, tienThue,
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

  it("bàn cờ có đúng 32 ô: 20 ô đất, 4 ô biển, 4 góc, 3 cơ hội, 1 thuế", () => {
    assert.strictEqual(BAN_CO.length, 32);
    const dem = (loai: string) => BAN_CO.filter((o) => o.loai === loai).length;
    assert.strictEqual(dem("dat"), 20);
    assert.strictEqual(dem("bien"), 4);
    assert.strictEqual(dem("goc"), 4);
    assert.strictEqual(dem("cohoi"), 3);
    assert.strictEqual(dem("thue"), 1);
    assert.strictEqual(SO_BIEN, 4, "SO_BIEN phải đếm đúng số ô biển trên bàn");
  });

  it("khách sạn ở ô đắt nhất không vượt quá hai lần tiền khởi điểm", () => {
    // Chốt chặn cân bằng: từ khi bỏ luật trọn nhóm, một ô lẻ cũng lên được
    // khách sạn, nên bậc cuối mà quá cao thì dừng vào đó là phá sản ngay.
    const datMax = BAN_CO
      .filter((o) => o.loai === "dat")
      .reduce((re, o) => ((o.gia ?? 0) > (re.gia ?? 0) ? o : re));
    const khachSan = bangThue(datMax.gia!)[BAC_KHACH_SAN] * 1000;
    assert.ok(
      khachSan <= TIEN_BAN_DAU * 2,
      `khách sạn ở ${datMax.ten} thu ${khachSan}, quá nặng so với ${TIEN_BAN_DAU} khởi điểm`,
    );
  });

  it("bảng tiền thuê ô biển có đúng một mức cho mỗi ô biển", () => {
    const b = bangThueBien();
    assert.strictEqual(b.length, SO_BIEN);
    for (let i = 1; i < b.length; i++) {
      assert.ok(b[i] > b[i - 1], `mức ${i + 1} ô biển phải cao hơn mức ${i}`);
    }
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
      leHoi: false, leHoiToanQuoc: false,
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

  it("cờ lễ hội làm tiền thuê và giá mua đắt lên theo đúng hệ số", () => {
    const o = timO("Hoàn Kiếm");
    const { o: tt, doc } = banTrang();
    tt[o.i].chu = "A";
    const thueGoc = tienThue(doc, o.i, "B");
    const giaGoc = giaMuaThucTe(o, tt[o.i]);
    assert.ok(thueGoc > 0);
    assert.strictEqual(giaGoc, giaMua(o), "chưa có cờ thì đúng giá niêm yết");

    tt[o.i].leHoi = true;
    assert.strictEqual(tienThue(doc, o.i, "B"), thueGoc * HE_SO_LE_HOI);
    assert.strictEqual(giaMuaThucTe(o, tt[o.i]), giaGoc * HE_SO_LE_HOI);

    tt[o.i].leHoi = false;
    tt[o.i].leHoiToanQuoc = true;
    assert.strictEqual(tienThue(doc, o.i, "B"), thueGoc * HE_SO_LE_HOI_TOAN_QUOC);

    // Một ô mang cả hai cờ thì hai hệ số nhân với nhau.
    tt[o.i].leHoi = true;
    const ca2 = HE_SO_LE_HOI * HE_SO_LE_HOI_TOAN_QUOC;
    assert.strictEqual(tienThue(doc, o.i, "B"), thueGoc * ca2);
    assert.strictEqual(giaMuaThucTe(o, tt[o.i]), giaGoc * ca2);
    assert.strictEqual(
      giaMuaDut(o, tt[o.i]), giaGoc * ca2 * 2,
      "giá mua đứt tính trên giá đã nhân cờ lễ hội",
    );
  });

  it("cờ lễ hội thường không bao giờ rơi vào ô góc, cơ hội hay thuế", () => {
    const hopLe = BAN_CO.filter(coTheGiangCo);
    assert.ok(hopLe.length >= SO_LE_HOI_THUONG);
    for (const o of hopLe) {
      assert.ok(
        o.loai === "dat" || o.loai === "bien",
        `${o.ten} không được phép giăng cờ lễ hội`,
      );
    }
    for (const o of BAN_CO) {
      if (o.loai === "goc" || o.loai === "cohoi" || o.loai === "thue") {
        assert.ok(!coTheGiangCo(o), `${o.ten} phải bị loại khỏi danh sách giăng cờ`);
      }
    }
  });

  it("mở ván thì giăng đúng số cờ lễ hội thường, không có lễ hội toàn quốc", async () => {
    const { room } = await vanHaiNguoi();
    const co = [...room.state.o].filter((t: any) => t.leHoi);
    assert.strictEqual(co.length, SO_LE_HOI_THUONG);
    for (let i = 0; i < SO_O; i++) {
      if (!room.state.o[i].leHoi) continue;
      assert.ok(coTheGiangCo(BAN_CO[i]), `${BAN_CO[i].ten} không được giăng cờ`);
    }
    assert.strictEqual(
      [...room.state.o].filter((t: any) => t.leHoiToanQuoc).length, 0,
      "đầu ván chưa ai đăng cai lễ hội toàn quốc",
    );
  });

  it("lễ hội toàn quốc chỉ nằm ở đúng một ô, dời đi thì chỗ cũ hạ cờ", async () => {
    const { room, a } = await vanHaiNguoi();
    const phong: any = room;
    const sid = a.sessionId;
    const nhom = BAN_CO.filter((x) => x.nhom === "hagiang");
    for (const x of nhom) room.state.o[x.i].chu = sid;

    phong.apDungChon(sid, "leHoiToanQuoc", nhom[0].i);
    assert.strictEqual(room.state.o[nhom[0].i].leHoiToanQuoc, true);

    phong.apDungChon(sid, "leHoiToanQuoc", nhom[1].i);
    assert.strictEqual(room.state.o[nhom[0].i].leHoiToanQuoc, false, "chỗ cũ phải hạ cờ");
    assert.strictEqual(room.state.o[nhom[1].i].leHoiToanQuoc, true);
    assert.strictEqual(
      [...room.state.o].filter((t: any) => t.leHoiToanQuoc).length, 1,
      "cả bàn chỉ được có một lễ hội toàn quốc",
    );
  });

  it("ô biển và ô khách sạn không ai mua đứt được", () => {
    const { o: tt, doc } = banTrang();
    const giau = 99_999_999;

    const bien = BAN_CO.find((x) => x.loai === "bien")!;
    tt[bien.i].chu = "A";
    const kqBien = coTheMuaDut(doc, bien.i, "B", giau);
    assert.strictEqual(kqBien.ok, false, "ô biển phải tự đi tới mà mua");
    assert.match(kqBien.lyDo!, /[Oo]\u0300? ?bi\u1ec3n|bi\u1ec3n/);

    const dat = timO("Ho\u00e0n Ki\u1ebfm");
    tt[dat.i].chu = "A";
    assert.strictEqual(coTheMuaDut(doc, dat.i, "B", giau).ok, true, "\u00f4 \u0111\u1ea5t th\u01b0\u1eddng th\u00ec mua \u0111\u1ee9t \u0111\u01b0\u1ee3c");

    tt[dat.i].nha = BAC_KHACH_SAN;
    assert.strictEqual(coTheMuaDut(doc, dat.i, "B", giau).ok, false, "kh\u00e1ch s\u1ea1n b\u1ea5t kh\u1ea3 x\u00e2m ph\u1ea1m");

    tt[dat.i].nha = 1;
    tt[dat.i].theChap = true;
    assert.strictEqual(coTheMuaDut(doc, dat.i, "B", giau).ok, false, "\u00f4 \u0111ang th\u1ebf ch\u1ea5p");
  });

  it("xây được trên một ô lẻ, không cần trọn nhóm và không phải xây đều", () => {
    const { o: tt, doc } = banTrang();
    const nhom = BAN_CO.filter((x) => x.nhom === "hagiang");
    const tien = 10_000_000;

    // Chỉ sở hữu đúng một ô trong nhóm ba ô.
    tt[nhom[0].i].chu = "A";
    assert.strictEqual(
      coTheXay(doc, nhom[0].i, "A", tien, 32, 12).ok, true,
      "một ô lẻ vẫn xây được",
    );

    // Dồn hết nhà vào ô đó trong khi hai ô kia trống: không còn luật xây đều.
    tt[nhom[0].i].nha = BAC_KHACH_SAN - 1;
    tt[nhom[1].i].chu = "A";
    assert.strictEqual(
      coTheXay(doc, nhom[0].i, "A", tien, 32, 12).ok, true,
      "lệch bao nhiêu nhà cũng được",
    );

    // Ô của người khác thì vẫn không đụng vào được.
    assert.strictEqual(coTheXay(doc, nhom[2].i, "A", tien, 32, 12).ok, false);
  });

  it("ô đang thế chấp thì không xây được", () => {
    const { o: tt, doc } = banTrang();
    const o = timO("Hoàn Kiếm");
    tt[o.i].chu = "A";
    tt[o.i].theChap = true;
    const kq = coTheXay(doc, o.i, "A", 10_000_000, 32, 12);
    assert.strictEqual(kq.ok, false);
    assert.match(kq.lyDo!, /thế chấp/);
  });

  it("vòng đầu không ai được xây tới bậc 3 nhà", () => {
    const { o: tt, doc } = banTrang();
    const o = timO("Đồng Văn");
    tt[o.i].chu = "A";
    tt[o.i].nha = 2;

    const tien = 10_000_000;
    const vong1 = coTheXay(doc, o.i, "A", tien, 32, 12, 1);
    assert.strictEqual(vong1.ok, false);
    assert.match(vong1.lyDo!, /[Vv]òng đầu/);

    const vong2 = coTheXay(doc, o.i, "A", tien, 32, 12, 2);
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
  /* ------------------------------------------------- tự chơi hết một ván */

  /**
   * Chơi trọn một ván bốn người từ đầu tới lúc có người thắng.
   *
   * Đây là lưới an toàn cho toàn bộ luồng ván chơi. Nó không kiểm một luật
   * cụ thể nào mà kiểm thứ khó thấy hơn: ván không bao giờ kẹt. Mỗi vòng lặp
   * nhìn giai đoạn hiện tại rồi gửi đúng một tin nhắn hợp lệ, nên nếu có
   * trạng thái nào server mở ra mà không có đường đi tiếp, trạng thái đó sẽ
   * đứng im và test báo lỗi kèm tên giai đoạn — thay vì treo im lìm.
   *
   * Cố ý KHÔNG dựa vào đồng hồ hết giờ của server: nếu phải chờ hết giờ mới
   * đi tiếp được thì đó đã là lỗi rồi.
   */
  it("bốn người chơi trọn một ván, không kẹt ở bất cứ giai đoạn nào", async function () {
    this.timeout(60_000);

    const room = await colyseus.createRoom<GameState>("co_ty_phu", {});
    const ten = ["A", "B", "C", "D"];
    const client: Record<string, any> = {};
    for (const t of ten) {
      const c = await noi(room, t);
      client[c.sessionId] = c;
    }
    assert.strictEqual(room.state.nguoiChoi.size, 4);
    for (const sid of Object.keys(client)) client[sid].send("sanSang");
    await room.waitForNextPatch();
    assert.notStrictEqual(room.state.giaiDoan, "cho", "đủ bốn người sẵn sàng thì ván phải chạy");

    /** Chữ ký trạng thái, đổi là ván có tiến triển. */
    const chuKy = () =>
      [
        room.state.giaiDoan, room.state.luotCua, room.state.hanhDong,
        room.state.kieuChon, room.state.oChoQuyet, room.state.tienCanGom,
        room.state.xx1, room.state.xx2, room.state.congBoSo,
        [...room.state.nguoiChoi.values()].map((p) => `${p.viTri}:${p.tien}`).join("|"),
        [...room.state.o].map((t: any) => `${t.chu}${t.nha}`).join(""),
      ].join("/");

    const nghi = () => new Promise((r) => setTimeout(r, 12));
    let truoc = chuKy();
    let imLang = 0;
    let soNuoc = 0;

    for (let vong = 0; vong < 6000; vong++) {
      if (room.state.giaiDoan === "ketthuc") break;

      const sid = room.state.luotCua;
      const c = sid ? client[sid] : undefined;
      const gd = room.state.giaiDoan;
      const hd = room.state.hanhDong ? room.state.hanhDong.split(",") : [];

      if (c) {
        if (gd === "tung") {
          c.send("tungXucXac");
        } else if (gd === "gom") {
          c.send("tudong");
        } else if (gd === "chon") {
          if (room.state.kieuChon === "tangNguoi") {
            c.send("chon", { nguoi: room.state.nguoiChonDuoc.split(",")[0] });
          } else {
            c.send("chon", { o: Number(room.state.oChonDuoc.split(",")[0]) });
          }
        } else if (gd === "quyet") {
          // Mua và xây hăng để ván tiến tới một điều kiện thắng, chứ cứ bỏ
          // qua hết thì hai nghìn vòng vẫn chưa ai hơn ai.
          const chon = ["mua", "xay", "muadut", "tieptuc", "boqua"].find((x) => hd.includes(x));
          if (chon) c.send(chon);
        }
        soNuoc++;
      }

      await nghi();

      const bayGio = chuKy();
      if (bayGio === truoc) {
        imLang++;
        assert.ok(
          imLang < 80,
          `ván kẹt ở giai đoạn "${gd}" (kiểuChọn "${room.state.kieuChon}", `
            + `hành động "${room.state.hanhDong}") sau ${soNuoc} nước đi`,
        );
      } else {
        imLang = 0;
        truoc = bayGio;
      }
    }

    assert.strictEqual(
      room.state.giaiDoan, "ketthuc",
      `sau ${soNuoc} nước đi ván vẫn chưa xong, có thể luật đang không dẫn tới kết cục nào`,
    );
    assert.ok(room.state.nguoiThang, "phải có người thắng");

    // Một dòng tóm tắt: chạy test nhiều lần là thấy ngay ván thường kết thúc
    // bằng cách nào và dài bao nhiêu — dữ liệu cân bằng rẻ tiền nhất có.
    const conSong = [...room.state.nguoiChoi.values()].filter((p) => !p.phaSan).length;
    console.log(
      `      [ván] thắng vì "${room.state.lyDoThang}" sau ${soNuoc} nước đi, `
        + `${conSong}/4 người còn trụ`,
    );
    assert.ok(
      ["bien", "nhom", "conlai"].includes(room.state.lyDoThang),
      `lý do thắng lạ: ${room.state.lyDoThang}`,
    );

    // Hộp cờ phải cân: số nhà trên bàn cộng số còn trong hộp đúng bằng tổng.
    let nhaTrenBan = 0;
    let ksTrenBan = 0;
    for (const o of BAN_CO) {
      const tt = room.state.o[o.i];
      if (o.loai !== "dat") continue;
      if (tt.nha >= BAC_KHACH_SAN) ksTrenBan++;
      else nhaTrenBan += tt.nha;
    }
    assert.strictEqual(
      nhaTrenBan + room.state.nhaConLai, SO_NHA_TOI_DA,
      "số nhà trên bàn cộng số trong hộp phải luôn bằng tổng ban đầu",
    );
    assert.strictEqual(
      ksTrenBan + room.state.khachSanConLai, SO_KHACH_SAN_TOI_DA,
      "số khách sạn trên bàn cộng số trong hộp phải luôn bằng tổng ban đầu",
    );

    // Lễ hội toàn quốc, nếu có, chỉ được nằm ở đúng một ô.
    assert.ok(
      [...room.state.o].filter((t: any) => t.leHoiToanQuoc).length <= 1,
      "cả bàn chỉ được có nhiều nhất một lễ hội toàn quốc",
    );
  });
});

import { Room, Client, CloseCode, Delayed } from "colyseus";
import {
  BAN_CO, DON_VI, LUONG, LUOT_KET_DAO, O_DAO_HOANG, O_XUAT_PHAT, SO_O,
  TIEN_BAN_DAU, TIEN_RA_DAO, coTheMua, coTheXay, dinhDang,
  giaMua, giaTheChap, giaXay, khaNangChiTra, tienThue,
  type DocO,
} from "@co-ty-phu/shared";
import { GameState, NguoiChoi, DongNhatKy, TrangThaiO as OSchema } from "./schema/GameState.js";
import { gieoXucXac, tron } from "../rng.js";
import { BO_CO_HOI, BO_KHI_VAN, type The } from "../cards.js";

/** Thời gian cho mỗi lượt tung xúc xắc. */
const GIAY_TUNG = 30_000;
/** Thời gian để quyết định mua, trả hay xây. */
const GIAY_QUYET = 25_000;
/** Giữ ghế bao lâu khi người chơi rớt mạng. */
const GIAY_GIU_GHE = 60;
/** Số dòng nhật ký giữ lại trong state. */
const SO_DONG_NHAT_KY = 14;

export class CoTyPhuRoom extends Room<{ state: GameState }> {
  maxClients = 4;
  state = new GameState();

  private dongHo?: Delayed;
  private boCoHoi: The[] = [];
  private boKhiVan: The[] = [];

  /** Bộ đọc trạng thái ô để dùng lại các hàm luật trong package shared. */
  private get doc(): DocO {
    return (i: number) => this.state.o[i];
  }

  // ---------------------------------------------------------------- vòng đời

  onCreate() {
    for (let i = 0; i < SO_O; i++) this.state.o.push(new OSchema());
    this.boCoHoi = tron([...BO_CO_HOI]);
    this.boKhiVan = tron([...BO_KHI_VAN]);
    this.ghi("Phòng đã mở. Cần ít nhất 2 người và tất cả bấm Sẵn sàng.", "he-thong");
  }

  onJoin(client: Client, options: { ten?: string } = {}) {
    const p = new NguoiChoi();
    p.ten = (options.ten || "").trim().slice(0, 16) || `Người ${this.state.nguoiChoi.size + 1}`;
    p.mau = this.state.nguoiChoi.size;
    p.thuTu = this.state.nguoiChoi.size;
    p.tien = TIEN_BAN_DAU;
    p.viTri = O_XUAT_PHAT;
    this.state.nguoiChoi.set(client.sessionId, p);
    this.ghi(`${p.ten} vào phòng.`, "he-thong");
  }

  onLeave(client: Client, code: CloseCode) {
    const p = this.state.nguoiChoi.get(client.sessionId);
    if (!p) return;
    this.ghi(`${p.ten} rời phòng.`, "he-thong");

    if (this.state.giaiDoan === "cho") {
      this.state.nguoiChoi.delete(client.sessionId);
      return;
    }
    // Ván đang chạy: coi như phá sản để tài sản quay lại thị trường.
    this.choPhaSan(client.sessionId);
    if (this.state.luotCua === client.sessionId) this.sangLuotKe();
  }

  onDrop(client: Client) {
    const p = this.state.nguoiChoi.get(client.sessionId);
    if (p) p.ketNoi = false;
    this.allowReconnection(client, GIAY_GIU_GHE).catch(() => {});
  }

  onReconnect(client: Client) {
    const p = this.state.nguoiChoi.get(client.sessionId);
    if (p) {
      p.ketNoi = true;
      this.ghi(`${p.ten} đã kết nối lại.`, "he-thong");
    }
  }

  onDispose() {
    this.dongHo?.clear();
  }

  // -------------------------------------------------------------- tin nhắn

  messages = {
    /** Bật tắt trạng thái sẵn sàng khi còn ở phòng chờ. */
    sanSang: (client: Client) => {
      if (this.state.giaiDoan !== "cho") return;
      const p = this.state.nguoiChoi.get(client.sessionId);
      if (!p) return;
      p.sanSang = !p.sanSang;

      const tatCa = [...this.state.nguoiChoi.values()];
      if (tatCa.length >= 2 && tatCa.every((x) => x.sanSang)) this.batDauVan();
    },

    tungXucXac: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "tung") return;
      this.tung(client.sessionId);
    },

    mua: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("mua")) return;

      const i = this.state.oChoQuyet;
      const o = BAN_CO[i];
      const p = this.state.nguoiChoi.get(client.sessionId)!;
      const gia = giaMua(o);
      if (p.tien < gia) return;

      p.tien -= gia;
      this.state.o[i].chu = client.sessionId;
      this.ghi(`${p.ten} mua ${o.ten} với ${dinhDang(gia)}.`, "mua");
      this.ketThucQuyet();
    },

    boqua: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("boqua")) return;
      const o = BAN_CO[this.state.oChoQuyet];
      this.ghi(`${o.ten} chưa ai mua, đưa ra đấu giá ở ván sau.`, "he-thong");
      this.ketThucQuyet();
    },

    tra: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("tra")) return;
      this.traTienThue(client.sessionId);
      this.ketThucQuyet();
    },

    /** Xây nhà ở một ô bất kỳ của mình, không bắt buộc phải đang đứng ở đó. */
    xay: (client: Client, tin: { o?: number } = {}) => {
      const p = this.state.nguoiChoi.get(client.sessionId);
      if (!p || p.phaSan) return;
      if (this.state.giaiDoan !== "quyet" && this.state.giaiDoan !== "tung") return;

      const i = typeof tin.o === "number" ? tin.o : this.state.oChoQuyet;
      const o = BAN_CO[i];
      if (!o) return;

      const kq = coTheXay(
        this.doc, i, client.sessionId, p.tien,
        this.state.nhaConLai, this.state.khachSanConLai,
      );
      if (!kq.ok) {
        client.send("loi", { thongBao: kq.lyDo });
        return;
      }

      const tt = this.state.o[i];
      p.tien -= giaXay(o);
      if (tt.nha === 4) {
        tt.nha = 5;
        this.state.nhaConLai += 4;
        this.state.khachSanConLai -= 1;
        this.ghi(`${p.ten} xây khách sạn ở ${o.ten}.`, "xay");
      } else {
        tt.nha += 1;
        this.state.nhaConLai -= 1;
        this.ghi(`${p.ten} xây nhà thứ ${tt.nha} ở ${o.ten}.`, "xay");
      }

      // Xây xong vẫn còn quyền quyết định ở ô đang đứng, nên tính lại nút bấm.
      if (this.state.giaiDoan === "quyet" && this.state.oChoQuyet === i) {
        this.moQuyetDinhODatMinh(client.sessionId, i);
      }
    },

    tieptuc: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("tieptuc")) return;
      this.ketThucQuyet();
    },
  };

  // ------------------------------------------------------------- trợ giúp

  private denLuot(client: Client): boolean {
    return this.state.luotCua === client.sessionId;
  }

  private choPhep(hd: string): boolean {
    return this.state.hanhDong.split(",").includes(hd);
  }

  private ghi(noiDung: string, loai: string) {
    const d = new DongNhatKy();
    d.noiDung = noiDung;
    d.loai = loai;
    this.state.nhatKy.push(d);
    while (this.state.nhatKy.length > SO_DONG_NHAT_KY) this.state.nhatKy.shift();
  }

  private thuTuNguoiChoi(): string[] {
    return [...this.state.nguoiChoi.entries()]
      .filter(([, p]) => !p.phaSan)
      .sort((a, b) => a[1].thuTu - b[1].thuTu)
      .map(([sid]) => sid);
  }

  private datDongHo(ms: number, fn: () => void) {
    this.dongHo?.clear();
    this.state.hanLuot = this.clock.currentTime + ms;
    this.dongHo = this.clock.setTimeout(fn, ms);
  }

  // -------------------------------------------------------- luồng ván chơi

  private batDauVan() {
    this.lock();
    this.state.giaiDoan = "tung";
    this.ghi("Ván bắt đầu. Chúc may mắn!", "he-thong");
    this.batDauLuot(this.thuTuNguoiChoi()[0]);
  }

  private batDauLuot(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p) return;
    this.state.luotCua = sid;
    this.state.giaiDoan = "tung";
    this.state.soLanDoi = 0;
    this.state.oChoQuyet = -1;
    this.state.tienPhaiTra = 0;
    this.state.hanhDong = "";
    this.state.thongBao = p.oDao
      ? `${p.ten} đang ở Đảo Hoang, tung đôi để ra.`
      : `Tới lượt ${p.ten}.`;
    this.datDongHo(GIAY_TUNG, () => this.tung(sid));
  }

  private sangLuotKe() {
    if (this.kiemTraKetThuc()) return;
    const thuTu = this.thuTuNguoiChoi();
    if (thuTu.length === 0) return;
    const viTri = thuTu.indexOf(this.state.luotCua);
    this.batDauLuot(thuTu[(viTri + 1) % thuTu.length]);
  }

  /** Gieo xúc xắc và xử lý toàn bộ hệ quả. Chỉ server gọi hàm này. */
  private tung(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p || p.phaSan || this.state.giaiDoan !== "tung") return;

    const [a, b] = gieoXucXac();
    this.state.xx1 = a;
    this.state.xx2 = b;
    const tong = a + b;
    const doi = a === b;

    if (p.oDao) {
      this.xuLyODao(sid, p, doi, tong);
      return;
    }

    if (doi) {
      this.state.soLanDoi += 1;
      if (this.state.soLanDoi >= 3) {
        this.ghi(`${p.ten} tung đôi ba lần liên tiếp, vào Đảo Hoang.`, "he-thong");
        this.vaoDao(p);
        this.sangLuotKe();
        return;
      }
    }

    this.ghi(`${p.ten} tung ${a} + ${b} = ${tong}${doi ? " (đôi)" : ""}.`, "he-thong");
    this.diChuyen(p, tong);
    this.xuLyO(sid);
  }

  private xuLyODao(sid: string, p: NguoiChoi, doi: boolean, tong: number) {
    if (doi) {
      p.oDao = false;
      p.luotODao = 0;
      this.ghi(`${p.ten} tung được đôi và rời Đảo Hoang.`, "he-thong");
      this.diChuyen(p, tong);
      this.xuLyO(sid);
      return;
    }

    p.luotODao += 1;
    if (p.luotODao >= LUOT_KET_DAO) {
      this.chuyenTien(p, -TIEN_RA_DAO);
      p.oDao = false;
      p.luotODao = 0;
      this.ghi(`${p.ten} nộp ${dinhDang(TIEN_RA_DAO)} để rời Đảo Hoang.`, "tien");
      this.diChuyen(p, tong);
      this.xuLyO(sid);
      return;
    }

    this.ghi(`${p.ten} chưa ra được Đảo Hoang (lượt ${p.luotODao}/${LUOT_KET_DAO}).`, "he-thong");
    this.sangLuotKe();
  }

  private vaoDao(p: NguoiChoi) {
    p.viTri = O_DAO_HOANG;
    p.oDao = true;
    p.luotODao = 0;
    this.state.soLanDoi = 0;
  }

  /** Dời quân và trả lương nếu đi qua ô Xuất phát. */
  private diChuyen(p: NguoiChoi, soO: number) {
    const cu = p.viTri;
    const moi = (cu + soO + SO_O * 2) % SO_O;
    // Đi tiến mà chỉ số nhỏ lại nghĩa là đã vòng qua ô Xuất phát.
    if (soO > 0 && moi <= cu) {
      p.tien += LUONG;
      this.ghi(`${p.ten} đi qua Xuất phát, nhận ${dinhDang(LUONG)}.`, "tien");
    }
    p.viTri = moi;
  }

  private nhayToi(p: NguoiChoi, oDich: number, nhanLuong = true) {
    const cu = p.viTri;
    if (nhanLuong && oDich <= cu) {
      p.tien += LUONG;
      this.ghi(`${p.ten} đi qua Xuất phát, nhận ${dinhDang(LUONG)}.`, "tien");
    }
    p.viTri = oDich;
  }

  // ----------------------------------------------------- xử lý ô vừa dừng

  private xuLyO(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p) return;
    const i = p.viTri;
    const o = BAN_CO[i];
    this.state.oChoQuyet = i;
    this.state.tienPhaiTra = 0;

    // --- ô góc ---
    if (o.loai === "goc") {
      if (o.icon === "dulich") {
        this.nhayToi(p, O_XUAT_PHAT);
        this.ghi(`${p.ten} đi Du lịch xuyên Việt về thẳng Xuất phát.`, "he-thong");
      }
      this.moQuyet(["tieptuc"], o.phu || "Nghỉ chân, không mất gì.");
      return;
    }

    // --- ô thuế ---
    if (o.loai === "thue") {
      const so = (o.thue ?? 0) * DON_VI;
      this.chuyenTien(p, -so);
      this.ghi(`${p.ten} nộp ${dinhDang(so)} tiền ${o.ten.toLowerCase()}.`, "tien");
      this.moQuyet(["tieptuc"], `Đã nộp ${dinhDang(so)}.`);
      return;
    }

    // --- thẻ ---
    if (o.loai === "cohoi" || o.loai === "khivan") {
      const the = this.rutThe(o.loai);
      this.ghi(`${p.ten} rút thẻ: ${the.noiDung}`, "the");
      this.apDungThe(sid, p, the);
      if (this.state.giaiDoan === "ketthuc") return;
      this.moQuyet(["tieptuc"], the.noiDung);
      return;
    }

    // --- ô mua được ---
    if (coTheMua(o)) {
      const tt = this.state.o[i];

      if (!tt.chu) {
        const gia = giaMua(o);
        const du = p.tien >= gia;
        this.moQuyet(
          du ? ["mua", "boqua"] : ["boqua"],
          du
            ? `${o.ten} chưa có chủ, giá ${dinhDang(gia)}.`
            : `Bạn không đủ tiền mua ${o.ten} (cần ${dinhDang(gia)}).`,
        );
        return;
      }

      if (tt.chu !== sid) {
        const diem = this.state.xx1 + this.state.xx2;
        const thue = tienThue(this.doc, i, sid, diem);
        this.state.tienPhaiTra = thue;
        if (thue <= 0) {
          this.moQuyet(["tieptuc"], `${o.ten} đang thế chấp, không phải trả tiền thuê.`);
          return;
        }
        const chu = this.state.nguoiChoi.get(tt.chu);
        this.moQuyet(["tra"], `${o.ten} của ${chu?.ten ?? "?"}, tiền thuê ${dinhDang(thue)}.`);
        return;
      }

      this.moQuyetDinhODatMinh(sid, i);
      return;
    }

    this.moQuyet(["tieptuc"], "Nghỉ chân.");
  }

  private moQuyetDinhODatMinh(sid: string, i: number) {
    const p = this.state.nguoiChoi.get(sid)!;
    const o = BAN_CO[i];
    if (o.loai !== "dat") {
      this.moQuyet(["tieptuc"], "Ô của bạn, nghỉ chân không mất gì.");
      return;
    }
    const kq = coTheXay(this.doc, i, sid, p.tien, this.state.nhaConLai, this.state.khachSanConLai);
    if (kq.ok) {
      const gia = giaXay(o);
      const tt = this.state.o[i];
      this.moQuyet(
        ["xay", "tieptuc"],
        tt.nha === 4
          ? `Nâng ${o.ten} lên khách sạn với ${dinhDang(gia)}.`
          : `Đất của bạn, xây thêm nhà với ${dinhDang(gia)}.`,
      );
    } else {
      this.moQuyet(["tieptuc"], kq.lyDo!);
    }
  }

  private moQuyet(hanhDong: string[], thongBao: string) {
    this.state.giaiDoan = "quyet";
    this.state.hanhDong = hanhDong.join(",");
    this.state.thongBao = thongBao;
    this.datDongHo(GIAY_QUYET, () => this.hetGioQuyet());
  }

  private hetGioQuyet() {
    const hd = this.state.hanhDong.split(",");
    const sid = this.state.luotCua;
    if (hd.includes("tra")) this.traTienThue(sid);
    else if (hd.includes("boqua")) {
      this.ghi(`Hết giờ, ${BAN_CO[this.state.oChoQuyet]?.ten ?? "ô này"} vẫn chưa có chủ.`, "he-thong");
    }
    this.ketThucQuyet();
  }

  private ketThucQuyet() {
    if (this.kiemTraKetThuc()) return;
    this.state.oChoQuyet = -1;
    this.state.hanhDong = "";
    this.state.tienPhaiTra = 0;

    const p = this.state.nguoiChoi.get(this.state.luotCua);
    const duocTungTiep =
      p && !p.phaSan && !p.oDao &&
      this.state.xx1 === this.state.xx2 &&
      this.state.soLanDoi > 0 && this.state.soLanDoi < 3;

    if (duocTungTiep) {
      this.state.giaiDoan = "tung";
      this.state.thongBao = `${p!.ten} tung đôi nên được đi thêm một lượt.`;
      this.datDongHo(GIAY_TUNG, () => this.tung(this.state.luotCua));
      return;
    }
    this.sangLuotKe();
  }

  // ------------------------------------------------------------ tiền bạc

  private traTienThue(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    const i = this.state.oChoQuyet;
    if (!p || i < 0) return;
    const tt = this.state.o[i];
    const chu = tt.chu ? this.state.nguoiChoi.get(tt.chu) : undefined;
    const so = this.state.tienPhaiTra;
    if (!chu || so <= 0) return;

    const thucTra = this.chuyenTien(p, -so);
    chu.tien += thucTra;
    this.ghi(`${p.ten} trả ${dinhDang(thucTra)} tiền thuê cho ${chu.ten}.`, "tien");
  }

  /**
   * Cộng hoặc trừ tiền. Khi thiếu tiền mặt, tự bán nhà rồi thế chấp đất để
   * gom đủ; vẫn không đủ thì người chơi phá sản.
   *
   * Trả về số tiền thực sự chuyển đi (dương), để bên nhận cộng đúng.
   */
  private chuyenTien(p: NguoiChoi, delta: number): number {
    if (delta >= 0) {
      p.tien += delta;
      return delta;
    }
    const can = -delta;
    if (p.tien >= can) {
      p.tien -= can;
      return can;
    }

    const sid = this.timSessionId(p);
    if (sid && khaNangChiTra(this.doc, sid, p.tien) >= can) {
      this.banTaiSan(sid, p, can);
      p.tien -= can;
      return can;
    }

    const conLai = p.tien;
    p.tien = 0;
    if (sid) this.choPhaSan(sid);
    return Math.max(0, conLai);
  }

  /** Bán nhà rồi thế chấp đất cho tới khi đủ tiền mặt. */
  private banTaiSan(sid: string, p: NguoiChoi, can: number) {
    for (const o of BAN_CO) {
      if (p.tien >= can) return;
      const tt = this.state.o[o.i];
      if (tt.chu !== sid || o.loai !== "dat" || tt.nha === 0) continue;
      while (tt.nha > 0 && p.tien < can) {
        if (tt.nha === 5) {
          tt.nha = 4;
          this.state.khachSanConLai += 1;
          this.state.nhaConLai -= 4;
        } else {
          tt.nha -= 1;
          this.state.nhaConLai += 1;
        }
        p.tien += Math.floor(giaXay(o) / 2);
      }
      this.ghi(`${p.ten} bán bớt nhà ở ${o.ten} để xoay tiền.`, "tien");
    }
    for (const o of BAN_CO) {
      if (p.tien >= can) return;
      const tt = this.state.o[o.i];
      if (tt.chu !== sid || tt.theChap) continue;
      tt.theChap = true;
      p.tien += giaTheChap(o);
      this.ghi(`${p.ten} thế chấp ${o.ten}.`, "tien");
    }
  }

  private timSessionId(p: NguoiChoi): string | undefined {
    for (const [sid, x] of this.state.nguoiChoi.entries()) if (x === p) return sid;
    return undefined;
  }

  private choPhaSan(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p || p.phaSan) return;
    p.phaSan = true;
    p.tien = 0;
    for (const o of BAN_CO) {
      const tt = this.state.o[o.i];
      if (tt.chu !== sid) continue;
      if (o.loai === "dat" && tt.nha > 0) {
        if (tt.nha === 5) this.state.khachSanConLai += 1;
        else this.state.nhaConLai += tt.nha;
      }
      tt.chu = "";
      tt.nha = 0;
      tt.theChap = false;
    }
    this.ghi(`${p.ten} phá sản và rời cuộc chơi.`, "he-thong");
  }

  private kiemTraKetThuc(): boolean {
    const conLai = [...this.state.nguoiChoi.entries()].filter(([, p]) => !p.phaSan);
    if (this.state.giaiDoan === "cho" || conLai.length > 1) return false;

    this.dongHo?.clear();
    this.state.giaiDoan = "ketthuc";
    this.state.hanhDong = "";
    this.state.luotCua = "";
    if (conLai.length === 1) {
      this.state.nguoiThang = conLai[0][0];
      this.state.thongBao = `${conLai[0][1].ten} thắng!`;
      this.ghi(`${conLai[0][1].ten} là người cuối cùng còn trụ lại. Chúc mừng!`, "he-thong");
    } else {
      this.state.thongBao = "Ván kết thúc.";
    }
    return true;
  }

  // --------------------------------------------------------------- thẻ bài

  private rutThe(loai: "cohoi" | "khivan"): The {
    const bo = loai === "cohoi" ? this.boCoHoi : this.boKhiVan;
    const the = bo.shift()!;
    bo.push(the); // thẻ đã dùng xuống đáy bộ
    return the;
  }

  private apDungThe(sid: string, p: NguoiChoi, the: The) {
    const hu = the.hieuUng;
    switch (hu.loai) {
      case "nhan":
        this.chuyenTien(p, hu.so * DON_VI);
        break;

      case "nop":
        this.chuyenTien(p, -hu.so * DON_VI);
        break;

      case "thuMoiNguoi": {
        let tong = 0;
        for (const [sid2, x] of this.state.nguoiChoi.entries()) {
          if (sid2 === sid || x.phaSan) continue;
          tong += this.chuyenTien(x, -hu.so * DON_VI);
        }
        p.tien += tong;
        break;
      }

      case "traMoiNguoi": {
        for (const [sid2, x] of this.state.nguoiChoi.entries()) {
          if (sid2 === sid || x.phaSan) continue;
          const tra = this.chuyenTien(p, -hu.so * DON_VI);
          x.tien += tra;
          if (p.phaSan) break;
        }
        break;
      }

      case "diToi":
        this.nhayToi(p, hu.o);
        break;

      case "vaoDao":
        this.vaoDao(p);
        break;

      case "luiLai":
        p.viTri = (p.viTri - hu.so + SO_O) % SO_O;
        break;

      case "suaNha": {
        const { nha, khachSan } = this.demNhaCuaToi(sid);
        const so = (nha * hu.moiNha + khachSan * hu.moiKhachSan) * DON_VI;
        if (so > 0) this.chuyenTien(p, -so);
        break;
      }
    }
    this.kiemTraKetThuc();
  }

  private demNhaCuaToi(sid: string): { nha: number; khachSan: number } {
    let nha = 0;
    let khachSan = 0;
    for (const o of BAN_CO) {
      const tt = this.state.o[o.i];
      if (tt.chu !== sid || o.loai !== "dat") continue;
      if (tt.nha >= 5) khachSan++;
      else nha += tt.nha;
    }
    return { nha, khachSan };
  }
}

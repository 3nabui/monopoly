import { Room, Client, CloseCode, Delayed, type AuthContext } from "colyseus";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { nguoiDungTuToken, type NguoiDung } from "../config/auth.js";
import {
  BAC_KHACH_SAN, BAN_CO, DON_VI, LUONG, LUOT_KET_DAO, LUOT_MAT_DIEN,
  O_DAO_HOANG, O_XUAT_PHAT, SO_NHOM_THANG, SO_O,
  TIEN_BAN_DAU, TIEN_RA_DAO,
  SO_LE_HOI_THUONG,
  coTheBan, coTheGiangCo, coTheMua, coTheMuaDut, coTheXay, dinhDang,
  giaMuaDut, giaMuaThucTe, giaTheChap, giaXay, khaNangChiTra,
  taiSanRong, tenLeHoi, thangNgay, tienThue, tienThueO,
  BO_CO_HOI,
  type DocO, type KieuChon, type The,
} from "@co-ty-phu/shared";
import { luuVan, type NguoiTrongVan } from "../db/kho.js";
import { GameState, NguoiChoi, DongNhatKy, TrangThaiO as OSchema } from "./schema/GameState.js";
import { gieoXucXac, tron } from "../rng.js";


/** Thời gian cho mỗi lượt tung xúc xắc. */
const GIAY_TUNG = 30_000;
/**
 * Thời gian để quyết định: mua, mua đứt, xây, bán gom tiền, hay chọn ô cho
 * thẻ cơ hội. Mọi giai đoạn chờ người chơi đều dùng chung con số này để
 * thanh đếm ngược trong HUD lúc nào cũng khớp.
 */
const GIAY_QUYET = 25_000;
/** Giữ ghế bao lâu khi người chơi rớt mạng. */
const GIAY_GIU_GHE = 60;
/** Số dòng nhật ký giữ lại trong state. */
const SO_DONG_NHAT_KY = 14;

/** Lý do bị từ chối vào phòng. Client đọc mã này để hiện đúng thông báo. */
export const LOI = {
  SAI_MAT_KHAU: "SAI_MAT_KHAU",
  DA_BAT_DAU: "DA_BAT_DAU",
  DAY_PHONG: "DAY_PHONG",
  CHUA_DANG_NHAP: "CHUA_DANG_NHAP",
} as const;

export interface TuyChonVaoPhong {
  tenPhong?: string;
  matKhau?: string;
}

export class CoTyPhuRoom extends Room<{ state: GameState }> {
  maxClients = 4;
  state = new GameState();

  private dongHo?: Delayed;
  private boCoHoi: The[] = [];

  /**
   * Việc phải làm sau khi người chơi gom đủ tiền, hoặc sau khi họ chọn xong ô
   * cho thẻ cơ hội. Giữ ở đây vì luồng ván chơi bị cắt làm hai nửa: nửa trước
   * dừng lại chờ người chơi, nửa sau chạy tiếp khi họ đã quyết.
   */
  private viecSauGom: (() => void) | null = null;
  private viecSauChon: (() => void) | null = null;

  /** Mật khẩu phòng giữ ở dạng băm trong bộ nhớ phòng, không bao giờ vào state. */
  private muoi = "";
  private bam = "";

  /** Dùng khi ghi ván vào database lúc kết thúc. */
  private batDauLuc = new Date();
  private soLuot = 0;
  private daLuu = false;

  /** Bộ đọc trạng thái ô để dùng lại các hàm luật trong package shared. */
  private get doc(): DocO {
    return (i: number) => this.state.o[i];
  }

  // ---------------------------------------------------------------- vòng đời

  onCreate(options: TuyChonVaoPhong = {}) {
    for (let i = 0; i < SO_O; i++) this.state.o.push(new OSchema());
    this.boCoHoi = tron([...BO_CO_HOI]);

    this.state.tenPhong =
      String(options.tenPhong ?? "").trim().slice(0, 24) || `Phòng ${this.roomId}`;

    const mk = String(options.matKhau ?? "");
    if (mk) {
      this.muoi = randomBytes(16).toString("hex");
      this.bam = scryptSync(mk, this.muoi, 32).toString("hex");
      this.state.coMatKhau = true;
    }

    this.capNhatMoTa();
    this.ghi("Phòng đã mở. Cần ít nhất 2 người và tất cả bấm Sẵn sàng.", "he-thong");
  }

  /**
   * Chạy trước onJoin. Đây là nơi chặn người lạ: sai mật khẩu, ván đã bắt đầu,
   * hoặc chưa đăng nhập thì ném lỗi và client không vào được phòng.
   *
   * Giá trị trả về nằm ở client.auth cho onJoin dùng.
   */
  async onAuth(_client: Client, options: TuyChonVaoPhong = {}, context: AuthContext) {
    const nd = await nguoiDungTuToken(context.token);
    if (!nd) throw new Error(LOI.CHUA_DANG_NHAP);

    if (this.bam) {
      const thu = scryptSync(String(options.matKhau ?? ""), this.muoi, 32);
      const dung = Buffer.from(this.bam, "hex");
      if (thu.length !== dung.length || !timingSafeEqual(thu, dung)) {
        throw new Error(LOI.SAI_MAT_KHAU);
      }
    }

    if (this.state.giaiDoan !== "cho") throw new Error(LOI.DA_BAT_DAU);
    if (this.state.nguoiChoi.size >= this.maxClients) throw new Error(LOI.DAY_PHONG);

    return nd;
  }

  onJoin(client: Client) {
    const nd = client.auth as NguoiDung;
    const p = new NguoiChoi();
    p.uid = nd.id;
    p.ten = nd.ten;
    p.anh = nd.anh ?? "";
    p.mau = this.mauConTrong();
    p.thuTu = this.mauConTrong();
    p.tien = TIEN_BAN_DAU;
    p.viTri = O_XUAT_PHAT;
    p.soVong = 1;
    this.state.nguoiChoi.set(client.sessionId, p);

    if (!this.state.chuPhong) this.state.chuPhong = client.sessionId;
    this.ghi(`${p.ten} vào phòng.`, "he-thong");
    this.capNhatMoTa();
  }

  /**
   * Thông tin phòng hiện ở sảnh. Mật khẩu không bao giờ lọt vào đây, chỉ có
   * cờ cho biết phòng có khoá hay không.
   */
  private capNhatMoTa() {
    this.setMetadata({
      ten: this.state.tenPhong,
      coMatKhau: this.state.coMatKhau,
      soNguoi: this.state.nguoiChoi.size,
      toiDa: this.maxClients,
      trangThai: this.state.giaiDoan,
      chu: this.state.nguoiChoi.get(this.state.chuPhong)?.ten ?? "",
    });
  }

  /** Chỉ số màu nhỏ nhất chưa ai dùng, để người vào sau không trùng màu. */
  private mauConTrong(): number {
    const daDung = new Set([...this.state.nguoiChoi.values()].map((p) => p.mau));
    for (let i = 0; i < this.maxClients; i++) if (!daDung.has(i)) return i;
    return this.state.nguoiChoi.size;
  }

  onLeave(client: Client, code: CloseCode) {
    const p = this.state.nguoiChoi.get(client.sessionId);
    if (!p) return;
    this.ghi(`${p.ten} rời phòng.`, "he-thong");

    if (this.state.giaiDoan === "cho") {
      this.state.nguoiChoi.delete(client.sessionId);
      // Chủ phòng rời thì trao quyền cho người còn lại, không thì phòng kẹt.
      if (this.state.chuPhong === client.sessionId) {
        this.state.chuPhong = [...this.state.nguoiChoi.keys()][0] ?? "";
      }
      this.capNhatMoTa();
      return;
    }
    // Ván đang chạy: coi như phá sản để tài sản quay lại thị trường.
    this.choPhaSan(client.sessionId);
    if (this.state.luotCua === client.sessionId) this.sangLuotKe();
    this.capNhatMoTa();
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

    /** Mua ô chưa có chủ, đúng giá in trên bàn cờ. */
    mua: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("mua")) return;

      const i = this.state.oChoQuyet;
      const o = BAN_CO[i];
      const tt = this.state.o[i];
      const p = this.state.nguoiChoi.get(client.sessionId)!;
      const gia = giaMuaThucTe(o, tt);
      if (p.tien < gia) return;

      p.tien -= gia;
      tt.chu = client.sessionId;
      const co = tenLeHoi(tt);
      this.ghi(
        `${p.ten} mua ${o.ten} với ${dinhDang(gia)}${co ? ` (${co.toLowerCase()})` : ""}.`,
        "mua",
      );
      this.ketThucQuyet();
    },

    /**
     * Mua đứt ô của người khác. Tiền trả thẳng cho chủ cũ, công trình trên ô
     * đổi chủ theo. Khách sạn và ô đang thế chấp thì không mua đứt được.
     */
    muadut: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("muadut")) return;

      const sid = client.sessionId;
      const i = this.state.oChoQuyet;
      const o = BAN_CO[i];
      const tt = this.state.o[i];
      const p = this.state.nguoiChoi.get(sid)!;

      const kq = coTheMuaDut(this.doc, i, sid, p.tien);
      if (!kq.ok) {
        client.send("loi", { thongBao: kq.lyDo });
        return;
      }

      const gia = giaMuaDut(o, tt);
      const chuCu = this.state.nguoiChoi.get(tt.chu);
      p.tien -= gia;
      if (chuCu) chuCu.tien += gia;
      tt.chu = sid;
      tt.matDien = 0;
      this.ghi(
        `${p.ten} mua đứt ${o.ten} của ${chuCu?.ten ?? "?"} với ${dinhDang(gia)}.`,
        "mua",
      );
      this.ketThucQuyet();
    },

    boqua: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "quyet") return;
      if (!this.choPhep("boqua")) return;
      const o = BAN_CO[this.state.oChoQuyet];
      this.ghi(
        this.choPhep("muadut")
          ? `${o?.ten ?? "Ô này"} vẫn thuộc chủ cũ.`
          : `${o?.ten ?? "Ô này"} chưa ai mua.`,
        "he-thong",
      );
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
        this.state.nhaConLai, this.state.khachSanConLai, p.soVong,
      );
      if (!kq.ok) {
        client.send("loi", { thongBao: kq.lyDo });
        return;
      }

      const tt = this.state.o[i];
      p.tien -= giaXay(o);
      if (tt.nha === BAC_KHACH_SAN - 1) {
        // Nâng lên khách sạn: trả 3 nhà về hộp, lấy ra 1 khách sạn.
        tt.nha = BAC_KHACH_SAN;
        this.state.nhaConLai += BAC_KHACH_SAN - 1;
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

    /**
     * Bán bớt một bậc công trình, hoặc thế chấp ô nếu đã hết nhà.
     *
     * Dùng được cả khi đang bị bắt gom tiền và khi đang tới lượt mình mà
     * muốn chủ động xoay tiền trước.
     */
    ban: (client: Client, tin: { o?: number } = {}) => {
      const sid = client.sessionId;
      const p = this.state.nguoiChoi.get(sid);
      if (!p || p.phaSan || this.state.luotCua !== sid) return;

      const dangGom = this.state.giaiDoan === "gom";
      const tuNguyen = this.state.giaiDoan === "tung" || this.state.giaiDoan === "quyet";
      if (!dangGom && !tuNguyen) return;

      const i = Number(tin.o);
      const kq = coTheBan(this.doc, i, sid, this.state.nhaConLai);
      if (!kq.ok) {
        client.send("loi", { thongBao: kq.lyDo });
        return;
      }

      this.banMotBac(sid, p, i);
      if (dangGom && p.tien >= this.state.tienCanGom) this.xongGom();
    },

    /** Nhường cho server tự bán tài sản cho đủ số tiền đang thiếu. */
    tudong: (client: Client) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "gom") return;
      const p = this.state.nguoiChoi.get(client.sessionId);
      if (!p) return;
      this.banTaiSan(client.sessionId, p, this.state.tienCanGom);
      this.xongGom();
    },

    /**
     * Chọn một ô trên bàn cho việc đang chờ. Thẻ tặng ô có hai bước nên tin
     * nhắn này mang `o` ở bước một và `nguoi` ở bước hai.
     */
    chon: (client: Client, tin: { o?: number; nguoi?: string } = {}) => {
      if (!this.denLuot(client) || this.state.giaiDoan !== "chon") return;
      const sid = client.sessionId;
      const kieu = this.state.kieuChon as KieuChon;

      // Bước hai của thẻ tặng ô: chọn tặng cho ai.
      if (kieu === "tangNguoi") {
        const den = String(tin.nguoi ?? "");
        if (!this.nguoiDuocChon().includes(den)) {
          client.send("loi", { thongBao: "Không tặng cho người này được." });
          return;
        }
        this.traoO(sid, this.state.oDangTang, den);
        this.xongChon();
        return;
      }

      const i = Number(tin.o);
      if (!this.oDuocChon().includes(i)) {
        client.send("loi", { thongBao: "Ô này không chọn được." });
        return;
      }

      // Bước một của thẻ tặng ô: chọn xong ô thì sang bước chọn người. Bàn
      // chỉ còn một đối thủ thì khỏi hỏi, tặng luôn.
      if (kieu === "tangO") {
        const ds = this.doiThu(sid);
        if (ds.length <= 1) {
          this.traoO(sid, i, ds[0] ?? "");
          this.xongChon();
          return;
        }
        this.sangBuocChonNguoi(sid, i, ds);
        return;
      }

      this.apDungChon(sid, kieu, i);
      this.xongChon();
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

  private oDuocChon(): number[] {
    return this.state.oChonDuoc ? this.state.oChonDuoc.split(",").map(Number) : [];
  }

  private nguoiDuocChon(): string[] {
    return this.state.nguoiChonDuoc ? this.state.nguoiChonDuoc.split(",") : [];
  }

  /** Những người chơi khác còn trong cuộc, theo thứ tự đi. */
  private doiThu(sid: string): string[] {
    return this.thuTuNguoiChoi().filter((x) => x !== sid);
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

  /** Người ngồi kế tiếp còn trong cuộc, dùng cho thẻ tặng ô. */
  private nguoiKeTiep(sid: string): string | undefined {
    const tatCa = this.thuTuNguoiChoi();
    const viTri = tatCa.indexOf(sid);
    if (viTri < 0) return tatCa.find((x) => x !== sid);
    for (let k = 1; k < tatCa.length; k++) {
      const ke = tatCa[(viTri + k) % tatCa.length];
      if (ke && ke !== sid) return ke;
    }
    return undefined;
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
    this.batDauLuc = new Date();
    this.soLuot = 0;
    this.capNhatMoTa();
    this.ghi("Ván bắt đầu. Chúc may mắn!", "he-thong");
    this.giangCoLeHoi();
    this.batDauLuot(this.thuTuNguoiChoi()[0]);
  }

  /**
   * Giăng cờ lễ hội thường ở vài ô ngẫu nhiên, một lần duy nhất lúc mở ván.
   * Không đụng tới ô góc, ô cơ hội và ô thuế — những ô đó không có giá để mà
   * đắt lên. Cờ này không ai dời được, nên đó là các điểm nóng cố định mà cả
   * bàn đều nhìn thấy ngay từ đầu.
   */
  private giangCoLeHoi() {
    const chon = tron(BAN_CO.filter(coTheGiangCo).map((o) => o.i))
      .slice(0, SO_LE_HOI_THUONG);
    for (const i of chon) this.state.o[i].leHoi = true;
    this.ghi(
      `Lễ hội năm nay mở ở ${chon.map((i) => BAN_CO[i].ten).join(" và ")}.`,
      "he-thong",
    );
  }

  private batDauLuot(sid: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p) return;
    this.soLuot++;
    this.state.luotCua = sid;
    this.state.giaiDoan = "tung";
    this.state.soLanDoi = 0;
    this.state.oChoQuyet = -1;
    this.state.tienPhaiTra = 0;
    this.state.tienCanGom = 0;
    this.state.kieuChon = "";
    this.state.oChonDuoc = "";
    this.state.nguoiChonDuoc = "";
    this.state.oDangTang = -1;
    this.state.hanhDong = "";
    this.viecSauGom = null;
    this.viecSauChon = null;
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

    this.giamMatDien();

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

  /** Mỗi lần tung xúc xắc thì các ô đang mất điện bớt đi một lượt. */
  private giamMatDien() {
    for (const o of BAN_CO) {
      const tt = this.state.o[o.i];
      if (!tt || tt.matDien <= 0) continue;
      tt.matDien -= 1;
      if (tt.matDien === 0) this.ghi(`${o.ten} đã có điện trở lại.`, "he-thong");
    }
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
    // Bị đưa thẳng vào đảo, không bước qua ô nào nên cũng không nhận lương.
    p.buocCuoi = 0;
    this.state.soLanDoi = 0;
  }

  /** Dời quân, trả lương và tăng số vòng nếu đi qua ô Xuất phát. */
  private diChuyen(p: NguoiChoi, soO: number) {
    const cu = p.viTri;
    const moi = (cu + soO + SO_O * 2) % SO_O;
    // Đi tiến mà chỉ số nhỏ lại nghĩa là đã vòng qua ô Xuất phát.
    if (soO > 0 && moi <= cu) this.quaXuatPhat(p);
    p.viTri = moi;
    p.buocCuoi = soO;
  }

  /**
   * Thẻ "đi thẳng tới ô X". Đây là đi tới chứ không phải lùi: người chơi vòng
   * theo chiều thường và nhận lương nếu qua ô Xuất phát, nên số bước báo cho
   * client cũng phải là số bước đi tới.
   */
  private nhayToi(p: NguoiChoi, oDich: number, nhanLuong = true) {
    const cu = p.viTri;
    if (nhanLuong && oDich <= cu) this.quaXuatPhat(p);
    p.viTri = oDich;
    p.buocCuoi = (oDich - cu + SO_O) % SO_O;
  }

  private quaXuatPhat(p: NguoiChoi) {
    p.tien += LUONG;
    if (p.soVong < 255) p.soVong += 1;
    this.ghi(`${p.ten} đi qua Xuất phát, nhận ${dinhDang(LUONG)}.`, "tien");
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
        this.moQuyet(["tieptuc"], o.phu || "Nghỉ chân, không mất gì.");
        return;
      }
      if (o.icon === "lehoi") {
        this.moChon(
          sid, "leHoiToanQuoc",
          "Chọn một ô đất của bạn để đăng cai Lễ hội toàn quốc năm nay.",
          () => {
            if (this.kiemTraKetThuc()) return;
            this.moQuyet(["tieptuc"], "Lễ hội toàn quốc đã có chủ nhà.");
          },
        );
        return;
      }
      this.moQuyet(["tieptuc"], o.phu || "Nghỉ chân, không mất gì.");
      return;
    }

    // --- ô thuế: 10% tài sản ròng, không vượt mức in trên ô ---
    if (o.loai === "thue") {
      const so = tienThueO(o, taiSanRong(this.doc, sid, p.tien));
      this.traRoi(sid, so, `tiền thuế`, undefined, () => {
        if (this.kiemTraKetThuc()) return;
        this.moQuyet(["tieptuc"], `Đã nộp ${dinhDang(so)} tiền thuế.`);
      });
      return;
    }

    // --- thẻ cơ hội ---
    if (o.loai === "cohoi") {
      const the = this.rutThe();
      this.ghi(`${p.ten} rút thẻ: ${the.noiDung}`, "the");
      this.apDungThe(sid, p, the, () => {
        if (this.kiemTraKetThuc()) return;
        this.moQuyet(["tieptuc"], the.noiDung);
      });
      return;
    }

    // --- ô mua được ---
    if (coTheMua(o)) {
      const tt = this.state.o[i];

      if (!tt.chu) {
        const gia = giaMuaThucTe(o, tt);
        const du = p.tien >= gia;
        const co = tenLeHoi(tt);
        this.moQuyet(
          du ? ["mua", "boqua"] : ["boqua"],
          du
            ? `${o.ten} chưa có chủ, giá ${dinhDang(gia)}${co ? ` — đang có ${co.toLowerCase()}` : ""}.`
            : `Bạn không đủ tiền mua ${o.ten} (cần ${dinhDang(gia)}).`,
        );
        return;
      }

      if (tt.chu === sid) {
        this.moQuyetDinhODatMinh(sid, i);
        return;
      }

      // Ô của người khác: tiền thuê bị trừ ngay, không có nút từ chối. Sau đó
      // mới tới lượt người chơi quyết có mua đứt hay không.
      const thue = tienThue(this.doc, i, sid);
      const chuCu = tt.chu;
      this.state.tienPhaiTra = thue;
      const tiep = () => {
        if (this.kiemTraKetThuc()) return;
        this.moQuyetMuaDut(sid, i);
      };

      if (thue > 0) {
        this.traRoi(sid, thue, `tiền thuê ${o.ten}`, chuCu, tiep);
      } else {
        const chu = this.state.nguoiChoi.get(chuCu);
        this.ghi(
          tt.matDien > 0
            ? `${o.ten} đang mất điện, ${p.ten} không phải trả tiền.`
            : `${o.ten} của ${chu?.ten ?? "?"} đang thế chấp, không phải trả tiền.`,
          "he-thong",
        );
        tiep();
      }
      return;
    }

    this.moQuyet(["tieptuc"], "Nghỉ chân.");
  }

  /** Sau khi đã trả tiền thuê: cho người chơi chọn mua đứt hay bỏ qua. */
  private moQuyetMuaDut(sid: string, i: number) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p || p.phaSan) { this.ketThucQuyet(); return; }

    const o = BAN_CO[i];
    const tt = this.state.o[i];
    const kq = coTheMuaDut(this.doc, i, sid, p.tien);
    if (kq.ok) {
      this.moQuyet(
        ["muadut", "boqua"],
        `Mua đứt ${o.ten} từ tay chủ cũ với ${dinhDang(giaMuaDut(o, tt))}?`,
      );
    } else {
      this.moQuyet(["tieptuc"], kq.lyDo!);
    }
  }

  private moQuyetDinhODatMinh(sid: string, i: number) {
    const p = this.state.nguoiChoi.get(sid)!;
    const o = BAN_CO[i];
    if (o.loai !== "dat") {
      this.moQuyet(["tieptuc"], "Ô của bạn, nghỉ chân không mất gì.");
      return;
    }
    const kq = coTheXay(
      this.doc, i, sid, p.tien,
      this.state.nhaConLai, this.state.khachSanConLai, p.soVong,
    );
    if (kq.ok) {
      const gia = giaXay(o);
      const tt = this.state.o[i];
      this.moQuyet(
        ["xay", "tieptuc"],
        tt.nha === BAC_KHACH_SAN - 1
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
    if (hd.includes("boqua")) {
      const o = BAN_CO[this.state.oChoQuyet];
      this.ghi(
        hd.includes("muadut")
          ? `Hết giờ, ${o?.ten ?? "ô này"} vẫn thuộc chủ cũ.`
          : `Hết giờ, ${o?.ten ?? "ô này"} vẫn chưa có chủ.`,
        "he-thong",
      );
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

  /**
   * Trả một khoản bắt buộc rồi chạy tiếp `xong`.
   *
   * Đủ tiền mặt thì trừ ngay. Thiếu tiền mặt nhưng còn tài sản thì dừng luồng
   * lại, mở giai đoạn "gom" cho người chơi tự chọn ô để bán — hoặc bấm tự
   * động. Không còn gì để bán thì phá sản và chủ nợ nhận phần còn lại.
   */
  private traRoi(
    sid: string,
    so: number,
    nhan: string,
    choAi: string | undefined,
    xong: () => void,
  ) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p) return;
    if (so <= 0) { xong(); return; }

    if (p.tien >= so) {
      this.traNgay(sid, so, nhan, choAi);
      xong();
      return;
    }

    if (khaNangChiTra(this.doc, sid, p.tien) >= so) {
      this.moGomTien(sid, so, nhan, () => {
        this.traNgay(sid, so, nhan, choAi);
        xong();
      });
      return;
    }

    const con = p.tien;
    p.tien = 0;
    if (choAi) {
      const chu = this.state.nguoiChoi.get(choAi);
      if (chu) chu.tien += con;
    }
    this.ghi(`${p.ten} không trả nổi ${nhan}.`, "tien");
    this.choPhaSan(sid);
    xong();
  }

  private traNgay(sid: string, so: number, nhan: string, choAi?: string) {
    const p = this.state.nguoiChoi.get(sid);
    if (!p) return;
    p.tien -= so;
    const chu = choAi ? this.state.nguoiChoi.get(choAi) : undefined;
    if (chu) chu.tien += so;
    this.ghi(
      chu
        ? `${p.ten} trả ${dinhDang(so)} ${nhan} cho ${chu.ten}.`
        : `${p.ten} nộp ${dinhDang(so)} ${nhan}.`,
      "tien",
    );
  }

  // ------------------------------------------------------- gom tiền để trả

  /**
   * Thiếu tiền mặt thì dừng ván lại ở đây. Người chơi tự bấm vào ô của mình
   * để bán bớt cho tới khi đủ, hoặc nhường server bán giúp. Hết giờ thì
   * server bán thay — không ai bị treo ván vì rời máy.
   */
  private moGomTien(sid: string, can: number, nhan: string, xong: () => void) {
    const p = this.state.nguoiChoi.get(sid)!;
    this.viecSauGom = xong;
    this.state.giaiDoan = "gom";
    this.state.tienCanGom = can;
    this.state.hanhDong = "ban,tudong";
    this.state.thongBao =
      `Cần ${dinhDang(can)} để trả ${nhan} nhưng bạn chỉ có ${dinhDang(p.tien)}. ` +
      "Bấm vào ô của bạn để bán bớt, hoặc để server tự bán.";
    this.datDongHo(GIAY_QUYET, () => {
      this.banTaiSan(sid, p, this.state.tienCanGom);
      this.xongGom();
    });
  }

  private xongGom() {
    const viec = this.viecSauGom;
    this.viecSauGom = null;
    this.state.tienCanGom = 0;
    this.state.hanhDong = "";
    viec?.();
  }

  /** Bán một bậc công trình ở ô i, hoặc thế chấp ô nếu đã hết nhà. */
  private banMotBac(sid: string, p: NguoiChoi, i: number) {
    const o = BAN_CO[i];
    const tt = this.state.o[i];

    if (o.loai === "dat" && tt.nha > 0) {
      if (tt.nha >= BAC_KHACH_SAN) {
        // Hạ khách sạn về 3 nhà: trả khách sạn về hộp, lấy 3 nhà ra.
        tt.nha = BAC_KHACH_SAN - 1;
        this.state.khachSanConLai += 1;
        this.state.nhaConLai -= BAC_KHACH_SAN - 1;
        p.tien += Math.floor(giaXay(o) / 2);
        this.ghi(`${p.ten} bán khách sạn ở ${o.ten}, còn 3 nhà.`, "tien");
      } else {
        tt.nha -= 1;
        this.state.nhaConLai += 1;
        p.tien += Math.floor(giaXay(o) / 2);
        this.ghi(`${p.ten} bán một nhà ở ${o.ten}.`, "tien");
      }
      return;
    }

    tt.theChap = true;
    p.tien += giaTheChap(o);
    this.ghi(`${p.ten} thế chấp ${o.ten}, lấy ${dinhDang(giaTheChap(o))}.`, "tien");
  }

  /**
   * Cộng hoặc trừ tiền không qua giai đoạn gom. Dùng cho các khoản chạy theo
   * vòng lặp (thẻ thu/trả mỗi người, tiền ra đảo): thiếu tiền thì tự bán nhà
   * rồi thế chấp đất, vẫn không đủ thì phá sản.
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
        // Hộp không còn đủ nhà để hạ khách sạn thì đành bỏ qua ô này.
        if (tt.nha >= BAC_KHACH_SAN && this.state.nhaConLai < BAC_KHACH_SAN - 1) break;
        this.banMotBac(sid, p, o.i);
      }
    }
    for (const o of BAN_CO) {
      if (p.tien >= can) return;
      const tt = this.state.o[o.i];
      if (tt.chu !== sid || tt.theChap || tt.nha > 0) continue;
      this.banMotBac(sid, p, o.i);
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
        if (tt.nha >= BAC_KHACH_SAN) this.state.khachSanConLai += 1;
        else this.state.nhaConLai += tt.nha;
      }
      tt.chu = "";
      tt.nha = 0;
      tt.theChap = false;
      tt.matDien = 0;
      tt.leHoiToanQuoc = false;
    }
    this.ghi(`${p.ten} phá sản và rời cuộc chơi.`, "he-thong");
  }

  // ------------------------------------------------------------ kết thúc

  /**
   * Ba cách kết thúc ván, kiểm tra sau mỗi lần một ô đổi chủ và mỗi lần có
   * người phá sản:
   *   1. Có người gom đủ toàn bộ ô biển.
   *   2. Có người sở hữu trọn SO_NHOM_THANG nhóm đất.
   *   3. Chỉ còn một người chưa phá sản.
   */
  private kiemTraKetThuc(): boolean {
    if (this.state.giaiDoan === "ketthuc") return true;
    if (this.state.giaiDoan === "cho") return false;

    for (const [sid, p] of this.state.nguoiChoi.entries()) {
      if (p.phaSan) continue;
      const vi = thangNgay(this.doc, sid);
      if (vi) { this.ketThuc(sid, vi); return true; }
    }

    const conLai = [...this.state.nguoiChoi.entries()].filter(([, p]) => !p.phaSan);
    if (conLai.length > 1) return false;
    this.ketThuc(conLai[0]?.[0] ?? "", "conlai");
    return true;
  }

  private ketThuc(sid: string, lyDo: string) {
    this.dongHo?.clear();
    this.viecSauGom = null;
    this.viecSauChon = null;
    this.state.giaiDoan = "ketthuc";
    this.state.hanhDong = "";
    this.state.luotCua = "";
    this.state.oChoQuyet = -1;
    this.state.tienCanGom = 0;
    this.state.kieuChon = "";
    this.state.oChonDuoc = "";
    this.state.nguoiChonDuoc = "";
    this.state.oDangTang = -1;
    this.state.nguoiThang = sid;
    this.state.lyDoThang = lyDo;

    const p = sid ? this.state.nguoiChoi.get(sid) : undefined;
    if (!p) {
      this.state.thongBao = "Ván kết thúc.";
      void this.luuKetQua();
      return;
    }
    const vi =
      lyDo === "bien" ? "gom đủ toàn bộ ô biển"
      : lyDo === "nhom" ? `sở hữu trọn ${SO_NHOM_THANG} nhóm đất`
      : "là người cuối cùng còn trụ lại";
    this.state.thongBao = `${p.ten} thắng!`;
    this.ghi(`${p.ten} ${vi}. Chúc mừng!`, "he-thong");
    void this.luuKetQua();
  }

  /**
   * Ghi ván vừa xong xuống database. Chạy ngoài luồng chơi: lưu hỏng thì chỉ
   * mất bản ghi lịch sử, người chơi vẫn thấy kết quả bình thường.
   */
  private async luuKetQua() {
    if (this.daLuu) return;
    this.daLuu = true;

    const nguoiChoi: NguoiTrongVan[] = [];
    for (const [sid, p] of this.state.nguoiChoi.entries()) {
      if (!p.uid) continue;
      let soO = 0;
      let soNha = 0;
      for (const o of BAN_CO) {
        const tt = this.state.o[o.i];
        if (tt?.chu !== sid) continue;
        soO++;
        if (o.loai === "dat") soNha += tt.nha;
      }
      nguoiChoi.push({
        nguoiDungId: p.uid,
        thuTu: p.thuTu,
        // Postgres integer tối đa khoảng 2,1 tỉ — tiền trong game không chạm tới.
        taiSan: Math.min(2_000_000_000, Math.round(taiSanRong(this.doc, sid, p.tien))),
        soO,
        soNha,
        phaSan: p.phaSan,
        thang: sid === this.state.nguoiThang,
      });
    }

    const thangUid = this.state.nguoiThang
      ? this.state.nguoiChoi.get(this.state.nguoiThang)?.uid
      : undefined;

    await luuVan({
      maPhong: this.roomId,
      tenPhong: this.state.tenPhong,
      coMatKhau: this.state.coMatKhau,
      batDauLuc: this.batDauLuc,
      soLuot: this.soLuot,
      nguoiThang: thangUid,
      nguoiChoi,
    });
  }

  // --------------------------------------------------------------- thẻ bài

  private rutThe(): The {
    const the = this.boCoHoi.shift()!;
    this.boCoHoi.push(the); // thẻ đã dùng xuống đáy bộ
    return the;
  }

  private apDungThe(sid: string, p: NguoiChoi, the: The, xong: () => void) {
    const hu = the.hieuUng;
    switch (hu.loai) {
      case "nhan":
        p.tien += hu.so * DON_VI;
        this.ghi(`${p.ten} nhận ${dinhDang(hu.so * DON_VI)}.`, "tien");
        xong();
        break;

      case "nop":
        this.traRoi(sid, hu.so * DON_VI, "theo thẻ cơ hội", undefined, xong);
        break;

      case "thuMoiNguoi": {
        let tong = 0;
        for (const [sid2, x] of this.state.nguoiChoi.entries()) {
          if (sid2 === sid || x.phaSan) continue;
          tong += this.chuyenTien(x, -hu.so * DON_VI);
        }
        p.tien += tong;
        this.ghi(`${p.ten} thu được ${dinhDang(tong)} từ những người khác.`, "tien");
        xong();
        break;
      }

      case "traMoiNguoi": {
        for (const [sid2, x] of this.state.nguoiChoi.entries()) {
          if (sid2 === sid || x.phaSan) continue;
          const tra = this.chuyenTien(p, -hu.so * DON_VI);
          x.tien += tra;
          if (p.phaSan) break;
        }
        xong();
        break;
      }

      case "diToi":
        this.nhayToi(p, hu.o);
        xong();
        break;

      case "vaoDao":
        this.vaoDao(p);
        xong();
        break;

      case "luiLai":
        p.viTri = (p.viTri - hu.so + SO_O) % SO_O;
        p.buocCuoi = -hu.so;
        xong();
        break;

      case "suaNha": {
        const { nha, khachSan } = this.demNhaCuaToi(sid);
        const so = (nha * hu.moiNha + khachSan * hu.moiKhachSan) * DON_VI;
        this.traRoi(sid, so, "tiền sửa chữa", undefined, xong);
        break;
      }

      case "chon":
        this.moChon(sid, hu.kieu, the.noiDung, xong);
        break;
    }
  }

  private demNhaCuaToi(sid: string): { nha: number; khachSan: number } {
    let nha = 0;
    let khachSan = 0;
    for (const o of BAN_CO) {
      const tt = this.state.o[o.i];
      if (tt.chu !== sid || o.loai !== "dat") continue;
      if (tt.nha >= BAC_KHACH_SAN) khachSan++;
      else nha += tt.nha;
    }
    return { nha, khachSan };
  }

  // ------------------------------------------------- thẻ bắt chọn một ô

  private moChon(sid: string, kieu: KieuChon, noiDung: string, xong: () => void) {
    const ds = this.oHopLeDeChon(sid, kieu);
    if (ds.length === 0) {
      this.ghi("Không có ô nào hợp lệ, thẻ này không có tác dụng.", "the");
      xong();
      return;
    }

    this.viecSauChon = xong;
    this.state.giaiDoan = "chon";
    this.state.kieuChon = kieu;
    this.state.oChonDuoc = ds.join(",");
    this.state.hanhDong = "chon";
    this.state.thongBao = noiDung;
    this.datDongHo(GIAY_QUYET, () => {
      // Hết giờ thì server chọn thay: ô đầu danh sách, trừ thẻ tặng ô thì
      // chọn ô rẻ nhất để người chơi không mất phần đắt nhất vì chậm tay.
      const i = kieu === "tangO"
        ? ds.reduce((re, x) => ((BAN_CO[x].gia ?? 0) < (BAN_CO[re].gia ?? 0) ? x : re), ds[0])
        : ds[0];
      this.apDungChon(sid, kieu, i);
      this.xongChon();
    });
  }

  private xongChon() {
    const viec = this.viecSauChon;
    this.viecSauChon = null;
    this.state.kieuChon = "";
    this.state.oChonDuoc = "";
    this.state.nguoiChonDuoc = "";
    this.state.oDangTang = -1;
    this.state.hanhDong = "";
    viec?.();
  }

  /**
   * Bước hai của thẻ tặng ô. Giữ nguyên `viecSauChon` để khi chọn xong người
   * nhận thì lượt chơi chạy tiếp đúng chỗ nó đang dở.
   */
  private sangBuocChonNguoi(sid: string, i: number, ds: string[]) {
    this.state.oDangTang = i;
    this.state.kieuChon = "tangNguoi";
    this.state.oChonDuoc = "";
    this.state.nguoiChonDuoc = ds.join(",");
    this.state.thongBao = `Tặng ${BAN_CO[i].ten} cho ai?`;
    this.datDongHo(GIAY_QUYET, () => {
      // Hết giờ thì tặng người ngồi kế tiếp, giống luật cũ.
      this.traoO(sid, i, this.nguoiKeTiep(sid) ?? ds[0]);
      this.xongChon();
    });
  }

  /**
   * Chuyển một ô sang tay người khác.
   *
   * Cờ lễ hội toàn quốc đi theo ô chứ không theo người: ô vẫn là nơi đăng
   * cai, chỉ đổi chủ nhà. Nó chỉ mất khi ô thành vô chủ.
   */
  private traoO(tu: string, i: number, den: string) {
    const p = this.state.nguoiChoi.get(tu);
    const nhan = den ? this.state.nguoiChoi.get(den) : undefined;
    const o = BAN_CO[i];
    const tt = this.state.o[i];
    if (!p || !nhan || !o || !tt || tt.chu !== tu) {
      this.ghi("Không tặng được ô này.", "the");
      return;
    }
    tt.chu = den;
    tt.matDien = 0;
    this.ghi(`${p.ten} tặng ${o.ten} cho ${nhan.ten}.`, "the");
    this.kiemTraKetThuc();
  }

  /**
   * Những ô được phép chọn. Mọi kiểu chọn đều chỉ nhắm vào ô đất: bốn thẻ
   * tương tác không đụng tới ô biển (ai gom được biển thì giữ được biển), và
   * lễ hội toàn quốc cũng chỉ đăng cai ở ô đất.
   */
  private oHopLeDeChon(sid: string, kieu: KieuChon): number[] {
    const ra: number[] = [];
    for (const o of BAN_CO) {
      if (o.loai !== "dat") continue;
      const tt = this.state.o[o.i];
      if (!tt.chu) continue;

      if (kieu === "tangO" || kieu === "leHoiToanQuoc") {
        if (tt.chu === sid) ra.push(o.i);
        continue;
      }

      if (tt.chu === sid) continue;
      const chu = this.state.nguoiChoi.get(tt.chu);
      if (!chu || chu.phaSan) continue;

      if (kieu === "phaBo" && tt.nha >= BAC_KHACH_SAN) continue;
      if (kieu === "haBac" && (tt.nha <= 0 || tt.nha >= BAC_KHACH_SAN)) continue;
      if (kieu === "matDien" && tt.matDien > 0) continue;
      ra.push(o.i);
    }
    return ra;
  }

  private apDungChon(sid: string, kieu: KieuChon, i: number) {
    const p = this.state.nguoiChoi.get(sid);
    const o = BAN_CO[i];
    const tt = this.state.o[i];
    if (!p || !o || !tt) return;
    const chuCu = this.state.nguoiChoi.get(tt.chu);

    switch (kieu) {
      case "phaBo":
        // Nhà trên ô trở về hộp, ô thành vô chủ và ai cũng mua lại được.
        // Không còn chủ thì cũng không còn ai đăng cai lễ hội toàn quốc.
        this.state.nhaConLai += tt.nha;
        tt.chu = "";
        tt.nha = 0;
        tt.theChap = false;
        tt.matDien = 0;
        tt.leHoiToanQuoc = false;
        this.ghi(`${p.ten} phá bỏ ${o.ten} của ${chuCu?.ten ?? "?"}, ô thành vô chủ.`, "the");
        break;

      case "haBac":
        tt.nha -= 1;
        this.state.nhaConLai += 1;
        this.ghi(
          `${p.ten} hạ ${o.ten} của ${chuCu?.ten ?? "?"} xuống còn ${tt.nha} nhà.`,
          "the",
        );
        break;

      case "matDien":
        tt.matDien = LUOT_MAT_DIEN;
        this.ghi(
          `${o.ten} của ${chuCu?.ten ?? "?"} mất điện ${LUOT_MAT_DIEN} lượt tung.`,
          "the",
        );
        break;

      case "leHoiToanQuoc": {
        // Cả bàn chỉ có một lễ hội toàn quốc: hạ cờ ở chỗ cũ rồi dựng ở đây.
        const cu = BAN_CO.find((x) => this.state.o[x.i].leHoiToanQuoc);
        for (const x of BAN_CO) this.state.o[x.i].leHoiToanQuoc = false;
        tt.leHoiToanQuoc = true;
        this.ghi(
          cu && cu.i !== i
            ? `${p.ten} giành Lễ hội toàn quốc từ ${cu.ten} về ${o.ten}.`
            : `${p.ten} đăng cai Lễ hội toàn quốc ở ${o.ten}.`,
          "the",
        );
        break;
      }

      case "tangO":
      case "tangNguoi":
        // Hai kiểu này đi qua traoO() chứ không qua đây.
        break;
    }

    this.kiemTraKetThuc();
  }
}

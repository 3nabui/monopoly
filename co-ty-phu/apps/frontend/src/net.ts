import { ColyseusSDK, type Room } from "@colyseus/sdk";
import type { default as server } from "@co-ty-phu/backend/app.config";
import type { AnhChup } from "./state.js";

/**
 * Lớp mạng: đăng nhập, sảnh phòng, và phòng chơi.
 *
 * Kiểu `typeof server` lấy từ backend nên tên phòng và tên tin nhắn được kiểm
 * tra lúc biên dịch; không dòng mã server nào lọt vào bundle của trình duyệt.
 */

const DIA_CHI = import.meta.env.VITE_SERVER ?? `ws://${location.hostname}:2567`;
const KHOA_PHIEN = "co-ty-phu:phien";

export const client = new ColyseusSDK<typeof server>(DIA_CHI);

export interface NguoiDung {
  id: string;
  ten: string;
  anh?: string;
  email?: string;
  khach?: boolean;
}

export interface CauHinh {
  google: boolean;
  khach: boolean;
}

export interface PhongTomTat {
  roomId: string;
  ten: string;
  coMatKhau: boolean;
  soNguoi: number;
  toiDa: number;
  trangThai: string;
  chu: string;
}

export type HanhDongGui =
  | "sanSang" | "tungXucXac" | "mua" | "muadut" | "boqua" | "tudong" | "tieptuc";

/* ------------------------------------------------------------- đăng nhập */

export async function layCauHinh(): Promise<CauHinh> {
  try {
    const r = await client.http.get("/api/cau-hinh");
    return { google: Boolean(r.data?.google), khach: Boolean(r.data?.khach) };
  } catch {
    return { google: false, khach: false };
  }
}

export async function dangNhapGoogle(): Promise<NguoiDung> {
  const r = await client.auth.signInWithProvider<NguoiDung>("google");
  return r.user;
}

export async function dangNhapKhach(ten: string): Promise<NguoiDung> {
  const r = await client.auth.signInAnonymously<NguoiDung>({ ten });
  return r.user;
}

export async function dangXuat(): Promise<void> {
  try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
  await client.auth.signOut();
}

/** Gọi callback mỗi khi trạng thái đăng nhập đổi, kể cả lúc khôi phục từ token cũ. */
export function theoDoiDangNhap(cb: (nd: NguoiDung | null) => void): () => void {
  return client.auth.onChange<NguoiDung>((r) => cb(r?.user ?? null));
}

/* ------------------------------------------------------------ sảnh phòng */

export interface Sanh {
  roi(): void;
}

/**
 * Vào phòng chờ chung để nhận danh sách phòng theo thời gian thực.
 * LobbyRoom gửi "rooms" khi vào, rồi "+" và "-" mỗi lần có thay đổi.
 */
export async function moSanh(onDanhSach: (ds: PhongTomTat[]) => void): Promise<Sanh> {
  const room = await client.joinOrCreate("sanh", { filter: { name: "co_ty_phu" } });
  const bang = new Map<string, PhongTomTat>();

  const doi = (r: any): PhongTomTat => ({
    roomId: r.roomId,
    ten: r.metadata?.ten ?? "Phòng",
    coMatKhau: Boolean(r.metadata?.coMatKhau),
    soNguoi: r.metadata?.soNguoi ?? r.clients ?? 0,
    toiDa: r.metadata?.toiDa ?? r.maxClients ?? 4,
    trangThai: r.metadata?.trangThai ?? "cho",
    chu: r.metadata?.chu ?? "",
  });

  const phat = () => onDanhSach([...bang.values()]);

  room.onMessage("rooms", (ds: any[]) => {
    bang.clear();
    for (const r of ds) bang.set(r.roomId, doi(r));
    phat();
  });
  room.onMessage("+", ([roomId, r]: [string, any]) => {
    bang.set(roomId, doi(r));
    phat();
  });
  room.onMessage("-", (roomId: string) => {
    bang.delete(roomId);
    phat();
  });

  return { roi: () => { void room.leave(); } };
}

/* ------------------------------------------------------------ phòng chơi */

export interface KetNoi {
  room: Room;
  sid: string;
  gui(hanhDong: HanhDongGui): void;
  xay(o?: number): void;
  /** Bán bớt một bậc công trình, hoặc thế chấp ô nếu đã hết nhà. */
  ban(o: number): void;
  /** Chọn một ô cho thẻ cơ hội đang chờ. */
  chon(o: number): void;
  roi(): void;
}

function doiSangAnhChup(state: any): AnhChup {
  const nguoiChoi: AnhChup["nguoiChoi"] = [];
  state.nguoiChoi.forEach((p: any, sid: string) => {
    nguoiChoi.push({
      sid,
      uid: p.uid, anh: p.anh,
      ten: p.ten, mau: p.mau, tien: p.tien, viTri: p.viTri, buocCuoi: p.buocCuoi ?? 0,
      soVong: p.soVong ?? 1, thuTu: p.thuTu,
      sanSang: p.sanSang, oDao: p.oDao, phaSan: p.phaSan, ketNoi: p.ketNoi,
    });
  });
  nguoiChoi.sort((a, b) => a.thuTu - b.thuTu);

  return {
    giaiDoan: state.giaiDoan,
    luotCua: state.luotCua,
    hanLuot: state.hanLuot,
    xx1: state.xx1,
    xx2: state.xx2,
    oChoQuyet: state.oChoQuyet,
    tienPhaiTra: state.tienPhaiTra,
    hanhDong: state.hanhDong ? String(state.hanhDong).split(",") : [],
    thongBao: state.thongBao,
    tienCanGom: state.tienCanGom ?? 0,
    kieuChon: state.kieuChon ?? "",
    oChonDuoc: state.oChonDuoc ? String(state.oChonDuoc).split(",").map(Number) : [],
    nguoiThang: state.nguoiThang,
    lyDoThang: state.lyDoThang ?? "",
    nhaConLai: state.nhaConLai,
    khachSanConLai: state.khachSanConLai,
    tenPhong: state.tenPhong ?? "",
    coMatKhau: Boolean(state.coMatKhau),
    chuPhong: state.chuPhong ?? "",
    nguoiChoi,
    o: [...state.o].map((t: any) => ({
      chu: t.chu, nha: t.nha, theChap: t.theChap, matDien: t.matDien ?? 0,
    })),
    nhatKy: [...state.nhatKy].map((d: any) => ({ noiDung: d.noiDung, loai: d.loai })),
  };
}

export interface TuyChonKetNoi {
  onState(anh: AnhChup): void;
  onLoi(thongBao: string): void;
  onRoi(): void;
}

function ganPhong(room: Room, opt: TuyChonKetNoi): KetNoi {
  try { sessionStorage.setItem(KHOA_PHIEN, room.reconnectionToken); } catch { /* bỏ qua */ }

  room.onStateChange((state: any) => opt.onState(doiSangAnhChup(state)));
  room.onMessage("loi", (tin: any) => opt.onLoi(tin?.thongBao ?? "Không thực hiện được."));
  room.onLeave(() => {
    try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
    opt.onRoi();
  });

  return {
    room,
    sid: room.sessionId,
    gui: (hanhDong) => room.send(hanhDong as any),
    xay: (o) => room.send("xay" as any, o === undefined ? {} : { o }),
    ban: (o) => room.send("ban" as any, { o }),
    chon: (o) => room.send("chon" as any, { o }),
    roi: () => {
      try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
      void room.leave();
    },
  };
}

export async function taoPhong(ten: string, matKhau: string, opt: TuyChonKetNoi): Promise<KetNoi> {
  const room = await client.create("co_ty_phu", { tenPhong: ten, matKhau });
  return ganPhong(room, opt);
}

export async function vaoPhong(roomId: string, matKhau: string, opt: TuyChonKetNoi): Promise<KetNoi> {
  const room = await client.joinById(roomId, { matKhau });
  return ganPhong(room, opt);
}

/** Thử nối lại ván đang dở sau khi tải lại trang. Trả về null nếu không còn. */
export async function noiLai(opt: TuyChonKetNoi): Promise<KetNoi | null> {
  let token: string | null = null;
  try { token = sessionStorage.getItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
  if (!token) return null;
  try {
    return ganPhong(await client.reconnect(token), opt);
  } catch {
    try { sessionStorage.removeItem(KHOA_PHIEN); } catch { /* bỏ qua */ }
    return null;
  }
}

/** Đổi mã lỗi của server thành câu tiếng Việt cho người chơi đọc. */
export function dienGiaiLoi(e: unknown): string {
  const s = String((e as any)?.message ?? e ?? "");
  if (s.includes("SAI_MAT_KHAU")) return "Mật khẩu phòng không đúng.";
  // Ván bắt đầu thì phòng bị khoá ở tầng ghép trận, lỗi về trước cả onAuth.
  if (s.includes("DA_BAT_DAU") || s.includes("locked")) {
    return "Ván trong phòng đã bắt đầu, không vào được nữa.";
  }
  if (s.includes("DAY_PHONG")) return "Phòng đã đủ 4 người.";
  if (s.includes("CHUA_DANG_NHAP")) return "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.";
  if (s.includes("not found") || s.includes("no rooms")) return "Phòng không còn nữa.";
  return "Không vào được phòng. Thử lại sau.";
}

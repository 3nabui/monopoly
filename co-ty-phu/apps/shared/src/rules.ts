import { BAN_CO, DON_VI, coTheMua } from "./board.js";
import type { MaNhom, O, TrangThaiO } from "./types.js";

/**
 * Luật chơi thuần, không phụ thuộc server hay trình duyệt.
 *
 * Server gọi các hàm này để chốt kết quả; client gọi đúng các hàm này để hiện
 * HUD trước khi mạng trả lời. Viết một lần, hai bên không bao giờ lệch nhau.
 */

/** Đọc trạng thái ô theo chỉ số, chấp nhận cả mảng lẫn thứ giống mảng. */
export interface DocO {
  (i: number): TrangThaiO | undefined;
}

function docTu(tiles: readonly TrangThaiO[]): DocO {
  return (i) => tiles[i];
}

/**
 * Bảng tiền thuê của một ô đất, tính bằng K:
 * [đất trống, 1 nhà, 2 nhà, 3 nhà, 4 nhà, khách sạn].
 */
export function bangThue(giaK: number): [number, number, number, number, number, number] {
  const g = Math.round(giaK / 10);
  return [g, g * 5, g * 15, g * 45, g * 80, g * 125];
}

/** Giá mua ô, theo đơn vị gốc. */
export function giaMua(o: O): number {
  return (o.gia ?? 0) * DON_VI;
}

/** Giá xây mỗi căn nhà trên ô đất, theo đơn vị gốc. */
export function giaXay(o: O): number {
  return Math.round((o.gia ?? 0) / 4 / 5) * 5 * DON_VI;
}

/** Giá trị thế chấp, bằng nửa giá mua. */
export function giaTheChap(o: O): number {
  return Math.floor(giaMua(o) / 2);
}

/** Tiền cần trả để giải chấp: giá trị thế chấp cộng 10% lãi. */
export function giaGiaiChap(o: O): number {
  return Math.round(giaTheChap(o) * 1.1);
}

/** Một người đã sở hữu trọn nhóm màu hay chưa. */
export function tronBo(doc: DocO, nhom: MaNhom, chu: string): boolean {
  if (!chu) return false;
  return BAN_CO
    .filter((o) => o.nhom === nhom)
    .every((o) => doc(o.i)?.chu === chu);
}

/** Đếm số ô cùng loại mà một người đang sở hữu. */
export function demTheoLoai(doc: DocO, loai: O["loai"], chu: string): number {
  if (!chu) return 0;
  return BAN_CO.filter((o) => o.loai === loai && doc(o.i)?.chu === chu).length;
}

/**
 * Tiền thuê phải trả khi dừng ở ô i.
 *
 * Trả về 0 khi ô chưa có chủ, đang thế chấp, hoặc người dừng chính là chủ.
 * `diemXucXac` chỉ dùng cho ô tiện ích.
 */
export function tienThue(
  doc: DocO,
  i: number,
  nguoiDung: string,
  diemXucXac: number,
): number {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt || !coTheMua(o)) return 0;
  if (!tt.chu || tt.chu === nguoiDung || tt.theChap) return 0;

  if (o.loai === "dat") {
    const b = bangThue(o.gia!);
    if (tt.nha >= 5) return b[5] * DON_VI;
    if (tt.nha > 0) return b[tt.nha] * DON_VI;
    // Đất trống nhưng chủ đã trọn nhóm thì tiền thuê nhân đôi.
    return (tronBo(doc, o.nhom!, tt.chu) ? b[0] * 2 : b[0]) * DON_VI;
  }

  if (o.loai === "bien") {
    const n = demTheoLoai(doc, "bien", tt.chu);
    return [25, 50, 100, 200][Math.max(0, Math.min(3, n - 1))] * DON_VI;
  }

  // Tiện ích: nhân với điểm xúc xắc vừa tung.
  const m = demTheoLoai(doc, "tienich", tt.chu);
  return diemXucXac * (m >= 2 ? 10 : 4) * DON_VI;
}

export interface KetQuaKiemTra {
  ok: boolean;
  /** Lý do không làm được, viết sẵn bằng tiếng Việt để HUD hiện thẳng. */
  lyDo?: string;
}

/**
 * Có được xây thêm một căn nhà ở ô i hay không.
 *
 * Kiểm tra đủ bốn điều kiện: là ô đất của mình, đã trọn nhóm, không ô nào
 * trong nhóm đang thế chấp, và tuân thủ luật xây đều.
 */
export function coTheXay(
  doc: DocO,
  i: number,
  chu: string,
  tienMat: number,
  nhaConLai: number,
  khachSanConLai: number,
): KetQuaKiemTra {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt) return { ok: false, lyDo: "Ô không hợp lệ." };
  if (o.loai !== "dat") return { ok: false, lyDo: "Chỉ xây được trên ô đất." };
  if (tt.chu !== chu) return { ok: false, lyDo: "Đây không phải đất của bạn." };

  const trongNhom = BAN_CO.filter((x) => x.nhom === o.nhom);
  if (!tronBo(doc, o.nhom!, chu)) {
    return { ok: false, lyDo: "Phải sở hữu cả nhóm mới được xây nhà." };
  }
  if (trongNhom.some((x) => doc(x.i)?.theChap)) {
    return { ok: false, lyDo: "Có ô trong nhóm đang thế chấp." };
  }
  if (tt.nha >= 5) {
    return { ok: false, lyDo: "Đã có khách sạn, không xây thêm được." };
  }

  const itNhat = Math.min(...trongNhom.map((x) => doc(x.i)?.nha ?? 0));
  if (tt.nha > itNhat) {
    return { ok: false, lyDo: "Luật xây đều: hãy xây ở ô còn ít nhà hơn trước." };
  }

  // Nâng từ 4 nhà lên khách sạn thì trả 4 nhà về hộp, chỉ cần 1 khách sạn.
  const nangKhachSan = tt.nha === 4;
  if (nangKhachSan && khachSanConLai <= 0) {
    return { ok: false, lyDo: "Hộp đã hết khách sạn, phải chờ người khác bán ra." };
  }
  if (!nangKhachSan && nhaConLai <= 0) {
    return { ok: false, lyDo: "Hộp đã hết nhà, phải chờ người khác bán ra." };
  }
  if (tienMat < giaXay(o)) {
    return { ok: false, lyDo: `Không đủ tiền xây, cần ${dinhDang(giaXay(o))}.` };
  }
  return { ok: true };
}

/** Tổng tài sản: tiền mặt cộng giá đất chưa thế chấp cộng giá nhà đã xây. */
export function taiSanRong(doc: DocO, chu: string, tienMat: number): number {
  let tong = tienMat;
  for (const o of BAN_CO) {
    const tt = doc(o.i);
    if (!tt || tt.chu !== chu) continue;
    tong += tt.theChap ? giaTheChap(o) : giaMua(o);
    if (o.loai === "dat" && tt.nha > 0) tong += tt.nha * giaXay(o);
  }
  return tong;
}

/**
 * Tiền tối đa người chơi có thể gom được ngay lúc này: tiền mặt, cộng nửa giá
 * nhà nếu bán hết, cộng giá trị thế chấp của đất chưa thế chấp. Dùng để biết
 * một người đã thực sự phá sản hay vẫn còn đường xoay.
 */
export function khaNangChiTra(doc: DocO, chu: string, tienMat: number): number {
  let tong = tienMat;
  for (const o of BAN_CO) {
    const tt = doc(o.i);
    if (!tt || tt.chu !== chu) continue;
    if (o.loai === "dat" && tt.nha > 0) tong += Math.floor((tt.nha * giaXay(o)) / 2);
    if (!tt.theChap) tong += giaTheChap(o);
  }
  return tong;
}

/** Đếm số nhà và khách sạn đang nằm trên bàn, để biết hộp còn bao nhiêu. */
export function demNhaTrenBan(doc: DocO): { nha: number; khachSan: number } {
  let nha = 0;
  let khachSan = 0;
  for (const o of BAN_CO) {
    const tt = doc(o.i);
    if (!tt || o.loai !== "dat") continue;
    if (tt.nha >= 5) khachSan++;
    else nha += tt.nha;
  }
  return { nha, khachSan };
}

/** Định dạng tiền theo kiểu Việt Nam: 1.852.500 */
export function dinhDang(n: number): string {
  return Math.round(n).toLocaleString("vi-VN");
}

/** Rút gọn thành K để in lên nhãn ô: 240K */
export function dinhDangK(n: number): string {
  return `${Math.round(n / DON_VI)}K`;
}

export { docTu };

import { BAN_CO, DON_VI, THU_TU_NHOM, coTheMua } from "./board.js";
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

/** Bậc công trình cao nhất trên một ô đất: 4 nghĩa là khách sạn. */
export const BAC_KHACH_SAN = 4;

/** Bậc cao nhất được phép xây khi người chơi còn ở vòng đầu tiên. */
export const BAC_TOI_DA_VONG_DAU = 2;

/** Số nhóm đất trọn vẹn cần có để thắng ngay. */
export const SO_NHOM_THANG = 3;

/** Số ô biển trên bàn. Sở hữu hết số này là thắng ngay. */
export const SO_BIEN = BAN_CO.filter((o) => o.loai === "bien").length;

/** Số lần tung xúc xắc mà thẻ Cơ hội làm một ô mất điện. */
export const LUOT_MAT_DIEN = 5;

/**
 * Hệ số mua đứt: người mua trả gấp đôi số vốn chủ cũ đã bỏ vào ô.
 *
 * Để ở đây thành một con số duy nhất cho dễ cân lại. Càng cao thì mua đứt
 * càng khó xảy ra và chủ đất càng an toàn.
 */
export const HE_SO_MUA_DUT = 2;

/**
 * Bảng tiền thuê của một ô đất, tính bằng K, theo bậc công trình:
 * [mua đất, 1 nhà, 2 nhà, 3 nhà, khách sạn].
 *
 * Mức gốc bằng 1/10 giá mua. Ô đã trọn nhóm nhưng chưa xây thì ăn đôi mức
 * gốc — xem tienThue.
 */
export function bangThue(giaK: number): [number, number, number, number, number] {
  const g = Math.round(giaK / 10);
  return [g, g * 5, g * 15, g * 45, g * 125];
}

/**
 * Tiền thuê ô biển theo số ô biển người đó đang giữ, tính bằng K.
 *
 * Mức cuối gần như không bao giờ thu được: gom đủ toàn bộ ô biển là thắng
 * ngay, ván dừng tại đó.
 */
const THUE_BIEN = [25, 60, 150, 300];

export function bangThueBien(): number[] {
  return THUE_BIEN.slice(0, Math.max(1, SO_BIEN));
}

/** Giá mua ô, theo đơn vị gốc. */
export function giaMua(o: O): number {
  return (o.gia ?? 0) * DON_VI;
}

/** Giá xây mỗi bậc nhà trên ô đất, theo đơn vị gốc. */
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

/** Số nhà thường đang đứng trên ô, không tính khách sạn. */
export function soNhaThuong(tt: TrangThaiO): number {
  return tt.nha >= BAC_KHACH_SAN ? 0 : tt.nha;
}

/**
 * Giá mua đứt một ô đang có chủ.
 *
 * Bằng HE_SO_MUA_DUT lần số vốn chủ cũ đã bỏ ra: giá mua ô cộng tiền đã xây.
 * Toàn bộ số này trả cho chủ cũ, nhà băng không lấy đồng nào, nên mua đứt là
 * một vụ chuyển tiền rất lớn giữa hai người chơi — đủ để người bị mua đứt
 * không coi đó là mất mát hoàn toàn.
 */
export function giaMuaDut(o: O, tt: TrangThaiO): number {
  const von = giaMua(o) + (o.loai === "dat" ? soNhaThuong(tt) * giaXay(o) : 0);
  return von * HE_SO_MUA_DUT;
}

export interface KetQuaKiemTra {
  ok: boolean;
  /** Lý do không làm được, viết sẵn bằng tiếng Việt để HUD hiện thẳng. */
  lyDo?: string;
}

/**
 * Ô có thuộc diện mua đứt được hay không, xét riêng bản thân ô — chưa quan
 * tâm ai đang đứng ở đó hay có đủ tiền không.
 *
 * Ba thứ nằm ngoài tầm mua đứt:
 *   - Ô biển. Gom đủ ô biển là thắng ngay, nên nếu mua đứt được thì ai có
 *     tiền cũng giật được chiến thắng từ tay người khác, mà ô biển lại rẻ
 *     nhất bàn vì không xây nhà được. Muốn có biển thì phải tự đi tới và mua.
 *   - Ô đã lên khách sạn. Phần thưởng cho người dám xây tới bậc cuối.
 *   - Ô đang thế chấp.
 */
export function oMuaDutDuoc(o: O, tt: TrangThaiO): KetQuaKiemTra {
  if (!coTheMua(o)) return { ok: false, lyDo: "Ô này không mua đứt được." };
  if (o.loai === "bien") {
    return { ok: false, lyDo: "Ô biển không mua đứt được, phải tự đi tới mà mua." };
  }
  if (tt.theChap) return { ok: false, lyDo: "Ô đang thế chấp, không mua đứt được." };
  if (tt.nha >= BAC_KHACH_SAN) {
    return { ok: false, lyDo: "Ô đã có khách sạn, không ai mua đứt được." };
  }
  return { ok: true };
}

/**
 * Có được mua đứt ô i hay không: vừa xét bản thân ô, vừa xét người mua.
 */
export function coTheMuaDut(
  doc: DocO,
  i: number,
  nguoiMua: string,
  tienMat: number,
): KetQuaKiemTra {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt) return { ok: false, lyDo: "Ô này không mua đứt được." };
  if (!tt.chu) return { ok: false, lyDo: "Ô chưa có chủ, mua thường là được." };
  if (tt.chu === nguoiMua) return { ok: false, lyDo: "Ô này đã là của bạn." };

  const duoc = oMuaDutDuoc(o, tt);
  if (!duoc.ok) return duoc;

  const gia = giaMuaDut(o, tt);
  if (tienMat < gia) {
    return { ok: false, lyDo: `Mua đứt cần ${dinhDang(gia)}, bạn không đủ tiền mặt.` };
  }
  return { ok: true };
}

/** Một người đã sở hữu trọn nhóm màu hay chưa. */
export function tronBo(doc: DocO, nhom: MaNhom, chu: string): boolean {
  if (!chu) return false;
  return BAN_CO
    .filter((o) => o.nhom === nhom)
    .every((o) => doc(o.i)?.chu === chu);
}

/** Số nhóm đất mà một người đang sở hữu trọn vẹn. */
export function demNhomTronBo(doc: DocO, chu: string): number {
  if (!chu) return 0;
  return THU_TU_NHOM.filter((n) => tronBo(doc, n, chu)).length;
}

/** Đếm số ô cùng loại mà một người đang sở hữu. */
export function demTheoLoai(doc: DocO, loai: O["loai"], chu: string): number {
  if (!chu) return 0;
  return BAN_CO.filter((o) => o.loai === loai && doc(o.i)?.chu === chu).length;
}

/**
 * Người này có thắng ngay lập tức hay không, và vì sao.
 *
 * Hai cách thắng ngay, kiểm tra sau mỗi lần đổi chủ một ô:
 *   "bien"  — gom đủ toàn bộ ô biển
 *   "nhom"  — sở hữu trọn vẹn SO_NHOM_THANG nhóm đất
 */
export function thangNgay(doc: DocO, chu: string): "bien" | "nhom" | null {
  if (!chu) return null;
  if (SO_BIEN > 0 && demTheoLoai(doc, "bien", chu) >= SO_BIEN) return "bien";
  if (demNhomTronBo(doc, chu) >= SO_NHOM_THANG) return "nhom";
  return null;
}

/**
 * Tiền thuê phải trả khi dừng ở ô i.
 *
 * Trả về 0 khi ô chưa có chủ, đang thế chấp, đang mất điện, hoặc người dừng
 * chính là chủ.
 */
export function tienThue(doc: DocO, i: number, nguoiDung: string): number {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt || !coTheMua(o)) return 0;
  if (!tt.chu || tt.chu === nguoiDung || tt.theChap) return 0;
  if (tt.matDien > 0) return 0;

  if (o.loai === "dat") {
    const b = bangThue(o.gia!);
    if (tt.nha > 0) return b[Math.min(BAC_KHACH_SAN, tt.nha)] * DON_VI;
    // Mới cắm cờ nhưng chủ đã trọn nhóm thì tiền thuê nhân đôi.
    return (tronBo(doc, o.nhom!, tt.chu) ? b[0] * 2 : b[0]) * DON_VI;
  }

  const n = demTheoLoai(doc, "bien", tt.chu);
  const bang = bangThueBien();
  return bang[Math.max(0, Math.min(bang.length - 1, n - 1))] * DON_VI;
}

/** Thuế phải nộp ở ô thuế: 10% tài sản ròng, không vượt mức in trên ô. */
export function tienThueO(o: O, taiSan: number): number {
  const tran = (o.thue ?? 0) * DON_VI;
  return Math.min(tran, Math.round(taiSan / 10));
}

/**
 * Có được xây thêm một bậc ở ô i hay không.
 *
 * Xây tự do: ô đất nào của mình cũng xây được, không cần trọn nhóm và không
 * có luật xây đều. Chỉ còn bốn thứ chặn lại, và cả bốn đều là ràng buộc vật
 * lý chứ không phải điều kiện luật: ô phải là đất của mình và chưa thế chấp,
 * chưa lên tới khách sạn, hộp cờ còn quân, và trong túi đủ tiền.
 *
 * `soVong` là vòng thứ mấy người chơi đang đi (bắt đầu từ 1). Ở vòng đầu
 * không ai được xây tới bậc 3 nhà — luật này giữ cho người đi sau không bị
 * bỏ lại quá xa ngay từ đầu ván.
 */
export function coTheXay(
  doc: DocO,
  i: number,
  chu: string,
  tienMat: number,
  nhaConLai: number,
  khachSanConLai: number,
  soVong = 99,
): KetQuaKiemTra {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt) return { ok: false, lyDo: "Ô không hợp lệ." };
  if (o.loai !== "dat") return { ok: false, lyDo: "Chỉ xây được trên ô đất." };
  if (tt.chu !== chu) return { ok: false, lyDo: "Đây không phải đất của bạn." };
  if (tt.theChap) return { ok: false, lyDo: "Ô đang thế chấp, không xây được." };
  if (tt.nha >= BAC_KHACH_SAN) {
    return { ok: false, lyDo: "Đã có khách sạn, không xây thêm được." };
  }
  if (soVong <= 1 && tt.nha >= BAC_TOI_DA_VONG_DAU) {
    return { ok: false, lyDo: "Vòng đầu chỉ được xây tới 2 nhà. Qua Xuất phát rồi xây tiếp." };
  }

  // Nâng từ 3 nhà lên khách sạn thì trả 3 nhà về hộp, chỉ cần 1 khách sạn.
  const nangKhachSan = tt.nha === BAC_KHACH_SAN - 1;
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

/**
 * Có bán được gì ở ô i hay không, và bán thì thu về bao nhiêu.
 *
 * Bán theo bậc: khách sạn hạ về 3 nhà, nhà hạ một căn, hết nhà thì thế chấp
 * cả ô. Mỗi lần gọi chỉ hạ một bậc để người chơi thấy rõ mình đang bán gì.
 */
export function coTheBan(
  doc: DocO,
  i: number,
  chu: string,
  nhaConLai = 99,
): KetQuaKiemTra & { thuVe?: number; viec?: "khachsan" | "nha" | "thechap" } {
  const o = BAN_CO[i];
  const tt = doc(i);
  if (!o || !tt) return { ok: false, lyDo: "Ô không hợp lệ." };
  if (tt.chu !== chu) return { ok: false, lyDo: "Đây không phải ô của bạn." };

  if (o.loai === "dat" && tt.nha >= BAC_KHACH_SAN) {
    // Hạ khách sạn phải lấy 3 nhà từ hộp ra thay vào, hộp cạn thì không hạ được.
    if (nhaConLai < BAC_KHACH_SAN - 1) {
      return { ok: false, lyDo: "Hộp không còn đủ nhà để hạ khách sạn xuống." };
    }
    return { ok: true, viec: "khachsan", thuVe: Math.floor(giaXay(o) / 2) };
  }
  if (o.loai === "dat" && tt.nha > 0) {
    return { ok: true, viec: "nha", thuVe: Math.floor(giaXay(o) / 2) };
  }
  if (tt.theChap) return { ok: false, lyDo: "Ô này đã thế chấp rồi." };
  return { ok: true, viec: "thechap", thuVe: giaTheChap(o) };
}

/** Tổng tài sản: tiền mặt cộng giá đất chưa thế chấp cộng giá nhà đã xây. */
export function taiSanRong(doc: DocO, chu: string, tienMat: number): number {
  let tong = tienMat;
  for (const o of BAN_CO) {
    const tt = doc(o.i);
    if (!tt || tt.chu !== chu) continue;
    tong += tt.theChap ? giaTheChap(o) : giaMua(o);
    if (o.loai === "dat" && tt.nha > 0) {
      const bac = tt.nha >= BAC_KHACH_SAN ? BAC_KHACH_SAN : tt.nha;
      tong += bac * giaXay(o);
    }
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
    if (o.loai === "dat" && tt.nha > 0) {
      const bac = tt.nha >= BAC_KHACH_SAN ? BAC_KHACH_SAN : tt.nha;
      tong += Math.floor((bac * giaXay(o)) / 2);
    }
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
    if (tt.nha >= BAC_KHACH_SAN) khachSan++;
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

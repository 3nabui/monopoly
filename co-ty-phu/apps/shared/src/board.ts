import type { MaNhom, Nhom, O } from "./types.js";

/** Giá in trên bàn cờ tính bằng K (nghìn). */
export const DON_VI = 1000;

/** Tiền mỗi người cầm lúc bắt đầu ván. */
export const TIEN_BAN_DAU = 1_500 * DON_VI;

/** Lương nhận được mỗi lần đi qua ô Xuất phát. */
export const LUONG = 200 * DON_VI;

/** Tiền nộp để ra khỏi Đảo Hoang. */
export const TIEN_RA_DAO = 50 * DON_VI;

/** Số lượt tối đa bị kẹt ở Đảo Hoang trước khi buộc phải nộp tiền. */
export const LUOT_KET_DAO = 3;

/** Số người chơi mà chủ phòng được chọn khi mở phòng. */
export const SO_NGUOI_TOI_THIEU = 2;
export const SO_NGUOI_TOI_DA = 4;

/** Giới hạn thật của hộp cờ. */
export const SO_NHA_TOI_DA = 32;
export const SO_KHACH_SAN_TOI_DA = 12;

export const NHOM: Record<MaNhom, Nhom> = {
  hagiang:  { ten: "Hà Giang",        vung: "Cao nguyên đá Đông Bắc", mau: "#8d6e63" },
  laocai:   { ten: "Lào Cai",         vung: "Núi rừng Tây Bắc",       mau: "#4fc3e8" },
  ninhbinh: { ten: "Ninh Bình",       vung: "Đồng bằng sông Hồng",    mau: "#ec6fa8" },
  hue:      { ten: "Thừa Thiên Huế",  vung: "Cố đô Bắc Trung Bộ",     mau: "#9b6bc9" },
  quangnam: { ten: "Quảng Nam",       vung: "Di sản Nam Trung Bộ",    mau: "#f2922e" },
  lamdong:  { ten: "Lâm Đồng",        vung: "Cao nguyên Tây Nguyên",  mau: "#56b964" },
  hcm:      { ten: "TP. Hồ Chí Minh", vung: "Đầu tàu Đông Nam Bộ",    mau: "#e04b4b" },
  hanoi:    { ten: "Hà Nội",          vung: "Thủ đô ngàn năm",        mau: "#2f5bd4" },
};

/** Thứ tự nhóm từ rẻ tới đắt, dùng cho bảng giá trong HUD. */
export const THU_TU_NHOM: MaNhom[] = [
  "hagiang", "laocai", "ninhbinh", "hue", "quangnam", "lamdong", "hcm", "hanoi",
];

export const MAU_BIEN = "#00a2b5";
export const MAU_COHOI = "#ff8a3d";
export const MAU_THUE = "#52607a";
export const MAU_GOC = "#2f3d57";

/**
 * Bàn cờ 32 ô: 4 ô góc, 20 ô đất chia thành 8 nhóm tỉnh thành, 4 ô biển,
 * 3 ô Cơ hội và 1 ô thuế. Mỗi cạnh có 7 ô thường nằm giữa hai ô góc.
 *
 * Thứ tự đi là theo chiều tăng của i, quay vòng về 0 — tức thuận chiều kim
 * đồng hồ trên bàn 3D.
 */
export const BAN_CO: readonly O[] = [
  { i: 0,  loai: "goc",   ten: "XUẤT PHÁT",          phu: "Nhận 200K mỗi vòng",    icon: "xuatphat" },
  { i: 1,  loai: "dat",   ten: "Đồng Văn",      nhom: "hagiang",  gia: 60,  moc: "nhaSan" },
  { i: 2,  loai: "dat",   ten: "Mèo Vạc",       nhom: "hagiang",  gia: 60,  moc: "nuiDa" },
  { i: 3,  loai: "dat",   ten: "Lũng Cú",       nhom: "hagiang",  gia: 80,  moc: "thapNuoc" },
  { i: 4,  loai: "bien",  ten: "Biển Hạ Long",       phu: "Quảng Ninh", gia: 200, moc: "thuyenBuom" },
  { i: 5,  loai: "dat",   ten: "Bắc Hà",        nhom: "laocai",   gia: 100, moc: "ruongBac" },
  { i: 6,  loai: "dat",   ten: "Bát Xát",       nhom: "laocai",   gia: 100, moc: "nuiSong" },
  { i: 7,  loai: "dat",   ten: "Sa Pa",         nhom: "laocai",   gia: 120, moc: "ruongThong" },

  { i: 8,  loai: "goc",   ten: "ĐẢO HOANG",          phu: "Ghé thăm hoặc mắc kẹt", icon: "daohoang" },
  { i: 9,  loai: "dat",   ten: "Tam Cốc",       nhom: "ninhbinh", gia: 140, moc: "nuiDa" },
  { i: 10, loai: "dat",   ten: "Hoa Lư",        nhom: "ninhbinh", gia: 140, moc: "congThanh" },
  { i: 11, loai: "dat",   ten: "Tràng An",      nhom: "ninhbinh", gia: 160, moc: "nuiSong" },
  { i: 12, loai: "cohoi", ten: "CƠ HỘI" },
  { i: 13, loai: "dat",   ten: "Thiên Mụ",      nhom: "hue",      gia: 180, moc: "thapChuong" },
  { i: 14, loai: "bien",  ten: "Biển Đà Nẵng",       phu: "Bãi Mỹ Khê", gia: 200, moc: "cauVong" },
  { i: 15, loai: "dat",   ten: "Đại Nội",       nhom: "hue",      gia: 200, moc: "congThanh" },

  { i: 16, loai: "goc",   ten: "LỄ HỘI TOÀN QUỐC",   phu: "Nghỉ chân, không mất gì", icon: "lehoi" },
  { i: 17, loai: "dat",   ten: "Mỹ Sơn",        nhom: "quangnam", gia: 220, moc: "thapCham" },
  { i: 18, loai: "bien",  ten: "Biển Nha Trang",     phu: "Khánh Hòa", gia: 200, moc: "resort" },
  { i: 19, loai: "dat",   ten: "Hội An",        nhom: "quangnam", gia: 240, moc: "phoCo" },
  { i: 20, loai: "cohoi", ten: "CƠ HỘI" },
  { i: 21, loai: "dat",   ten: "Bảo Lộc",       nhom: "lamdong",  gia: 260, moc: "doiChe" },
  { i: 22, loai: "dat",   ten: "Đà Lạt",        nhom: "lamdong",  gia: 280, moc: "nhaTho" },
  { i: 23, loai: "dat",   ten: "Đức Trọng",     nhom: "lamdong",  gia: 260, moc: "trucDien" },

  { i: 24, loai: "goc",   ten: "DU LỊCH XUYÊN VIỆT", phu: "Về thẳng Xuất phát",    icon: "dulich" },
  { i: 25, loai: "bien",  ten: "Biển Phú Quốc",      phu: "Kiên Giang", gia: 200, moc: "bienDua" },
  { i: 26, loai: "dat",   ten: "Thủ Thiêm",     nhom: "hcm",      gia: 300, moc: "caoOcDoi" },
  { i: 27, loai: "dat",   ten: "Bến Thành",     nhom: "hcm",      gia: 320, moc: "choThap" },
  { i: 28, loai: "cohoi", ten: "CƠ HỘI" },
  { i: 29, loai: "dat",   ten: "Ba Đình",       nhom: "hanoi",    gia: 350, moc: "chuaMotCot" },
  { i: 30, loai: "thue",  ten: "ĐÓNG THUẾ",         phu: "10% tài sản, tối đa 200K", thue: 200 },
  { i: 31, loai: "dat",   ten: "Hoàn Kiếm",     nhom: "hanoi",    gia: 400, moc: "thapRua" },
];

export const SO_O = BAN_CO.length;

/** Vị trí ô Xuất phát và ô Đảo Hoang, dùng ở nhiều nơi nên đặt tên. */
export const O_XUAT_PHAT = 0;
export const O_DAO_HOANG = 8;

/** Màu quân cờ theo thứ tự ngồi. */
export const MAU_NGUOI_CHOI = ["#3fb36b", "#e7405e", "#f2b705", "#3b82f6"] as const;

export function mauCuaO(o: O): string {
  switch (o.loai) {
    case "dat":   return NHOM[o.nhom!].mau;
    case "bien":  return MAU_BIEN;
    case "cohoi": return MAU_COHOI;
    case "thue":  return MAU_THUE;
    default:      return MAU_GOC;
  }
}

export function tenLoaiO(o: O): string {
  switch (o.loai) {
    case "dat":   return "Ô đất";
    case "bien":  return "Ô biển";
    case "cohoi": return "Thẻ cơ hội";
    case "thue":  return "Thuế";
    default:      return "Ô góc";
  }
}

/** Ô có thể mua được hay không. */
export function coTheMua(o: O): boolean {
  return o.loai === "dat" || o.loai === "bien";
}

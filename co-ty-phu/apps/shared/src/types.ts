/**
 * Kiểu dữ liệu dùng chung cho cả server lẫn client.
 *
 * Quy ước tiền: giá in trên bàn cờ tính bằng "K" (nghìn). Mọi phép tính tiền
 * trong game dùng đơn vị gốc, đổi bằng DON_VI. Ví dụ ô 240K = 240_000.
 */

export type LoaiO =
  | "goc"      // 4 ô góc
  | "dat"      // ô đất thuộc một nhóm tỉnh thành
  | "bien"     // ô biển, thay cho nhà ga
  | "tienich"  // nhà máy điện / nhà máy nước
  | "cohoi"    // thẻ Cơ hội
  | "khivan"   // thẻ Khí vận
  | "thue";    // ô thuế

export type MaNhom =
  | "hagiang" | "laocai" | "ninhbinh" | "hue"
  | "quangnam" | "lamdong" | "hcm" | "hanoi";

export type IconGoc = "xuatphat" | "daohoang" | "lehoi" | "dulich";

export interface Nhom {
  ten: string;
  vung: string;
  /** Màu nhận diện nhóm, dùng cho cả dải màu 3D lẫn HUD. */
  mau: string;
}

export interface O {
  /** Vị trí trên bàn cờ, 0..35. */
  i: number;
  loai: LoaiO;
  ten: string;
  /** Dòng phụ hiển thị dưới tên ô. */
  phu?: string;
  /** Chỉ có ở ô đất. */
  nhom?: MaNhom;
  /** Giá mua, tính bằng K. Có ở ô đất, ô biển, ô tiện ích. */
  gia?: number;
  /** Số tiền phải nộp, tính bằng K. Chỉ có ở ô thuế. */
  thue?: number;
  /** Chỉ có ở ô góc. */
  icon?: IconGoc;
  /** Khoá công trình biểu tượng dựng ở viền ngoài bàn cờ. */
  moc?: string;
}

/** Trạng thái sở hữu của một ô, do server giữ. */
export interface TrangThaiO {
  /** sessionId của chủ sở hữu; chuỗi rỗng nghĩa là chưa ai mua. */
  chu: string;
  /** 0..4 là số nhà, 5 nghĩa là đã nâng lên khách sạn. */
  nha: number;
  /** Đang thế chấp thì không thu được tiền thuê. */
  theChap: boolean;
}

/** Giai đoạn của ván chơi. Server là nơi duy nhất đổi giá trị này. */
export type GiaiDoan =
  | "cho"      // đang chờ đủ người
  | "tung"     // tới lượt ai đó, chờ họ tung xúc xắc
  | "quyet"    // đã dừng ở một ô, chờ người chơi quyết định
  | "ketthuc";

/** Việc người chơi có thể làm khi đang ở giai đoạn "quyet". */
export type HanhDong = "mua" | "boqua" | "tra" | "xay" | "tieptuc";

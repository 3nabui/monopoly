/**
 * Kiểu dữ liệu dùng chung cho cả server lẫn client.
 *
 * Quy ước tiền: giá in trên bàn cờ tính bằng "K" (nghìn). Mọi phép tính tiền
 * trong game dùng đơn vị gốc, đổi bằng DON_VI. Ví dụ ô 240K = 240_000.
 */

export type LoaiO =
  | "goc"      // 4 ô góc
  | "dat"      // ô đất thuộc một nhóm tỉnh thành
  | "bien"     // ô biển, sở hữu hết là thắng ngay
  | "cohoi"    // thẻ Cơ hội
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
  /** Vị trí trên bàn cờ, 0..31. */
  i: number;
  loai: LoaiO;
  ten: string;
  /** Dòng phụ hiển thị dưới tên ô. */
  phu?: string;
  /** Chỉ có ở ô đất. */
  nhom?: MaNhom;
  /** Giá mua, tính bằng K. Có ở ô đất và ô biển. */
  gia?: number;
  /** Mức thuế tối đa, tính bằng K. Chỉ có ở ô thuế. */
  thue?: number;
  /** Chỉ có ở ô góc. */
  icon?: IconGoc;
  /** Khoá công trình biểu tượng dựng ở viền ngoài bàn cờ. */
  moc?: string;
}

/**
 * Trạng thái sở hữu của một ô, do server giữ.
 *
 * Bậc công trình trên ô đất, lưu ở `nha`:
 *   0 = mua đất (cắm cờ)   1 = một nhà   2 = hai nhà
 *   3 = ba nhà             4 = khách sạn
 */
export interface TrangThaiO {
  /** sessionId của chủ sở hữu; chuỗi rỗng nghĩa là chưa ai mua. */
  chu: string;
  /** Bậc công trình, 0..4. Xem bảng trên. */
  nha: number;
  /** Đang thế chấp thì không thu được tiền thuê. */
  theChap: boolean;
  /** Số lần tung xúc xắc còn lại mà ô này mất điện, 0 là bình thường. */
  matDien: number;
  /**
   * Lễ hội thường: đầu mỗi trận server giăng cờ ở 2 ô ngẫu nhiên và giữ
   * nguyên suốt ván.
   */
  leHoi: boolean;
  /**
   * Lễ hội toàn quốc: cả bàn chỉ có đúng một ô mang cờ này. Ai dừng ở ô góc
   * Lễ hội toàn quốc thì được dời nó về một ô đất của mình.
   */
  leHoiToanQuoc: boolean;
}

/** Giai đoạn của ván chơi. Server là nơi duy nhất đổi giá trị này. */
export type GiaiDoan =
  | "cho"      // đang chờ đủ người
  | "tung"     // tới lượt ai đó, chờ họ tung xúc xắc
  | "quyet"    // đã dừng ở một ô, chờ người chơi quyết định
  | "gom"      // thiếu tiền mặt, chờ người chơi chọn ô để bán
  | "chon"     // thẻ cơ hội yêu cầu chọn một ô trên bàn
  | "ketthuc";

/** Việc người chơi có thể làm khi đang ở giai đoạn "quyet". */
export type HanhDong =
  | "mua"      // mua ô chưa có chủ
  | "muadut"   // mua đứt ô của người khác
  | "boqua"
  | "tra"      // trả tiền thuê
  | "xay"
  | "ban"      // bán bớt công trình hoặc thế chấp đất
  | "tudong"   // để server tự bán cho đủ tiền
  | "tieptuc";

/**
 * Việc server đang bắt người chơi chọn trên bàn cờ. Bốn kiểu đầu do thẻ cơ
 * hội sinh ra, hai kiểu sau không phải thẻ.
 */
export type KieuChon =
  | "phaBo"          // phá bỏ một ô của người khác, ô thành vô chủ
  | "tangO"          // chọn một ô của mình để tặng
  | "tangNguoi"      // bước hai của tặng ô: chọn tặng cho ai
  | "matDien"        // làm một ô của người khác mất điện
  | "haBac"          // hạ một bậc công trình của người khác
  | "leHoiToanQuoc"  // dời lễ hội toàn quốc về một ô đất của mình
  | "dulich";        // ô góc Du lịch: chọn một ô bất kỳ để đi tới

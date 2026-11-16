/**
 * BỘ THẺ CƠ HỘI VÀ KHÍ VẬN
 * ========================
 *
 * Đây là chỗ duy nhất cần sửa khi muốn thêm, bớt hoặc đổi nội dung thẻ.
 * Sửa xong chạy lại `npm run dev:server` là có hiệu lực, không phải đụng
 * chỗ nào khác.
 *
 * Mỗi thẻ gồm hai phần:
 *   noiDung  — câu chữ hiện lên cho người chơi đọc
 *   hieuUng  — việc server sẽ làm, chọn một trong các kiểu bên dưới
 *
 * Số tiền ghi theo đơn vị K giống giá in trên bàn cờ. 150 nghĩa là 150K,
 * tức 150.000 trong game.
 *
 * Hai bộ được trộn riêng khi mở phòng. Rút xong thẻ xuống đáy bộ, nên cả
 * bộ quay vòng đều chứ không lặp ngẫu nhiên.
 */

/** Các kiểu hiệu ứng mà một thẻ có thể mang. */
export type HieuUngThe =
  /** Nhà băng trả cho người rút. */
  | { loai: "nhan"; so: number }
  /** Người rút trả cho nhà băng. */
  | { loai: "nop"; so: number }
  /** Mỗi người chơi khác trả cho người rút. */
  | { loai: "thuMoiNguoi"; so: number }
  /** Người rút trả cho từng người chơi khác. */
  | { loai: "traMoiNguoi"; so: number }
  /**
   * Đi thẳng tới ô số `o`. Đây là ĐI TỚI chứ không phải lùi: người chơi
   * vòng theo chiều thường và nhận lương nếu qua ô Xuất phát.
   * Số ô xem trong board.ts, hoặc bảng trong LUAT-CHOI.md.
   */
  | { loai: "diToi"; o: number }
  /** Bị đưa thẳng vào Đảo Hoang, không đi qua ô nào nên không nhận lương. */
  | { loai: "vaoDao" }
  /** Lùi lại `so` ô. Đây là cách duy nhất khiến quân đi ngược. */
  | { loai: "luiLai"; so: number }
  /** Nộp tiền sửa chữa theo số nhà và khách sạn đang có. */
  | { loai: "suaNha"; moiNha: number; moiKhachSan: number };

export interface The {
  noiDung: string;
  hieuUng: HieuUngThe;
}

/**
 * Thẻ CƠ HỘI — nghiêng về di chuyển và vận may.
 * Ô số 7, 13, 20, 24, 34 trên bàn cờ.
 */
export const BO_CO_HOI: readonly The[] = [
  { noiDung: "Trúng thầu dự án ven biển, nhận 150K.", hieuUng: { loai: "nhan", so: 150 } },
  { noiDung: "Đi thẳng về ô Xuất phát và nhận lương.", hieuUng: { loai: "diToi", o: 0 } },
  { noiDung: "Lạc đường trên đèo, lùi lại 3 ô.", hieuUng: { loai: "luiLai", so: 3 } },
  { noiDung: "Vi phạm quy hoạch, vào Đảo Hoang.", hieuUng: { loai: "vaoDao" } },
  { noiDung: "Khách du lịch đông bất ngờ, nhận 100K.", hieuUng: { loai: "nhan", so: 100 } },
  { noiDung: "Chi phí quảng bá du lịch, nộp 80K.", hieuUng: { loai: "nop", so: 80 } },
  { noiDung: "Bạn thắng cuộc thi khởi nghiệp, mỗi người trả bạn 50K.", hieuUng: { loai: "thuMoiNguoi", so: 50 } },
  { noiDung: "Đi thẳng tới Biển Nha Trang.", hieuUng: { loai: "diToi", o: 22 } },
  { noiDung: "Bảo trì toàn bộ bất động sản: 25K mỗi nhà, 100K mỗi khách sạn.", hieuUng: { loai: "suaNha", moiNha: 25, moiKhachSan: 100 } },
  { noiDung: "Cổ tức quỹ đầu tư, nhận 50K.", hieuUng: { loai: "nhan", so: 50 } },
];

/**
 * Thẻ KHÍ VẬN — nghiêng về tiền bạc.
 * Ô số 2, 16, 29 trên bàn cờ.
 */
export const BO_KHI_VAN: readonly The[] = [
  { noiDung: "Hoàn thuế cuối năm, nhận 200K.", hieuUng: { loai: "nhan", so: 200 } },
  { noiDung: "Viện phí sau chuyến leo núi, nộp 100K.", hieuUng: { loai: "nop", so: 100 } },
  { noiDung: "Mừng khai trương, mỗi người trả bạn 30K.", hieuUng: { loai: "thuMoiNguoi", so: 30 } },
  { noiDung: "Khao cả bàn một chầu, trả mỗi người 40K.", hieuUng: { loai: "traMoiNguoi", so: 40 } },
  { noiDung: "Bán lô đất cũ, nhận 120K.", hieuUng: { loai: "nhan", so: 120 } },
  { noiDung: "Phạt xây dựng sai phép, nộp 150K.", hieuUng: { loai: "nop", so: 150 } },
  { noiDung: "Đi thẳng tới Hội An.", hieuUng: { loai: "diToi", o: 21 } },
  { noiDung: "Trốn thuế bị phát hiện, vào Đảo Hoang.", hieuUng: { loai: "vaoDao" } },
  { noiDung: "Tiền thưởng cuối quý, nhận 80K.", hieuUng: { loai: "nhan", so: 80 } },
  { noiDung: "Sửa chữa sau bão: 20K mỗi nhà, 75K mỗi khách sạn.", hieuUng: { loai: "suaNha", moiNha: 20, moiKhachSan: 75 } },
];

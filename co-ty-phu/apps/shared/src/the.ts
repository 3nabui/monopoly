import type { KieuChon } from "./types.js";

/**
 * BỘ THẺ CƠ HỘI
 * =============
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
 * Bộ thẻ được trộn khi mở phòng. Rút xong thẻ xuống đáy bộ, nên cả bộ quay
 * vòng đều chứ không lặp ngẫu nhiên.
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
  | { loai: "suaNha"; moiNha: number; moiKhachSan: number }
  /**
   * Thẻ bắt người rút chọn một ô trên bàn cờ. Server tính sẵn danh sách ô
   * hợp lệ và client chỉ cho bấm vào những ô đó. Hết giờ thì server chọn
   * thay. Bốn kiểu chọn xem KieuChon trong types.ts.
   */
  | { loai: "chon"; kieu: KieuChon };

export interface The {
  noiDung: string;
  hieuUng: HieuUngThe;
}

/**
 * Thẻ CƠ HỘI — ô số 12, 20, 28 trên bàn cờ.
 *
 * Bốn thẻ cuối là thẻ tương tác: người rút phải bấm chọn một ô trên bàn.
 */
export const BO_CO_HOI: readonly The[] = [
  { noiDung: "Trúng thầu dự án ven biển, nhận 150K.", hieuUng: { loai: "nhan", so: 150 } },
  { noiDung: "Hoàn thuế cuối năm, nhận 200K.", hieuUng: { loai: "nhan", so: 200 } },
  { noiDung: "Khách du lịch đông bất ngờ, nhận 100K.", hieuUng: { loai: "nhan", so: 100 } },
  { noiDung: "Đi thẳng về ô Xuất phát và nhận lương.", hieuUng: { loai: "diToi", o: 0 } },
  { noiDung: "Đi thẳng tới Biển Nha Trang.", hieuUng: { loai: "diToi", o: 18 } },
  { noiDung: "Lạc đường trên đèo, lùi lại 3 ô.", hieuUng: { loai: "luiLai", so: 3 } },
  { noiDung: "Vi phạm quy hoạch, vào Đảo Hoang.", hieuUng: { loai: "vaoDao" } },
  { noiDung: "Chi phí quảng bá du lịch, nộp 80K.", hieuUng: { loai: "nop", so: 80 } },
  { noiDung: "Phạt xây dựng sai phép, nộp 150K.", hieuUng: { loai: "nop", so: 150 } },
  { noiDung: "Bạn thắng cuộc thi khởi nghiệp, mỗi người trả bạn 50K.", hieuUng: { loai: "thuMoiNguoi", so: 50 } },
  { noiDung: "Khao cả bàn một chầu, trả mỗi người 40K.", hieuUng: { loai: "traMoiNguoi", so: 40 } },
  { noiDung: "Bảo trì toàn bộ bất động sản: 25K mỗi nhà, 100K mỗi khách sạn.", hieuUng: { loai: "suaNha", moiNha: 25, moiKhachSan: 100 } },

  {
    noiDung: "Giải toả mặt bằng: chọn một ô của người khác để phá bỏ, ô đó thành vô chủ. Ô đã có khách sạn thì không được.",
    hieuUng: { loai: "chon", kieu: "phaBo" },
  },
  {
    noiDung: "Thanh tra xây dựng: chọn một ô của người khác để hạ một bậc công trình. Ô đã có khách sạn thì không được.",
    hieuUng: { loai: "chon", kieu: "haBac" },
  },
  {
    noiDung: "Sự cố lưới điện: chọn một ô của người khác, ô đó mất điện 5 lượt tung, ai dừng ở đó cũng không phải trả tiền.",
    hieuUng: { loai: "chon", kieu: "matDien" },
  },
  {
    noiDung: "Làm từ thiện: chọn một ô của bạn để tặng người chơi kế tiếp.",
    hieuUng: { loai: "chon", kieu: "tangO" },
  },
];

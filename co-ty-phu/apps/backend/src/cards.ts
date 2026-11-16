/**
 * Bộ thẻ Cơ hội và Khí vận.
 *
 * Số tiền ghi theo đơn vị K giống giá in trên bàn cờ; phòng chơi nhân với
 * DON_VI khi áp dụng.
 */

export type HieuUngThe =
  | { loai: "nhan"; so: number }
  | { loai: "nop"; so: number }
  | { loai: "thuMoiNguoi"; so: number }
  | { loai: "traMoiNguoi"; so: number }
  | { loai: "diToi"; o: number }
  | { loai: "vaoDao" }
  | { loai: "luiLai"; so: number }
  | { loai: "suaNha"; moiNha: number; moiKhachSan: number };

export interface The {
  noiDung: string;
  hieuUng: HieuUngThe;
}

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

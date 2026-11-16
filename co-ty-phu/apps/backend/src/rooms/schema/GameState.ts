import { schema, t, type SchemaType } from "@colyseus/schema";
import { SO_NHA_TOI_DA, SO_KHACH_SAN_TOI_DA } from "@co-ty-phu/shared";

/**
 * Trạng thái ván chơi. Đây là nguồn sự thật duy nhất — client chỉ đọc, mọi
 * thay đổi đều do phòng chơi trên server thực hiện.
 */

export const NguoiChoi = schema({
  /** Mã người dùng lấy từ tài khoản đăng nhập, bền qua các lần vào lại. */
  uid: t.string().default(""),
  ten: t.string().default(""),
  /** Ảnh đại diện từ Google, rỗng nếu không có. */
  anh: t.string().default(""),
  /** Chỉ số màu quân cờ, 0..3. */
  mau: t.uint8().default(0),
  tien: t.number().default(0),
  /** Vị trí trên bàn cờ, 0..31. */
  viTri: t.uint8().default(0),
  /**
   * Số ô của nước đi vừa rồi, có dấu: dương là đi tới, âm là lùi lại,
   * 0 nghĩa là bị dời thẳng (vào Đảo Hoang) chứ không bước qua từng ô.
   * Client dựa vào đây để chạy hoạt ảnh đúng hướng.
   */
  buocCuoi: t.int8().default(0),
  /**
   * Đang đi vòng thứ mấy, bắt đầu từ 1 và tăng mỗi lần qua ô Xuất phát.
   * Vòng 1 bị hạn chế xây nhà — xem coTheXay trong package shared.
   */
  soVong: t.uint8().default(1),
  /** Thứ tự ngồi, quyết định thứ tự đi. */
  thuTu: t.uint8().default(0),
  sanSang: t.boolean().default(false),
  oDao: t.boolean().default(false),
  luotODao: t.uint8().default(0),
  phaSan: t.boolean().default(false),
  ketNoi: t.boolean().default(true),
});
export type NguoiChoi = SchemaType<typeof NguoiChoi>;

export const TrangThaiO = schema({
  /** sessionId của chủ sở hữu; chuỗi rỗng nghĩa là chưa ai mua. */
  chu: t.string().default(""),
  /** Bậc công trình: 0 là mới cắm cờ, 1..3 là số nhà, 4 là khách sạn. */
  nha: t.uint8().default(0),
  theChap: t.boolean().default(false),
  /** Số lần tung xúc xắc còn lại mà ô này mất điện, 0 là bình thường. */
  matDien: t.uint8().default(0),
  /** Cờ lễ hội thường, server giăng ngẫu nhiên đầu trận và không ai dời được. */
  leHoi: t.boolean().default(false),
  /** Cờ lễ hội toàn quốc, cả bàn chỉ có đúng một ô mang cờ này. */
  leHoiToanQuoc: t.boolean().default(false),
});
export type TrangThaiO = SchemaType<typeof TrangThaiO>;

export const DongNhatKy = schema({
  noiDung: t.string().default(""),
  /** "tien" | "mua" | "xay" | "the" | "he-thong" — dùng để tô màu trong HUD. */
  loai: t.string().default("he-thong"),
});
export type DongNhatKy = SchemaType<typeof DongNhatKy>;

export const GameState = schema({
  /** "cho" | "tung" | "quyet" | "gom" | "chon" | "ketthuc" */
  giaiDoan: t.string().default("cho"),

  nguoiChoi: t.map(NguoiChoi),
  o: t.array(TrangThaiO),

  /** sessionId của người được quyền hành động lúc này. */
  luotCua: t.string().default(""),
  /** Mốc thời gian theo đồng hồ phòng mà lượt hiện tại hết hạn. */
  hanLuot: t.number().default(0),

  xx1: t.uint8().default(0),
  xx2: t.uint8().default(0),
  /** Số lần tung ra đôi liên tiếp trong lượt này. */
  soLanDoi: t.uint8().default(0),

  /** Ô đang chờ người chơi quyết định; -1 nghĩa là không có. */
  oChoQuyet: t.int8().default(-1),
  /** Số tiền phải trả ở ô đang chờ, nếu có. */
  tienPhaiTra: t.number().default(0),
  /** Danh sách hành động hợp lệ, ngăn cách bằng dấu phẩy. */
  hanhDong: t.string().default(""),
  /** Câu giải thích hiện trong HUD. */
  thongBao: t.string().default(""),

  /** Giai đoạn "gom": số tiền mặt còn thiếu mà người chơi phải bán để bù. */
  tienCanGom: t.number().default(0),
  /**
   * Giai đoạn "chon": kiểu chọn mà thẻ cơ hội yêu cầu
   * ("phaBo" | "tangO" | "matDien" | "haBac"), rỗng khi không chọn gì.
   */
  kieuChon: t.string().default(""),
  /** Danh sách ô được phép chọn, số thứ tự ngăn cách bằng dấu phẩy. */
  oChonDuoc: t.string().default(""),
  /** Danh sách người được phép chọn ở bước tặng ô, sessionId cách nhau dấu phẩy. */
  nguoiChonDuoc: t.string().default(""),
  /** Ô đang chờ tặng ở bước hai của thẻ tặng ô; -1 nghĩa là không có. */
  oDangTang: t.int8().default(-1),

  /**
   * CÔNG BỐ — những gì cả bàn phải cùng nhìn thấy.
   *
   * `thongBao` ở trên chỉ nói với người đang tới lượt, còn đây là kênh phát
   * cho mọi client: ai rút được thẻ gì, ai mua đứt của ai, lễ hội dời đi
   * đâu. Client nào thấy `congBoSo` nhảy số thì bật tấm thẻ giữa màn hình.
   */
  congBo: t.string().default(""),
  /** "the" | "mua" | "lehoi" | "tien" — client dùng để chọn màu tấm thẻ. */
  congBoLoai: t.string().default(""),
  /** sessionId của người mà công bố này nói tới, để lấy tên và màu quân. */
  congBoAi: t.string().default(""),
  /** Tăng một đơn vị mỗi lần công bố, kể cả khi nội dung trùng lần trước. */
  congBoSo: t.uint16().default(0),

  nhatKy: t.array(DongNhatKy),
  nguoiThang: t.string().default(""),
  /** "bien" | "nhom" | "conlai" — vì sao người đó thắng. */
  lyDoThang: t.string().default(""),

  nhaConLai: t.uint8().default(SO_NHA_TOI_DA),
  khachSanConLai: t.uint8().default(SO_KHACH_SAN_TOI_DA),

  /** Tên phòng do người tạo đặt, hiện ở sảnh và trên đầu màn chơi. */
  tenPhong: t.string().default(""),
  coMatKhau: t.boolean().default(false),
  /** sessionId của người tạo phòng. */
  chuPhong: t.string().default(""),
});
export type GameState = SchemaType<typeof GameState>;

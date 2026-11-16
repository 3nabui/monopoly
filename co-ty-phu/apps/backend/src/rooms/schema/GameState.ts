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
  /** Vị trí trên bàn cờ, 0..35. */
  viTri: t.uint8().default(0),
  /**
   * Số ô của nước đi vừa rồi, có dấu: dương là đi tới, âm là lùi lại,
   * 0 nghĩa là bị dời thẳng (vào Đảo Hoang) chứ không bước qua từng ô.
   * Client dựa vào đây để chạy hoạt ảnh đúng hướng.
   */
  buocCuoi: t.int8().default(0),
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
  /** 0..4 là số nhà, 5 nghĩa là khách sạn. */
  nha: t.uint8().default(0),
  theChap: t.boolean().default(false),
});
export type TrangThaiO = SchemaType<typeof TrangThaiO>;

export const DongNhatKy = schema({
  noiDung: t.string().default(""),
  /** "tien" | "mua" | "xay" | "the" | "he-thong" — dùng để tô màu trong HUD. */
  loai: t.string().default("he-thong"),
});
export type DongNhatKy = SchemaType<typeof DongNhatKy>;

export const GameState = schema({
  /** "cho" | "tung" | "quyet" | "ketthuc" */
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

  nhatKy: t.array(DongNhatKy),
  nguoiThang: t.string().default(""),

  nhaConLai: t.uint8().default(SO_NHA_TOI_DA),
  khachSanConLai: t.uint8().default(SO_KHACH_SAN_TOI_DA),

  /** Tên phòng do người tạo đặt, hiện ở sảnh và trên đầu màn chơi. */
  tenPhong: t.string().default(""),
  coMatKhau: t.boolean().default(false),
  /** sessionId của người tạo phòng. */
  chuPhong: t.string().default(""),
});
export type GameState = SchemaType<typeof GameState>;

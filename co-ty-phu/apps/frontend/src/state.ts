/**
 * Ảnh chụp trạng thái ván chơi dưới dạng dữ liệu thuần.
 *
 * Client không bao giờ tự sửa những số này — nó chỉ vẽ lại những gì server
 * gửi xuống. Mọi thay đổi đều phải đi qua một tin nhắn lên server.
 */

export interface NguoiChoiVM {
  sid: string;
  /** Mã tài khoản, bền qua các lần vào lại phòng. */
  uid: string;
  /** Ảnh đại diện Google, chuỗi rỗng nếu không có. */
  anh: string;
  ten: string;
  mau: number;
  tien: number;
  viTri: number;
  /** Số ô của nước đi vừa rồi, có dấu. 0 nghĩa là bị dời thẳng. */
  buocCuoi: number;
  /** Đang đi vòng thứ mấy, bắt đầu từ 1. Vòng 1 bị hạn chế xây nhà. */
  soVong: number;
  thuTu: number;
  sanSang: boolean;
  oDao: boolean;
  phaSan: boolean;
  ketNoi: boolean;
}

export interface OVM {
  chu: string;
  /** Bậc công trình: 0 là mới cắm cờ, 1..3 là số nhà, 4 là khách sạn. */
  nha: number;
  theChap: boolean;
  /** Số lần tung còn lại mà ô mất điện, 0 là bình thường. */
  matDien: number;
  /** Cờ lễ hội thường, giăng ngẫu nhiên đầu trận và cố định suốt ván. */
  leHoi: boolean;
  /** Cờ lễ hội toàn quốc, cả bàn chỉ có đúng một ô. */
  leHoiToanQuoc: boolean;
}

export interface DongNhatKyVM {
  noiDung: string;
  loai: string;
}

export interface AnhChup {
  giaiDoan: string;
  luotCua: string;
  hanLuot: number;
  xx1: number;
  xx2: number;
  oChoQuyet: number;
  tienPhaiTra: number;
  hanhDong: string[];
  thongBao: string;
  /** Giai đoạn "gom": số tiền mặt còn thiếu. */
  tienCanGom: number;
  /** Giai đoạn "chon": kiểu chọn mà thẻ cơ hội yêu cầu. */
  kieuChon: string;
  /** Những ô được phép chọn trong giai đoạn "chon". */
  oChonDuoc: number[];
  /** Những người được phép chọn ở bước tặng ô. */
  nguoiChonDuoc: string[];
  /** Ô đang chờ tặng ở bước hai của thẻ tặng ô; -1 nghĩa là không có. */
  oDangTang: number;
  /** Công bố cho cả bàn: nội dung, loại, người liên quan, và số đếm. */
  congBo: string;
  congBoLoai: string;
  congBoAi: string;
  congBoSo: number;
  nguoiThang: string;
  /** "bien" | "nhom" | "conlai" — vì sao người đó thắng. */
  lyDoThang: string;
  nhaConLai: number;
  khachSanConLai: number;
  tenPhong: string;
  coMatKhau: boolean;
  chuPhong: string;
  nguoiChoi: NguoiChoiVM[];
  o: OVM[];
  nhatKy: DongNhatKyVM[];
}

export function anhChupRong(): AnhChup {
  return {
    giaiDoan: "cho", luotCua: "", hanLuot: 0, xx1: 0, xx2: 0,
    oChoQuyet: -1, tienPhaiTra: 0, hanhDong: [], thongBao: "",
    tienCanGom: 0, kieuChon: "", oChonDuoc: [], nguoiChonDuoc: [], oDangTang: -1,
    congBo: "", congBoLoai: "", congBoAi: "", congBoSo: 0,
    nguoiThang: "", lyDoThang: "", nhaConLai: 32, khachSanConLai: 12,
    tenPhong: "", coMatKhau: false, chuPhong: "",
    nguoiChoi: [], o: [], nhatKy: [],
  };
}

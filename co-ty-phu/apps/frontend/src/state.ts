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
  thuTu: number;
  sanSang: boolean;
  oDao: boolean;
  phaSan: boolean;
  ketNoi: boolean;
}

export interface OVM {
  chu: string;
  nha: number;
  theChap: boolean;
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
  nguoiThang: string;
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
    nguoiThang: "", nhaConLai: 32, khachSanConLai: 12,
    tenPhong: "", coMatKhau: false, chuPhong: "",
    nguoiChoi: [], o: [], nhatKy: [],
  };
}

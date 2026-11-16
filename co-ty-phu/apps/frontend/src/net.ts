import { ColyseusSDK, type Room } from "@colyseus/sdk";
import type { default as server } from "@co-ty-phu/backend/app.config";
import type { AnhChup } from "./state.js";

/**
 * Lớp mạng. Kiểu `typeof server` lấy từ backend nên tên phòng và tên tin nhắn
 * được kiểm tra lúc biên dịch; không có dòng mã server nào lọt vào bundle.
 */

const DIA_CHI = import.meta.env.VITE_SERVER ?? `ws://${location.hostname}:2567`;
const KHOA_PHIEN = "co-ty-phu:phien";

const client = new ColyseusSDK<typeof server>(DIA_CHI);

export type HanhDongGui = "sanSang" | "tungXucXac" | "mua" | "boqua" | "tra" | "tieptuc";

export interface KetNoi {
  room: Room;
  sid: string;
  gui(hanhDong: HanhDongGui): void;
  xay(o?: number): void;
  roi(): void;
}

function doiSangAnhChup(state: any): AnhChup {
  const nguoiChoi: AnhChup["nguoiChoi"] = [];
  state.nguoiChoi.forEach((p: any, sid: string) => {
    nguoiChoi.push({
      sid,
      ten: p.ten, mau: p.mau, tien: p.tien, viTri: p.viTri, thuTu: p.thuTu,
      sanSang: p.sanSang, oDao: p.oDao, phaSan: p.phaSan, ketNoi: p.ketNoi,
    });
  });
  nguoiChoi.sort((a, b) => a.thuTu - b.thuTu);

  return {
    giaiDoan: state.giaiDoan,
    luotCua: state.luotCua,
    hanLuot: state.hanLuot,
    xx1: state.xx1,
    xx2: state.xx2,
    oChoQuyet: state.oChoQuyet,
    tienPhaiTra: state.tienPhaiTra,
    hanhDong: state.hanhDong ? String(state.hanhDong).split(",") : [],
    thongBao: state.thongBao,
    nguoiThang: state.nguoiThang,
    nhaConLai: state.nhaConLai,
    khachSanConLai: state.khachSanConLai,
    nguoiChoi,
    o: [...state.o].map((t: any) => ({ chu: t.chu, nha: t.nha, theChap: t.theChap })),
    nhatKy: [...state.nhatKy].map((d: any) => ({ noiDung: d.noiDung, loai: d.loai })),
  };
}

export interface TuyChonKetNoi {
  ten: string;
  onState(anh: AnhChup): void;
  onLoi(thongBao: string): void;
  onRoi(): void;
}

export async function ketNoi(opt: TuyChonKetNoi): Promise<KetNoi> {
  let room: Room;

  // Rớt mạng rồi tải lại trang thì vào lại đúng ghế cũ nếu server còn giữ.
  const token = sessionStorage.getItem(KHOA_PHIEN);
  if (token) {
    try {
      room = await client.reconnect(token);
    } catch {
      sessionStorage.removeItem(KHOA_PHIEN);
      room = await client.joinOrCreate("co_ty_phu", { ten: opt.ten });
    }
  } else {
    room = await client.joinOrCreate("co_ty_phu", { ten: opt.ten });
  }

  try {
    sessionStorage.setItem(KHOA_PHIEN, room.reconnectionToken);
  } catch {
    /* chế độ riêng tư có thể chặn, bỏ qua */
  }

  room.onStateChange((state: any) => opt.onState(doiSangAnhChup(state)));
  room.onMessage("loi", (tin: any) => opt.onLoi(tin?.thongBao ?? "Không thực hiện được."));
  room.onLeave(() => {
    sessionStorage.removeItem(KHOA_PHIEN);
    opt.onRoi();
  });

  return {
    room,
    sid: room.sessionId,
    gui: (hanhDong) => room.send(hanhDong as any),
    xay: (o) => room.send("xay" as any, o === undefined ? {} : { o }),
    roi: () => {
      sessionStorage.removeItem(KHOA_PHIEN);
      void room.leave();
    },
  };
}

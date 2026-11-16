import "./style.css";
import { BanCo3D } from "./board3d.js";
import { Hud } from "./hud.js";
import {
  dangNhapGoogle, dangNhapKhach, dangXuat, dienGiaiLoi, layCauHinh,
  moSanh, noiLai, taoPhong, theoDoiDangNhap, vaoPhong,
  type KetNoi, type NguoiDung, type PhongTomTat, type Sanh,
} from "./net.js";
import { anhChupRong, type AnhChup } from "./state.js";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ban = new BanCo3D(canvas);

let mang: KetNoi | null = null;
let sanh: Sanh | null = null;
let nguoiDung: NguoiDung | null = null;
let anh: AnhChup = anhChupRong();

/** Ba hàm callback mà mọi đường vào phòng đều dùng chung. */
const khiVaoPhong = {
  onState: (a: AnhChup) => {
    anh = a;
    ban.capNhat(a);
    hud.ve(a);
  },
  onLoi: (t: string) => hud.bao(t),
  onRoi: () => {
    mang = null;
    hud.veSanh();
    void batDauSanh();
  },
};

async function batDauSanh() {
  if (sanh) return;
  try {
    sanh = await moSanh((ds: PhongTomTat[]) => hud.veDanhSachPhong(ds));
  } catch (e) {
    console.error(e);
    hud.bao("Không tải được danh sách phòng.");
  }
}

function dongSanh() {
  sanh?.roi();
  sanh = null;
}

const hud = new Hud({
  onDangNhapGoogle: async () => {
    try {
      await dangNhapGoogle();
    } catch (e) {
      console.error(e);
      hud.moKhoaSanh();
      hud.bao("Đăng nhập Google không thành công.");
    }
  },

  onDangNhapKhach: async (ten) => {
    try {
      await dangNhapKhach(ten);
    } catch (e) {
      console.error(e);
      hud.bao("Không vào thử được. Máy chủ đã chạy chưa?");
    }
  },

  onDangXuat: async () => {
    mang?.roi();
    dongSanh();
    await dangXuat();
  },

  onTaoPhong: async (ten, matKhau) => {
    try {
      dongSanh();
      mang = await taoPhong(ten, matKhau, khiVaoPhong);
      hud.datSid(mang.sid);
      hud.datManHinh("phong");
    } catch (e) {
      console.error(e);
      hud.moKhoaSanh();
      hud.bao(dienGiaiLoi(e));
      void batDauSanh();
    }
  },

  onVaoPhong: async (roomId, matKhau) => {
    try {
      dongSanh();
      mang = await vaoPhong(roomId, matKhau, khiVaoPhong);
      hud.datSid(mang.sid);
      hud.datManHinh("phong");
    } catch (e) {
      console.error(e);
      hud.bao(dienGiaiLoi(e));
      void batDauSanh();
    }
  },

  onRoiPhong: () => mang?.roi(),
  onSanSang: () => mang?.gui("sanSang"),
  onTung: () => mang?.gui("tungXucXac"),
  onHanhDong: (hd) => mang?.gui(hd as any),
  onXay: (o) => mang?.xay(o),
  onBan: (o) => mang?.ban(o),
  onChon: (o) => mang?.chon(o),
  onChonNguoi: (sid) => mang?.chonNguoi(sid),

  onDoiMau: () => {
    const toi = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = toi ? "light" : "dark";
    document.getElementById("btnTheme")!.textContent = toi ? "☾" : "☀";
    ban.dongBoMau();
  },

  onChoiLai: () => {
    mang?.roi();
    document.getElementById("ketthuc")!.hidden = true;
  },

  onPhongTo: () => ban.phongTo(),
  onThuNho: () => ban.thuNho(),
});

ban.setOnChonO((i) => {
  // Đang có thẻ cơ hội chờ chọn ô và ô này hợp lệ thì bấm là chọn luôn,
  // không mở thẻ thông tin — đó là việc người chơi đang phải làm.
  if (anh.giaiDoan === "chon" && anh.luotCua === mang?.sid && anh.oChonDuoc.includes(i)) {
    mang.chon(i);
    return;
  }
  hud.moTheO(i);
});
ban.setOnZoom((z) => hud.capNhatZoom(z));
hud.capNhatZoom(ban.mucZoom);

/** Dành chỗ bên trái cho bảng giá khi màn hình đủ rộng. */
function canChinhKhung() {
  const legend = document.getElementById("legend")!;
  const rong = window.innerWidth >= 1180 && !legend.hidden;
  ban.datLechTrai(rong ? 282 : 0);
}
window.addEventListener("resize", canChinhKhung);
window.addEventListener("hud:layout", canChinhKhung);
canChinhKhung();

// Theo hệ thống lúc mở, sau đó người chơi tự bấm nút đổi.
if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
  document.documentElement.dataset.theme = "dark";
  document.getElementById("btnTheme")!.textContent = "☀";
  ban.dongBoMau();
}

hud.ve(anh);

/* ----------------------------------------------------------- khởi động */

void (async () => {
  hud.datCauHinh(await layCauHinh());

  theoDoiDangNhap(async (nd) => {
    nguoiDung = nd;
    hud.datNguoiDung(nd);

    if (!nd) {
      dongSanh();
      hud.datManHinh("dangnhap");
      return;
    }

    // Tải lại trang giữa ván thì nối lại đúng phòng cũ nếu server còn giữ ghế.
    if (!mang) {
      const lai = await noiLai(khiVaoPhong);
      if (lai) {
        mang = lai;
        hud.datSid(lai.sid);
        hud.datManHinh("phong");
        return;
      }
    }

    hud.datManHinh("sanh");
    await batDauSanh();
  });
})();

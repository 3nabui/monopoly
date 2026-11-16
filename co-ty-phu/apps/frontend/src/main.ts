import "./style.css";
import { BanCo3D } from "./board3d.js";
import { Hud } from "./hud.js";
import { ketNoi, type KetNoi } from "./net.js";
import { anhChupRong, type AnhChup } from "./state.js";

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const ban = new BanCo3D(canvas);

let mang: KetNoi | null = null;
let anh: AnhChup = anhChupRong();

const hud = new Hud({
  onVaoPhong: async (ten) => {
    try {
      mang = await ketNoi({
        ten,
        onState: (a) => {
          anh = a;
          ban.capNhat(a);
          hud.ve(a);
        },
        onLoi: (t) => hud.bao(t),
        onRoi: () => {
          mang = null;
          hud.matKetNoi();
        },
      });
      hud.datSid(mang.sid);
      hud.ve(anh);
    } catch (e) {
      console.error(e);
      hud.matKetNoi();
      hud.bao("Không kết nối được máy chủ. Server đã chạy ở cổng 2567 chưa?");
    }
  },
  onSanSang: () => mang?.gui("sanSang"),
  onTung: () => mang?.gui("tungXucXac"),
  onHanhDong: (hd) => mang?.gui(hd as any),
  onXay: (o) => mang?.xay(o),
  onDoiMau: () => {
    const toi = document.documentElement.dataset.theme === "dark";
    document.documentElement.dataset.theme = toi ? "light" : "dark";
    document.getElementById("btnTheme")!.textContent = toi ? "☾" : "☀";
    ban.dongBoMau();
  },
  onChoiLai: () => location.reload(),
  onPhongTo: () => ban.phongTo(),
  onThuNho: () => ban.thuNho(),
});

ban.setOnChonO((i) => hud.moTheO(i));
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

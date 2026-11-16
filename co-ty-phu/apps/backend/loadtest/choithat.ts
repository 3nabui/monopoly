import { Client, Room } from "@colyseus/sdk";
import { JWT } from "@colyseus/auth";

/**
 * ĐO TẢI — người chơi ảo chơi thật từ đầu tới cuối
 * =================================================
 *
 * Mỗi client ảo tự đăng nhập, vào một phòng 4 người, bấm sẵn sàng rồi chơi
 * cho tới khi ván kết thúc. Không phải chỉ mở kết nối rồi ngồi im: nó tung
 * xúc xắc, mua đất, xây nhà, chọn ô cho thẻ cơ hội — server phải tính luật
 * và đẩy state y như với người thật. Đó mới là tải đúng nghĩa.
 *
 * joinOrCreate dồn người vào phòng còn trống trước, nên 400 client ảo tự
 * chia thành 100 phòng 4 người.
 *
 * Chạy:
 *   JWT_SECRET=<đúng khoá server đang dùng> \
 *   npx tsx loadtest/choithat.ts --clients 80 --endpoint ws://localhost:2567
 *
 * Phải dùng ĐÚNG JWT_SECRET của server, nếu không mọi client đều bị onAuth
 * từ chối và con số đo được là vô nghĩa — nên script dừng ngay nếu tỉ lệ bị
 * từ chối quá cao.
 */

function thamSo(ten: string, macDinh: string): string {
  const i = process.argv.indexOf(`--${ten}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : macDinh;
}

const SO_CLIENT = Number(thamSo("clients", "40"));
const DIA_CHI = thamSo("endpoint", "ws://localhost:2567");
const GIAY = Number(thamSo("seconds", "60"));
/** Vào dồn dập quá thì đo thành đo lúc bắt tay, không phải lúc chơi. */
const GIAN_CACH_MS = Number(thamSo("ramp", "25"));

const dem = {
  vao: 0,
  tuChoi: 0,
  loi: 0,
  vanXong: 0,
  nuoc: 0,
  tre: [] as number[],
};

const nghi = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function motNguoi(stt: number) {
  const ten = `Bot${stt}`;
  const client = new Client(DIA_CHI);
  client.auth.token = await JWT.sign({ id: `loadtest:${stt}`, ten });

  let room: Room;
  try {
    room = await client.joinOrCreate("co_ty_phu", { soNguoi: 4, tenPhong: "Đo tải" });
  } catch (e) {
    dem.tuChoi++;
    if (dem.tuChoi <= 3) console.error(`  ${ten} không vào được: ${(e as Error)?.message}`);
    return;
  }
  dem.vao++;

  let sanSangRoi = false;
  let xong = false;
  let guiLuc = 0;

  const gui = (loai: string, tin?: any) => {
    guiLuc = Date.now();
    dem.nuoc++;
    try { room.send(loai as any, tin); } catch { /* phòng đã đóng */ }
  };

  room.onStateChange((state: any) => {
    if (guiLuc) { dem.tre.push(Date.now() - guiLuc); guiLuc = 0; }
    if (xong) return;

    if (state.giaiDoan === "cho") {
      if (!sanSangRoi) { sanSangRoi = true; gui("sanSang"); }
      return;
    }
    if (state.giaiDoan === "ketthuc") {
      xong = true;
      dem.vanXong++;
      void room.leave();
      return;
    }
    if (state.luotCua !== room.sessionId) return;

    const hd: string[] = state.hanhDong ? String(state.hanhDong).split(",") : [];
    switch (state.giaiDoan) {
      case "tung":
        gui("tungXucXac");
        break;
      case "gom":
        gui("tudong");
        break;
      case "chon":
        if (state.kieuChon === "tangNguoi") {
          gui("chon", { nguoi: String(state.nguoiChonDuoc).split(",")[0] });
        } else {
          gui("chon", { o: Number(String(state.oChonDuoc).split(",")[0]) });
        }
        break;
      case "quyet": {
        // Mua và xây hăng để ván đi tới kết cục; bỏ qua hết thì phép đo
        // biến thành đo thời gian ngồi chờ.
        const chon = ["mua", "xay", "muadut", "tieptuc", "boqua"].find((x) => hd.includes(x));
        if (chon) gui(chon);
        break;
      }
    }
  });

  room.onError((code, message) => {
    dem.loi++;
    if (dem.loi <= 3) console.error(`  ${ten} lỗi phòng ${code}: ${message}`);
  });
}

async function chay() {
  console.log(`Đo tải: ${SO_CLIENT} client ảo → ${DIA_CHI}, chạy ${GIAY} giây`);
  console.log(`Dự kiến ${Math.ceil(SO_CLIENT / 4)} phòng, mỗi phòng 4 người.\n`);

  const batDau = Date.now();
  const tatCa: Promise<void>[] = [];
  for (let i = 1; i <= SO_CLIENT; i++) {
    tatCa.push(motNguoi(i).catch(() => { dem.loi++; }));
    if (GIAN_CACH_MS > 0) await nghi(GIAN_CACH_MS);
  }
  await Promise.all(tatCa);
  const vaoXong = Date.now() - batDau;
  console.log(`Vào phòng xong sau ${(vaoXong / 1000).toFixed(1)}s — `
    + `${dem.vao} vào được, ${dem.tuChoi} bị từ chối.\n`);

  if (dem.vao === 0) {
    console.error("Không ai vào được phòng. Kiểm lại JWT_SECRET có khớp server không.");
    process.exit(1);
  }

  // In tiến độ mỗi 10 giây để thấy tải đang diễn ra chứ không treo.
  for (let giay = 10; giay <= GIAY; giay += 10) {
    await nghi(10_000);
    console.log(`  ${giay}s — ${dem.nuoc} nước đi, ${dem.vanXong} ván xong, `
      + `${dem.loi} lỗi`);
  }

  const t = dem.tre.slice().sort((a, b) => a - b);
  const p = (q: number) => (t.length ? Math.round(t[Math.min(t.length - 1, Math.floor(t.length * q))]) : 0);
  const giay = (Date.now() - batDau) / 1000;

  console.log("\n──────── kết quả ────────");
  console.log(`client vào được : ${dem.vao}/${SO_CLIENT}`);
  console.log(`bị từ chối      : ${dem.tuChoi}`);
  console.log(`lỗi phòng       : ${dem.loi}`);
  console.log(`ván chơi xong   : ${dem.vanXong}`);
  console.log(`nước đã đi      : ${dem.nuoc} (${(dem.nuoc / giay).toFixed(1)}/giây)`);
  console.log(`độ trễ state    : p50 ${p(0.5)}ms · p95 ${p(0.95)}ms · p99 ${p(0.99)}ms`);
  process.exit(0);
}

void chay();

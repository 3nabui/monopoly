import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
  LobbyRoom,
} from "colyseus";
import { auth } from "@colyseus/auth";

import "./config/auth.js";
import { CHO_KHACH, GOOGLE_SAN_SANG } from "./config/auth.js";
import { CoTyPhuRoom } from "./rooms/CoTyPhuRoom.js";
import { coDatabase, moDatabase } from "./db/index.js";
import { bangXepHang, vanGanDay } from "./db/kho.js";
import { BAN_CO, NHOM, THU_TU_NHOM } from "@co-ty-phu/shared";

/**
 * Nối database trước khi nhận người chơi. Nối không được thì server vẫn chạy,
 * chỉ là không lưu lại gì — xem apps/backend/src/db/index.ts.
 */
await moDatabase();

const server = defineServer({
  rooms: {
    /**
     * enableRealtimeListing() cho phép phòng chờ nhận thông báo mỗi khi danh
     * sách phòng đổi, nên sảnh cập nhật ngay chứ không phải bấm tải lại.
     */
    co_ty_phu: defineRoom(CoTyPhuRoom).enableRealtimeListing(),
    sanh: defineRoom(LobbyRoom),
  },

  routes: createRouter({
    /** Client hỏi xem server có bật đăng nhập Google hay không. */
    api_cauhinh: createEndpoint("/api/cau-hinh", { method: "GET" }, async () => {
      return { google: GOOGLE_SAN_SANG, khach: CHO_KHACH };
    }),

    /** Dữ liệu bàn cờ, để công cụ ngoài hoặc trang quản trị đọc được. */
    api_banco: createEndpoint("/api/ban-co", { method: "GET" }, async () => {
      return { o: BAN_CO, nhom: NHOM, thuTuNhom: THU_TU_NHOM };
    }),

    /** Bảng xếp hạng theo số ván thắng. */
    api_xephang: createEndpoint("/api/xep-hang", { method: "GET" }, async () => {
      return { luuTru: coDatabase(), bang: await bangXepHang(20) };
    }),

    /** Vài ván gần nhất, để xem nhanh server có đang ghi dữ liệu không. */
    api_vanganday: createEndpoint("/api/van-gan-day", { method: "GET" }, async () => {
      return { luuTru: coDatabase(), van: await vanGanDay(10) };
    }),
  }),

  express: (app) => {
    /** Mở /auth/* — đăng nhập Google, đăng nhập khách, lấy hồ sơ. */
    app.use(auth.prefix, auth.routes());

    app.get("/health", (_req, res) => {
      res.json({ ok: true, google: GOOGLE_SAN_SANG, luuTru: coDatabase(), ts: Date.now() });
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;

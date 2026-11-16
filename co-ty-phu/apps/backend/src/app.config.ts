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
import { BAN_CO, NHOM, THU_TU_NHOM } from "@co-ty-phu/shared";

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
  }),

  express: (app) => {
    /** Mở /auth/* — đăng nhập Google, đăng nhập khách, lấy hồ sơ. */
    app.use(auth.prefix, auth.routes());

    app.get("/health", (_req, res) => {
      res.json({ ok: true, google: GOOGLE_SAN_SANG, ts: Date.now() });
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;

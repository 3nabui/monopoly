import {
  defineServer,
  defineRoom,
  monitor,
  playground,
  createRouter,
  createEndpoint,
} from "colyseus";

import { CoTyPhuRoom } from "./rooms/CoTyPhuRoom.js";
import { BAN_CO, NHOM, THU_TU_NHOM } from "@co-ty-phu/shared";

const server = defineServer({
  rooms: {
    co_ty_phu: defineRoom(CoTyPhuRoom),
  },

  routes: createRouter({
    /** Dữ liệu bàn cờ, để công cụ ngoài hoặc trang quản trị đọc được. */
    api_banco: createEndpoint("/api/ban-co", { method: "GET" }, async () => {
      return { o: BAN_CO, nhom: NHOM, thuTuNhom: THU_TU_NHOM };
    }),
  }),

  express: (app) => {
    app.get("/health", (_req, res) => {
      res.json({ ok: true, ts: Date.now() });
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
      app.use("/playground", playground());
    }
  },
});

export default server;

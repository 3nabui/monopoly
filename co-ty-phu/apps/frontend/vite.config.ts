import { defineConfig } from "vite";

export default defineConfig({
  server: {
    // Cổng 3000 hay bị ứng dụng khác chiếm, nên chọn cổng riêng và báo lỗi
    // thẳng nếu bận, thay vì lặng lẽ nhảy sang cổng khác.
    port: 5180,
    strictPort: true,
  },
  preview: { port: 5180 },
});

# Ảnh Docker cho server Colyseus.
#
# Chạy được ở bất cứ chỗ nào nhận Dockerfile: Render, Railway, Fly.io, hay
# một máy chủ riêng. Build từ thư mục gốc của repo:
#
#     docker build -t co-ty-phu .
#     docker run -p 2567:2567 --env-file co-ty-phu/apps/backend/.env.production co-ty-phu
#
# Dự án là một npm workspaces monorepo, nên phải cài ở thư mục gốc rồi mới
# dựng được apps/shared và apps/backend.

# ---------------------------------------------------------------- dựng
FROM node:22-alpine AS build
WORKDIR /app

# Chép riêng mấy file package trước để Docker giữ lại tầng cài đặt khi mã
# nguồn đổi mà danh sách thư viện thì không.
COPY co-ty-phu/package.json co-ty-phu/package-lock.json ./
COPY co-ty-phu/apps/shared/package.json   apps/shared/
COPY co-ty-phu/apps/backend/package.json  apps/backend/
COPY co-ty-phu/apps/frontend/package.json apps/frontend/
RUN npm ci

COPY co-ty-phu/ ./
RUN npm run build:shared \
 && npm run build --workspace @co-ty-phu/backend \
 && npm prune --omit=dev

# ---------------------------------------------------------------- chạy
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=2567

# Không chạy bằng root. Ảnh node đã sẵn có user "node".
USER node

COPY --from=build --chown=node:node /app/node_modules          ./node_modules
COPY --from=build --chown=node:node /app/package.json          ./
COPY --from=build --chown=node:node /app/apps/shared/package.json  apps/shared/
COPY --from=build --chown=node:node /app/apps/shared/dist          apps/shared/dist
COPY --from=build --chown=node:node /app/apps/backend/package.json apps/backend/
COPY --from=build --chown=node:node /app/apps/backend/build        apps/backend/build
# Server tự chạy migration lúc khởi động nên thư mục này phải đi theo ảnh.
COPY --from=build --chown=node:node /app/apps/backend/drizzle      apps/backend/drizzle

EXPOSE 2567
CMD ["node", "apps/backend/build/index.js"]

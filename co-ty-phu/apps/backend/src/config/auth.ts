import { auth, JWT } from "@colyseus/auth";

/**
 * Đăng nhập bằng tài khoản Google.
 *
 * Luồng: trình duyệt gọi client.auth.signInWithProvider("google"), cửa sổ phụ
 * mở trang Google, Google gọi ngược về /auth/provider/google/callback trên
 * server này, hàm onCallback bên dưới dựng hồ sơ người chơi rồi @colyseus/auth
 * ký thành JWT trả về cho trình duyệt. Mỗi lần vào phòng, SDK đính kèm JWT đó
 * và Room.onAuth xác minh lại.
 */

auth.backend_url = process.env.BACKEND_URL ?? "http://localhost:2567";

export interface NguoiDung {
  id: string;
  ten: string;
  anh?: string;
  email?: string;
  /** Tài khoản tạm, chỉ dùng khi chạy thử ở máy mình. */
  khach?: boolean;
}

/**
 * Kho người dùng trong bộ nhớ tiến trình: tắt server là mất.
 * Khi nào cần giữ lại thì thay ba chỗ đọc ghi bên dưới bằng truy vấn thật.
 */
const kho = new Map<string, NguoiDung>();

export function layNguoiDung(id: string): NguoiDung | undefined {
  return kho.get(id);
}

export const GOOGLE_SAN_SANG = Boolean(
  process.env.OAUTH_CLIENT_ID && process.env.OAUTH_CLIENT_SECRET,
);

if (GOOGLE_SAN_SANG) {
  auth.oauth.addProvider("google", {
    key: process.env.OAUTH_CLIENT_ID!,
    secret: process.env.OAUTH_CLIENT_SECRET!,
    scope: ["profile", "email"],
  });
}

auth.oauth.onCallback(async (data: any, provider) => {
  const p = data?.profile ?? {};
  const id = `${provider}:${p.sub ?? p.id ?? p.email}`;
  const nd: NguoiDung = {
    id,
    ten: String(p.name || p.given_name || p.email?.split("@")[0] || "Người chơi").slice(0, 24),
    anh: p.picture,
    email: p.email,
  };
  kho.set(id, nd);
  return nd;
});

/**
 * Đăng nhập khách, chỉ để chạy thử khi chưa cấu hình Google. Không bật ở
 * môi trường thật: cứ bấm là có tài khoản mới, không kiểm chứng được ai là ai.
 */
export const CHO_KHACH = !GOOGLE_SAN_SANG && process.env.NODE_ENV !== "production";

auth.settings.onRegisterAnonymously = async (options: any) => {
  if (!CHO_KHACH) throw new Error("Chỉ đăng nhập bằng Google.");
  const id = `khach:${Math.random().toString(36).slice(2, 10)}`;
  const nd: NguoiDung = {
    id,
    ten: String(options?.ten || "Khách").trim().slice(0, 24) || "Khách",
    khach: true,
  };
  kho.set(id, nd);
  return nd;
};

/** Chưa dùng tới đăng nhập bằng email, chặn luôn cho rõ ràng. */
auth.settings.onFindUserByEmail = async () => undefined;
auth.settings.onRegisterWithEmailAndPassword = async () => {
  throw new Error("Chưa hỗ trợ đăng ký bằng email.");
};

/**
 * Đọc người dùng từ JWT mà SDK đính kèm khi vào phòng.
 * Trả về undefined nếu không có token hoặc token không hợp lệ.
 */
export async function nguoiDungTuToken(token?: string): Promise<NguoiDung | undefined> {
  if (!token) return undefined;
  try {
    const payload = await JWT.verify<any>(token);
    if (!payload?.id) return undefined;
    // Kho có thể trống sau khi server khởi động lại; vẫn tin JWT vì nó đã ký.
    return kho.get(payload.id) ?? {
      id: payload.id,
      ten: String(payload.ten || "Người chơi").slice(0, 24),
      anh: payload.anh,
      email: payload.email,
      khach: payload.khach,
    };
  } catch {
    return undefined;
  }
}

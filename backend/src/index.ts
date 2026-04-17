import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Env } from "./types.js";
import draws from "./routes/draws.js";
import analysis from "./routes/analysis.js";
import predict from "./routes/predict.js";
import simulation from "./routes/simulation.js";

const app = new Hono<{ Bindings: Env }>();

// セキュリティヘッダー
app.use("*", secureHeaders());

// CORS設定
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const allowed = [
        c.env.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:4173",
      ];
      if (!origin || allowed.includes(origin)) return origin ?? "";
      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ヘルスチェック
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ルーティング
app.route("/api/draws", draws);
app.route("/api/analysis", analysis);
app.route("/api/predict", predict);
app.route("/api/simulation", simulation);

// 404ハンドラー
app.notFound((c) => {
  return c.json({ error: "Not Found", code: "NOT_FOUND" }, 404);
});

// エラーハンドラー
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "内部サーバーエラーが発生しました", code: "INTERNAL_ERROR" }, 500);
});

export default app;

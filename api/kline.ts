export default function handler(req: any, res: any) {
  try {
    if (!res || typeof res.status !== "function") {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Wrong API runtime. This file should be api/kline.ts",
          klines: [],
          data: [],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    const code = String(req.query?.code || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const daysInput = Number(req.query?.days || 30);
    const days = Number.isFinite(daysInput)
      ? Math.max(7, Math.min(120, Math.floor(daysInput)))
      : 30;

    return res.status(200).json({
      ok: false,
      code,
      days,
      source: "Safe KLine Fallback",
      message: "日K API 安全備援啟動，目前先使用簡化ATR，避免Vercel函式崩潰。",
      klines: [],
      data: [],
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    try {
      return res.status(200).json({
        ok: false,
        message: error?.message || "kline safe fallback error",
        klines: [],
        data: [],
      });
    } catch {
      return;
    }
  }
}
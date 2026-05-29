module.exports = function handler(req, res) {
  try {
    const code = String((req.query && req.query.code) || "")
      .replace(/\D/g, "")
      .slice(0, 6);

    const daysInput = Number((req.query && req.query.days) || 30);
    const days = Number.isFinite(daysInput)
      ? Math.max(7, Math.min(120, Math.floor(daysInput)))
      : 30;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "no-store, max-age=0");

    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }

    return res.status(200).json({
      ok: false,
      code,
      days,
      source: "KLine JS Safe Fallback",
      message: "kline.js 已正常啟動，目前使用簡化ATR備援。",
      klines: [],
      data: [],
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(200).json({
      ok: false,
      source: "KLine JS Safe Fallback",
      message: error && error.message ? error.message : "kline.js safe fallback error",
      klines: [],
      data: [],
      updatedAt: new Date().toISOString(),
    });
  }
};
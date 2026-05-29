export default function handler(req: any, res: any) {
  res.status(200).json({
    ok: false,
    code: String(req.query?.code || ""),
    days: String(req.query?.days || ""),
    source: "KLine Safe Test",
    message: "kline API 已正常啟動，目前使用簡化ATR備援。",
    klines: [],
    data: [],
    updatedAt: new Date().toISOString(),
  });
}
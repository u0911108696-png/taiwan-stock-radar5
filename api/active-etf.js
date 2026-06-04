export default function handler(req, res) {
  const holdings = [
    { etfCode: "00980A", etfName: "主動野村臺灣優選", code: "2330", name: "台積電", industry: "半導體", todayWeight: 9.8, yesterdayWeight: 9.1 },
    { etfCode: "00980A", etfName: "主動野村臺灣優選", code: "3661", name: "世芯-KY", industry: "IC設計", todayWeight: 3.1, yesterdayWeight: 2.4 },
    { etfCode: "00980A", etfName: "主動野村臺灣優選", code: "2382", name: "廣達", industry: "AI伺服器", todayWeight: 4.5, yesterdayWeight: 3.9 },

    { etfCode: "00981A", etfName: "主動統一台股增長", code: "2330", name: "台積電", industry: "半導體", todayWeight: 8.9, yesterdayWeight: 8.4 },
    { etfCode: "00981A", etfName: "主動統一台股增長", code: "3017", name: "奇鋐", industry: "散熱", todayWeight: 3.8, yesterdayWeight: 2.9 },
    { etfCode: "00981A", etfName: "主動統一台股增長", code: "6669", name: "緯穎", industry: "AI伺服器", todayWeight: 2.7, yesterdayWeight: 0 },

    { etfCode: "00982A", etfName: "主動群益台灣強棒", code: "2308", name: "台達電", industry: "電源", todayWeight: 4.2, yesterdayWeight: 4.8 },
    { etfCode: "00982A", etfName: "主動群益台灣強棒", code: "2382", name: "廣達", industry: "AI伺服器", todayWeight: 4.1, yesterdayWeight: 3.5 },
    { etfCode: "00982A", etfName: "主動群益台灣強棒", code: "3231", name: "緯創", industry: "AI伺服器", todayWeight: 0, yesterdayWeight: 2.2 },
  ];

  const etfs = [
  {
    etfCode: "00980A",
    etfName: "主動野村臺灣優選",
    issuer: "野村投信",
    mode: "mock",
    status: "已建立",
    note: "目前使用示範持股，下一版串接每日投資組合。",
  },
  {
    etfCode: "00981A",
    etfName: "主動統一台股增長",
    issuer: "統一投信",
    mode: "mock",
    status: "已建立",
    note: "目前使用示範持股，下一版串接每日投資組合。",
  },
  {
    etfCode: "00982A",
    etfName: "主動群益台灣強棒",
    issuer: "群益投信",
    mode: "mock",
    status: "已建立",
    note: "目前使用示範持股，下一版串接每日投資組合。",
  },
];

res.status(200).json({
  ok: true,
  source: "api/active-etf mock js",
  mode: "mock",
  updatedAt: new Date().toISOString(),
  etfs,
  holdings,
});
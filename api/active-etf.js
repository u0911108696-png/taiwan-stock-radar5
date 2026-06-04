const REAL_FETCH_ENABLED = false;

async function fetchActiveEtfHoldings(etf) {
  if (!REAL_FETCH_ENABLED) {
    return {
      ok: false,
      mode: "mock",
      reason: "real fetch disabled",
      holdings: [],
    };
  }

  try {
    // v74 先預留真實抓取架構。
    // v75 再針對單一投信每日投資組合網址做實際解析。
    const response = await fetch(etf.sourceUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 Taiwan Stock Radar",
      },
    });

    const text = await response.text();

    return {
      ok: response.ok,
      mode: "real",
      reason: response.ok ? "fetch success but parser not enabled" : `http ${response.status}`,
      rawLength: text.length,
      holdings: [],
    };
  } catch (error) {
    return {
      ok: false,
      mode: "real",
      reason: error?.message || "fetch failed",
      holdings: [],
    };
  }
}

function normalizeActiveEtfHolding(raw, etf) {
  return {
    etfCode: etf.etfCode,
    etfName: etf.etfName,
    code: String(raw.code || "").replace(/\D/g, "").slice(0, 6),
    name: String(raw.name || ""),
    industry: String(raw.industry || "其他"),
    todayWeight: Number(raw.todayWeight || 0),
    yesterdayWeight: Number(raw.yesterdayWeight || 0),
  };
}

export default async function handler(req, res) {
  const etfs = [
    {
      etfCode: "00980A",
      etfName: "主動野村臺灣優選",
      issuer: "野村投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "mock_ready",
      sourceUrl: "https://www.nomurafunds.com.tw/",
      sourceName: "野村投信官網",
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；v75 開始嘗試解析投信每日投資組合。",
    },
    {
      etfCode: "00981A",
      etfName: "主動統一台股增長",
      issuer: "統一投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "mock_ready",
      sourceUrl: "https://www.ezmoney.com.tw/",
      sourceName: "統一投信官網",
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；v75 開始嘗試解析投信每日投資組合。",
    },
    {
      etfCode: "00982A",
      etfName: "主動群益台灣強棒",
      issuer: "群益投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "mock_ready",
      sourceUrl: "https://www.capitalfund.com.tw/",
      sourceName: "群益投信官網",
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；v75 開始嘗試解析投信每日投資組合。",
    },
  ];

  const fetchReports = await Promise.all(
    etfs.map(async (etf) => {
      const result = await fetchActiveEtfHoldings(etf);

      return {
        etfCode: etf.etfCode,
        etfName: etf.etfName,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
        realFetchEnabled: REAL_FETCH_ENABLED,
        ok: result.ok,
        mode: result.mode,
        reason: result.reason,
        rawLength: result.rawLength || 0,
        holdingsCount: result.holdings?.length || 0,
        checkedAt: new Date().toISOString(),
      };
    })
  );

  const etfsWithFetchStatus = etfs.map((etf) => {
    const report = fetchReports.find((item) => item.etfCode === etf.etfCode);

    return {
      ...etf,
      mode: REAL_FETCH_ENABLED && report?.ok ? "real" : "mock",
      status: REAL_FETCH_ENABLED && report?.ok ? "真實資料測試成功" : "準備串接",
      fetchStatus: report?.reason || "mock_ready",
      realFetchEnabled: REAL_FETCH_ENABLED,
      lastFetchAt: report?.checkedAt || new Date().toISOString(),
    };
  });

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

  res.status(200).json({
    ok: true,
    source: "api/active-etf v74 real-fetch-ready mock",
    mode: REAL_FETCH_ENABLED ? "real-test" : "mock",
    realReady: true,
    realFetchEnabled: REAL_FETCH_ENABLED,
    updatedAt: new Date().toISOString(),
    message: REAL_FETCH_ENABLED
      ? "v74 已啟用真實抓取測試，但尚未解析持股。"
      : "v74 已建立真實抓取函式，目前安全關閉，仍使用示範持股。",
    fetchReports,
    etfs: etfsWithFetchStatus,
    holdings,
  });
}
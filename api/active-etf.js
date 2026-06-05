const DEFAULT_REAL_FETCH_ENABLED = false;

function uniq(list, limit = 100) {
  return Array.from(new Set(list.filter(Boolean))).slice(0, limit);
}

function cleanText(text, limit = 1600) {
  return String(text || "").replace(/\s+/g, " ").slice(0, limit);
}

function getNearbyText(text, keyword, range = 400) {
  const source = String(text || "");
  const index = source.toLowerCase().indexOf(String(keyword || "").toLowerCase());
  if (index < 0) return "";
  return cleanText(source.slice(Math.max(0, index - range), index + range), 1200);
}

function normalizeLink(url, baseUrl) {
  const value = String(url || "").trim();
  if (!value || value.startsWith("javascript:")) return value;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function analyzeRawText(text, baseUrl, etfCode) {
  const safeText = String(text || "");
  const lower = safeText.toLowerCase();

  const hrefLinks = [...safeText.matchAll(/href=["']([^"']+)["']/gi)].map((match) =>
    normalizeLink(match[1], baseUrl)
  );

  const scriptLinks = [...safeText.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) =>
    normalizeLink(match[1], baseUrl)
  );

  const urlLikeLinks = [...safeText.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map((match) =>
    String(match[0] || "").replace(/[),;]+$/g, "")
  );

  const apiLikeStrings = uniq(
    [...safeText.matchAll(/["']([^"']*(?:api|ajax|fund|etf|download|holding|portfolio|stock|query|nav|detail|file|pdf|csv|xlsx|xls)[^"']*)["']/gi)]
      .map((match) => normalizeLink(match[1], baseUrl))
      .filter((url) => url.length >= 4),
    80
  );

  const possibleLinks = uniq(
    [...hrefLinks, ...scriptLinks, ...urlLikeLinks, ...apiLikeStrings].filter((url) => {
      const u = String(url || "").toLowerCase();
      return (
        u.includes("api") ||
        u.includes("ajax") ||
        u.includes("csv") ||
        u.includes("xls") ||
        u.includes("xlsx") ||
        u.includes("pdf") ||
        u.includes("download") ||
        u.includes("fund") ||
        u.includes("etf") ||
        u.includes("holding") ||
        u.includes("portfolio") ||
        u.includes("stock") ||
        u.includes("nav") ||
        u.includes("detail") ||
        u.includes("query") ||
        u.includes("file")
      );
    }),
    80
  );

  const capitalEtfLinks = uniq(
    possibleLinks.filter((url) => {
      const u = String(url || "").toLowerCase();
      return u.includes("capitalfund.com.tw") && (u.includes("etf") || u.includes("fund") || u.includes("download") || u.includes("pdf") || u.includes("csv") || u.includes("xls"));
    }),
    50
  );

  return {
    rawPreview: safeText.slice(0, 700),
    rawLength: safeText.length,
    hasTable: lower.includes("<table"),
    hasCsv: lower.includes(".csv") || lower.includes("csv"),
    hasJson: lower.includes("application/json") || lower.includes("__next_data__") || lower.includes("json"),
    hasXlsx: lower.includes(".xlsx") || lower.includes(".xls"),
    hasPdf: lower.includes(".pdf") || lower.includes("pdf"),
    hasApi: lower.includes("api") || lower.includes("ajax"),
    hasEtfCode: lower.includes(String(etfCode || "").toLowerCase()),
    hrefLinks: uniq(hrefLinks, 40),
    scriptLinks: uniq(scriptLinks, 40),
    apiLikeStrings: apiLikeStrings.slice(0, 60),
    possibleLinks: possibleLinks.slice(0, 70),
    capitalEtfLinks,
    keywordNearby: {
      etfCode: getNearbyText(safeText, etfCode),
      active: getNearbyText(safeText, "主動"),
      capitalStrong: getNearbyText(safeText, "強棒"),
      holding: getNearbyText(safeText, "持股"),
      portfolio: getNearbyText(safeText, "portfolio"),
      composition: getNearbyText(safeText, "投資組合"),
      fund: getNearbyText(safeText, "fund"),
      download: getNearbyText(safeText, "download"),
      api: getNearbyText(safeText, "api"),
      pdf: getNearbyText(safeText, "pdf"),
      csv: getNearbyText(safeText, "csv"),
    },
  };
}

async function fetchActiveEtfHoldings(etf, realFetchEnabled) {
  if (!realFetchEnabled) {
    return {
      ok: false,
      mode: "mock",
      reason: "real fetch disabled",
      holdings: [],
      analysis: analyzeRawText("", etf.sourceUrl, etf.etfCode),
    };
  }

  try {
    const response = await fetch(etf.sourceUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 Taiwan Stock Radar",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const text = await response.text();
    const analysis = analyzeRawText(text, etf.sourceUrl, etf.etfCode);

    return {
      ok: response.ok,
      mode: "real",
      reason: response.ok ? "fetch success but parser not enabled" : `http ${response.status}`,
      rawLength: text.length,
      holdings: [],
      analysis,
    };
  } catch (error) {
    return {
      ok: false,
      mode: "real",
      reason: error?.message || "fetch failed",
      rawLength: 0,
      holdings: [],
      analysis: analyzeRawText("", etf.sourceUrl, etf.etfCode),
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
  const realFetchEnabled =
    DEFAULT_REAL_FETCH_ENABLED || String(req.query?.test || "") === "1";

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
      note: "目前使用示範持股；v78 仍保留測試。",
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
      note: "目前使用示範持股；v78 仍保留測試。",
    },
    {
      etfCode: "00982A",
      etfName: "主動群益台灣強棒",
      issuer: "群益投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "mock_ready",
      sourceUrl: "https://www.capitalfund.com.tw/etf",
      sourceName: "群益投信 ETF 頁",
      lastFetchAt: new Date().toISOString(),
      note: "v78 改抓群益 ETF 頁，分析 00982A 與可能下載連結。",
    },
  ];

  const fetchReports = await Promise.all(
    etfs.map(async (etf) => {
      const result = await fetchActiveEtfHoldings(etf, realFetchEnabled);

      return {
        etfCode: etf.etfCode,
        etfName: etf.etfName,
        sourceName: etf.sourceName,
        sourceUrl: etf.sourceUrl,
        realFetchEnabled,
        ok: result.ok,
        mode: result.mode,
        reason: result.reason,
        rawLength: result.rawLength || 0,
        holdingsCount: result.holdings?.length || 0,
        checkedAt: new Date().toISOString(),
        analysis: result.analysis,
      };
    })
  );

  const etfsWithFetchStatus = etfs.map((etf) => {
    const report = fetchReports.find((item) => item.etfCode === etf.etfCode);

    return {
      ...etf,
      mode: realFetchEnabled && report?.ok ? "real" : "mock",
      status: realFetchEnabled && report?.ok ? "真實抓取測試成功" : "準備串接",
      fetchStatus: report?.reason || "mock_ready",
      realFetchEnabled,
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

  const focusReport =
    fetchReports.find((item) => item.etfCode === "00982A") ||
    fetchReports.find((item) => item.ok) ||
    fetchReports[0];

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v78 capital-etf-page-analyze"
      : "api/active-etf v78 mock safe",
    mode: realFetchEnabled ? "capital-etf-page-analyze" : "mock",
    realReady: true,
    realFetchEnabled,
    updatedAt: new Date().toISOString(),
    message: realFetchEnabled
      ? "v78 分析模式：00982A 改抓群益 ETF 頁，尋找 00982A / PDF / CSV / Excel / API 連結。"
      : "v78 安全模式：真實抓取關閉，仍使用示範持股。",
    focusEtfCode: focusReport?.etfCode || "",
    focusSourceUrl: focusReport?.sourceUrl || "",
    focusAnalysis: focusReport?.analysis || null,
    fetchReports,
    etfs: etfsWithFetchStatus,
    holdings,
  });
}
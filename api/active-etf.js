const DEFAULT_REAL_FETCH_ENABLED = false;

function uniq(list, limit = 120) {
  return Array.from(new Set((list || []).filter(Boolean))).slice(0, limit);
}

function cleanText(text, limit = 1800) {
  return String(text || "").replace(/\s+/g, " ").slice(0, limit);
}

function getNearbyText(text, keyword, range = 500) {
  const source = String(text || "");
  const index = source.toLowerCase().indexOf(String(keyword || "").toLowerCase());
  if (index < 0) return "";
  return cleanText(source.slice(Math.max(0, index - range), index + range), 1600);
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

function scoreLink(url) {
  const u = String(url || "").toLowerCase();
  let score = 0;

  if (u.includes("00982a")) score += 100;
  if (u.includes("download")) score += 40;
  if (u.includes("transaction")) score += 30;
  if (u.includes("etf")) score += 20;
  if (u.includes("fund")) score += 15;
  if (u.includes("csv")) score += 60;
  if (u.includes("xlsx") || u.includes("xls")) score += 60;
  if (u.includes("pdf")) score += 25;
  if (u.includes("api") || u.includes("ajax")) score += 45;
  if (u.includes("portfolio") || u.includes("holding") || u.includes("constituent")) score += 45;
  if (u.includes("composition") || u.includes("ingredient")) score += 35;

  return score;
}

function extractLinks(text, baseUrl) {
  const safeText = String(text || "");

  const hrefLinks = [...safeText.matchAll(/href=["']([^"']+)["']/gi)].map((match) =>
    normalizeLink(match[1], baseUrl)
  );

  const scriptLinks = [...safeText.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((match) =>
    normalizeLink(match[1], baseUrl)
  );

  const urlLikeLinks = [...safeText.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)].map((match) =>
    String(match[0] || "").replace(/[),;]+$/g, "")
  );

  const apiLikeStrings = [
    ...safeText.matchAll(
      /["']([^"']*(?:api|ajax|fund|etf|download|holding|portfolio|stock|query|nav|detail|file|pdf|csv|xlsx|xls|transaction|product|composition|constituent)[^"']*)["']/gi
    ),
  ]
    .map((match) => normalizeLink(match[1], baseUrl))
    .filter((url) => String(url || "").length >= 4);

  return {
    hrefLinks: uniq(hrefLinks, 80),
    scriptLinks: uniq(scriptLinks, 80),
    urlLikeLinks: uniq(urlLikeLinks, 80),
    apiLikeStrings: uniq(apiLikeStrings, 100),
  };
}

function analyzeRawText(text, baseUrl, etfCode) {
  const safeText = String(text || "");
  const lower = safeText.toLowerCase();
  const extracted = extractLinks(safeText, baseUrl);

  const allLinks = uniq(
    [
      ...extracted.hrefLinks,
      ...extracted.scriptLinks,
      ...extracted.urlLikeLinks,
      ...extracted.apiLikeStrings,
    ],
    180
  );

  const possibleLinks = uniq(
    allLinks.filter((url) => {
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
        u.includes("file") ||
        u.includes("transaction") ||
        u.includes("product") ||
        u.includes("composition") ||
        u.includes("constituent")
      );
    }),
    120
  );

  const bestLinks = [...possibleLinks]
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const hasEtfCode = lower.includes(String(etfCode || "").toLowerCase());
  const hasFileHint =
    lower.includes(".csv") ||
    lower.includes(".xls") ||
    lower.includes(".xlsx") ||
    lower.includes("download") ||
    lower.includes("api") ||
    lower.includes("ajax");

  return {
    rawPreview: safeText.slice(0, 800),
    rawLength: safeText.length,
    hasTable: lower.includes("<table"),
    hasCsv: lower.includes(".csv") || lower.includes("csv"),
    hasJson: lower.includes("application/json") || lower.includes("__next_data__") || lower.includes("json"),
    hasXlsx: lower.includes(".xlsx") || lower.includes(".xls"),
    hasPdf: lower.includes(".pdf") || lower.includes("pdf"),
    hasApi: lower.includes("api") || lower.includes("ajax"),
    hasEtfCode,
    hasFileHint,
    hrefLinks: extracted.hrefLinks.slice(0, 50),
    scriptLinks: extracted.scriptLinks.slice(0, 50),
    apiLikeStrings: extracted.apiLikeStrings.slice(0, 80),
    possibleLinks: possibleLinks.slice(0, 100),
    bestLinks,
    keywordNearby: {
      etfCode: getNearbyText(safeText, etfCode),
      active: getNearbyText(safeText, "主動"),
      capitalStrong: getNearbyText(safeText, "強棒"),
      holding: getNearbyText(safeText, "持股"),
      portfolio: getNearbyText(safeText, "portfolio"),
      composition: getNearbyText(safeText, "投資組合"),
      download: getNearbyText(safeText, "download"),
      transaction: getNearbyText(safeText, "transaction"),
      product: getNearbyText(safeText, "product"),
      fund: getNearbyText(safeText, "fund"),
      api: getNearbyText(safeText, "api"),
      pdf: getNearbyText(safeText, "pdf"),
      csv: getNearbyText(safeText, "csv"),
      xls: getNearbyText(safeText, "xls"),
    },
  };
}

async function fetchTextPage(url, etfCode) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 Taiwan Stock Radar",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      url,
      reason: response.ok ? "fetch success" : `http ${response.status}`,
      rawLength: text.length,
      analysis: analyzeRawText(text, url, etfCode),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      reason: error?.message || "fetch failed",
      rawLength: 0,
      analysis: analyzeRawText("", url, etfCode),
    };
  }
}

function buildTradingSafety({ realFetchEnabled, pages, parsedHoldings }) {
  const okPages = pages.filter((page) => page.ok);
  const hasEtfCode = pages.some((page) => page.analysis?.hasEtfCode);
  const hasFileHint = pages.some((page) => page.analysis?.hasFileHint);
  const hasParsedHoldings = Array.isArray(parsedHoldings) && parsedHoldings.length > 0;

  if (!realFetchEnabled) {
    return {
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      label: "示範資料，不可當真實加減碼",
      reason: "真實抓取未啟用，目前僅供版面與流程測試。",
    };
  }

  if (hasParsedHoldings) {
    return {
      usableForTrading: true,
      dataLevel: "REAL_PARSED",
      confidence: 90,
      label: "真實資料已解析，可進入實戰觀察",
      reason: "已取得並解析真實持股權重。",
    };
  }

  if (okPages.length > 0 && hasEtfCode && hasFileHint) {
    return {
      usableForTrading: false,
      dataLevel: "REAL_SOURCE_FOUND",
      confidence: 65,
      label: "找到真實來源，但尚未解析",
      reason: "已找到 ETF 頁與下載線索，但尚未轉成持股權重，不能當成真實加減碼。",
    };
  }

  if (okPages.length > 0) {
    return {
      usableForTrading: false,
      dataLevel: "REAL_PAGE_ONLY",
      confidence: 45,
      label: "抓到官網頁面，但資料不足",
      reason: "可抓到官網，但尚未確認真實持股來源。",
    };
  }

  return {
    usableForTrading: false,
    dataLevel: "FETCH_FAILED",
    confidence: 10,
    label: "真實資料抓取失敗",
    reason: "目前無法取得可用來源，維持示範資料。",
  };
}

async function fetchActiveEtfHoldings(etf, realFetchEnabled) {
  if (!realFetchEnabled) {
    return {
      ok: false,
      mode: "mock",
      reason: "real fetch disabled",
      holdings: [],
      pages: [],
      analysis: analyzeRawText("", etf.sourceUrl, etf.etfCode),
      downloadAnalysis: null,
      tradingSafety: buildTradingSafety({
        realFetchEnabled,
        pages: [],
        parsedHoldings: [],
      }),
    };
  }

  const pageUrls = uniq([etf.sourceUrl, ...(etf.extraSourceUrls || [])], 8);
  const pages = await Promise.all(pageUrls.map((url) => fetchTextPage(url, etf.etfCode)));

  const mainPage = pages.find((page) => page.url === etf.sourceUrl) || pages[0];
  const downloadPage =
    pages.find((page) => String(page.url || "").includes("/transaction/download")) ||
    pages.find((page) => page.analysis?.bestLinks?.some((item) => String(item.url || "").includes("download"))) ||
    null;

  const bestPage = pages
    .map((page) => ({
      ...page,
      score:
        (page.analysis?.hasEtfCode ? 80 : 0) +
        (page.analysis?.hasCsv ? 35 : 0) +
        (page.analysis?.hasXlsx ? 35 : 0) +
        (page.analysis?.hasPdf ? 15 : 0) +
        (page.analysis?.hasApi ? 25 : 0) +
        Math.min(60, page.analysis?.bestLinks?.[0]?.score || 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const parsedHoldings = [];

  const tradingSafety = buildTradingSafety({
    realFetchEnabled,
    pages,
    parsedHoldings,
  });

  return {
    ok: pages.some((page) => page.ok),
    mode: "real",
    reason: tradingSafety.reason,
    rawLength: pages.reduce((sum, page) => sum + (page.rawLength || 0), 0),
    holdings: parsedHoldings,
    pages: pages.map((page) => ({
      url: page.url,
      ok: page.ok,
      status: page.status,
      reason: page.reason,
      rawLength: page.rawLength,
      hasEtfCode: page.analysis?.hasEtfCode || false,
      hasCsv: page.analysis?.hasCsv || false,
      hasXlsx: page.analysis?.hasXlsx || false,
      hasPdf: page.analysis?.hasPdf || false,
      hasApi: page.analysis?.hasApi || false,
      bestLinks: page.analysis?.bestLinks || [],
    })),
    analysis: bestPage?.analysis || mainPage?.analysis || analyzeRawText("", etf.sourceUrl, etf.etfCode),
    downloadAnalysis: downloadPage?.analysis || null,
    tradingSafety,
  };
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
      extraSourceUrls: [],
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；尚未解析真實持股權重。",
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
      extraSourceUrls: [],
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；尚未解析真實持股權重。",
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
      extraSourceUrls: [
        "https://www.capitalfund.com.tw/etf/transaction/download",
        "https://www.capitalfund.com.tw/etf/product/overview",
        "https://www.capitalfund.com.tw/etf/product/interest",
        "https://www.capitalfund.com.tw/etf/product/cross/feature",
      ],
      lastFetchAt: new Date().toISOString(),
      note: "v80 實戰安全版：找到真實來源前，仍不把資料當成真實加減碼。",
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
        pages: result.pages || [],
        analysis: result.analysis,
        downloadAnalysis: result.downloadAnalysis,
        tradingSafety: result.tradingSafety,
      };
    })
  );

  const etfsWithFetchStatus = etfs.map((etf) => {
    const report = fetchReports.find((item) => item.etfCode === etf.etfCode);
    const safety = report?.tradingSafety;

    return {
      ...etf,
      mode: safety?.usableForTrading ? "real" : "mock",
      status: safety?.usableForTrading ? "真實資料可用" : "實戰前檢查",
      fetchStatus: safety?.label || report?.reason || "mock_ready",
      realFetchEnabled,
      usableForTrading: safety?.usableForTrading || false,
      dataLevel: safety?.dataLevel || "MOCK_ONLY",
      confidence: safety?.confidence || 0,
      lastFetchAt: report?.checkedAt || new Date().toISOString(),
    };
  });

  const mockHoldings = [
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

  const realParsedHoldings = fetchReports.flatMap((report) => report.realHoldings || []);
  const hasRealHoldings = realParsedHoldings.length > 0;
  const holdings = hasRealHoldings ? realParsedHoldings : mockHoldings;

  const focusReport =
    fetchReports.find((item) => item.etfCode === "00982A") ||
    fetchReports.find((item) => item.ok) ||
    fetchReports[0];

  const focusPages = focusReport?.pages || [];
  const focusBestLinks = uniq(
    [
      ...(focusReport?.analysis?.bestLinks || []).map((item) => item.url),
      ...(focusReport?.downloadAnalysis?.bestLinks || []).map((item) => item.url),
    ],
    40
  );

  const overallSafety = {
    usableForTrading: hasRealHoldings,
    dataLevel: hasRealHoldings ? "REAL_PARSED" : "MOCK_WITH_REAL_SOURCE_CHECK",
    confidence: hasRealHoldings ? 90 : realFetchEnabled ? 65 : 20,
    label: hasRealHoldings
      ? "真實持股已解析，可實戰觀察"
      : realFetchEnabled
        ? "找到真實來源線索，但尚未解析持股"
        : "安全模式，使用示範資料",
    reason: hasRealHoldings
      ? "API 已使用真實持股權重。"
      : "尚未把官網資料解析成持股權重，因此 ETF 加減碼仍不可當成真實買賣依據。",
  };

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v80 trading-safe-source-check"
      : "api/active-etf v80 trading-safe-mock",
    mode: realFetchEnabled ? "trading-safe-source-check" : "mock",
    realReady: true,
    realFetchEnabled,
    usableForTrading: overallSafety.usableForTrading,
    dataLevel: overallSafety.dataLevel,
    confidence: overallSafety.confidence,
    updatedAt: new Date().toISOString(),
    message: overallSafety.label,
    warning: overallSafety.reason,
    focusEtfCode: focusReport?.etfCode || "",
    focusSourceUrl: focusReport?.sourceUrl || "",
    focusPages,
    focusBestLinks,
    focusAnalysis: focusReport?.analysis || null,
    focusDownloadAnalysis: focusReport?.downloadAnalysis || null,
    fetchReports,
    etfs: etfsWithFetchStatus,
    holdings,
  });
}
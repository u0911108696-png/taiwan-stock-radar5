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
  if (u.includes("download")) score += 35;
  if (u.includes("transaction")) score += 25;
  if (u.includes("etf")) score += 20;
  if (u.includes("fund")) score += 15;
  if (u.includes("csv")) score += 50;
  if (u.includes("xlsx") || u.includes("xls")) score += 50;
  if (u.includes("pdf")) score += 25;
  if (u.includes("api") || u.includes("ajax")) score += 40;
  if (u.includes("portfolio") || u.includes("holding") || u.includes("constituent")) score += 40;
  if (u.includes("composition") || u.includes("ingredient")) score += 30;

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

  const apiLikeStrings = [...safeText.matchAll(/["']([^"']*(?:api|ajax|fund|etf|download|holding|portfolio|stock|query|nav|detail|file|pdf|csv|xlsx|xls|transaction|product)[^"']*)["']/gi)]
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
        u.includes("product")
      );
    }),
    120
  );

  const capitalEtfLinks = uniq(
    possibleLinks.filter((url) => {
      const u = String(url || "").toLowerCase();
      return (
        u.includes("capitalfund.com.tw") &&
        (
          u.includes("etf") ||
          u.includes("fund") ||
          u.includes("download") ||
          u.includes("transaction") ||
          u.includes("product") ||
          u.includes("pdf") ||
          u.includes("csv") ||
          u.includes("xls") ||
          u.includes("xlsx") ||
          u.includes("api") ||
          u.includes("ajax")
        )
      );
    }),
    80
  );

  const bestLinks = [...possibleLinks]
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  return {
    rawPreview: safeText.slice(0, 800),
    rawLength: safeText.length,
    hasTable: lower.includes("<table"),
    hasCsv: lower.includes(".csv") || lower.includes("csv"),
    hasJson: lower.includes("application/json") || lower.includes("__next_data__") || lower.includes("json"),
    hasXlsx: lower.includes(".xlsx") || lower.includes(".xls"),
    hasPdf: lower.includes(".pdf") || lower.includes("pdf"),
    hasApi: lower.includes("api") || lower.includes("ajax"),
    hasEtfCode: lower.includes(String(etfCode || "").toLowerCase()),
    hrefLinks: extracted.hrefLinks.slice(0, 50),
    scriptLinks: extracted.scriptLinks.slice(0, 50),
    apiLikeStrings: extracted.apiLikeStrings.slice(0, 80),
    possibleLinks: possibleLinks.slice(0, 100),
    capitalEtfLinks,
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
    };
  }

  const pageUrls = uniq(
    [
      etf.sourceUrl,
      ...(etf.extraSourceUrls || []),
    ],
    8
  );

  const pages = await Promise.all(pageUrls.map((url) => fetchTextPage(url, etf.etfCode)));

  const mainPage = pages.find((page) => page.url === etf.sourceUrl) || pages[0];
  const downloadPage =
    pages.find((page) => String(page.url || "").includes("/transaction/download")) ||
    pages.find((page) => page.analysis?.bestLinks?.some((item) => String(item.url || "").includes("download"))) ||
    null;

  const ok = pages.some((page) => page.ok);
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

  return {
    ok,
    mode: "real",
    reason: ok ? "fetch success but parser not enabled" : "all fetch failed",
    rawLength: pages.reduce((sum, page) => sum + (page.rawLength || 0), 0),
    holdings: [],
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
      note: "目前使用示範持股；v79 保留安全測試。",
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
      note: "目前使用示範持股；v79 保留安全測試。",
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
      note: "v79 同時分析群益 ETF 頁與下載頁，但尚未解析持股。",
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

  const focusPages = focusReport?.pages || [];
  const focusBestLinks = uniq(
    [
      ...(focusReport?.analysis?.bestLinks || []).map((item) => item.url),
      ...(focusReport?.downloadAnalysis?.bestLinks || []).map((item) => item.url),
    ],
    40
  );

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v79 multi-page-safe-analyze"
      : "api/active-etf v79 mock safe",
    mode: realFetchEnabled ? "multi-page-safe-analyze" : "mock",
    realReady: true,
    realFetchEnabled,
    updatedAt: new Date().toISOString(),
    message: realFetchEnabled
      ? "v79 分析模式：同時分析群益 ETF 頁、下載頁、產品頁，找出最可能的真實資料連結；尚未解析持股。"
      : "v79 安全模式：真實抓取關閉，仍使用示範持股。",
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
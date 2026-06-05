const DEFAULT_REAL_FETCH_ENABLED = false;

function uniq(list, limit = 120) {
  return Array.from(new Set((list || []).filter(Boolean))).slice(0, limit);
}

function cleanText(text, limit = 1800) {
  return String(text || "").replace(/\s+/g, " ").slice(0, limit);
}

function getNearbyText(text, keyword, range = 700) {
  const source = String(text || "");
  const index = source.toLowerCase().indexOf(String(keyword || "").toLowerCase());
  if (index < 0) return "";
  return cleanText(source.slice(Math.max(0, index - range), index + range), 2000);
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

  if (u.includes("00982a")) score += 150;
  if (u.includes("download")) score += 55;
  if (u.includes("transaction")) score += 40;
  if (u.includes("etf")) score += 25;
  if (u.includes("fund")) score += 20;
  if (u.includes("csv")) score += 80;
  if (u.includes("xlsx") || u.includes("xls")) score += 80;
  if (u.includes("pdf")) score += 30;
  if (u.includes("api") || u.includes("ajax")) score += 70;
  if (u.includes("portfolio") || u.includes("holding") || u.includes("constituent")) score += 70;
  if (u.includes("composition") || u.includes("ingredient")) score += 50;
  if (u.includes("product")) score += 25;
  if (u.includes("query") || u.includes("detail")) score += 30;

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

  const stringLinks = [
    ...safeText.matchAll(
      /["'`]([^"'`]*(?:api|ajax|fund|etf|download|holding|portfolio|stock|query|nav|detail|file|pdf|csv|xlsx|xls|transaction|product|composition|constituent|00982A)[^"'`]*)["'`]/gi
    ),
  ]
    .map((match) => normalizeLink(match[1], baseUrl))
    .filter((url) => String(url || "").length >= 4);

  return {
    hrefLinks: uniq(hrefLinks, 80),
    scriptLinks: uniq(scriptLinks, 80),
    urlLikeLinks: uniq(urlLikeLinks, 80),
    stringLinks: uniq(stringLinks, 160),
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
      ...extracted.stringLinks,
    ],
    240
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
        u.includes("constituent") ||
        u.includes("00982a")
      );
    }),
    160
  );

  const bestLinks = [...possibleLinks]
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40);

  const hasEtfCode = lower.includes(String(etfCode || "").toLowerCase());
  const hasFileHint =
    lower.includes(".csv") ||
    lower.includes(".xls") ||
    lower.includes(".xlsx") ||
    lower.includes("download") ||
    lower.includes("api") ||
    lower.includes("ajax");

  return {
    rawPreview: safeText.slice(0, 900),
    rawLength: safeText.length,
    hasTable: lower.includes("<table"),
    hasCsv: lower.includes(".csv") || lower.includes("csv"),
    hasJson: lower.includes("application/json") || lower.includes("__next_data__") || lower.includes("json"),
    hasXlsx: lower.includes(".xlsx") || lower.includes(".xls"),
    hasPdf: lower.includes(".pdf") || lower.includes("pdf"),
    hasApi: lower.includes("api") || lower.includes("ajax"),
    hasEtfCode,
    hasFileHint,
    hrefLinks: extracted.hrefLinks.slice(0, 60),
    scriptLinks: extracted.scriptLinks.slice(0, 60),
    stringLinks: extracted.stringLinks.slice(0, 100),
    possibleLinks: possibleLinks.slice(0, 120),
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
      ajax: getNearbyText(safeText, "ajax"),
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
      rawText: text,
      analysis: analyzeRawText(text, url, etfCode),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      reason: error?.message || "fetch failed",
      rawLength: 0,
      rawText: "",
      analysis: analyzeRawText("", url, etfCode),
    };
  }
}

async function fetchJsFiles(scriptLinks, etfCode) {
  const jsLinks = uniq(
    (scriptLinks || []).filter((url) => {
      const u = String(url || "").toLowerCase();
      return u.includes("capitalfund.com.tw") && (u.includes(".js") || u.includes("/assets/") || u.includes("/runtime/"));
    }),
    12
  );

  const reports = [];

  for (const url of jsLinks) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 Taiwan Stock Radar",
          accept: "*/*",
        },
      });

      const text = await response.text();
      const analysis = analyzeRawText(text, url, etfCode);

      reports.push({
        url,
        ok: response.ok,
        status: response.status,
        rawLength: text.length,
        hasEtfCode: analysis.hasEtfCode,
        hasApi: analysis.hasApi,
        hasCsv: analysis.hasCsv,
        hasXlsx: analysis.hasXlsx,
        hasPdf: analysis.hasPdf,
        bestLinks: analysis.bestLinks,
        possibleLinks: analysis.possibleLinks,
        keywordNearby: analysis.keywordNearby,
      });
    } catch (error) {
      reports.push({
        url,
        ok: false,
        status: 0,
        rawLength: 0,
        reason: error?.message || "js fetch failed",
        bestLinks: [],
        possibleLinks: [],
      });
    }
  }

  return reports;
}

function buildTradingSafety({ realFetchEnabled, pages, jsReports }) {
  const okPages = pages.filter((page) => page.ok);
  const hasEtfCode = pages.some((page) => page.analysis?.hasEtfCode) || jsReports.some((item) => item.hasEtfCode);
  const hasFileHint =
    pages.some((page) => page.analysis?.hasFileHint) ||
    jsReports.some((item) => item.hasApi || item.hasCsv || item.hasXlsx || item.hasPdf);
  const hasStrongApiHint = jsReports.some((item) => (item.bestLinks || []).some((link) => link.score >= 100));

  if (!realFetchEnabled) {
    return {
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      label: "示範資料，不可當真實加減碼",
      reason: "真實抓取未啟用，目前僅供版面與流程測試。",
    };
  }

  if (hasStrongApiHint) {
    return {
      usableForTrading: false,
      dataLevel: "REAL_API_HINT_FOUND",
      confidence: 72,
      label: "找到疑似 API 端點，等待解析",
      reason: "已從 JS 或頁面找到疑似資料端點，但尚未解析成持股權重。",
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
      jsReports: [],
      analysis: analyzeRawText("", etf.sourceUrl, etf.etfCode),
      tradingSafety: buildTradingSafety({
        realFetchEnabled,
        pages: [],
        jsReports: [],
      }),
    };
  }

  const pageUrls = uniq([etf.sourceUrl, ...(etf.extraSourceUrls || [])], 8);
  const pages = await Promise.all(pageUrls.map((url) => fetchTextPage(url, etf.etfCode)));

  const allScriptLinks = uniq(
    pages.flatMap((page) => page.analysis?.scriptLinks || []),
    30
  );

  const jsReports = etf.etfCode === "00982A" ? await fetchJsFiles(allScriptLinks, etf.etfCode) : [];

  const bestPage = pages
    .map((page) => ({
      ...page,
      score:
        (page.analysis?.hasEtfCode ? 80 : 0) +
        (page.analysis?.hasCsv ? 35 : 0) +
        (page.analysis?.hasXlsx ? 35 : 0) +
        (page.analysis?.hasPdf ? 15 : 0) +
        (page.analysis?.hasApi ? 25 : 0) +
        Math.min(80, page.analysis?.bestLinks?.[0]?.score || 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const tradingSafety = buildTradingSafety({
    realFetchEnabled,
    pages,
    jsReports,
  });

  return {
    ok: pages.some((page) => page.ok),
    mode: "real",
    reason: tradingSafety.reason,
    rawLength: pages.reduce((sum, page) => sum + (page.rawLength || 0), 0) + jsReports.reduce((sum, item) => sum + (item.rawLength || 0), 0),
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
      scriptCount: page.analysis?.scriptLinks?.length || 0,
      bestLinks: page.analysis?.bestLinks || [],
    })),
    jsReports,
    analysis: bestPage?.analysis || analyzeRawText("", etf.sourceUrl, etf.etfCode),
    tradingSafety,
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
      note: "v84 JS/API 端點追蹤版：只在 test=1 抓 JS 檔找 API。",
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
        jsReports: result.jsReports || [],
        analysis: result.analysis,
        tradingSafety: result.tradingSafety,
        realHoldings: result.holdings || [],
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
  const focusJsReports = focusReport?.jsReports || [];

  const focusBestLinks = uniq(
    [
      ...(focusReport?.analysis?.bestLinks || []).map((item) => item.url),
      ...focusPages.flatMap((page) => (page.bestLinks || []).map((item) => item.url)),
      ...focusJsReports.flatMap((item) => (item.bestLinks || []).map((link) => link.url)),
      ...focusJsReports.flatMap((item) => item.possibleLinks || []),
    ],
    80
  );

  const overallSafety = {
    usableForTrading: false,
    dataLevel: focusReport?.tradingSafety?.dataLevel || "MOCK_WITH_REAL_SOURCE_CHECK",
    confidence: focusReport?.tradingSafety?.confidence || (realFetchEnabled ? 65 : 20),
    label: focusReport?.tradingSafety?.label || (realFetchEnabled ? "JS/API 端點追蹤中" : "安全模式，使用示範資料"),
    reason:
      focusReport?.tradingSafety?.reason ||
      "尚未把官網資料解析成持股權重，因此 ETF 加減碼仍不可當成真實買賣依據。",
  };

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v84 js-api-trace"
      : "api/active-etf v84 safe-mock",
    mode: realFetchEnabled ? "js-api-trace" : "mock",
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
    focusJsReports,
    focusBestLinks,
    focusAnalysis: focusReport?.analysis || null,
    fetchReports,
    etfs: etfsWithFetchStatus,
    holdings,
  });
}
const DEFAULT_REAL_FETCH_ENABLED = false;
const FOCUS_ETF_CODE = "00982A";
const FOCUS_PRODUCT_ID = "399";
const CAPITAL_BASE = "https://www.capitalfund.com.tw";

function uniq(list, limit = 120) {
  return Array.from(new Set((list || []).filter(Boolean))).slice(0, limit);
}

function cleanText(text, limit = 1800) {
  return String(text || "").replace(/\s+/g, " ").slice(0, limit);
}

function getNearbyText(text, keyword, range = 900) {
  const source = String(text || "");
  const index = source.toLowerCase().indexOf(String(keyword || "").toLowerCase());
  if (index < 0) return "";
  return cleanText(source.slice(Math.max(0, index - range), index + range), 2200);
}

function normalizeLink(url, baseUrl) {
  const value = String(url || "").trim();
  if (!value || value.startsWith("javascript:")) return "";

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function isCssNoise(value) {
  const u = String(value || "").toLowerCase();

  if (!u) return true;
  if (u.length > 280) return true;

  return (
    u.includes("{") ||
    u.includes("}") ||
    u.includes("@media") ||
    u.includes("position:") ||
    u.includes("absolute") ||
    u.includes("background") ||
    u.includes("linear-gradient") ||
    u.includes("border-") ||
    u.includes("padding") ||
    u.includes("margin") ||
    u.includes("display:") ||
    u.includes("font-size") ||
    u.includes("box-shadow") ||
    u.includes("transition") ||
    u.includes("transform") ||
    u.includes("color:") ||
    u.includes("width:") ||
    u.includes("height:") ||
    u.includes("rgba") ||
    u.includes("%20%20") ||
    u.includes("sc57") ||
    u.includes("_nghost") ||
    u.includes("_ngcontent") ||
    u.includes("data-unchecked") ||
    u.includes("data-checked")
  );
}

function isRealUsefulLink(value) {
  const u = String(value || "").toLowerCase();

  if (!u) return false;
  if (isCssNoise(u)) return false;

  const isUrl =
    u.startsWith("http://") ||
    u.startsWith("https://") ||
    u.startsWith("/") ||
    u.startsWith("./") ||
    u.startsWith("../");

  const hasUsefulKeyword =
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
    u.includes("ingredient") ||
    u.includes("399") ||
    u.includes("00982a");

  return isUrl && hasUsefulKeyword;
}

function scoreLink(url) {
  const u = String(url || "").toLowerCase();
  let score = 0;

  if (!isRealUsefulLink(u)) return 0;

  if (u.includes("00982a")) score += 180;
  if (u.includes("/399/")) score += 150;
  if (u.includes("detail/399")) score += 150;
  if (u.includes("portfolio")) score += 130;
  if (u.includes("holding")) score += 130;
  if (u.includes("composition")) score += 120;
  if (u.includes("constituent")) score += 120;
  if (u.includes("ingredient")) score += 100;
  if (u.includes("download")) score += 95;
  if (u.includes("csv")) score += 110;
  if (u.includes("xlsx") || u.includes("xls")) score += 110;
  if (u.includes("pdf")) score += 55;
  if (u.includes("api") || u.includes("ajax")) score += 95;
  if (u.includes("product/detail")) score += 80;
  if (u.includes("transaction")) score += 50;
  if (u.includes("etf")) score += 35;
  if (u.includes("fund")) score += 20;
  if (u.includes("query") || u.includes("detail")) score += 35;

  if (u.includes("favicon")) score -= 100;
  if (u.includes("google")) score -= 100;
  if (u.includes("facebook")) score -= 100;
  if (u.includes("line.me")) score -= 100;
  if (u.includes("fonts.")) score -= 100;
  if (u.includes("assets/images")) score -= 80;
  if (u.includes(".css")) score -= 80;
  if (u.includes(".woff")) score -= 80;
  if (u.includes(".png") || u.includes(".jpg") || u.includes(".svg") || u.includes(".ico")) score -= 80;

  return Math.max(0, score);
}

function extractLinks(text, baseUrl) {
  const safeText = String(text || "");

  const hrefLinks = [...safeText.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => normalizeLink(match[1], baseUrl))
    .filter(isRealUsefulLink);

  const scriptLinks = [...safeText.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => normalizeLink(match[1], baseUrl))
    .filter((url) => {
      const u = String(url || "").toLowerCase();
      return u.includes(".js") && u.includes("capitalfund.com.tw") && !isCssNoise(u);
    });

  const urlLikeLinks = [...safeText.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)]
    .map((match) => String(match[0] || "").replace(/[),;]+$/g, ""))
    .filter(isRealUsefulLink);

  const stringLinks = [
    ...safeText.matchAll(
      /["'`]([^"'`]*(?:api|ajax|fund|etf|download|holding|portfolio|stock|query|nav|detail|file|pdf|csv|xlsx|xls|transaction|product|composition|constituent|ingredient|00982A|399)[^"'`]*)["'`]/gi
    ),
  ]
    .map((match) => normalizeLink(match[1], baseUrl))
    .filter(isRealUsefulLink);

  return {
    hrefLinks: uniq(hrefLinks, 100),
    scriptLinks: uniq(scriptLinks, 80),
    urlLikeLinks: uniq(urlLikeLinks, 100),
    stringLinks: uniq(stringLinks, 180),
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
    ].filter(isRealUsefulLink),
    260
  );

  const possibleLinks = uniq(allLinks.filter(isRealUsefulLink), 180);

  const bestLinks = [...possibleLinks]
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  const hasEtfCode = lower.includes(String(etfCode || "").toLowerCase());
  const hasProduct399 = lower.includes("399");
  const hasEtfName =
    lower.includes("主動群益台灣強棒") ||
    lower.includes("群益台灣強棒") ||
    lower.includes("台灣強棒");

  const hasHoldingKeyword =
    lower.includes("持股") ||
    lower.includes("投資組合") ||
    lower.includes("成分") ||
    lower.includes("portfolio") ||
    lower.includes("holding") ||
    lower.includes("composition") ||
    lower.includes("constituent");

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
    hasEtfName,
    hasProduct399,
    hasHoldingKeyword,
    hasFileHint,
    hrefLinks: extracted.hrefLinks.slice(0, 80),
    scriptLinks: extracted.scriptLinks.slice(0, 80),
    stringLinks: extracted.stringLinks.slice(0, 120),
    possibleLinks: possibleLinks.slice(0, 140),
    bestLinks,
    keywordNearby: {
      etfCode: getNearbyText(safeText, etfCode),
      product399: getNearbyText(safeText, "399"),
      active: getNearbyText(safeText, "主動"),
      capitalStrong: getNearbyText(safeText, "強棒"),
      holding: getNearbyText(safeText, "持股"),
      portfolio: getNearbyText(safeText, "portfolio"),
      composition: getNearbyText(safeText, "投資組合"),
      constituent: getNearbyText(safeText, "constituent"),
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
      return u.includes("capitalfund.com.tw") && u.includes(".js") && !isCssNoise(u);
    }),
    14
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
        hasEtfName: analysis.hasEtfName,
        hasProduct399: analysis.hasProduct399,
        hasHoldingKeyword: analysis.hasHoldingKeyword,
        hasApi: analysis.hasApi,
        hasCsv: analysis.hasCsv,
        hasXlsx: analysis.hasXlsx,
        hasPdf: analysis.hasPdf,
        cleanLinkCount: analysis.bestLinks.length,
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
        cleanLinkCount: 0,
        bestLinks: [],
        possibleLinks: [],
      });
    }
  }

  return reports;
}

function buildProduct399Urls() {
  return [
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/basic`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/portfolio`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/download`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/transaction`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/networth`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/holding`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/composition`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/constituent`,
    `${CAPITAL_BASE}/etf/transaction/download`,
    `${CAPITAL_BASE}/etf/transaction/download?fundId=${FOCUS_PRODUCT_ID}`,
    `${CAPITAL_BASE}/etf/transaction/download?productId=${FOCUS_PRODUCT_ID}`,
    `${CAPITAL_BASE}/etf/transaction/download?etfCode=${FOCUS_ETF_CODE}`,
  ];
}

function scoreDetailPage(page) {
  const a = page.analysis || {};
  const lower = String(page.rawText || "").toLowerCase();

  let score = 0;

  if (page.ok) score += 20;
  if (a.hasEtfCode) score += 120;
  if (a.hasEtfName) score += 120;
  if (a.hasProduct399) score += 70;
  if (a.hasHoldingKeyword) score += 80;
  if (a.hasCsv) score += 40;
  if (a.hasXlsx) score += 40;
  if (a.hasPdf) score += 25;
  if (a.hasApi) score += 35;
  if (a.hasTable) score += 30;

  if (lower.includes("00982a")) score += 120;
  if (lower.includes("主動群益台灣強棒")) score += 130;
  if (lower.includes("投資組合")) score += 50;
  if (lower.includes("持股")) score += 50;
  if (lower.includes("成分股")) score += 50;
  if (lower.includes("前十大")) score += 35;
  if (lower.includes("權重")) score += 35;
  if (lower.includes("download")) score += 30;
  if (lower.includes("portfolio")) score += 40;
  if (lower.includes("holding")) score += 40;
  if (lower.includes("composition")) score += 40;

  const bestTop = a.bestLinks?.[0]?.score || 0;
  score += Math.min(120, bestTop);

  return score;
}

async function analyzeProduct399Detail(etfCode) {
  const urls = buildProduct399Urls();
  const pages = await Promise.all(urls.map((url) => fetchTextPage(url, etfCode)));

  const allScriptLinks = uniq(
    pages.flatMap((page) => page.analysis?.scriptLinks || []),
    30
  );

  const jsReports = await fetchJsFiles(allScriptLinks, etfCode);

  const pageReports = pages
    .map((page) => ({
      url: page.url,
      ok: page.ok,
      status: page.status,
      rawLength: page.rawLength,
      score: scoreDetailPage(page),
      hasEtfCode: page.analysis?.hasEtfCode || false,
      hasEtfName: page.analysis?.hasEtfName || false,
      hasProduct399: page.analysis?.hasProduct399 || false,
      hasHoldingKeyword: page.analysis?.hasHoldingKeyword || false,
      hasCsv: page.analysis?.hasCsv || false,
      hasXlsx: page.analysis?.hasXlsx || false,
      hasPdf: page.analysis?.hasPdf || false,
      hasApi: page.analysis?.hasApi || false,
      hasTable: page.analysis?.hasTable || false,
      cleanLinkCount: page.analysis?.bestLinks?.length || 0,
      bestLinks: page.analysis?.bestLinks || [],
      keywordNearby: {
        etfCode: page.analysis?.keywordNearby?.etfCode || "",
        product399: page.analysis?.keywordNearby?.product399 || "",
        capitalStrong: page.analysis?.keywordNearby?.capitalStrong || "",
        holding: page.analysis?.keywordNearby?.holding || "",
        portfolio: page.analysis?.keywordNearby?.portfolio || "",
        composition: page.analysis?.keywordNearby?.composition || "",
        constituent: page.analysis?.keywordNearby?.constituent || "",
        download: page.analysis?.keywordNearby?.download || "",
        api: page.analysis?.keywordNearby?.api || "",
        csv: page.analysis?.keywordNearby?.csv || "",
        xls: page.analysis?.keywordNearby?.xls || "",
      },
    }))
    .sort((a, b) => b.score - a.score);

  const linkCandidates = uniq(
    [
      ...pageReports.flatMap((page) => (page.bestLinks || []).map((item) => item.url)),
      ...jsReports.flatMap((item) => (item.bestLinks || []).map((link) => link.url)),
      ...jsReports.flatMap((item) => item.possibleLinks || []),
    ].filter(isRealUsefulLink),
    120
  )
    .map((url) => ({ url, score: scoreLink(url) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);

  const holdingLinkCandidates = linkCandidates.filter((item) => {
    const u = item.url.toLowerCase();

    return (
      u.includes("portfolio") ||
      u.includes("holding") ||
      u.includes("composition") ||
      u.includes("constituent") ||
      u.includes("ingredient") ||
      u.includes("download") ||
      u.includes("csv") ||
      u.includes("xls") ||
      u.includes("xlsx") ||
      u.includes("00982a") ||
      u.includes("/399/")
    );
  });

  const bestPage = pageReports[0] || null;
  const bestHoldingLink = holdingLinkCandidates[0] || null;

  return {
    productId: FOCUS_PRODUCT_ID,
    productUrl: `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/basic`,
    testedUrls: urls,
    likelyProductFound: Boolean(bestPage && bestPage.score >= 300),
    bestPageUrl: bestPage?.url || "",
    bestPageScore: bestPage?.score || 0,
    bestHoldingLink: bestHoldingLink?.url || "",
    bestHoldingLinkScore: bestHoldingLink?.score || 0,
    holdingLinkFound: Boolean(bestHoldingLink),
    message: bestHoldingLink
      ? `找到疑似 399 持股 / 下載連結：${bestHoldingLink.url}`
      : "已鎖定 399，但尚未找到可直接解析的持股連結",
    pageReports,
    jsReports,
    holdingLinkCandidates,
    allLinkCandidates: linkCandidates,
  };
}

function buildTradingSafety({ realFetchEnabled, product399DetailReport }) {
  if (!realFetchEnabled) {
    return {
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      label: "示範資料，不可當真實加減碼",
      reason: "真實抓取未啟用，目前僅供版面與流程測試。",
    };
  }

  if (product399DetailReport?.holdingLinkFound) {
    return {
      usableForTrading: false,
      dataLevel: "HOLDING_LINK_FOUND",
      confidence: 82,
      label: "找到疑似 399 持股資料連結",
      reason: "已找到疑似持股或下載連結，但尚未解析成持股權重，不能當成真實加減碼。",
    };
  }

  if (product399DetailReport?.likelyProductFound) {
    return {
      usableForTrading: false,
      dataLevel: "PRODUCT_399_FOUND",
      confidence: 78,
      label: "已鎖定 00982A 產品頁 399",
      reason: "已確認 399 是疑似 00982A 產品頁，但尚未解析持股權重。",
    };
  }

  return {
    usableForTrading: false,
    dataLevel: "PRODUCT_399_CHECKING",
    confidence: 65,
    label: "正在檢查 399 持股連結",
    reason: "正在追蹤 399 頁面裡的持股、投資組合、下載連結。",
  };
}

async function fetchActiveEtfHoldings(etf, realFetchEnabled) {
  if (!realFetchEnabled) {
    return {
      ok: false,
      mode: "mock",
      reason: "real fetch disabled",
      holdings: [],
      product399DetailReport: null,
      tradingSafety: buildTradingSafety({
        realFetchEnabled,
        product399DetailReport: null,
      }),
    };
  }

  const product399DetailReport =
    etf.etfCode === FOCUS_ETF_CODE ? await analyzeProduct399Detail(etf.etfCode) : null;

  const tradingSafety = buildTradingSafety({
    realFetchEnabled,
    product399DetailReport,
  });

  return {
    ok: Boolean(product399DetailReport?.likelyProductFound || product399DetailReport?.holdingLinkFound),
    mode: "real",
    reason: tradingSafety.reason,
    rawLength:
      product399DetailReport?.pageReports?.reduce((sum, page) => sum + (page.rawLength || 0), 0) || 0,
    holdings: [],
    product399DetailReport,
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
      sourceUrl: `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/basic`,
      sourceName: "群益投信 00982A 產品頁",
      extraSourceUrls: [],
      lastFetchAt: new Date().toISOString(),
      note: "v87 鎖定 productId 399，追蹤持股 / 投資組合 / 下載連結。",
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
        product399DetailReport: result.product399DetailReport || null,
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
    fetchReports.find((item) => item.etfCode === FOCUS_ETF_CODE) ||
    fetchReports.find((item) => item.ok) ||
    fetchReports[0];

  const product399DetailReport = focusReport?.product399DetailReport || null;

  const focusBestLinks = uniq(
    [
      ...(product399DetailReport?.holdingLinkCandidates || []).map((item) => item.url),
      ...(product399DetailReport?.allLinkCandidates || []).map((item) => item.url),
      ...(product399DetailReport?.pageReports || []).flatMap((page) =>
        (page.bestLinks || []).map((item) => item.url)
      ),
      ...(product399DetailReport?.jsReports || []).flatMap((item) =>
        (item.bestLinks || []).map((link) => link.url)
      ),
    ].filter(isRealUsefulLink),
    120
  );

  const overallSafety = {
    usableForTrading: false,
    dataLevel: focusReport?.tradingSafety?.dataLevel || "MOCK_WITH_REAL_SOURCE_CHECK",
    confidence: focusReport?.tradingSafety?.confidence || (realFetchEnabled ? 65 : 20),
    label: focusReport?.tradingSafety?.label || (realFetchEnabled ? "399 持股連結追蹤中" : "安全模式，使用示範資料"),
    reason:
      focusReport?.tradingSafety?.reason ||
      "尚未把官網資料解析成持股權重，因此 ETF 加減碼仍不可當成真實買賣依據。",
  };

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v87 product399-holding-link-trace"
      : "api/active-etf v87 safe-mock",
    mode: realFetchEnabled ? "product399-holding-link-trace" : "mock",
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
    product399DetailReport,
    focusBestLinks,
    fetchReports,
    etfs: etfsWithFetchStatus,
    holdings,
  });
}
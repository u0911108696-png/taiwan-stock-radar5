const DEFAULT_REAL_FETCH_ENABLED = false;

const FOCUS_ETF_CODE = "00982A";
const FOCUS_PRODUCT_ID = "399";
const CAPITAL_BASE = "https://www.capitalfund.com.tw";
const PORTFOLIO_URL = `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/portfolio`;

const STOCK_NAME_MAP = {
  "2330": "台積電",
  "2308": "台達電",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "3017": "奇鋐",
  "3661": "世芯-KY",
  "2454": "聯發科",
  "2317": "鴻海",
  "3037": "欣興",
  "2383": "台光電",
  "2344": "華邦電",
  "2408": "南亞科",
  "2376": "技嘉",
  "2377": "微星",
  "2357": "華碩",
  "2324": "仁寶",
  "2356": "英業達",
  "2379": "瑞昱",
  "3034": "聯詠",
  "3035": "智原",
  "3443": "創意",
  "3711": "日月光投控",
  "6415": "矽力-KY",
  "6770": "力積電",
  "8299": "群聯",
  "3324": "雙鴻",
  "3653": "健策",
  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
};

const INDUSTRY_MAP = {
  "2330": "半導體",
  "2454": "半導體",
  "3661": "IC設計",
  "2379": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3711": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "8299": "半導體",
  "2308": "電源能源",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",
  "2317": "電子代工",
  "3037": "PCB",
  "2383": "PCB",
  "2344": "記憶體",
  "2408": "記憶體",
  "2376": "AI伺服器",
  "2377": "電腦週邊",
  "2357": "電腦週邊",
  "2324": "電子代工",
  "2356": "電子代工",
  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",
};

const ETF_CODE_PREFIX_BLOCK = [
  "00",
  "006",
  "007",
  "008",
  "009",
];

function uniq(list, limit = 120) {
  return Array.from(new Set((list || []).filter(Boolean))).slice(0, limit);
}

function cleanText(text, limit = 5000) {
  return String(text || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
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
  if (u.includes("portfolio")) score += 150;
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
  const clean = cleanText(safeText, 6000);
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

  const bestLinks = [...allLinks]
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

  return {
    rawPreview: safeText.slice(0, 900),
    cleanPreview: clean.slice(0, 1600),
    rawLength: safeText.length,
    cleanLength: clean.length,
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
    hrefLinks: extracted.hrefLinks.slice(0, 80),
    scriptLinks: extracted.scriptLinks.slice(0, 80),
    stringLinks: extracted.stringLinks.slice(0, 120),
    bestLinks,
    keywordNearby: {
      etfCode: getNearbyText(safeText, etfCode),
      product399: getNearbyText(safeText, "399"),
      capitalStrong: getNearbyText(safeText, "強棒"),
      holding: getNearbyText(safeText, "持股"),
      portfolio: getNearbyText(safeText, "portfolio"),
      composition: getNearbyText(safeText, "投資組合"),
      constituent: getNearbyText(safeText, "constituent"),
      weight: getNearbyText(safeText, "權重"),
      download: getNearbyText(safeText, "download"),
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

function isLikelyEtfCode(code) {
  const value = String(code || "").toUpperCase();

  if (value.length > 4) return true;
  if (ETF_CODE_PREFIX_BLOCK.some((prefix) => value.startsWith(prefix))) return true;

  return false;
}

function isValidTaiwanStockCode(code) {
  const value = String(code || "");

  if (!/^\d{4}$/.test(value)) return false;
  if (isLikelyEtfCode(value)) return false;

  const num = Number(value);
  if (!Number.isFinite(num)) return false;

  return num >= 1100 && num <= 9999;
}

function extractWeightFromNearby(text) {
  const nearby = String(text || "");

  const percentMatches = [...nearby.matchAll(/(\d{1,2}(?:\.\d{1,4})?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 30);

  if (percentMatches.length > 0) {
    return percentMatches[0];
  }

  const weightTextMatches = [
    ...nearby.matchAll(/(?:權重|比重|持股比例|投資比例)\D{0,20}(\d{1,2}(?:\.\d{1,4})?)/g),
  ]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 30);

  if (weightTextMatches.length > 0) {
    return weightTextMatches[0];
  }

  return 0;
}

function parseHoldingsFromText(rawText) {
  const clean = cleanText(rawText, 40000);
  const candidates = [];
  const rejected = [];

  for (const [code, name] of Object.entries(STOCK_NAME_MAP)) {
    if (!isValidTaiwanStockCode(code)) {
      rejected.push({ code, name, reason: "非台股個股代號" });
      continue;
    }

    const codeNearby = getNearbyText(clean, code, 220);
    const nameNearby = getNearbyText(clean, name, 220);
    const hasCode = Boolean(codeNearby);
    const hasName = Boolean(nameNearby);

    if (!hasCode && !hasName) continue;

    const combinedNearby = `${codeNearby} ${nameNearby}`;
    const weight = extractWeightFromNearby(combinedNearby);

    if (!hasCode || !hasName) {
      rejected.push({
        code,
        name,
        reason: "缺少代號或名稱，防止誤判",
        nearby: cleanText(combinedNearby, 400),
      });
      continue;
    }

    if (!weight || weight <= 0) {
      rejected.push({
        code,
        name,
        reason: "找到代號與名稱，但沒有權重%，不可當持股",
        nearby: cleanText(combinedNearby, 400),
      });
      continue;
    }

    candidates.push({
      etfCode: FOCUS_ETF_CODE,
      etfName: "主動群益台灣強棒",
      code,
      name,
      industry: INDUSTRY_MAP[code] || "其他",
      todayWeight: weight,
      yesterdayWeight: 0,
      parseSource: "strict-known-code-name-weight",
      nearby: cleanText(combinedNearby, 500),
      confidence: 90,
    });
  }

  const genericMatches = [
    ...clean.matchAll(/(?:^|\s)(\d{4})\s+([\u4e00-\u9fa5A-Za-z0-9\-]{2,12})\s+(\d{1,2}(?:\.\d{1,4})?)\s*%/g),
  ];

  for (const match of genericMatches) {
    const code = match[1];
    const name = STOCK_NAME_MAP[code] || match[2];
    const weight = Number(match[3]);

    if (!isValidTaiwanStockCode(code)) {
      rejected.push({ code, name, reason: "疑似 ETF 或非個股代號，已過濾", nearby: cleanText(match[0], 300) });
      continue;
    }

    if (!Number.isFinite(weight) || weight <= 0 || weight > 30) {
      rejected.push({ code, name, reason: "權重不合理，已過濾", nearby: cleanText(match[0], 300) });
      continue;
    }

    if (!STOCK_NAME_MAP[code] && String(name).length < 2) {
      rejected.push({ code, name, reason: "名稱不足，已過濾", nearby: cleanText(match[0], 300) });
      continue;
    }

    candidates.push({
      etfCode: FOCUS_ETF_CODE,
      etfName: "主動群益台灣強棒",
      code,
      name,
      industry: INDUSTRY_MAP[code] || "其他",
      todayWeight: weight,
      yesterdayWeight: 0,
      parseSource: "strict-generic-code-name-weight",
      nearby: cleanText(match[0], 300),
      confidence: STOCK_NAME_MAP[code] ? 85 : 70,
    });
  }

  const unique = Array.from(
    new Map(
      candidates
        .sort((a, b) => b.confidence + b.todayWeight - (a.confidence + a.todayWeight))
        .map((item) => [item.code, item])
    ).values()
  );

  const totalWeight = unique.reduce((sum, item) => sum + (Number(item.todayWeight) || 0), 0);
  const withWeightCount = unique.filter((item) => item.todayWeight > 0).length;

  const validForManualCheck = withWeightCount >= 3 && totalWeight >= 5 && totalWeight <= 100;
  const usableAsRealHoldings = false;

  return {
    ok: unique.length > 0,
    count: unique.length,
    withWeightCount,
    totalWeight: Number(totalWeight.toFixed(4)),
    validForManualCheck,
    usableAsRealHoldings,
    reason:
      validForManualCheck
        ? "已嚴格解析出多檔持股與權重，但仍需人工核對，不開放實戰。"
        : unique.length > 0
          ? "有找到部分嚴格持股，但數量或權重不足，不可用。"
          : "嚴格模式下尚未解析出可用持股。",
    holdings: unique.slice(0, 50),
    rejected: rejected.slice(0, 80),
  };
}

async function analyzeProduct399Portfolio() {
  const portfolioPage = await fetchTextPage(PORTFOLIO_URL, FOCUS_ETF_CODE);
  const basicPage = await fetchTextPage(`${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/basic`, FOCUS_ETF_CODE);
  const downloadPage = await fetchTextPage(`${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/download`, FOCUS_ETF_CODE);

  const portfolioParse = parseHoldingsFromText(portfolioPage.rawText);
  const basicParse = parseHoldingsFromText(basicPage.rawText);
  const downloadParse = parseHoldingsFromText(downloadPage.rawText);

  const bestParse = [portfolioParse, basicParse, downloadParse].sort((a, b) => {
    return b.withWeightCount * 100 + b.totalWeight - (a.withWeightCount * 100 + a.totalWeight);
  })[0];

  const allBestLinks = uniq(
    [
      ...(portfolioPage.analysis.bestLinks || []).map((item) => item.url),
      ...(basicPage.analysis.bestLinks || []).map((item) => item.url),
      ...(downloadPage.analysis.bestLinks || []).map((item) => item.url),
    ].filter(isRealUsefulLink),
    80
  );

  return {
    productId: FOCUS_PRODUCT_ID,
    etfCode: FOCUS_ETF_CODE,
    portfolioUrl: PORTFOLIO_URL,
    parserMode: "strict-no-etf-code-no-weight-no-use",
    testedPages: [
      {
        label: "portfolio",
        url: portfolioPage.url,
        ok: portfolioPage.ok,
        status: portfolioPage.status,
        rawLength: portfolioPage.rawLength,
        cleanPreview: portfolioPage.analysis.cleanPreview,
        hasEtfCode: portfolioPage.analysis.hasEtfCode,
        hasEtfName: portfolioPage.analysis.hasEtfName,
        hasHoldingKeyword: portfolioPage.analysis.hasHoldingKeyword,
        hasTable: portfolioPage.analysis.hasTable,
        hasCsv: portfolioPage.analysis.hasCsv,
        hasXlsx: portfolioPage.analysis.hasXlsx,
        hasPdf: portfolioPage.analysis.hasPdf,
        hasApi: portfolioPage.analysis.hasApi,
        keywordNearby: portfolioPage.analysis.keywordNearby,
        parse: portfolioParse,
      },
      {
        label: "basic",
        url: basicPage.url,
        ok: basicPage.ok,
        status: basicPage.status,
        rawLength: basicPage.rawLength,
        cleanPreview: basicPage.analysis.cleanPreview,
        hasEtfCode: basicPage.analysis.hasEtfCode,
        hasEtfName: basicPage.analysis.hasEtfName,
        hasHoldingKeyword: basicPage.analysis.hasHoldingKeyword,
        hasTable: basicPage.analysis.hasTable,
        hasCsv: basicPage.analysis.hasCsv,
        hasXlsx: basicPage.analysis.hasXlsx,
        hasPdf: basicPage.analysis.hasPdf,
        hasApi: basicPage.analysis.hasApi,
        keywordNearby: basicPage.analysis.keywordNearby,
        parse: basicParse,
      },
      {
        label: "download",
        url: downloadPage.url,
        ok: downloadPage.ok,
        status: downloadPage.status,
        rawLength: downloadPage.rawLength,
        cleanPreview: downloadPage.analysis.cleanPreview,
        hasEtfCode: downloadPage.analysis.hasEtfCode,
        hasEtfName: downloadPage.analysis.hasEtfName,
        hasHoldingKeyword: downloadPage.analysis.hasHoldingKeyword,
        hasTable: downloadPage.analysis.hasTable,
        hasCsv: downloadPage.analysis.hasCsv,
        hasXlsx: downloadPage.analysis.hasXlsx,
        hasPdf: downloadPage.analysis.hasPdf,
        hasApi: downloadPage.analysis.hasApi,
        keywordNearby: downloadPage.analysis.keywordNearby,
        parse: downloadParse,
      },
    ],
    bestParse,
    realHoldingsTest: bestParse.holdings,
    rejectedSamples: bestParse.rejected,
    bestLinks: allBestLinks,
    message: bestParse.reason,
  };
}

function buildTradingSafety({ realFetchEnabled, portfolioReport }) {
  if (!realFetchEnabled) {
    return {
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      label: "示範資料，不可當真實加減碼",
      reason: "真實抓取未啟用，目前僅供版面與流程測試。",
    };
  }

  if (portfolioReport?.bestParse?.validForManualCheck) {
    return {
      usableForTrading: false,
      dataLevel: "STRICT_HOLDINGS_PARSED_NEED_MANUAL_CHECK",
      confidence: 84,
      label: "嚴格模式解析到疑似持股",
      reason: "已過濾 ETF 代號，且要求代號、名稱、權重同時存在；仍需人工核對，不開放實戰。",
    };
  }

  if ((portfolioReport?.bestParse?.count || 0) > 0) {
    return {
      usableForTrading: false,
      dataLevel: "STRICT_PARTIAL_HOLDINGS_NOT_USABLE",
      confidence: 70,
      label: "嚴格模式僅解析到部分持股",
      reason: "解析結果數量或權重不足，不可當成真實加減碼。",
    };
  }

  return {
    usableForTrading: false,
    dataLevel: "STRICT_PARSE_FAILED_SAFE",
    confidence: 60,
    label: "嚴格模式未取得可用持股",
    reason: "避免誤把 ETF 清單當成持股，目前不顯示為真實資料。",
  };
}

async function fetchActiveEtfHoldings(etf, realFetchEnabled) {
  if (!realFetchEnabled) {
    return {
      ok: false,
      mode: "mock",
      reason: "real fetch disabled",
      holdings: [],
      portfolioReport: null,
      tradingSafety: buildTradingSafety({
        realFetchEnabled,
        portfolioReport: null,
      }),
    };
  }

  const portfolioReport = etf.etfCode === FOCUS_ETF_CODE ? await analyzeProduct399Portfolio() : null;

  const tradingSafety = buildTradingSafety({
    realFetchEnabled,
    portfolioReport,
  });

  return {
    ok: Boolean(portfolioReport),
    mode: "real",
    reason: tradingSafety.reason,
    rawLength: portfolioReport?.testedPages?.reduce((sum, page) => sum + (page.rawLength || 0), 0) || 0,
    holdings: [],
    portfolioReport,
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
      sourceUrl: PORTFOLIO_URL,
      sourceName: "群益投信 00982A 399 portfolio",
      lastFetchAt: new Date().toISOString(),
      note: "v89 嚴格防誤判：過濾 ETF 代號，必須代號 + 名稱 + 權重才算持股。",
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
        portfolioReport: result.portfolioReport || null,
        tradingSafety: result.tradingSafety,
        realHoldings: result.holdings || [],
      };
    })
  );

  const focusReport =
    fetchReports.find((item) => item.etfCode === FOCUS_ETF_CODE) ||
    fetchReports.find((item) => item.ok) ||
    fetchReports[0];

  const portfolioReport = focusReport?.portfolioReport || null;
  const realHoldingsTest = portfolioReport?.realHoldingsTest || [];

  const overallSafety = {
    usableForTrading: false,
    dataLevel: focusReport?.tradingSafety?.dataLevel || "MOCK_ONLY",
    confidence: focusReport?.tradingSafety?.confidence || (realFetchEnabled ? 60 : 20),
    label: focusReport?.tradingSafety?.label || (realFetchEnabled ? "嚴格防誤判解析中" : "安全模式，使用示範資料"),
    reason:
      focusReport?.tradingSafety?.reason ||
      "尚未把官網資料解析成持股權重，因此 ETF 加減碼仍不可當成真實買賣依據。",
  };

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

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v89 strict-anti-false-parser"
      : "api/active-etf v89 safe-mock",
    mode: realFetchEnabled ? "strict-anti-false-parser" : "mock",
    realReady: true,
    realFetchEnabled,
    usableForTrading: false,
    dataLevel: overallSafety.dataLevel,
    confidence: overallSafety.confidence,
    updatedAt: new Date().toISOString(),
    message: overallSafety.label,
    warning: overallSafety.reason,
    focusEtfCode: FOCUS_ETF_CODE,
    focusProductId: FOCUS_PRODUCT_ID,
    focusSourceUrl: PORTFOLIO_URL,
    portfolioReport,
    realHoldingsTest,
    rejectedSamples: portfolioReport?.rejectedSamples || portfolioReport?.bestParse?.rejected || [],
    fetchReports,
    etfs: etfs.map((etf) => ({
      ...etf,
      realFetchEnabled,
      usableForTrading: false,
      dataLevel: etf.etfCode === FOCUS_ETF_CODE ? overallSafety.dataLevel : "MOCK_ONLY",
      confidence: etf.etfCode === FOCUS_ETF_CODE ? overallSafety.confidence : 20,
      fetchStatus: etf.etfCode === FOCUS_ETF_CODE ? overallSafety.label : "示範資料",
    })),
    holdings: mockHoldings,
  });
}
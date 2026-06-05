const DEFAULT_REAL_FETCH_ENABLED = false;

const FOCUS_ETF_CODE = "00982A";
const FOCUS_PRODUCT_ID = "399";
const CAPITAL_BASE = "https://www.capitalfund.com.tw";
const PORTFOLIO_URL = `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/portfolio`;

const MOCK_HOLDINGS = [
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

function cleanText(text, limit = 8000) {
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

function uniq(list, limit = 100) {
  return Array.from(new Set((list || []).filter(Boolean))).slice(0, limit);
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

function isUsefulFileOrApiLink(url) {
  const u = String(url || "").toLowerCase();

  if (!u) return false;
  if (!u.includes("capitalfund.com.tw")) return false;

  const useful =
    u.includes(".csv") ||
    u.includes(".xls") ||
    u.includes(".xlsx") ||
    u.includes(".json") ||
    u.includes("api") ||
    u.includes("ajax") ||
    u.includes("download") ||
    u.includes("holding") ||
    u.includes("portfolio") ||
    u.includes("composition") ||
    u.includes("constituent");

  const noise =
    u.includes(".css") ||
    u.includes(".png") ||
    u.includes(".jpg") ||
    u.includes(".svg") ||
    u.includes(".ico") ||
    u.includes(".woff") ||
    u.includes("google") ||
    u.includes("facebook") ||
    u.includes("line.me") ||
    u.length > 260 ||
    u.includes("{") ||
    u.includes("}") ||
    u.includes("@media") ||
    u.includes("background") ||
    u.includes("position:");

  return useful && !noise;
}

function extractUsefulLinks(html, baseUrl) {
  const safe = String(html || "");

  const hrefLinks = [...safe.matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => normalizeLink(m[1], baseUrl))
    .filter(isUsefulFileOrApiLink);

  const srcLinks = [...safe.matchAll(/src=["']([^"']+)["']/gi)]
    .map((m) => normalizeLink(m[1], baseUrl))
    .filter(isUsefulFileOrApiLink);

  const urlLinks = [...safe.matchAll(/https?:\/\/[^\s"'<>\\]+/gi)]
    .map((m) => String(m[0] || "").replace(/[),;]+$/g, ""))
    .filter(isUsefulFileOrApiLink);

  return uniq([...hrefLinks, ...srcLinks, ...urlLinks], 80);
}

function countEtfListNoise(text) {
  const clean = String(text || "").toUpperCase();

  const etfCodes = clean.match(/\b00\d{2,3}[A-Z]?\b/g) || [];
  const uniqueEtfCodes = uniq(etfCodes, 200);

  const pageNoiseWords = [
    "ETF首頁",
    "ETF產品資訊",
    "ETF總覽",
    "ETF配息",
    "ETF Q&A",
    "ETF介紹",
    "ETF交易資訊",
    "群益ETF總覽",
    "熱門搜尋",
    "請輸入基金名稱",
    "登入交易",
    "ETF產品特色",
    "配息專區",
    "配息查詢",
    "申購買回清單",
    "追蹤差距",
  ];

  const noiseWordCount = pageNoiseWords.filter((word) => String(text || "").includes(word)).length;

  return {
    etfCodeCount: etfCodes.length,
    uniqueEtfCodeCount: uniqueEtfCodes.length,
    uniqueEtfCodes: uniqueEtfCodes.slice(0, 40),
    noiseWordCount,
    isEtfListPage: uniqueEtfCodes.length >= 5 || noiseWordCount >= 5,
  };
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 Taiwan Stock Radar",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const html = await response.text();
    const clean = cleanText(html, 12000);
    const usefulLinks = extractUsefulLinks(html, url);
    const noise = countEtfListNoise(clean);

    return {
      ok: response.ok,
      status: response.status,
      url,
      rawLength: html.length,
      cleanPreview: clean.slice(0, 1800),
      usefulLinks,
      noise,
      has00982A: clean.toUpperCase().includes("00982A"),
      hasProduct399: clean.includes("399"),
      hasCapitalStrong:
        clean.includes("主動群益台灣強棒") ||
        clean.includes("群益台灣強棒") ||
        clean.includes("台灣強棒"),
      hasPossibleHoldingWords:
        clean.includes("持股") ||
        clean.includes("投資組合") ||
        clean.includes("成分股") ||
        clean.includes("權重") ||
        clean.toLowerCase().includes("portfolio") ||
        clean.toLowerCase().includes("holding"),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url,
      rawLength: 0,
      cleanPreview: "",
      usefulLinks: [],
      noise: {
        etfCodeCount: 0,
        uniqueEtfCodeCount: 0,
        uniqueEtfCodes: [],
        noiseWordCount: 0,
        isEtfListPage: false,
      },
      has00982A: false,
      hasProduct399: false,
      hasCapitalStrong: false,
      hasPossibleHoldingWords: false,
      error: error?.message || "fetch failed",
    };
  }
}

function buildSafety(realFetchEnabled, report) {
  if (!realFetchEnabled) {
    return {
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      label: "示範資料，不可當真實加減碼",
      reason: "真實抓取未啟用，目前僅供版面與流程測試。",
    };
  }

  if (!report || !report.ok) {
    return {
      usableForTrading: false,
      dataLevel: "REAL_PAGE_FETCH_FAILED",
      confidence: 30,
      label: "官網頁面抓取失敗",
      reason: "尚未成功取得群益 00982A 頁面，不能解析持股。",
    };
  }

  if (report.noise?.isEtfListPage) {
    return {
      usableForTrading: false,
      dataLevel: "SAFE_NO_REAL_HOLDINGS",
      confidence: 45,
      label: "偵測到 ETF 清單頁，已保守停用",
      reason: "頁面含大量 00 開頭 ETF 代號與 ETF 導覽文字，容易誤判成持股；目前不解析、不實戰。",
    };
  }

  if (report.usefulLinks?.length > 0) {
    return {
      usableForTrading: false,
      dataLevel: "REAL_LINKS_FOUND_NOT_PARSED",
      confidence: 55,
      label: "找到疑似資料連結，但尚未解析",
      reason: "已找到可能的下載或 API 連結，但尚未確認為持股權重檔，不開放實戰。",
    };
  }

  return {
    usableForTrading: false,
    dataLevel: "SAFE_NO_REAL_HOLDINGS",
    confidence: 40,
    label: "尚未找到真正持股檔",
    reason: "目前只確認產品頁存在，尚未找到可解析的 CSV / XLS / JSON 持股資料。",
  };
}

async function analyzeFocusEtf(realFetchEnabled) {
  if (!realFetchEnabled) {
    return {
      ok: false,
      mode: "mock",
      sourceUrl: PORTFOLIO_URL,
      report: null,
      safety: buildSafety(false, null),
      realHoldings: [],
    };
  }

  const urls = [
    PORTFOLIO_URL,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/basic`,
    `${CAPITAL_BASE}/etf/product/detail/${FOCUS_PRODUCT_ID}/download`,
    `${CAPITAL_BASE}/etf/transaction/download`,
    `${CAPITAL_BASE}/etf/transaction/download?productId=${FOCUS_PRODUCT_ID}`,
    `${CAPITAL_BASE}/etf/transaction/download?etfCode=${FOCUS_ETF_CODE}`,
  ];

  const pages = await Promise.all(urls.map(fetchPage));

  const bestPage =
    pages.find((p) => p.ok && p.has00982A && p.hasCapitalStrong) ||
    pages.find((p) => p.ok && p.has00982A) ||
    pages.find((p) => p.ok) ||
    pages[0];

  const allUsefulLinks = uniq(pages.flatMap((p) => p.usefulLinks || []), 120);

  const report = {
    focusEtfCode: FOCUS_ETF_CODE,
    focusProductId: FOCUS_PRODUCT_ID,
    sourceUrl: PORTFOLIO_URL,
    parserMode: "v91-safe-no-false-positive",
    pages: pages.map((p) => ({
      url: p.url,
      ok: p.ok,
      status: p.status,
      rawLength: p.rawLength,
      has00982A: p.has00982A,
      hasProduct399: p.hasProduct399,
      hasCapitalStrong: p.hasCapitalStrong,
      hasPossibleHoldingWords: p.hasPossibleHoldingWords,
      noise: p.noise,
      usefulLinks: p.usefulLinks,
      cleanPreview: p.cleanPreview,
      error: p.error || "",
    })),
    bestPageUrl: bestPage?.url || "",
    bestPageNoise: bestPage?.noise || null,
    usefulLinks: allUsefulLinks,
    realHoldingsTest: [],
    rejectedReason:
      bestPage?.noise?.isEtfListPage
        ? "偵測到大量 ETF 清單代號，完全保守停用。"
        : "尚未找到可確認的持股 CSV / XLS / JSON 檔。",
  };

  const safety = buildSafety(realFetchEnabled, {
    ...bestPage,
    usefulLinks: allUsefulLinks,
  });

  return {
    ok: true,
    mode: "safe-check",
    sourceUrl: PORTFOLIO_URL,
    report,
    safety,
    realHoldings: [],
  };
}

export default async function handler(req, res) {
  const realFetchEnabled =
    DEFAULT_REAL_FETCH_ENABLED || String(req.query?.test || "") === "1";

  const focus = await analyzeFocusEtf(realFetchEnabled);
  const safety = focus.safety;

  const etfs = [
    {
      etfCode: "00980A",
      etfName: "主動野村臺灣優選",
      issuer: "野村投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "示範資料",
      sourceUrl: "https://www.nomurafunds.com.tw/",
      sourceName: "野村投信官網",
      realFetchEnabled: false,
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；不可當真實加減碼。",
    },
    {
      etfCode: "00981A",
      etfName: "主動統一台股增長",
      issuer: "統一投信",
      mode: "mock",
      status: "準備串接",
      fetchStatus: "示範資料",
      sourceUrl: "https://www.ezmoney.com.tw/",
      sourceName: "統一投信官網",
      realFetchEnabled: false,
      usableForTrading: false,
      dataLevel: "MOCK_ONLY",
      confidence: 20,
      lastFetchAt: new Date().toISOString(),
      note: "目前使用示範持股；不可當真實加減碼。",
    },
    {
      etfCode: FOCUS_ETF_CODE,
      etfName: "主動群益台灣強棒",
      issuer: "群益投信",
      mode: "mock",
      status: "保守停用",
      fetchStatus: safety.label,
      sourceUrl: PORTFOLIO_URL,
      sourceName: "群益投信 00982A 399 portfolio",
      realFetchEnabled,
      usableForTrading: false,
      dataLevel: safety.dataLevel,
      confidence: safety.confidence,
      lastFetchAt: new Date().toISOString(),
      note: "v91 完全保守防誤判：偵測 ETF 清單時不解析為持股。",
    },
  ];

  const fetchReports = etfs.map((etf) => ({
    etfCode: etf.etfCode,
    etfName: etf.etfName,
    sourceName: etf.sourceName,
    sourceUrl: etf.sourceUrl,
    realFetchEnabled: etf.etfCode === FOCUS_ETF_CODE ? realFetchEnabled : false,
    ok: etf.etfCode === FOCUS_ETF_CODE ? focus.ok : false,
    mode: etf.etfCode === FOCUS_ETF_CODE ? focus.mode : "mock",
    reason: etf.etfCode === FOCUS_ETF_CODE ? safety.reason : "示範資料",
    rawLength:
      etf.etfCode === FOCUS_ETF_CODE
        ? focus.report?.pages?.reduce((sum, p) => sum + (p.rawLength || 0), 0) || 0
        : 0,
    holdingsCount: 0,
    checkedAt: new Date().toISOString(),
    tradingSafety:
      etf.etfCode === FOCUS_ETF_CODE
        ? safety
        : {
            usableForTrading: false,
            dataLevel: "MOCK_ONLY",
            confidence: 20,
            label: "示範資料",
            reason: "目前使用示範資料。",
          },
    realHoldings: [],
  }));

  res.status(200).json({
    ok: true,
    source: realFetchEnabled
      ? "api/active-etf v91 ultra-safe-anti-false-positive"
      : "api/active-etf v91 safe-mock",
    mode: realFetchEnabled ? "ultra-safe-check" : "mock",
    realReady: true,
    realFetchEnabled,
    usableForTrading: false,
    dataLevel: safety.dataLevel,
    confidence: safety.confidence,
    updatedAt: new Date().toISOString(),
    message: safety.label,
    warning: safety.reason,
    focusEtfCode: FOCUS_ETF_CODE,
    focusProductId: FOCUS_PRODUCT_ID,
    focusSourceUrl: PORTFOLIO_URL,
    portfolioReport: focus.report,
    realHoldingsTest: [],
    holdingBlocks: [],
    rejectedSamples: focus.report
      ? [
          {
            reason: focus.report.rejectedReason,
            bestPageNoise: focus.report.bestPageNoise,
          },
        ]
      : [],
    fetchReports,
    etfs,
    holdings: MOCK_HOLDINGS,
  });
}
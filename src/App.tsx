import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  industry: string;
  highPrice: number;
  lowPrice: number;
  updatedAt?: string;
};

type Position = {
  code: string;
  buyPrice: number;
  shares: number;
  note?: string;
};

type Settings = {
  refreshSeconds: number;
  hotPercent: number;
  stableIndustryLock: boolean;
};

type TabKey = "home" | "top50" | "watch" | "favorite" | "more";

type PopupKey =
  | ""
  | "sop"
  | "entry"
  | "snapshot"
  | "industry"
  | "search"
  | "positions"
  | "settings"
  | "top50"
  | "moneyUp"
  | "moneyDown"
  | "failed"
  | "amount"
  | "volume";

type PriceDirection = "up" | "down" | "same" | "new";

type MoneyHistory = {
  code: string;
  amountRaw: number[];
  volumeRaw: number[];
  priceRaw: number[];
};

type MoneyTrend =
  | "資金慢慢增加"
  | "資金突然放大"
  | "資金持平"
  | "資金開始減少"
  | "資金放大但股價不漲"
  | "尚未累積";

type EntryLevel = "可進場觀察" | "等回測再進" | "不建議進場";

type EntryPlan = {
  level: EntryLevel;
  score: number;
  reason: string;
  warning: string;
  buyLow: number;
  buyHigh: number;
  stopPrice: number;
  firstProfit: number;
  secondProfit: number;
  atrLine: number;
};

type IndustryItem = {
  industry: string;
  count: number;
  totalAmount: number;
  totalVolume: number;
  avgChange: number;
  amountShare: number;
  score: number;
  strength: "強勢" | "續航" | "轉強" | "分歧" | "過熱" | "轉弱" | "觀察";
  status: "主線續航" | "主線剛轉強" | "資金分歧" | "主線退潮" | "短線過熱" | "觀察中";
  light: "綠燈" | "黃燈" | "紅燈" | "灰燈";
  reason: string;
  stocks: Stock[];
};

type SnapshotStock = {
  code: string;
  name: string;
  industry: string;
  snapshotPrice: number;
  snapshotChangePercent: number;
  snapshotOpenPrice: number;
  snapshotReason: string;
  snapshotType: "可觀察" | "不要碰" | "前50";
};

type Open910Snapshot = {
  id: string;
  dateKey: string;
  createdAt: string;
  topIndustries: string[];
  top50: SnapshotStock[];
  picks: SnapshotStock[];
  avoids: SnapshotStock[];
};

type SopStep = {
  title: string;
  status: "做" | "等" | "禁止";
  detail: string;
};

const API_URL = "/api/stocks";
const SEARCH_API_URL = "/api/search";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const WATCH_KEY = "taiwan-stock-radar-watch";
const POSITIONS_KEY = "taiwan-stock-radar-my-positions";
const SEARCH_HISTORY_KEY = "taiwan-stock-radar-search-history";

const SETTINGS_KEY = "taiwan-stock-radar-v42-settings";
const CACHE_KEY = "taiwan-stock-radar-v42-cache";
const MONEY_HISTORY_KEY = "taiwan-stock-radar-v42-money-history";
const SNAPSHOT_KEY = "taiwan-stock-radar-v42-snapshot";

const defaultSettings: Settings = {
  refreshSeconds: 15,
  hotPercent: 8,
  stableIndustryLock: true,
};

const codeToChineseName: Record<string, string> = {
  "2330": "台積電",
  "2303": "聯電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2344": "華邦電",
  "2408": "南亞科",
  "2337": "旺宏",
  "3481": "群創",
  "2409": "友達",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2324": "仁寶",
  "2356": "英業達",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",
  "2308": "台達電",
  "2301": "光寶科",
  "8299": "群聯",
  "3443": "創意",
  "3661": "世芯-KY",
  "3035": "智原",
  "3034": "聯詠",
  "2379": "瑞昱",
  "6415": "矽力-KY",
  "6770": "力積電",
  "3711": "日月光投控",
  "2383": "台光電",
  "3037": "欣興",
  "3189": "景碩",
  "8046": "南電",
  "2368": "金像電",
  "3017": "奇鋐",
  "3324": "雙鴻",
  "3653": "健策",
  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
  "2881": "富邦金",
  "2882": "國泰金",
  "2884": "玉山金",
  "2885": "元大金",
  "2891": "中信金",
  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "8299": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3035": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",

  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",

  "2357": "電腦週邊",
  "2377": "電腦週邊",

  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",
  "2313": "PCB",
  "2367": "PCB",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",

  "2308": "電源能源",
  "2301": "電源能源",

  "3481": "面板",
  "2409": "面板",

  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",

  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2885": "金融",
  "2891": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
};

function n(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function safeParse<T>(text: string | null, fallback: T): T {
  try {
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function nowText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function todayKey() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function taiwanMinutesNow() {
  const text = new Date().toLocaleTimeString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });

  const [hh, mm] = text.split(":").map(Number);
  return hh * 60 + mm;
}

function open910Status() {
  const minutes = taiwanMinutesNow();
  const open = 9 * 60;
  const lock = 9 * 60 + 10;
  const end = 13 * 60 + 30;

  if (minutes < open) return "開盤前，先等待";
  if (minutes >= open && minutes < lock) return "9:10前，先觀察不急";
  if (minutes >= lock && minutes <= end) return "9:10後，可進入實戰";
  return "收盤後，僅供檢討";
}

function open910Tone(status: string) {
  if (status.includes("可進入")) return "text-emerald-300";
  if (status.includes("先觀察")) return "text-yellow-300";
  if (status.includes("收盤")) return "text-slate-300";
  return "text-cyan-300";
}

function sopNowAction(openStatus: string, entryGoodCount: number, snapshot: Open910Snapshot | null) {
  if (openStatus.includes("開盤前")) return "先等開盤，不先預設股票。";
  if (openStatus.includes("9:10前")) return "只觀察，不追，不急著買。";
  if (openStatus.includes("可進入") && !snapshot) return "先鎖定9:10快照，再看可進場觀察。";
  if (entryGoodCount > 0) return "只看可進場觀察，到買點區間才考慮小部位。";
  return "沒有低風險候選，今天先不硬做。";
}

function cleanCode(value: string) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

function stockDisplayName(stock: { code: string; name?: string }) {
  return codeToChineseName[stock.code] || stock.name || stock.code;
}

function formatPrice(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toFixed(2);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}億`;
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(0)}萬`;
  return `${sign}${abs.toFixed(0)}`;
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "")
    .replace(".TW", "")
    .replace(".TWO", "")
    .replace(/\D/g, "")
    .slice(0, 6);

  const rawName = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);
  const name = codeToChineseName[code] || rawName;

  const price = n(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = n(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = n(raw.openPrice ?? raw.open ?? raw.o ?? price);

  const highPrice = Math.max(n(raw.highPrice ?? raw.high ?? raw.h ?? price), price, openPrice, previousClose);
  const lowPrice = Math.min(n(raw.lowPrice ?? raw.low ?? raw.l ?? price), price, openPrice || price, previousClose || price);

  const changePercent =
    raw.changePercent !== undefined
      ? n(raw.changePercent)
      : previousClose > 0
        ? ((price - previousClose) / previousClose) * 100
        : 0;

  const openPremiumPercent =
    raw.openPremiumPercent !== undefined && raw.openPremiumPercent !== null
      ? n(raw.openPremiumPercent)
      : previousClose > 0 && openPrice > 0
        ? ((openPrice - previousClose) / previousClose) * 100
        : null;

  return {
    code,
    name,
    price,
    changePercent,
    volume: n(raw.volume ?? raw.tradeVolume ?? raw.totalVolume ?? raw.v),
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: raw.industry && raw.industry !== "其他" ? String(raw.industry) : industryMap[code] ?? "其他",
    highPrice,
    lowPrice,
    updatedAt: String(raw.updatedAt ?? raw.time ?? raw.updateTime ?? updateTime),
  };
}
function openingPremium(stock: Stock) {
  return stock.openPremiumPercent ?? 0;
}

function afterOpenPercent(stock: Stock) {
  if (stock.openPrice <= 0) return 0;
  return ((stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function estimatedAmount(stock: Stock) {
  return Math.max(0, stock.price * stock.volume);
}

function amountRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function volumeRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => b.volume - a.volume);
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function rankPercent(rank: number, length: number) {
  if (rank >= 999 || length <= 1) return 0;
  return Math.round(((length - rank + 1) / length) * 100);
}

function amountRankPercent(stock: Stock, list: Stock[]) {
  return rankPercent(amountRankIndex(stock, list), list.length);
}

function volumeRankPercent(stock: Stock, list: Stock[]) {
  return rankPercent(volumeRankIndex(stock, list), list.length);
}

function volumeState(stock: Stock, list: Stock[]) {
  const rank = volumeRankPercent(stock, list);
  if (rank >= 80) return "量能強";
  if (rank >= 50) return "量能普通";
  return "量能不足";
}

function atrValue(stock: Stock) {
  const range = Math.max(stock.highPrice - stock.lowPrice, stock.price * 0.012);
  return Math.max(range, stock.price * 0.008);
}

function atrStopLine(stock: Stock) {
  const atr = atrValue(stock);
  return Math.max(0, stock.highPrice - atr * 1.5);
}

function latestNumber(values: number[] | undefined) {
  if (!values || values.length === 0) return 0;
  return values[values.length - 1] || 0;
}

function previousNumber(values: number[] | undefined) {
  if (!values || values.length < 2) return 0;
  return values[values.length - 2] || 0;
}

function changePercentNumber(now: number, prev: number) {
  if (!Number.isFinite(now) || !Number.isFinite(prev) || prev <= 0) return 0;
  return ((now - prev) / prev) * 100;
}

function moneyTrendChange(code: string, moneyHistory: Record<string, MoneyHistory>) {
  const history = moneyHistory[code];

  const nowAmount = latestNumber(history?.amountRaw);
  const prevAmount = previousNumber(history?.amountRaw);
  const nowVolume = latestNumber(history?.volumeRaw);
  const prevVolume = previousNumber(history?.volumeRaw);
  const nowPrice = latestNumber(history?.priceRaw);
  const prevPrice = previousNumber(history?.priceRaw);

  return {
    nowAmount,
    prevAmount,
    amountChangePercent: changePercentNumber(nowAmount, prevAmount),
    nowVolume,
    prevVolume,
    volumeChangePercent: changePercentNumber(nowVolume, prevVolume),
    nowPrice,
    prevPrice,
    priceChangePercent: changePercentNumber(nowPrice, prevPrice),
  };
}

function moneyTrendLabel(stock: Stock, moneyHistory: Record<string, MoneyHistory>): MoneyTrend {
  const history = moneyHistory[stock.code];

  if (!history || history.amountRaw.length < 2) return "尚未累積";

  const data = moneyTrendChange(stock.code, moneyHistory);
  const amountUp = data.amountChangePercent >= 15;
  const amountBigUp = data.amountChangePercent >= 45;
  const amountDown = data.amountChangePercent <= -15;
  const volumeUp = data.volumeChangePercent >= 12;
  const priceFlat = Math.abs(data.priceChangePercent) <= 0.35;

  if (amountBigUp && priceFlat) return "資金放大但股價不漲";
  if (amountBigUp && stock.price >= stock.openPrice) return "資金突然放大";
  if (amountUp && volumeUp && stock.price >= stock.openPrice) return "資金慢慢增加";
  if (amountDown || data.volumeChangePercent <= -20) return "資金開始減少";

  return "資金持平";
}

function moneyTrendTone(label: MoneyTrend | string) {
  if (label === "資金慢慢增加" || label === "資金突然放大") return "text-emerald-300";
  if (label === "資金放大但股價不漲") return "text-orange-300";
  if (label === "資金開始減少") return "text-red-300";
  return "text-slate-300";
}

function priceVolumeState(stock: Stock, list: Stock[], settings: Settings) {
  const vol = volumeState(stock, list);

  if (stock.price < stock.openPrice || stock.price < stock.previousClose) return "轉弱退潮";
  if (stock.changePercent >= 3 && vol === "量能強") return "量價同步";
  if (stock.changePercent >= settings.hotPercent && vol !== "量能強") return "低量假強";
  if (amountRankPercent(stock, list) >= 70 && stock.changePercent < 2.5) return "爆量不漲";

  return "觀察中";
}

function isOverheat(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || openingPremium(stock) >= 6 || afterOpenPercent(stock) >= 4;
}

function isFail(stock: Stock, list: Stock[], settings: Settings) {
  const pv = priceVolumeState(stock, list, settings);
  return pv === "轉弱退潮" || pv === "爆量不漲" || stock.price < stock.openPrice || stock.changePercent < 0;
}

function chaseRisk(stock: Stock, list: Stock[], settings: Settings) {
  const pv = priceVolumeState(stock, list, settings);

  if (pv === "低量假強" || pv === "爆量不漲") return "追高風險高";
  if (isOverheat(stock, settings)) return "追高風險高";
  if (afterOpenPercent(stock) >= 3 || openingPremium(stock) >= 4) return "追高風險中";
  if (stock.changePercent >= 5 && volumeState(stock, list) !== "量能強") return "追高風險中";

  return "追高風險低";
}

function exitAlert(stock: Stock, list: Stock[], settings: Settings, industryStatus?: string) {
  const stop = atrStopLine(stock);
  const pv = priceVolumeState(stock, list, settings);

  if (stock.price < stock.previousClose) return "跌破昨收，出場避開";
  if (stock.price < stock.openPrice) return "跌破開盤，出場觀察";
  if (stock.price < stop) return "跌破ATR線，減碼觀察";
  if (pv === "爆量不漲") return "爆量不漲，提高警覺";
  if (pv === "轉弱退潮") return "量價轉弱，出場觀察";
  if (industryStatus === "主線退潮") return "產業退潮，降低持股";
  if (isOverheat(stock, settings)) return "短線過熱，分批停利";

  return "續抱觀察";
}

function pullbackRadar(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const main = mainIndustries.includes(stock.industry);
  const openGap = afterOpenPercent(stock);
  const pv = priceVolumeState(stock, list, settings);
  const amountStrong = amountRankPercent(stock, list) >= 60;

  if (!main) return "非主線";
  if (isFail(stock, list, settings)) return "回測失敗";
  if (isOverheat(stock, settings)) return "過熱等回測";
  if (stock.price < stock.openPrice) return "回測失敗";
  if (openGap >= 0 && openGap <= 1.5 && amountStrong && pv !== "轉弱退潮") return "回測買點";
  if (openGap > 1.5 && openGap <= 3.5 && amountStrong) return "接近買點";
  if (openGap > 3.5) return "尚未回測";

  return "觀察中";
}

function decisionText(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings, moneyHistory: Record<string, MoneyHistory>) {
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);

  if (isFail(stock, list, settings)) return "主線失效";
  if (isOverheat(stock, settings)) return "過熱不追";
  if (
    mainIndustries.includes(stock.industry) &&
    amountRankPercent(stock, list) >= 70 &&
    volumeRankPercent(stock, list) >= 65 &&
    stock.price >= stock.openPrice &&
    priceVolumeState(stock, list, settings) === "量價同步" &&
    !isOverheat(stock, settings)
  )
    return "主線核心";

  if (moneyLabel === "資金慢慢增加" || moneyLabel === "資金突然放大") return "資金增加中";
  if (pullbackRadar(stock, list, mainIndustries, settings) === "回測買點") return "回測買點";

  return "觀察中";
}

function entryTone(level: EntryLevel | string) {
  if (level === "可進場觀察") return "text-emerald-300";
  if (level === "等回測再進") return "text-yellow-300";
  if (level === "不建議進場") return "text-red-300";
  return "text-slate-300";
}

function riskTone(label: string) {
  if (label.includes("可進場") || label.includes("續抱") || label.includes("低風險")) return "text-emerald-300";
  if (label.includes("等") || label.includes("觀察") || label.includes("接近")) return "text-yellow-300";
  if (label.includes("過熱") || label.includes("不追")) return "text-orange-300";
  if (label.includes("不建議") || label.includes("跌破") || label.includes("停損") || label.includes("減少") || label.includes("出場")) return "text-red-300";
  return "text-slate-300";
}

function directionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  return "text-cyan-300";
}

function directionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
  if (direction === "new") return "新資料";
  return "--";
}
function entryPlan(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  moneyHistory: Record<string, MoneyHistory>,
  industryStatus?: string
): EntryPlan {
  const reasons: string[] = [];
  const warnings: string[] = [];

  const moneyLabel = moneyTrendLabel(stock, moneyHistory);
  const decision = decisionText(stock, list, mainIndustries, settings, moneyHistory);
  const pullback = pullbackRadar(stock, list, mainIndustries, settings);
  const chase = chaseRisk(stock, list, settings);
  const pv = priceVolumeState(stock, list, settings);
  const exit = exitAlert(stock, list, settings, industryStatus);
  const atrLine = atrStopLine(stock);

  let score = 0;

  if (mainIndustries.includes(stock.industry)) {
    score += 25;
    reasons.push("前三主線");
  } else {
    warnings.push("非前三主線");
  }

  if (decision === "主線核心") {
    score += 25;
    reasons.push("主線核心");
  }

  if (moneyLabel === "資金慢慢增加") {
    score += 22;
    reasons.push("資金慢慢增加");
  }

  if (moneyLabel === "資金突然放大") {
    score += 16;
    reasons.push("資金突然放大");
  }

  if (pullback === "回測買點") {
    score += 20;
    reasons.push("接近回測買點");
  } else if (pullback === "接近買點") {
    score += 12;
    reasons.push("接近買點");
  }

  if (stock.price >= stock.openPrice) {
    score += 12;
    reasons.push("守開盤價");
  } else {
    score -= 35;
    warnings.push("跌破開盤價");
  }

  if (stock.price >= stock.previousClose) {
    score += 8;
    reasons.push("守昨收");
  } else {
    score -= 35;
    warnings.push("跌破昨收");
  }

  if (pv === "量價同步") {
    score += 12;
    reasons.push("量價同步");
  }

  if (chase === "追高風險低") {
    score += 10;
    reasons.push("追高風險低");
  } else if (chase === "追高風險中") {
    score -= 10;
    warnings.push("追高風險中");
  } else {
    score -= 45;
    warnings.push("追高風險高");
  }

  if (pv === "爆量不漲") {
    score -= 45;
    warnings.push("爆量不漲");
  }

  if (isOverheat(stock, settings)) {
    score -= 40;
    warnings.push("短線過熱");
  }

  if (isFail(stock, list, settings)) {
    score -= 60;
    warnings.push("主線失效或轉弱");
  }

  if (moneyLabel === "資金開始減少") {
    score -= 55;
    warnings.push("資金開始減少");
  }

  if (moneyLabel === "資金放大但股價不漲") {
    score -= 35;
    warnings.push("資金放大但股價不漲");
  }

  if (industryStatus === "主線退潮") {
    score -= 45;
    warnings.push("產業主線退潮");
  }

  if (exit.includes("跌破") || exit.includes("出場")) {
    score -= 35;
    warnings.push(exit);
  }

  const baseOpen = stock.openPrice > 0 ? stock.openPrice : stock.price;
  const safeAtrLine = atrLine > 0 && atrLine < stock.price * 1.08 ? atrLine : stock.price * 0.985;

  const rawBuyLow = Math.min(baseOpen, stock.price);
  const rawBuyHigh = Math.max(baseOpen * 1.018, stock.price * 1.006);

  const buyLow = Math.min(rawBuyLow, rawBuyHigh);
  const buyHigh = Math.max(rawBuyLow, rawBuyHigh);
  const stopPrice = Math.min(baseOpen * 0.992, safeAtrLine, stock.previousClose > 0 ? stock.previousClose : baseOpen * 0.99);
  const firstProfit = Math.max(stock.price * 1.025, buyHigh * 1.018);
  const secondProfit = Math.max(stock.price * 1.045, buyHigh * 1.035);

  let level: EntryLevel = "不建議進場";

  const fatalWarning = warnings.some(
    (w) =>
      w.includes("跌破昨收") ||
      w.includes("跌破開盤價") ||
      w.includes("追高風險高") ||
      w.includes("爆量不漲") ||
      w.includes("資金開始減少") ||
      w.includes("主線失效") ||
      w.includes("產業主線退潮")
  );

  if (score >= 68 && !fatalWarning) {
    level = "可進場觀察";
  } else if (score >= 45 && !fatalWarning) {
    level = "等回測再進";
  }

  if (pullback === "尚未回測" || afterOpenPercent(stock) > 2.8) {
    if (level === "可進場觀察") level = "等回測再進";
    warnings.push("離開盤價偏遠，等回測比較安全");
  }

  if (level === "不建議進場" && score >= 38 && warnings.length <= 2 && stock.price >= stock.openPrice && stock.price >= stock.previousClose) {
    level = "等回測再進";
    warnings.push("備用候選，只能小部位觀察");
  }

  return {
    level,
    score: Math.max(0, Math.min(100, score)),
    reason: reasons.slice(0, 6).join("｜") || "條件尚未明確",
    warning: warnings.slice(0, 5).join("｜") || "目前無重大警訊",
    buyLow,
    buyHigh,
    stopPrice,
    firstProfit,
    secondProfit,
    atrLine: safeAtrLine,
  };
}

function snapshotChangePercent(snapshotPrice: number, nowPrice: number) {
  if (!Number.isFinite(snapshotPrice) || snapshotPrice <= 0) return 0;
  return ((nowPrice - snapshotPrice) / snapshotPrice) * 100;
}

function snapshotResult(type: SnapshotStock["snapshotType"], change: number) {
  if (type === "可觀察") {
    if (change >= 1) return "成功";
    if (change <= -1) return "失敗";
    return "等待";
  }

  if (type === "不要碰") {
    if (change <= 0) return "警報有效";
    if (change >= 1.5) return "警報太早";
    return "等待";
  }

  if (change >= 1) return "轉強";
  if (change <= -1) return "轉弱";
  return "等待";
}

function snapshotTone(result: string) {
  if (result === "成功" || result === "警報有效" || result === "轉強") return "text-emerald-300";
  if (result === "失敗" || result === "警報太早" || result === "轉弱") return "text-red-300";
  return "text-yellow-300";
}

function toSnapshotStock(stock: Stock, type: SnapshotStock["snapshotType"], reason: string): SnapshotStock {
  return {
    code: stock.code,
    name: stockDisplayName(stock),
    industry: stock.industry,
    snapshotPrice: stock.price,
    snapshotChangePercent: stock.changePercent,
    snapshotOpenPrice: stock.openPrice,
    snapshotReason: reason,
    snapshotType: type,
  };
}

function snapshotCurrentStock(item: SnapshotStock, stocks: Stock[], searchHistory: Stock[]) {
  return stocks.find((s) => s.code === item.code) || searchHistory.find((s) => s.code === item.code) || null;
}

function snapshotItemChange(item: SnapshotStock, stocks: Stock[], searchHistory: Stock[]) {
  const current = snapshotCurrentStock(item, stocks, searchHistory);
  if (!current) return 0;
  return snapshotChangePercent(item.snapshotPrice, current.price);
}

function snapshotSuccessRate(items: SnapshotStock[], stocks: Stock[], searchHistory: Stock[], type: SnapshotStock["snapshotType"]) {
  const filtered = items.filter((item) => item.snapshotType === type);
  const done = filtered.filter((item) => snapshotResult(item.snapshotType, snapshotItemChange(item, stocks, searchHistory)) !== "等待");
  const success = done.filter((item) => {
    const result = snapshotResult(item.snapshotType, snapshotItemChange(item, stocks, searchHistory));
    return result === "成功" || result === "警報有效";
  });

  return {
    total: filtered.length,
    done: done.length,
    success: success.length,
    rate: done.length > 0 ? (success.length / done.length) * 100 : 0,
  };
}

function makeSopSteps(openStatus: string, entryGoodCount: number, entryWaitCount: number, snapshot: Open910Snapshot | null): SopStep[] {
  const before910 = openStatus.includes("開盤前") || openStatus.includes("9:10前");
  const canTrade = openStatus.includes("可進入");

  return [
    {
      title: "9:00～9:10 先等待",
      status: before910 ? "等" : "做",
      detail: before910 ? "只看資料有沒有更新，不急著買。" : "已過9:10，開始看實戰候選。",
    },
    {
      title: "9:10後先鎖定快照",
      status: snapshot ? "做" : canTrade ? "等" : "等",
      detail: snapshot ? `已鎖定 ${snapshot.createdAt}` : "9:10後按「鎖定快照」，保留當下名單。",
    },
    {
      title: "只看可進場觀察",
      status: entryGoodCount > 0 ? "做" : "等",
      detail: entryGoodCount > 0 ? `目前有 ${entryGoodCount} 檔可進場觀察。` : "沒有低風險候選就不要硬做。",
    },
    {
      title: "等回測再進不追高",
      status: entryWaitCount > 0 ? "等" : "做",
      detail: entryWaitCount > 0 ? `${entryWaitCount} 檔要等回測，不能看到漲就追。` : "目前等待回測名單較少。",
    },
    {
      title: "不建議進場直接排除",
      status: "禁止",
      detail: "跌破開盤、追高風險高、爆量不漲、資金減少，都不要碰。",
    },
    {
      title: "進場後照停損與ATR",
      status: "做",
      detail: "跌破停損價先退，跌破ATR線保護獲利，到第一停利可分批。",
    },
  ];
}
function getIndustryRanking(list: Stock[], settings: Settings, moneyHistory: Record<string, MoneyHistory>): IndustryItem[] {
  const totalAmount = list.reduce((sum, s) => sum + estimatedAmount(s), 0);
  const map = new Map<string, IndustryItem>();

  list.forEach((stock) => {
    const item =
      map.get(stock.industry) ||
      ({
        industry: stock.industry,
        count: 0,
        totalAmount: 0,
        totalVolume: 0,
        avgChange: 0,
        amountShare: 0,
        score: 0,
        strength: "觀察",
        status: "觀察中",
        light: "灰燈",
        reason: "",
        stocks: [],
      } as IndustryItem);

    item.count += 1;
    item.totalAmount += estimatedAmount(stock);
    item.totalVolume += stock.volume;
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);
    map.set(stock.industry, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avgChange = item.avgChange / Math.max(1, item.count);
      const amountShare = totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0;

      let failCount = 0;
      let overheatCount = 0;
      let moneyCount = 0;

      item.stocks.forEach((stock) => {
        const money = moneyTrendLabel(stock, moneyHistory);
        if (isFail(stock, list, settings)) failCount += 1;
        if (isOverheat(stock, settings)) overheatCount += 1;
        if (money === "資金慢慢增加" || money === "資金突然放大") moneyCount += 1;
      });

      const score = amountShare * 3 + Math.max(0, avgChange) * 5 + moneyCount * 18 - failCount * 22 - overheatCount * 8;

      let status: IndustryItem["status"] = "觀察中";
      let light: IndustryItem["light"] = "灰燈";
      let strength: IndustryItem["strength"] = "觀察";

      if (failCount >= Math.max(2, item.count * 0.35)) {
        status = "主線退潮";
        light = "紅燈";
        strength = "轉弱";
      } else if (overheatCount >= Math.max(2, item.count * 0.35)) {
        status = "短線過熱";
        light = "紅燈";
        strength = "過熱";
      } else if (moneyCount >= 2 && amountShare >= 12) {
        status = "主線續航";
        light = "綠燈";
        strength = "強勢";
      } else if (moneyCount >= 1 || amountShare >= 10 || avgChange >= 3) {
        status = "主線剛轉強";
        light = "黃燈";
        strength = "轉強";
      }

      const reason =
        strength === "強勢"
          ? "資金集中、強股明顯，是目前較強主線。"
          : strength === "轉強"
            ? "資金剛轉入，先觀察是否延續。"
            : strength === "過熱"
              ? "短線漲太快，等回測不要追。"
              : strength === "轉弱"
                ? "失效股偏多，降低出手。"
                : "資金尚未明確集中。";

      return {
        ...item,
        avgChange,
        amountShare,
        score,
        status,
        light,
        strength,
        reason,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function positionPlan(
  stock: Stock,
  position: Position | undefined,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  moneyHistory: Record<string, MoneyHistory>,
  industryStatus?: string
) {
  const buyPrice = position?.buyPrice || 0;
  const shares = position?.shares || 0;
  const hasPosition = buyPrice > 0;

  const atrLine = atrStopLine(stock);
  const pullback = pullbackRadar(stock, list, mainIndustries, settings);
  const chase = chaseRisk(stock, list, settings);
  const exit = exitAlert(stock, list, settings, industryStatus);
  const pv = priceVolumeState(stock, list, settings);
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);

  const pnlPercent = hasPosition ? ((stock.price - buyPrice) / buyPrice) * 100 : 0;
  const pnlAmount = hasPosition && shares > 0 ? (stock.price - buyPrice) * shares * 1000 : 0;

  let action = "觀察";
  if (hasPosition && pnlPercent <= -3) action = "個人停損警戒";
  if (exit.includes("出場") || exit.includes("跌破")) action = "出場提醒";
  else if (moneyLabel === "資金開始減少") action = "資金減少警戒";
  else if (moneyLabel === "資金放大但股價不漲") action = "爆量不漲警戒";
  else if (moneyLabel === "資金慢慢增加") action = "資金增溫觀察";
  else if (moneyLabel === "資金突然放大") action = "資金放大觀察";
  else if (chase === "追高風險高") action = hasPosition ? "持有勿追" : "不追高";
  else if (!hasPosition && pullback === "回測買點") action = "低風險觀察";
  else if (hasPosition && pnlPercent >= 8) action = "高獲利分批";
  else if (hasPosition && pnlPercent >= 5) action = "分批停利";
  else if (hasPosition && pnlPercent > 0 && stock.price > atrLine) action = "續抱觀察";

  let batchTitle = "尚未進入分批停利";
  let batchStep1 = "先守停損，不急著加碼。";
  let batchStep2 = `守 ATR 線 ${formatPrice(atrLine)}。`;
  let batchStep3 = "跌破開盤價、ATR線或昨收，降低持股。";
  let dangerText = "目前無明顯持倉危險。";

  if (!hasPosition) {
    batchTitle = "尚未輸入持倉";
    batchStep1 = "請先輸入買進價。";
    batchStep2 = "輸入後會自動計算分批停利。";
    batchStep3 = "張數可填可不填。";
    dangerText = "尚未建立個人風控。";
  } else if (pnlPercent < 0) {
    batchTitle = "虧損中，先不要加倉";
    batchStep1 = "第一步：守個人停損線。";
    batchStep2 = `跌破 ${formatPrice(Math.min(buyPrice * 0.98, stock.openPrice))} 先減碼觀察。`;
    batchStep3 = `跌破昨收 ${formatPrice(stock.previousClose)} 主線偏弱。`;
    dangerText = "成本以下不建議攤平加倉。";
  } else if (pnlPercent >= 5) {
    batchTitle = "獲利 5%+，可分批停利";
    batchStep1 = "第一段：可先停利 1/3。";
    batchStep2 = `第二段：跌破 ATR 線 ${formatPrice(atrLine)} 再出 1/3。`;
    batchStep3 = "最後一段：跌破開盤價或主線失效再出。";
    dangerText = "已進入保護獲利區。";
  }

  if (exit.includes("跌破") || exit.includes("出場")) dangerText = `警戒：${exit}`;

  return {
    hasPosition,
    buyPrice,
    shares,
    pnlPercent,
    pnlAmount,
    atrLine,
    action,
    batchTitle,
    batchStep1,
    batchStep2,
    batchStep3,
    dangerText,
    buyText: hasPosition ? `你的買進價 ${formatPrice(buyPrice)}，目前損益 ${formatPercent(pnlPercent)}。` : "尚未輸入買進價，先看理想買點。",
    stopText: exit,
    profitText: stock.price < atrLine ? "跌破ATR線，獲利需保護。" : "用ATR移動停利，不猜最高點。",
    addText: pv === "量價同步" && chase !== "追高風險高" ? "量價同步，可觀察是否小幅加倉。" : "尚未達加倉條件。",
  };
}

function MiniCard({ title, value, sub, tone, onClick }: { title: string; value: string | number; sub: string; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left active:scale-95">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
    </button>
  );
}

function ActionCard({ title, sub, badge, tone, onClick }: { title: string; sub: string; badge: string | number; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-black text-white">{title}</div>
          <div className="mt-1 text-sm font-bold text-slate-400">{sub}</div>
        </div>
        <div className={`rounded-2xl bg-black/40 px-3 py-2 text-lg font-black ${tone}`}>{badge}</div>
      </div>
    </button>
  );
}

function DetailRow({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}

function ModalShell({ title, sub, children, onClose, z = 90 }: { title: string; sub?: string; children: ReactNode; onClose: () => void; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 px-3 py-6 backdrop-blur-sm" style={{ zIndex: z }} onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-3xl border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              {sub && <div className="text-xs font-bold text-slate-500">{sub}</div>}
              <div className="mt-1 text-2xl font-black text-white">{title}</div>
            </div>
            <button onClick={onClose} className="rounded-2xl bg-slate-800 px-3 py-2 text-lg font-black text-white">×</button>
          </div>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
function SopCard({ step }: { step: SopStep }) {
  const tone = step.status === "做" ? "text-emerald-300" : step.status === "等" ? "text-yellow-300" : "text-red-300";
  const bg = step.status === "做" ? "border-emerald-500/40 bg-emerald-950/20" : step.status === "等" ? "border-yellow-500/40 bg-yellow-950/20" : "border-red-500/40 bg-red-950/20";

  return (
    <div className={`rounded-3xl border p-4 ${bg}`}>
      <div className={`text-sm font-black ${tone}`}>{step.status}</div>
      <div className="mt-1 text-lg font-black text-white">{step.title}</div>
      <div className="mt-2 text-sm font-bold text-slate-300">{step.detail}</div>
    </div>
  );
}

function SimpleStockButton({
  stock,
  label,
  tone,
  reason,
  onClick,
}: {
  stock: Stock;
  label: string;
  tone: string;
  reason?: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full rounded-2xl bg-black/30 p-3 text-left active:scale-95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-base font-black text-white">{stockDisplayName(stock)}</div>
          {reason && <div className="mt-1 text-xs font-bold text-slate-400">{reason}</div>}
        </div>
        <div className="text-right">
          <div className={`text-sm font-black ${tone}`}>{label}</div>
          <div className={stock.changePercent >= 0 ? "text-sm font-black text-red-300" : "text-sm font-black text-emerald-300"}>
            {formatPercent(stock.changePercent)}
          </div>
          <div className="text-xs font-black text-slate-500">{formatPrice(stock.price)}</div>
        </div>
      </div>
    </button>
  );
}

function EntryStockButton({ stock, plan, onClick }: { stock: Stock; plan: EntryPlan; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-xl font-black text-white">{stockDisplayName(stock)}</div>
          <div className={`mt-1 text-sm font-black ${entryTone(plan.level)}`}>{plan.level}｜分數 {plan.score}</div>
        </div>
        <div className="text-right">
          <div className={stock.changePercent >= 0 ? "text-xl font-black text-red-300" : "text-xl font-black text-emerald-300"}>
            {formatPercent(stock.changePercent)}
          </div>
          <div className="text-xs font-black text-slate-400">{formatPrice(stock.price)}</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-black/30 p-3 text-xs font-bold text-slate-300">
        原因：{plan.reason}
        <br />
        警訊：{plan.warning}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-blue-300">
          買點區間<br />{formatPrice(plan.buyLow)}～{formatPrice(plan.buyHigh)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">
          停損<br />{formatPrice(plan.stopPrice)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">
          第一停利<br />{formatPrice(plan.firstProfit)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
          ATR線<br />{formatPrice(plan.atrLine)}
        </div>
      </div>
    </button>
  );
}

function SnapshotButton({ item, current, onClick }: { item: SnapshotStock; current: Stock | null; onClick: () => void }) {
  const nowPrice = current?.price || item.snapshotPrice;
  const change = snapshotChangePercent(item.snapshotPrice, nowPrice);
  const result = snapshotResult(item.snapshotType, change);

  return (
    <button onClick={onClick} className="w-full rounded-2xl bg-black/30 p-3 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{item.code}｜{item.industry}｜{item.snapshotType}</div>
          <div className="mt-1 text-base font-black text-white">{item.name}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{item.snapshotReason}</div>
        </div>

        <div className="text-right">
          <div className={`text-sm font-black ${snapshotTone(result)}`}>{result}</div>
          <div className={change >= 0 ? "text-sm font-black text-red-300" : "text-sm font-black text-emerald-300"}>
            {formatPercent(change)}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">
          快照價<br />{formatPrice(item.snapshotPrice)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-white">
          現價<br />{formatPrice(nowPrice)}
        </div>
      </div>
    </button>
  );
}

function StockQuickModal({
  stock,
  top50,
  mainIndustries,
  settings,
  moneyHistory,
  industryStatus,
  position,
  onSavePosition,
  onDeletePosition,
  favoriteCodes,
  watchCodes,
  priceDirections,
  previousPriceMap,
  lastSuccessAt,
  onClose,
  onAddFavorite,
  onRemoveFavorite,
  onAddWatch,
  onRemoveWatch,
}: {
  stock: Stock;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  moneyHistory: Record<string, MoneyHistory>;
  industryStatus: string;
  position?: Position;
  onSavePosition: (position: Position) => void;
  onDeletePosition: (code: string) => void;
  favoriteCodes: string[];
  watchCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  lastSuccessAt: string;
  onClose: () => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddWatch: (code: string) => void;
  onRemoveWatch: (code: string) => void;
}) {
  const [buyPriceText, setBuyPriceText] = useState(position?.buyPrice ? String(position.buyPrice) : "");
  const [sharesText, setSharesText] = useState(position?.shares ? String(position.shares) : "");
  const [noteText, setNoteText] = useState(position?.note || "");

  const entry = entryPlan(stock, top50, mainIndustries, settings, moneyHistory, industryStatus);
  const plan = positionPlan(stock, position, top50, mainIndustries, settings, moneyHistory, industryStatus);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const isFavorite = favoriteCodes.includes(stock.code);
  const isWatch = watchCodes.includes(stock.code);
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);
  const moneyData = moneyTrendChange(stock.code, moneyHistory);
  const decision = decisionText(stock, top50, mainIndustries, settings, moneyHistory);

  function saveMyPosition() {
    const buyPrice = Number(buyPriceText);
    const shares = Number(sharesText || 0);

    if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
      alert("請輸入正確買進價");
      return;
    }

    onSavePosition({
      code: stock.code,
      buyPrice,
      shares: Number.isFinite(shares) && shares > 0 ? shares : 0,
      note: noteText,
    });
  }

  return (
    <ModalShell title={stockDisplayName(stock)} sub={`${stock.code}｜${stock.industry}`} onClose={onClose} z={120}>
      <div className="flex items-center justify-between rounded-2xl bg-black/30 p-4">
        <div className={`text-3xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
          {formatPercent(stock.changePercent)}
        </div>
        <div className="text-right">
          <div className="text-xs font-bold text-slate-500">即時現價</div>
          <div className="text-xl font-black text-white">{formatPrice(stock.price)}</div>
          <div className="text-xs font-bold text-cyan-300">{stock.updatedAt || lastSuccessAt || "--"}</div>
        </div>
      </div>

      <section className={`mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4 ${entryTone(entry.level)}`}>
        <div className="text-xs font-bold text-slate-400">低風險進場判斷</div>
        <div className="mt-1 text-3xl font-black">{entry.level}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          分數：{entry.score}
          <br />
          原因：{entry.reason}
          <br />
          警訊：{entry.warning}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <DetailRow label="買點區間" value={`${formatPrice(entry.buyLow)}～${formatPrice(entry.buyHigh)}`} tone="text-blue-300" />
          <DetailRow label="停損價" value={formatPrice(entry.stopPrice)} tone="text-red-300" />
          <DetailRow label="第一停利" value={formatPrice(entry.firstProfit)} tone="text-yellow-300" />
          <DetailRow label="ATR移動線" value={formatPrice(entry.atrLine)} tone="text-cyan-300" />
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-cyan-500/40 bg-cyan-950/20 p-4">
        <div className="text-lg font-black text-cyan-100">輸入我的持倉</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <input value={buyPriceText} onChange={(e) => setBuyPriceText(e.target.value)} placeholder="我的買進價" inputMode="decimal" className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none" />
          <input value={sharesText} onChange={(e) => setSharesText(e.target.value)} placeholder="張數，可不填" inputMode="decimal" className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none" />
        </div>
        <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="備註，可不填" className="mt-2 w-full rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-bold text-white outline-none" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={saveMyPosition} className="rounded-2xl bg-cyan-500 py-3 text-sm font-black text-white">儲存我的買點</button>
          <button onClick={() => onDeletePosition(stock.code)} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">刪除買點</button>
        </div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${riskTone(plan.action)}`}>
        <div className="text-xs font-bold text-slate-400">我的交易計畫</div>
        <div className="mt-1 text-3xl font-black">{plan.action}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          買點：{plan.buyText}
          <br />
          停損：{plan.stopText}
          <br />
          停利：{plan.profitText}
          <br />
          加倉：{plan.addText}
        </div>
      </section>

      <section className="mt-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-4">
        <div className="text-lg font-black text-emerald-100">資金增減趨勢</div>
        <div className={`mt-2 text-2xl font-black ${moneyTrendTone(moneyLabel)}`}>{moneyLabel}</div>
        <div className="mt-2 text-sm font-bold text-emerald-100">
          成交金額：{formatAmount(moneyData.prevAmount)} → {formatAmount(moneyData.nowAmount)}
          <br />
          金額變化：{formatPercent(moneyData.amountChangePercent)}
        </div>
      </section>

      <section className={`mt-3 rounded-2xl bg-black/30 p-4 ${directionTone(direction)}`}>
        <div className="text-xs font-bold text-slate-400">即時股價</div>
        <div className="mt-1 text-xl font-black">{directionText(direction)}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          <br />
          主線結論：{decision}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))} className={`rounded-2xl py-3 text-sm font-black ${isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"}`}>
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
        </button>
        <button onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))} className={`rounded-2xl py-3 text-sm font-black ${isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"}`}>
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>
      </div>
    </ModalShell>
  );
}
export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [searchHistory, setSearchHistory] = useState<Stock[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [moneyHistory, setMoneyHistory] = useState<Record<string, MoneyHistory>>({});
  const [snapshot, setSnapshot] = useState<Open910Snapshot | null>(null);

  const [tab, setTab] = useState<TabKey>("home");
  const [popup, setPopup] = useState<PopupKey>("");
  const [selectedCode, setSelectedCode] = useState("");
  const [industryPopup, setIndustryPopup] = useState("");

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [watchCodes, setWatchCodes] = useState<string[]>([]);
  const [queryText, setQueryText] = useState("");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryMessage, setQueryMessage] = useState("");

  const [updating, setUpdating] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [error, setError] = useState("");

  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastAttemptAt, setLastAttemptAt] = useState("");
  const [apiDataTime, setApiDataTime] = useState("");
  const [source, setSource] = useState("");
  const [autoSeconds, setAutoSeconds] = useState(defaultSettings.refreshSeconds);

  const [lastPriceMap, setLastPriceMap] = useState<Record<string, number>>({});
  const [previousPriceMap, setPreviousPriceMap] = useState<Record<string, number>>({});
  const [priceDirections, setPriceDirections] = useState<Record<string, PriceDirection>>({});

  const initedRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  function jumpToContent() {
    setTimeout(() => contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  const mainIndustries = useMemo(() => {
    const map = new Map<string, { industry: string; amount: number; volume: number }>();

    top50.forEach((stock) => {
      const item = map.get(stock.industry) || { industry: stock.industry, amount: 0, volume: 0 };
      item.amount += estimatedAmount(stock);
      item.volume += stock.volume;
      map.set(stock.industry, item);
    });

    return Array.from(map.values())
      .sort((a, b) => b.amount + b.volume * 10 - (a.amount + a.volume * 10))
      .slice(0, 3)
      .map((item) => item.industry);
  }, [top50]);

  const industryRanking = useMemo(() => getIndustryRanking(top50, settings, moneyHistory), [top50, settings, moneyHistory]);

  function stockIndustryStatus(stock: Stock) {
    return industryRanking.find((item) => item.industry === stock.industry)?.status || "觀察中";
  }

  const selectedStock = useMemo(
    () => stocks.find((s) => s.code === selectedCode) || searchHistory.find((s) => s.code === selectedCode) || null,
    [stocks, searchHistory, selectedCode]
  );

  const entryRows = useMemo(() => {
    return top50
      .map((stock) => ({
        stock,
        plan: entryPlan(stock, top50, mainIndustries, settings, moneyHistory, stockIndustryStatus(stock)),
      }))
      .sort((a, b) => b.plan.score - a.plan.score);
  }, [top50, mainIndustries, settings, moneyHistory, industryRanking]);

  const entryGoodList = useMemo(() => entryRows.filter((row) => row.plan.level === "可進場觀察").slice(0, 8), [entryRows]);
  const entryWaitList = useMemo(() => entryRows.filter((row) => row.plan.level === "等回測再進").slice(0, 8), [entryRows]);
  const entryBadList = useMemo(() => entryRows.filter((row) => row.plan.level === "不建議進場").slice(0, 8), [entryRows]);

  const openStatus = open910Status();
  const sopSteps = useMemo(() => makeSopSteps(openStatus, entryGoodList.length, entryWaitList.length, snapshot), [openStatus, entryGoodList.length, entryWaitList.length, snapshot]);
  const nowAction = sopNowAction(openStatus, entryGoodList.length, snapshot);

  const moneyUpList = useMemo(
    () =>
      top50
        .filter((stock) => ["資金慢慢增加", "資金突然放大"].includes(moneyTrendLabel(stock, moneyHistory)))
        .sort((a, b) => moneyTrendChange(b.code, moneyHistory).amountChangePercent - moneyTrendChange(a.code, moneyHistory).amountChangePercent),
    [top50, moneyHistory]
  );

  const moneyDownList = useMemo(
    () =>
      top50
        .filter((stock) => ["資金開始減少", "資金放大但股價不漲"].includes(moneyTrendLabel(stock, moneyHistory)))
        .sort((a, b) => moneyTrendChange(a.code, moneyHistory).amountChangePercent - moneyTrendChange(b.code, moneyHistory).amountChangePercent),
    [top50, moneyHistory]
  );

  const failedList = useMemo(
    () =>
      top50.filter((stock) => {
        const exit = exitAlert(stock, top50, settings, stockIndustryStatus(stock));
        return decisionText(stock, top50, mainIndustries, settings, moneyHistory) === "主線失效" || exit.includes("出場") || exit.includes("跌破");
      }),
    [top50, mainIndustries, settings, industryRanking, moneyHistory]
  );

  const amountList = useMemo(() => [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)), [top50]);
  const volumeList = useMemo(() => [...top50].sort((a, b) => b.volume - a.volume), [top50]);

  const watchStocks = useMemo(() => {
    const map = new Map<string, Stock>();

    watchCodes.forEach((code) => {
      const stock = stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code);
      if (stock) map.set(code, stock);
    });

    entryGoodList.map((row) => row.stock).forEach((stock) => map.set(stock.code, stock));
    moneyUpList.slice(0, 10).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [watchCodes, stocks, searchHistory, entryGoodList, moneyUpList]);

  const favoriteStocks = useMemo(
    () =>
      favoriteCodes
        .map((code) => stocks.find((s) => s.code === code) || searchHistory.find((s) => s.code === code))
        .filter(Boolean) as Stock[],
    [favoriteCodes, stocks, searchHistory]
  );

  const positionRows = useMemo(() => {
    return Object.values(positions)
      .map((position) => {
        const stock = stocks.find((s) => s.code === position.code) || searchHistory.find((s) => s.code === position.code);
        if (!stock) return null;

        const plan = positionPlan(stock, position, top50.length > 0 ? top50 : [stock], mainIndustries, settings, moneyHistory, stockIndustryStatus(stock));
        return { stock, position, plan, pnlPercent: plan.pnlPercent, pnlAmount: plan.pnlAmount, action: plan.action, danger: plan.dangerText };
      })
      .filter(Boolean) as {
      stock: Stock;
      position: Position;
      plan: ReturnType<typeof positionPlan>;
      pnlPercent: number;
      pnlAmount: number;
      action: string;
      danger: string;
    }[];
  }, [positions, stocks, searchHistory, top50, mainIndustries, settings, industryRanking, moneyHistory]);

  const positionStats = useMemo(() => {
    let totalPnl = 0;

    Object.values(positions).forEach((p) => {
      const stock = stocks.find((s) => s.code === p.code) || searchHistory.find((s) => s.code === p.code);
      if (stock && p.buyPrice > 0 && p.shares > 0) totalPnl += (stock.price - p.buyPrice) * p.shares * 1000;
    });

    return { count: Object.values(positions).length, totalPnl };
  }, [positions, stocks, searchHistory]);

  const bestPosition = positionRows.length ? [...positionRows].sort((a, b) => b.pnlPercent - a.pnlPercent)[0] : null;
  const dangerPosition = positionRows.length ? positionRows.find((row) => row.action.includes("停損") || row.action.includes("出場") || row.action.includes("減少")) || positionRows[0] : null;

  const topIndustry = industryRanking[0];
  const totalAmount = top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0);

  const snapshotPickRate = useMemo(() => (snapshot ? snapshotSuccessRate(snapshot.picks, stocks, searchHistory, "可觀察") : { total: 0, done: 0, success: 0, rate: 0 }), [snapshot, stocks, searchHistory]);
  const snapshotAvoidRate = useMemo(() => (snapshot ? snapshotSuccessRate(snapshot.avoids, stocks, searchHistory, "不要碰") : { total: 0, done: 0, success: 0, rate: 0 }), [snapshot, stocks, searchHistory]);

  const marketMode = useMemo(() => {
    if (!topIndustry) return "等待資料";
    if (moneyDownList.length >= 6 || failedList.length >= 6) return "風險偏高";
    if (entryGoodList.length >= 3 && openStatus.includes("可進入")) return "9:10實戰可觀察";
    if (entryGoodList.length >= 2) return "可進攻";
    return "只觀察";
  }, [topIndustry, moneyDownList, failedList, entryGoodList, openStatus]);

  const marketModeTone =
    marketMode === "可進攻" || marketMode === "9:10實戰可觀察"
      ? "text-emerald-300"
      : marketMode === "風險偏高"
        ? "text-red-300"
        : "text-yellow-300";

  function saveSettings(next: Settings) {
    setSettings(next);
    setAutoSeconds(next.refreshSeconds);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function saveFavorites(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean)));
    setFavoriteCodes(clean);
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(clean));
  }

  function saveWatch(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 100);
    setWatchCodes(clean);
    localStorage.setItem(WATCH_KEY, JSON.stringify(clean));
  }

  function saveSearchHistory(next: Stock[]) {
    const unique = Array.from(new Map(next.map((stock) => [stock.code, { ...stock, name: stockDisplayName(stock) }])).values()).slice(0, 20);
    setSearchHistory(unique);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(unique));
  }

  function savePosition(position: Position) {
    const next = { ...positions, [position.code]: position };
    setPositions(next);
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
    saveFavorites([...favoriteCodes, position.code]);
  }

  function deletePosition(code: string) {
    const next = { ...positions };
    delete next[code];
    setPositions(next);
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(next));
  }

  function updateMoneyHistory(list: Stock[]) {
    const topList = list.slice(0, 50);

    setMoneyHistory((old) => {
      const next = { ...old };

      topList.forEach((stock) => {
        const history = next[stock.code] || ({ code: stock.code, amountRaw: [], volumeRaw: [], priceRaw: [] } as MoneyHistory);

        next[stock.code] = {
          code: stock.code,
          amountRaw: [...history.amountRaw, estimatedAmount(stock)].slice(-8),
          volumeRaw: [...history.volumeRaw, stock.volume].slice(-8),
          priceRaw: [...history.priceRaw, stock.price].slice(-8),
        };
      });

      localStorage.setItem(MONEY_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }

  function createSnapshot() {
    if (top50.length === 0) {
      alert("目前沒有資料，請先更新。");
      return;
    }

    const next: Open910Snapshot = {
      id: `${todayKey()}-${Date.now()}`,
      dateKey: todayKey(),
      createdAt: nowText(),
      topIndustries: mainIndustries.slice(0, 3),
      top50: top50.map((stock) => toSnapshotStock(stock, "前50", decisionText(stock, top50, mainIndustries, settings, moneyHistory))),
      picks: entryGoodList.map((row) => toSnapshotStock(row.stock, "可觀察", row.plan.reason)),
      avoids: entryBadList.map((row) => toSnapshotStock(row.stock, "不要碰", row.plan.warning)),
    };

    setSnapshot(next);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    setPopup("snapshot");
  }

  function clearSnapshot() {
    setSnapshot(null);
    localStorage.removeItem(SNAPSHOT_KEY);
  }

  async function loadStocks() {
    try {
      setUpdating(true);
      setError("");
      setLastAttemptAt(nowText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API錯誤：${response.status}`);

      const json = await response.json();

      const list = Array.isArray(json.rankedStocks)
        ? json.rankedStocks
        : Array.isArray(json.stocks)
          ? json.stocks
          : Array.isArray(json.data)
            ? json.data
            : [];

      const dataTime = json.updatedAtTaiwan || (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : nowText());

      const normalized = list
        .map((raw: any) => normalizeStock(raw, dataTime))
        .filter((stock: Stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);

      if (normalized.length === 0) throw new Error("API回傳空資料");

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock: Stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE / Yahoo fallback";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCache(false);

      updateMoneyHistory(normalized);

      localStorage.setItem(CACHE_KEY, JSON.stringify({ stocks: normalized, lastSuccessAt: successTime, apiDataTime: dataTime, source: dataSource }));
    } catch (err: any) {
      setUsingCache(true);
      setError(err?.message || "資料更新失敗，已保留上次成功資料");
    } finally {
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }
  async function searchAnyStock() {
    const q = queryText.trim();

    if (!q) {
      setQueryMessage("請先輸入股票代號或名稱。");
      return;
    }

    try {
      setQueryLoading(true);
      setQueryMessage("");

      const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(q)}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json();

      if (!json.ok || !json.stock) {
        setQueryMessage(json.message || "查無資料，請確認代號或名稱。");
        return;
      }

      const stock = normalizeStock(json.stock, json.stock.updatedAt || nowText());

      saveSearchHistory([stock, ...searchHistory]);
      setSelectedCode(stock.code);
      setQueryMessage(`已查到 ${stock.code} ${stockDisplayName(stock)}`);

      setPreviousPriceMap((old) => ({
        ...old,
        [stock.code]: lastPriceMap[stock.code] || stock.price,
      }));

      setLastPriceMap((old) => ({
        ...old,
        [stock.code]: stock.price,
      }));

      setPriceDirections((old) => ({
        ...old,
        [stock.code]: "new",
      }));
    } catch (err: any) {
      setQueryMessage(err?.message || "查詢失敗，請稍後再試。");
    } finally {
      setQueryLoading(false);
    }
  }

  function sortList(list: Stock[]) {
    return [...list].sort((a, b) => {
      const ad = decisionText(a, top50, mainIndustries, settings, moneyHistory);
      const bd = decisionText(b, top50, mainIndustries, settings, moneyHistory);

      const weight = (d: string) => {
        if (d === "主線核心") return 1000;
        if (d === "資金增加中") return 850;
        if (d === "回測買點") return 650;
        if (d === "主線失效") return -700;
        if (d === "過熱不追") return -400;
        return 0;
      };

      return weight(bd) + estimatedAmount(b) / 10000000 - (weight(ad) + estimatedAmount(a) / 10000000);
    });
  }

  function popupList(key: PopupKey) {
    if (key === "moneyUp") return sortList(moneyUpList);
    if (key === "moneyDown") return sortList(moneyDownList);
    if (key === "failed") return sortList(failedList);
    if (key === "amount") return amountList;
    if (key === "volume") return volumeList;
    if (key === "top50") return sortList(top50);
    return [];
  }

  function popupTitle(key: PopupKey) {
    if (key === "moneyUp") return "資金慢慢增加";
    if (key === "moneyDown") return "資金減少警戒";
    if (key === "failed") return "停損與出場提醒";
    if (key === "amount") return "成交金額排行";
    if (key === "volume") return "成交量排行";
    if (key === "top50") return "今日50強";
    return "";
  }

  const industrySelectedList = useMemo(() => {
    if (!industryPopup) return [];
    return sortList(top50.filter((stock) => stock.industry === industryPopup));
  }, [industryPopup, top50, mainIndustries, moneyHistory]);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const merged = { ...defaultSettings, ...savedSettings };

    setSettings(merged);
    setAutoSeconds(merged.refreshSeconds);
    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setWatchCodes(safeParse(localStorage.getItem(WATCH_KEY), []));
    setSearchHistory(safeParse(localStorage.getItem(SEARCH_HISTORY_KEY), []));
    setPositions(safeParse(localStorage.getItem(POSITIONS_KEY), {}));
    setMoneyHistory(safeParse(localStorage.getItem(MONEY_HISTORY_KEY), {}));
    setSnapshot(safeParse(localStorage.getItem(SNAPSHOT_KEY), null));

    const cached = safeParse<any>(localStorage.getItem(CACHE_KEY), null);
    if (cached && Array.isArray(cached.stocks)) {
      setStocks(cached.stocks);
      setUsingCache(true);

      const prices: Record<string, number> = {};
      cached.stocks.forEach((stock: Stock) => {
        prices[stock.code] = stock.price;
      });

      setLastPriceMap(prices);
      if (cached.lastSuccessAt) setLastSuccessAt(cached.lastSuccessAt);
      if (cached.apiDataTime) setApiDataTime(cached.apiDataTime);
      if (cached.source) setSource(cached.source);
    }

    loadStocks();
  }, []);

  useEffect(() => {
    if (settings.refreshSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setAutoSeconds((sec) => {
        if (sec <= 1) {
          loadStocks();
          return settings.refreshSeconds;
        }

        return sec - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [settings.refreshSeconds, lastPriceMap, moneyHistory]);

  useEffect(() => {
    if (favoriteCodes.length === 0) return;

    loadStocks();

    const timer = window.setInterval(() => {
      loadStocks();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [favoriteCodes.join(",")]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">20項自選即時更新修復版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">盤中主線雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                自選與彈窗優先讀即時資料，舊查詢紀錄只當備用。
              </p>
            </div>

            <button onClick={() => loadStocks()} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
          <div className="text-xs font-bold text-cyan-300">目前應該做什麼</div>
          <div className={`mt-1 text-3xl font-black ${open910Tone(openStatus)}`}>{openStatus}</div>
          <div className="mt-2 text-2xl font-black text-white">{nowAction}</div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DetailRow label="可進場觀察" value={`${entryGoodList.length} 檔`} tone="text-emerald-300" />
            <DetailRow label="等回測再進" value={`${entryWaitList.length} 檔`} tone="text-yellow-300" />
            <DetailRow label="市場模式" value={marketMode} tone={marketModeTone} />
            <DetailRow label="自選即時" value={`${favoriteStocks.length} 檔`} tone="text-cyan-300" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button onClick={() => setPopup("sop")} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
              打開SOP
            </button>
            <button onClick={createSnapshot} className="rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white">
              鎖定快照
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="text-lg font-black">
            即時股價狀態：{updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-400">
            最後成功：{lastSuccessAt || "尚未成功"}｜下一次：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
          </div>
          <div className="mt-1 text-xs font-bold text-cyan-300">50強估算成交金額：{formatAmount(totalAmount)}</div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="可進場觀察" value={entryGoodList.length} sub="低風險候選" tone="text-emerald-300" onClick={() => setPopup("entry")} />
          <MiniCard title="等回測再進" value={entryWaitList.length} sub="不要急追" tone="text-yellow-300" onClick={() => setPopup("entry")} />
          <MiniCard title="自選即時" value={favoriteStocks.length} sub="每15秒更新" tone="text-cyan-300" onClick={() => setTab("favorite")} />
          <MiniCard title="持倉" value={positionStats.count} sub="損益風控" tone="text-purple-300" onClick={() => setPopup("positions")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="明日實戰SOP" sub="開盤流程" badge="📋" tone="text-cyan-300" onClick={() => setPopup("sop")} />
          <ActionCard title="進場候選" sub="買點 / 停損 / 停利" badge={entryGoodList.length} tone="text-emerald-300" onClick={() => setPopup("entry")} />
          <ActionCard title="9:10快照" sub="鎖定 / 驗證準確度" badge="📌" tone="text-emerald-300" onClick={() => setPopup("snapshot")} />
          <ActionCard title="今日50強" sub="漲幅排行" badge={top50.length} tone="text-red-300" onClick={() => setPopup("top50")} />
          <ActionCard title="全個股查詢" sub="不限50強" badge="🔍" tone="text-cyan-300" onClick={() => setPopup("search")} />
          <ActionCard title="設定" sub="更新頻率" badge="⚙️" tone="text-purple-300" onClick={() => setPopup("settings")} />
        </section>

        <section ref={contentRef} className="mt-4 scroll-mt-4">
          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xl font-black">可進場觀察</h3>
                  <button onClick={() => setPopup("entry")} className="rounded-2xl bg-emerald-500/20 px-3 py-2 text-xs font-black text-emerald-200">看全部</button>
                </div>

                <div className="mt-3 space-y-3">
                  {entryGoodList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有低風險進場候選。</div>}
                  {entryGoodList.slice(0, 5).map((row) => (
                    <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "top50" && (
            <div className="space-y-3">
              {entryRows.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          )}

          {tab === "watch" && (
            <div className="space-y-3">
              {watchStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有觀察股票。</div>}
              {watchStocks.map((stock) => (
                <SimpleStockButton key={stock.code} stock={stock} label="觀察" tone="text-cyan-300" onClick={() => setSelectedCode(stock.code)} />
              ))}
            </div>
          )}

          {tab === "favorite" && (
            <div className="space-y-3">
              {favoriteStocks.length === 0 && <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">目前沒有自選股。</div>}
              {favoriteStocks.map((stock) => (
                <SimpleStockButton
                  key={stock.code}
                  stock={stock}
                  label="自選即時"
                  tone="text-yellow-300"
                  reason={`更新：${stock.updatedAt || lastSuccessAt || "--"}`}
                  onClick={() => setSelectedCode(stock.code)}
                />
              ))}
            </div>
          )}

          {tab === "more" && (
            <div className="grid grid-cols-2 gap-3">
              <ActionCard title="明日實戰SOP" sub="開盤流程" badge="📋" tone="text-cyan-300" onClick={() => setPopup("sop")} />
              <ActionCard title="進場候選" sub="低風險買點" badge={entryGoodList.length} tone="text-emerald-300" onClick={() => setPopup("entry")} />
              <ActionCard title="資金慢慢增加" sub="個股資金增溫" badge={moneyUpList.length} tone="text-emerald-300" onClick={() => setPopup("moneyUp")} />
              <ActionCard title="資金減少警戒" sub="退潮 / 爆量不漲" badge={moneyDownList.length} tone="text-red-300" onClick={() => setPopup("moneyDown")} />
              <ActionCard title="產業強弱排行" sub="主線強弱集中看" badge={industryRanking.length} tone="text-yellow-300" onClick={() => setPopup("industry")} />
              <ActionCard title="持倉總表" sub="損益 / 停利 / 風險" badge={positionStats.count} tone="text-cyan-300" onClick={() => setPopup("positions")} />
            </div>
          )}
        </section>
      </div>

      {popup === "sop" && (
        <ModalShell title="明日實戰SOP" sub="照順序做，不追高、不硬買" onClose={() => setPopup("")}>
          <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="text-xs font-bold text-cyan-300">現在動作</div>
            <div className="mt-1 text-2xl font-black text-white">{nowAction}</div>
          </section>

          <div className="mt-4 space-y-3">
            {sopSteps.map((step) => (
              <SopCard key={step.title} step={step} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "entry" && (
        <ModalShell title="低風險進場候選" sub="可進場觀察 / 等回測 / 不建議" onClose={() => setPopup("")}>
          <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-4">
            <div className="text-xs font-bold text-emerald-300">提醒</div>
            <div className="mt-1 text-2xl font-black text-emerald-100">這不是保證買進</div>
            <div className="mt-2 text-sm font-bold text-slate-300">只代表條件相對安全。進場後仍要照停損價、ATR移動線、停利區執行。</div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-emerald-100">可進場觀察</div>
            <div className="mt-3 space-y-3">
              {entryGoodList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有低風險進場候選。</div>}
              {entryGoodList.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-yellow-100">等回測再進</div>
            <div className="mt-3 space-y-3">
              {entryWaitList.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-red-100">不建議進場</div>
            <div className="mt-3 space-y-3">
              {entryBadList.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          </section>
        </ModalShell>
      )}

      {popup === "snapshot" && (
        <ModalShell title="9:10鎖定快照" sub={snapshot ? `${snapshot.dateKey}｜${snapshot.createdAt}` : "尚未建立快照"} onClose={() => setPopup("")}>
          {!snapshot && (
            <div className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
              <div className="text-2xl font-black text-yellow-100">尚未鎖定快照</div>
              <div className="mt-2 text-sm font-bold text-slate-300">按下「鎖定快照」後，會保存目前前50強與進場候選清單。</div>
              <button onClick={createSnapshot} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white">
                鎖定快照
              </button>
            </div>
          )}

          {snapshot && (
            <>
              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <DetailRow label="可觀察成功率" value={`${snapshotPickRate.rate.toFixed(0)}%`} tone="text-emerald-300" />
                  <DetailRow label="不要碰警報率" value={`${snapshotAvoidRate.rate.toFixed(0)}%`} tone="text-red-300" />
                </div>
              </section>

              <section className="mt-4">
                <div className="text-lg font-black text-emerald-100">快照可觀察</div>
                <div className="mt-3 space-y-3">
                  {snapshot.picks.map((item) => (
                    <SnapshotButton key={`${item.code}-pick`} item={item} current={snapshotCurrentStock(item, stocks, searchHistory)} onClick={() => setSelectedCode(item.code)} />
                  ))}
                </div>
              </section>

              <section className="mt-4">
                <div className="text-lg font-black text-red-100">快照不要碰</div>
                <div className="mt-3 space-y-3">
                  {snapshot.avoids.map((item) => (
                    <SnapshotButton key={`${item.code}-avoid`} item={item} current={snapshotCurrentStock(item, stocks, searchHistory)} onClick={() => setSelectedCode(item.code)} />
                  ))}
                </div>
              </section>

              <button onClick={clearSnapshot} className="mt-4 w-full rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                重設快照
              </button>
            </>
          )}
        </ModalShell>
      )}

      {["moneyUp", "moneyDown", "failed", "amount", "volume", "top50"].includes(popup) && (
        <ModalShell title={popupTitle(popup)} sub={`共 ${popupList(popup).length} 檔｜點股票看詳情`} onClose={() => setPopup("")}>
          <div className="space-y-3">
            {popupList(popup).length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前沒有符合條件的股票。</div>}
            {popupList(popup).map((stock) => (
              <SimpleStockButton
                key={stock.code}
                stock={stock}
                label={decisionText(stock, top50, mainIndustries, settings, moneyHistory)}
                tone={riskTone(decisionText(stock, top50, mainIndustries, settings, moneyHistory))}
                onClick={() => setSelectedCode(stock.code)}
              />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "industry" && (
        <ModalShell title="產業主線強弱排行" sub="依資金、量能、強弱排序" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {industryRanking.map((item, index) => (
              <button key={item.industry} onClick={() => setIndustryPopup(item.industry)} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
                <div className="text-xs font-bold text-slate-500">#{index + 1} 主線強弱排序</div>
                <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
                <div className={`mt-1 text-sm font-black ${riskTone(item.strength)}`}>{item.light}｜{item.status}｜{item.strength}</div>
                <div className="mt-1 text-xs font-bold text-slate-400">{item.reason}</div>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {industryPopup && (
        <ModalShell title={`${industryPopup} 主線個股`} sub="該產業內資金排序" onClose={() => setIndustryPopup("")} z={110}>
          <div className="space-y-3">
            {industrySelectedList.length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前沒有該產業股票。</div>}
            {industrySelectedList.map((stock) => (
              <SimpleStockButton
                key={stock.code}
                stock={stock}
                label={decisionText(stock, top50, mainIndustries, settings, moneyHistory)}
                tone={riskTone(decisionText(stock, top50, mainIndustries, settings, moneyHistory))}
                onClick={() => setSelectedCode(stock.code)}
              />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "positions" && (
        <ModalShell title="持倉總表風險雷達" sub="你的買進價、損益、停利、停損集中看" onClose={() => setPopup("")}>
          <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow label="持倉檔數" value={`${positionStats.count} 檔`} tone="text-cyan-300" />
              <DetailRow label="持倉總損益" value={formatAmount(positionStats.totalPnl)} tone={positionStats.totalPnl >= 0 ? "text-red-300" : "text-emerald-300"} />
              <DetailRow label="最賺股票" value={bestPosition ? `${stockDisplayName(bestPosition.stock)} ${formatPercent(bestPosition.pnlPercent)}` : "--"} tone="text-red-300" />
              <DetailRow label="最高風險" value={dangerPosition ? `${stockDisplayName(dangerPosition.stock)}｜${dangerPosition.action}` : "--"} tone="text-yellow-300" />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {positionRows.length === 0 && <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">目前還沒有輸入買進價。</div>}
            {positionRows.map((row) => (
              <SimpleStockButton key={row.stock.code} stock={row.stock} label={row.action} tone={riskTone(row.action)} reason={row.danger} onClick={() => setSelectedCode(row.stock.code)} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "search" && (
        <ModalShell title="全個股查詢" sub="輸入代號或中文名稱" onClose={() => setPopup("")}>
          <div className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
            <div className="flex gap-2">
              <input value={queryText} onChange={(e) => setQueryText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchAnyStock(); }} placeholder="例如 華邦電、群創、2330" className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none" />
              <button onClick={searchAnyStock} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">{queryLoading ? "查詢中" : "查詢"}</button>
            </div>
            {queryMessage && <div className="mt-3 text-sm font-bold text-yellow-200">{queryMessage}</div>}
          </div>

          <div className="mt-4 space-y-3">
            {searchHistory.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">尚無查詢紀錄。</div>}
            {searchHistory.map((stock) => (
              <SimpleStockButton key={stock.code} stock={stock} label="查詢紀錄" tone="text-cyan-300" onClick={() => setSelectedCode(stock.code)} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "settings" && (
        <ModalShell title="設定" sub="主線確認與更新頻率" onClose={() => setPopup("")}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-lg font-black">即時更新頻率</div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  [15, "15秒"],
                  [30, "30秒"],
                  [60, "60秒"],
                  [0, "手動"],
                ].map(([value, label]) => (
                  <button key={String(value)} onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value) })} className={`rounded-2xl py-3 text-sm font-black ${settings.refreshSeconds === Number(value) ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => { setMoneyHistory({}); localStorage.removeItem(MONEY_HISTORY_KEY); }} className="w-full rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200">
              重置資金增減紀錄
            </button>

            <button onClick={clearSnapshot} className="w-full rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
              重置9:10快照
            </button>
          </div>
        </ModalShell>
      )}

      {selectedStock && (
        <>
          <div className="fixed right-4 top-24 z-[140] rounded-2xl bg-black/80 px-3 py-2 text-xs font-black text-cyan-200">
            個股即時資料
          </div>

          <StockQuickModal
            stock={selectedStock}
            top50={top50.length > 0 ? top50 : [selectedStock]}
            mainIndustries={mainIndustries}
            settings={settings}
            moneyHistory={moneyHistory}
            industryStatus={stockIndustryStatus(selectedStock)}
            position={positions[selectedStock.code]}
            onSavePosition={savePosition}
            onDeletePosition={deletePosition}
            favoriteCodes={favoriteCodes}
            watchCodes={watchCodes}
            priceDirections={priceDirections}
            previousPriceMap={previousPriceMap}
            lastSuccessAt={lastSuccessAt}
            onClose={() => setSelectedCode("")}
            onAddFavorite={(code) => saveFavorites([...favoriteCodes, code])}
            onRemoveFavorite={(code) => saveFavorites(favoriteCodes.filter((item) => item !== code))}
            onAddWatch={(code) => saveWatch([...watchCodes, code])}
            onRemoveWatch={(code) => saveWatch(watchCodes.filter((item) => item !== code))}
          />
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "首頁"],
            ["top50", "🔥", "50強"],
            ["watch", "📌", "觀察"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setPopup("");
                setIndustryPopup("");
                setTab(key as TabKey);
                jumpToContent();
              }}
              className={`rounded-2xl py-2 text-xs font-black ${tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"}`}
            >
              <div className="text-xl">{icon}</div>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
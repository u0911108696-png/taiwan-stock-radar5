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
  priceSource?: string;
  stableNote?: string;
};

type KlineCandle = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type KlineSignal = {
  action: "可進場" | "等回測" | "不追高" | "跌破出場" | "觀察";
  tone: string;
  reason: string;
  maText: string;
  buyLow: number;
  buyHigh: number;
  stopLine: number;
  atrLine: number;
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

type TabKey = "home" | "top50" | "portfolio" | "activeEtf" | "favorite" | "more";

type PopupKey =
  | ""
  | "sop"
  | "entry"
  | "alerts"
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
  | "volume"
  | "avoid";

type PriceDirection = "up" | "down" | "same" | "new" | "hold";

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

type AlertLevel = "紅燈" | "黃燈" | "綠燈";

type AlertItem = {
  id: string;
  level: AlertLevel;
  type:
    | "低風險進場"
    | "跌破開盤"
    | "突破開盤"
    | "追高風險"
    | "爆量不漲"
    | "資金減少"
    | "資金放大"
    | "跌破ATR"
    | "第一停利"
    | "主線核心"
    | "主線退潮"
    | "自選警報"
    | "持倉停損"
    | "持倉停利";
  code: string;
  name: string;
  industry: string;
  message: string;
  price: number;
  priority: number;
  updatedAt: string;
};

const API_URL = "/api/realtime";
const SEARCH_API_URL = "/api/search";
const KLINE_API_URL = "/api/kline";
const ACTIVE_ETF_API_URL = "/api/active-etf";
const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const WATCH_KEY = "taiwan-stock-radar-watch";
const POSITIONS_KEY = "taiwan-stock-radar-my-positions";
const SEARCH_HISTORY_KEY = "taiwan-stock-radar-search-history";

const SETTINGS_KEY = "taiwan-stock-radar-v66-settings";
const CACHE_KEY = "taiwan-stock-radar-v66-cache";
const MONEY_HISTORY_KEY = "taiwan-stock-radar-v66-money-history";
const SNAPSHOT_KEY = "taiwan-stock-radar-v66-snapshot";

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
  "2618": "長榮航",
  "3042": "晶技",
  "2327": "國巨",
};

const industryMap: Record<string, string> = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",
  "8299": "半導體",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

  "3481": "面板",
  "2409": "面板",

  "2327": "被動元件",
  "3042": "其他",

  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",

  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",

  "2357": "電腦週邊",
  "2377": "電腦週邊",

  "2308": "電源能源",
  "2301": "電源能源",

  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",

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
  "2618": "航空",
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
function parseTimeMs(text?: string) {
  if (!text) return 0;
  const time = new Date(String(text).replace(" ", "T")).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dataAgeSeconds(updatedAt?: string) {
  const ms = parseTimeMs(updatedAt);
  if (!ms) return 9999;
  return Math.max(0, Math.floor((Date.now() - ms) / 1000));
}

function dataFreshTone(updatedAt?: string) {
  const age = dataAgeSeconds(updatedAt);
  if (age <= 30) return "text-emerald-300";
  if (age <= 60) return "text-yellow-300";
  return "text-red-300";
}

function dataFreshText(updatedAt?: string) {
  const age = dataAgeSeconds(updatedAt);
  if (age <= 30) return "新鮮";
  if (age <= 60) return "稍慢";
  return "偏舊";
}

function sourceLabel(source?: string) {
  if (!source) return "資料源 --";
  if (source.includes("TWSE")) return "TWSE即時成交";
  if (source.includes("Yahoo")) return "Yahoo 1分K";
  return source;
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
    priceSource: String(raw.priceSource ?? raw.source ?? ""),
    stableNote: String(raw.stableNote ?? ""),
  };
}

function stableMergeStock(next: Stock, old?: Stock): Stock {
  if (!old || !old.price || old.price <= 0) {
    return {
      ...next,
      stableNote: next.stableNote || "正常更新",
    };
  }

  if (!next.price || next.price <= 0) {
    return { ...old, stableNote: "新資料無效，保留上一筆" };
  }

  const priceGap = Math.abs(next.price - old.price) / old.price;
  const oldTime = parseTimeMs(old.updatedAt);
  const nextTime = parseTimeMs(next.updatedAt);

  // 新資料時間比舊資料還早，不准覆蓋
  if (oldTime > 0 && nextTime > 0 && nextTime < oldTime) {
    return { ...old, stableNote: "資料時間較舊，保留最新價" };
  }

  // 同一分鐘內，如果價格跳回昨收或開盤，通常是舊資料回補，不准覆蓋
  if (oldTime > 0 && nextTime > 0 && Math.abs(nextTime - oldTime) <= 60000) {
    const jumpBackToOpen = next.openPrice > 0 && Math.abs(next.price - next.openPrice) <= 0.01 && Math.abs(old.price - next.openPrice) / old.price > 0.02;
    const jumpBackToPrev = next.previousClose > 0 && Math.abs(next.price - next.previousClose) <= 0.01 && Math.abs(old.price - next.previousClose) / old.price > 0.02;

    if (jumpBackToOpen || jumpBackToPrev) {
      return { ...old, stableNote: "疑似舊價回補，保留最新價" };
    }
  }

  // 價格瞬間跳動過大，先保護
  if (priceGap >= 0.08 && next.price === next.openPrice && old.price !== old.openPrice) {
    return { ...old, stableNote: "疑似跳回開盤價，保留上一筆" };
  }

  if (priceGap >= 0.12) {
    return { ...old, stableNote: "價格跳動過大，保留上一筆" };
  }

  return {
    ...next,
    stableNote: next.stableNote || "正常更新",
  };
}

function stableMergeList(nextList: Stock[], oldList: Stock[]) {
  const oldMap = new Map(oldList.map((stock) => [stock.code, stock]));
  return nextList.map((next) => stableMergeStock(next, oldMap.get(next.code)));
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
  ) {
    return "主線核心";
  }

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
  if (label.includes("可進場") || label.includes("續抱") || label.includes("低風險") || label.includes("突破")) return "text-emerald-300";
  if (label.includes("等") || label.includes("觀察") || label.includes("接近")) return "text-yellow-300";
  if (label.includes("過熱") || label.includes("不追") || label.includes("爆量")) return "text-orange-300";
  if (label.includes("不建議") || label.includes("跌破") || label.includes("停損") || label.includes("減少") || label.includes("出場") || label.includes("退潮")) return "text-red-300";
  return "text-slate-300";
}

function alertTone(level: AlertLevel) {
  if (level === "紅燈") return "text-red-300";
  if (level === "黃燈") return "text-yellow-300";
  return "text-emerald-300";
}

function alertBg(level: AlertLevel) {
  if (level === "紅燈") return "border-red-500/40 bg-red-950/20 shadow-[0_0_30px_rgba(239,68,68,0.18)]";
  if (level === "黃燈") return "border-yellow-500/40 bg-yellow-950/20 shadow-[0_0_30px_rgba(234,179,8,0.14)]";
  return "border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_30px_rgba(16,185,129,0.14)]";
}

function neonPanel(extra = "") {
  return `rounded-[2rem] border border-cyan-400/30 bg-slate-950/80 shadow-[0_0_35px_rgba(34,211,238,0.12)] ${extra}`;
}
function directionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  if (direction === "hold") return "text-yellow-300";
  return "text-cyan-300";
}

function directionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
  if (direction === "hold") return "⚠ 保留上一筆";
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

  if (stock.stableNote && stock.stableNote !== "正常更新") {
    score -= 10;
    warnings.push(stock.stableNote);
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
function makeAlert(
  stock: Stock,
  level: AlertLevel,
  type: AlertItem["type"],
  message: string,
  priority: number
): AlertItem {
  return {
    id: `${stock.code}-${type}`,
    level,
    type,
    code: stock.code,
    name: stockDisplayName(stock),
    industry: stock.industry,
    message,
    price: stock.price,
    priority,
    updatedAt: stock.updatedAt || nowText(),
  };
}

function buildStockAlerts(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  moneyHistory: Record<string, MoneyHistory>,
  position?: Position,
  isFavorite = false,
  industryStatus = "觀察中"
): AlertItem[] {
  const alerts: AlertItem[] = [];
  const moneyLabel = moneyTrendLabel(stock, moneyHistory);
  const entry = entryPlan(stock, list, mainIndustries, settings, moneyHistory, industryStatus);
  const chase = chaseRisk(stock, list, settings);
  const pv = priceVolumeState(stock, list, settings);
  const decision = decisionText(stock, list, mainIndustries, settings, moneyHistory);
  const atrLine = entry.atrLine;

  if (entry.level === "可進場觀察") {
    alerts.push(makeAlert(stock, "綠燈", "低風險進場", `可進場觀察｜買點 ${formatPrice(entry.buyLow)}～${formatPrice(entry.buyHigh)}`, 65));
  }

  if (stock.price < stock.openPrice) {
    alerts.push(makeAlert(stock, "紅燈", "跌破開盤", `跌破開盤價 ${formatPrice(stock.openPrice)}，先降低追價。`, 95));
  }

  if (stock.price >= stock.openPrice && afterOpenPercent(stock) >= 1) {
    alerts.push(makeAlert(stock, "綠燈", "突破開盤", `站上開盤價，開盤後漲幅 ${formatPercent(afterOpenPercent(stock))}`, 45));
  }

  if (chase === "追高風險高") {
    alerts.push(makeAlert(stock, "紅燈", "追高風險", "追高風險高，避免看到漲就追。", 90));
  } else if (chase === "追高風險中") {
    alerts.push(makeAlert(stock, "黃燈", "追高風險", "追高風險中，等回測再考慮。", 55));
  }

  if (pv === "爆量不漲") {
    alerts.push(makeAlert(stock, "紅燈", "爆量不漲", "成交金額放大但股價不強，防主力出貨。", 88));
  }

  if (moneyLabel === "資金開始減少") {
    alerts.push(makeAlert(stock, "紅燈", "資金減少", "資金開始減少，先不要加碼。", 86));
  }

  if (moneyLabel === "資金突然放大") {
    alerts.push(makeAlert(stock, "黃燈", "資金放大", "資金突然放大，確認股價有沒有跟上。", 60));
  }

  if (moneyLabel === "資金慢慢增加") {
    alerts.push(makeAlert(stock, "綠燈", "資金放大", "資金慢慢增加，可加入觀察。", 58));
  }

  if (stock.price < atrLine) {
    alerts.push(makeAlert(stock, "紅燈", "跌破ATR", `跌破 ATR 線 ${formatPrice(atrLine)}，保護本金或獲利。`, 92));
  }

  if (stock.price >= entry.firstProfit) {
    alerts.push(makeAlert(stock, "黃燈", "第一停利", `到第一停利 ${formatPrice(entry.firstProfit)}，可考慮分批。`, 72));
  }

  if (decision === "主線核心") {
    alerts.push(makeAlert(stock, "綠燈", "主線核心", "主線核心股，量價與產業方向相對強。", 62));
  }

  if (industryStatus === "主線退潮") {
    alerts.push(makeAlert(stock, "紅燈", "主線退潮", "產業主線退潮，降低出手。", 84));
  }

  if (isFavorite && (stock.price < stock.openPrice || stock.price < atrLine || moneyLabel === "資金開始減少")) {
    alerts.push(makeAlert(stock, "紅燈", "自選警報", "自選股出現轉弱警訊，請檢查。", 89));
  }

  if (stock.stableNote && stock.stableNote !== "正常更新") {
    alerts.push(makeAlert(stock, "黃燈", "自選警報", `資料保護：${stock.stableNote}`, 66));
  }

  if (position?.buyPrice && position.buyPrice > 0) {
    const pnlPercent = ((stock.price - position.buyPrice) / position.buyPrice) * 100;

    if (pnlPercent <= -3 || stock.price < atrLine) {
      alerts.push(makeAlert(stock, "紅燈", "持倉停損", `持倉損益 ${formatPercent(pnlPercent)}，觸發停損警戒。`, 98));
    }

    if (pnlPercent >= 5) {
      alerts.push(makeAlert(stock, "黃燈", "持倉停利", `持倉獲利 ${formatPercent(pnlPercent)}，可分批停利。`, 76));
    }
  }

  return alerts;
}

function alertSummaryText(alerts: AlertItem[]) {
  const red = alerts.filter((a) => a.level === "紅燈").length;
  const yellow = alerts.filter((a) => a.level === "黃燈").length;
  const green = alerts.filter((a) => a.level === "綠燈").length;

  if (red > 0) return `紅燈 ${red} 個，先處理風險。`;
  if (green > 0) return `綠燈 ${green} 個，可觀察機會。`;
  if (yellow > 0) return `黃燈 ${yellow} 個，等待確認。`;
  return "目前沒有重大警報。";
}

function homeMainDecision(marketMode: string, redCount: number, greenCount: number) {
  if (redCount >= 5) return "風險偏高，先不要急著進場";
  if (marketMode === "可進攻" || marketMode === "9:10實戰可觀察") return "可觀察機會，但只做低風險";
  if (greenCount > 0) return "有機會，但要等買點";
  return "只觀察，不硬做";
}

function homeActionText(redCount: number, entryGoodCount: number, avoidCount: number) {
  if (redCount > 0) return "先看不要碰清單，再看綠燈機會。";
  if (entryGoodCount > 0) return "先看今日只看這幾檔，到買點才小部位。";
  if (avoidCount > 0) return "警報偏多，今天先保守。";
  return "沒有明確主線，先等下一次更新。";
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

function makeSopSteps(openStatus: string, entryGoodCount: number, alertRedCount: number, entryWaitCount: number, snapshot: Open910Snapshot | null): SopStep[] {
  const before910 = openStatus.includes("開盤前") || openStatus.includes("9:10前");
  const canTrade = openStatus.includes("可進入");

  return [
    {
      title: "先看今日作戰結論",
      status: alertRedCount > 0 ? "禁止" : "做",
      detail: alertRedCount > 0 ? `目前有 ${alertRedCount} 個紅燈，先處理風險。` : "先確認今天是可進攻、只觀察，還是風險偏高。",
    },
    {
      title: "9:00～9:10 先等待",
      status: before910 ? "等" : "做",
      detail: before910 ? "只看資料有沒有更新，不急著買。" : "已過9:10，開始看實戰候選。",
    },
    {
      title: "9:10後先鎖定快照",
      status: snapshot ? "做" : canTrade ? "等" : "等",
      detail: snapshot ? `已鎖定 ${snapshot.createdAt}` : "9:10後會自動快照，也可以手動鎖定。",
    },
    {
      title: "只看今日重點股票",
      status: entryGoodCount > 0 ? "做" : "等",
      detail: entryGoodCount > 0 ? `目前有 ${entryGoodCount} 檔可進場觀察。` : "沒有低風險候選就不要硬做。",
    },
    {
      title: "等回測再進不追高",
      status: entryWaitCount > 0 ? "等" : "做",
      detail: entryWaitCount > 0 ? `${entryWaitCount} 檔要等回測，不能看到漲就追。` : "目前等待回測名單較少。",
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

function klineAverage(candles: KlineCandle[], days: number) {
  const part = candles.slice(-days);
  if (part.length === 0) return 0;
  return part.reduce((sum, item) => sum + item.close, 0) / part.length;
}

function klineAtr(candles: KlineCandle[]) {
  const part = candles.slice(-14);
  if (part.length === 0) return 0;

  const avgRange =
    part.reduce((sum, item) => {
      return sum + Math.max(item.high - item.low, item.close * 0.01);
    }, 0) / part.length;

  return avgRange;
}

function klineSignal(stock: Stock, candles: KlineCandle[], entry: EntryPlan): KlineSignal {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  const ma5 = klineAverage(candles, 5);
  const ma10 = klineAverage(candles, 10);
  const atr = klineAtr(candles);

  const lastClose = last?.close || stock.price;
  const lastOpen = last?.open || stock.openPrice || stock.price;
  const prevClose = prev?.close || stock.previousClose || stock.price;

  const buyLow = entry.buyLow;
  const buyHigh = entry.buyHigh;
  const stopLine = entry.stopPrice;
  const atrLine = Math.max(0, (last?.high || stock.highPrice || stock.price) - atr * 1.5);

  const isRedK = lastClose >= lastOpen;
  const aboveMa5 = ma5 > 0 && lastClose >= ma5;
  const aboveMa10 = ma10 > 0 && lastClose >= ma10;
  const maStrong = ma5 >= ma10;
  const tooFar = ma5 > 0 && ((lastClose - ma5) / ma5) * 100 >= 5;
  const weakBreak = ma10 > 0 && lastClose < ma10;
  const stopBreak = lastClose < stopLine || lastClose < atrLine;
  const nearBuy = lastClose >= buyLow && lastClose <= buyHigh * 1.015;
  const pullbackOk = lastClose >= stopLine && lastClose >= prevClose * 0.985;

  let action: KlineSignal["action"] = "觀察";
  let tone = "text-yellow-300";
  let reason = "K線尚未給出明確訊號。";

  if (stopBreak || weakBreak) {
    action = "跌破出場";
    tone = "text-red-300";
    reason = "跌破停損線、ATR線或MA10，優先保護本金。";
  } else if (tooFar || entry.level === "不建議進場") {
    action = "不追高";
    tone = "text-orange-300";
    reason = tooFar ? "現價離MA5太遠，容易回測，不追高。" : "進場條件不足，不建議進場。";
  } else if (nearBuy && aboveMa5 && maStrong && isRedK && pullbackOk) {
    action = "可進場";
    tone = "text-emerald-300";
    reason = "價格在買點區附近，站上MA5且MA5高於MA10。";
  } else if (lastClose > buyHigh || !nearBuy) {
    action = "等回測";
    tone = "text-yellow-300";
    reason = "尚未回到理想買點區，等回測靠近買點。";
  }

  const maText =
    ma5 > 0 && ma10 > 0
      ? ma5 >= ma10
        ? "MA5站上MA10，短線偏強"
        : "MA5低於MA10，短線偏弱"
      : "均線資料不足";

  return {
    action,
    tone,
    reason,
    maText,
    buyLow,
    buyHigh,
    stopLine,
    atrLine: atrLine || entry.atrLine,
  };
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

  let dangerText = "目前無明顯持倉危險。";

  if (!hasPosition) {
    dangerText = "尚未建立個人風控。";
  } else if (pnlPercent < 0) {
    dangerText = "成本以下不建議攤平加倉。";
  } else if (pnlPercent >= 5) {
    dangerText = "已進入保護獲利區。";
  }

  if (exit.includes("跌破") || exit.includes("出場")) dangerText = `警戒：${exit}`;
  if (stock.stableNote && stock.stableNote !== "正常更新") dangerText = `資料保護：${stock.stableNote}`;

  return {
    hasPosition,
    buyPrice,
    shares,
    pnlPercent,
    pnlAmount,
    atrLine,
    action,
    dangerText,
    buyText: hasPosition ? `你的買進價 ${formatPrice(buyPrice)}，目前損益 ${formatPercent(pnlPercent)}。` : "尚未輸入買進價，先看理想買點。",
    stopText: exit,
    profitText: stock.price < atrLine ? "跌破ATR線，獲利需保護。" : "用ATR移動停利，不猜最高點。",
    addText: pv === "量價同步" && chase !== "追高風險高" ? "量價同步，可觀察是否小幅加倉。" : "尚未達加倉條件。",
  };
}

function NeonPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={neonPanel(`p-4 ${className}`)}>{children}</section>;
}

function ActionCard({ title, sub, badge, tone, onClick }: { title: string; sub: string; badge: string | number; tone: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[1.6rem] border border-slate-700/80 bg-slate-950/90 p-4 text-left shadow-[0_0_22px_rgba(15,23,42,0.8)] active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-black text-white">{title}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
        </div>
        <div className={`rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-lg font-black ${tone}`}>{badge}</div>
      </div>
    </button>
  );
}

function DetailRow({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-black/35 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className={`mt-1 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}
type ActiveEtfInfo = {
  etfCode: string;
  etfName: string;
  issuer: string;
  mode: "mock" | "real" | string;
  status: string;
  fetchStatus?: string;
  sourceUrl?: string;
  sourceName?: string;
  lastFetchAt?: string;
  note: string;
  usableForTrading?: boolean;
  dataLevel?: string;
  confidence?: number;
  realFetchEnabled?: boolean;
};

type ActiveEtfHolding = {
  etfCode: string;
  etfName: string;
  code: string;
  name: string;
  industry: string;
  todayWeight: number;
  yesterdayWeight: number;
};

type ActiveEtfFlow = {
  code: string;
  name: string;
  industry: string;
  addEtfCount: number;
  cutEtfCount: number;
  weightChange: number;
  status: "強加碼" | "小加碼" | "強減碼" | "小減碼" | "新買進" | "清倉";
  detail: string[];
};

const ACTIVE_ETF_HOLDINGS: ActiveEtfHolding[] = [
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
type NextDayCandidate = {
  stock: Stock;
  score: number;
  level: "高機率候選" | "觀察候選";
  reasons: string[];
  warning: string;
};

function toNumSafe(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getStockRisePercent(stock: any) {
  return (
    toNumSafe(stock.changePercent) ||
    toNumSafe(stock.changeRate) ||
    toNumSafe(stock.percent) ||
    toNumSafe(stock.rate) ||
    toNumSafe(stock.z) ||
    0
  );
}

function getStockVolumeRatio(stock: any) {
  return (
    toNumSafe(stock.volumeRatio) ||
    toNumSafe(stock.volRatio) ||
    toNumSafe(stock.volumeRate) ||
    toNumSafe(stock.amountRatio) ||
    1
  );
}

function getStockCloseStrength(stock: any) {
  const price =
    toNumSafe(stock.price) ||
    toNumSafe(stock.close) ||
    toNumSafe(stock.lastPrice) ||
    toNumSafe(stock.tradePrice);

  const high =
    toNumSafe(stock.high) ||
    toNumSafe(stock.dayHigh) ||
    price;

  if (!price || !high) return 0.95;
  return Math.min(1, price / high);
}

function getStockAmountValue(stock: any) {
  return (
    toNumSafe(stock.amount) ||
    toNumSafe(stock.tradeValue) ||
    toNumSafe(stock.value) ||
    toNumSafe(stock.volume) ||
    0
  );
}

function buildNextDayCandidates(stocks: Stock[] = []) {
  const list = (stocks || [])
    .map((stock) => {
      const rise = getStockRisePercent(stock);
      const volumeRatio = getStockVolumeRatio(stock);
      const closeStrength = getStockCloseStrength(stock);
      const amount = getStockAmountValue(stock);

      let score = 0;
      const reasons: string[] = [];

      if (rise >= 2 && rise <= 7) {
        score += 25;
        reasons.push("漲幅 2%～7%，強勢但未過熱");
      } else if (rise > 0 && rise < 2) {
        score += 10;
        reasons.push("小漲轉強，列觀察");
      } else if (rise > 7) {
        score -= 25;
        reasons.push("漲幅過大，隔日追高風險");
      } else {
        score -= 30;
        reasons.push("今日未轉強");
      }

      if (volumeRatio >= 1.3 && volumeRatio <= 3.5) {
        score += 20;
        reasons.push(`量能放大 ${volumeRatio.toFixed(1)} 倍`);
      } else if (volumeRatio > 3.5) {
        score -= 10;
        reasons.push("爆量過熱，防隔日拉回");
      } else {
        score += 5;
        reasons.push("量能普通，需等隔日確認");
      }

      if (closeStrength >= 0.97) {
        score += 20;
        reasons.push("收盤接近最高，尾盤偏強");
      } else if (closeStrength >= 0.94) {
        score += 10;
        reasons.push("收盤位置尚可");
      } else {
        score -= 15;
        reasons.push("收盤離高點遠，疑似尾盤轉弱");
      }

      if ((stock as any).industry && (stock as any).industry !== "其他") {
        score += 10;
        reasons.push(`產業：${(stock as any).industry}`);
      }

      if (amount > 0) {
        score += 5;
        reasons.push("有成交金額支撐");
      }

const warning =
  rise >= 6.5
    ? "隔天若開高超過 3%，不買不追；等回測 5日線或分K站穩。"
    : "隔天先看 9:10 後是否站穩；開高超過 3% 不追。";

      return {
        stock,
        score: Math.max(0, Math.min(100, Math.round(score))),
        level: score >= 80 ? "高機率候選" : "觀察候選",
        reasons: reasons.slice(0, 4),
        warning,
      } as NextDayCandidate;
    })
    .filter((item) => {
      const rise = getStockRisePercent(item.stock);
      return item.score >= 60 && rise > 0 && rise <= 8.5;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return list;
}
type FiveDayBreakAlert = {
  stock: Stock;
  price: number;
  ma5: number;
  score: number;
  reason: string;
};

function getStockPriceValue(stock: any) {
  return (
    toNumSafe(stock.price) ||
    toNumSafe(stock.close) ||
    toNumSafe(stock.lastPrice) ||
    toNumSafe(stock.tradePrice) ||
    toNumSafe(stock.currentPrice) ||
    0
  );
}

function getCloseFromKlineItem(item: any) {
  return (
    toNumSafe(item?.close) ||
    toNumSafe(item?.c) ||
    toNumSafe(item?.price) ||
    toNumSafe(item?.lastPrice) ||
    toNumSafe(item?.tradePrice) ||
    0
  );
}

function getStockKlineList(stock: any) {
  const list =
    stock?.dailyK ||
    stock?.dailyKline ||
    stock?.kline ||
    stock?.klines ||
    stock?.candles ||
    stock?.history ||
    stock?.prices ||
    stock?.chart ||
    [];

  return Array.isArray(list) ? list : [];
}

function calcMaFromKline(stock: any, days = 5) {
  const list = getStockKlineList(stock);
  if (!list.length) return 0;

  const closes = list
    .map((item) => getCloseFromKlineItem(item))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (closes.length < days) return 0;

  const last = closes.slice(-days);
  const sum = last.reduce((acc, value) => acc + value, 0);
  return sum / days;
}

function getStockMa5Value(stock: any) {
  const directMa5 =
    toNumSafe(stock.ma5) ||
    toNumSafe(stock.avg5) ||
    toNumSafe(stock.ma_5) ||
    toNumSafe(stock.fiveMa) ||
    toNumSafe(stock.movingAverage5) ||
    toNumSafe(stock.ma?.ma5) ||
    toNumSafe(stock.ma?.m5) ||
    0;

  if (directMa5 > 0) return directMa5;

  return calcMaFromKline(stock, 5);
}

function getStockPrevCloseValue(stock: any) {
  const directPrevClose =
    toNumSafe(stock.prevClose) ||
    toNumSafe(stock.previousClose) ||
    toNumSafe(stock.yesterdayClose) ||
    toNumSafe(stock.refPrice) ||
    0;

  if (directPrevClose > 0) return directPrevClose;

  const list = getStockKlineList(stock);
  if (list.length >= 2) {
    const prev = getCloseFromKlineItem(list[list.length - 2]);
    if (prev > 0) return prev;
  }

  return 0;
}
function normalizeKlineRows(data: any) {
  const rows =
    data?.candles ||
    data?.klines ||
    data?.kline ||
    data?.dailyK ||
    data?.dailyKline ||
    data?.data ||
    data?.rows ||
    data?.chart ||
    [];

  if (!Array.isArray(rows)) return [];

  return rows
    .map((item) => ({
      date: item?.date || item?.t || item?.time || item?.d || "",
      open: toNumSafe(item?.open || item?.o),
      high: toNumSafe(item?.high || item?.h),
      low: toNumSafe(item?.low || item?.l),
      close: toNumSafe(item?.close || item?.c || item?.price),
      volume: toNumSafe(item?.volume || item?.v),
    }))
    .filter((item) => item.close > 0);
}

async function fetchDailyKlineForMa5(code: string) {
  try {
    const res = await fetch(`/api/kline?code=${encodeURIComponent(code)}&days=20&v=98`, {
      cache: "no-store",
    });

    if (!res.ok) return [];

    const data = await res.json();
    return normalizeKlineRows(data);
  } catch {
    return [];
  }
}
function buildFiveDayBreakAlerts(stocks: Stock[] = []) {
  return (stocks || [])
    .map((stock) => {
      const price = getStockPriceValue(stock);
      const ma5 = getStockMa5Value(stock);
      const prevClose = getStockPrevCloseValue(stock);
      const rise = getStockRisePercent(stock);
      const volumeRatio = getStockVolumeRatio(stock);

      const hasMa5 = ma5 > 0;
      const nowAboveMa5 = hasMa5 && price > ma5;
      const wasBelowOrNearMa5 = prevClose > 0 ? prevClose <= ma5 * 1.01 : true;
      const notTooHot = rise > 0 && rise <= 7.5;

      let score = 0;
      if (nowAboveMa5) score += 40;
      if (wasBelowOrNearMa5) score += 25;
      if (notTooHot) score += 20;
      if (volumeRatio >= 1.5 && volumeRatio <= 3.5) {
  score += 20;
} else if (volumeRatio >= 1.2) {
  score += 10;
} else {
  score -= 20;
}

      return {
        stock,
        price,
        ma5,
        score,
        reason:
  price > 0 && ma5 > 0
    ? `現價 ${price.toFixed(2)} 站上 5日線 ${ma5.toFixed(2)}｜量比 ${volumeRatio.toFixed(1)}`
    : "尚未取得完整 5日線資料",
      } as FiveDayBreakAlert;
    })
    .filter((item) => {
      const rise = getStockRisePercent(item.stock);
      return item.ma5 > 0 && item.price > item.ma5 && item.score >= 80 && rise > 0 && rise <= 7.5 && getStockVolumeRatio(item.stock) >= 1.2;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
function buildActiveEtfFlows(list: ActiveEtfHolding[] = ACTIVE_ETF_HOLDINGS): ActiveEtfFlow[] {
  const map = new Map<string, ActiveEtfFlow>();

  list.forEach((item) => {
    const diff = item.todayWeight - item.yesterdayWeight;
    if (diff === 0) return;

    const old = map.get(item.code) || {
      code: item.code,
      name: item.name,
      industry: item.industry,
      addEtfCount: 0,
      cutEtfCount: 0,
      weightChange: 0,
      status: "小加碼" as ActiveEtfFlow["status"],
      detail: [],
    };

    old.weightChange += diff;

    if (item.yesterdayWeight === 0 && item.todayWeight > 0) {
      old.addEtfCount += 1;
      old.detail.push(`${item.etfName} 新買進 ${item.todayWeight.toFixed(2)}%`);
    } else if (item.todayWeight === 0 && item.yesterdayWeight > 0) {
      old.cutEtfCount += 1;
      old.detail.push(`${item.etfName} 清倉 ${item.yesterdayWeight.toFixed(2)}%`);
    } else if (diff > 0) {
      old.addEtfCount += 1;
      old.detail.push(`${item.etfName} 加碼 +${diff.toFixed(2)}%`);
    } else {
      old.cutEtfCount += 1;
      old.detail.push(`${item.etfName} 減碼 ${diff.toFixed(2)}%`);
    }

    map.set(item.code, old);
  });

  return Array.from(map.values())
    .map((item) => {
      let status: ActiveEtfFlow["status"] = "小加碼";
      if (item.detail.some((text) => text.includes("新買進"))) status = "新買進";
      else if (item.detail.some((text) => text.includes("清倉"))) status = "清倉";
      else if (item.weightChange >= 0.8) status = "強加碼";
      else if (item.weightChange > 0) status = "小加碼";
      else if (item.weightChange <= -0.8) status = "強減碼";
      else status = "小減碼";

      return { ...item, status };
    })
    .sort((a, b) => Math.abs(b.weightChange) - Math.abs(a.weightChange));
}

function activeEtfTone(status: ActiveEtfFlow["status"]) {
  if (status.includes("加碼") || status === "新買進") return "text-red-300";
  return "text-emerald-300";
}
function DataBadge({ stock }: { stock: Stock }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
      <span className="rounded-full border border-cyan-400/20 bg-cyan-950/30 px-2 py-1 text-cyan-200">
        {sourceLabel(stock.priceSource)}
      </span>
      <span className={`rounded-full border border-white/10 bg-black/30 px-2 py-1 ${dataFreshTone(stock.updatedAt)}`}>
        {dataFreshText(stock.updatedAt)}｜{stock.updatedAt || "--"}
      </span>
      {stock.stableNote && stock.stableNote !== "正常更新" && (
        <span className="rounded-full border border-yellow-400/30 bg-yellow-950/30 px-2 py-1 text-yellow-200">
          {stock.stableNote}
        </span>
      )}
    </div>
  );
}
function ModalShell({ title, sub, children, onClose, z = 90 }: { title: string; sub?: string; children: ReactNode; onClose: () => void; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/85 px-3 py-6 backdrop-blur-sm" style={{ zIndex: z }} onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[2rem] border border-cyan-400/30 bg-slate-950 p-4 shadow-[0_0_45px_rgba(34,211,238,0.18)]" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-4 -mt-4 rounded-t-[2rem] border-b border-cyan-400/20 bg-slate-950/95 px-4 py-3 backdrop-blur">
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
  const bg =
    step.status === "做"
      ? "border-emerald-500/40 bg-emerald-950/20"
      : step.status === "等"
        ? "border-yellow-500/40 bg-yellow-950/20"
        : "border-red-500/40 bg-red-950/20";

  return (
    <div className={`rounded-[1.6rem] border p-4 ${bg}`}>
      <div className={`text-sm font-black ${tone}`}>{step.status}</div>
      <div className="mt-1 text-lg font-black text-white">{step.title}</div>
      <div className="mt-2 text-sm font-bold text-slate-300">{step.detail}</div>
    </div>
  );
}

function AlertButton({ alert, onClick }: { alert: AlertItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full rounded-[1.6rem] border p-4 text-left active:scale-95 ${alertBg(alert.level)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-sm font-black ${alertTone(alert.level)}`}>{alert.level}｜{alert.type}</div>
          <div className="mt-1 text-xl font-black text-white">{alert.name}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{alert.code}｜{alert.industry}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-white">{formatPrice(alert.price)}</div>
          <div className="text-xs font-bold text-slate-400">{alert.updatedAt}</div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-200">{alert.message}</div>
    </button>
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
    <button onClick={onClick} className="w-full rounded-[1.4rem] border border-slate-800 bg-black/35 p-3 text-left active:scale-95">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-base font-black text-white">{stockDisplayName(stock)}</div>
          {reason && <div className="mt-1 text-xs font-bold text-slate-400">{reason}</div>}
          <DataBadge stock={stock} />
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
    <button onClick={onClick} className="w-full rounded-[1.7rem] border border-cyan-400/20 bg-slate-950/90 p-4 text-left shadow-[0_0_20px_rgba(34,211,238,0.08)] active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">{stock.code}｜{stock.industry}</div>
          <div className="mt-1 text-xl font-black text-white">{stockDisplayName(stock)}</div>
          <div className={`mt-1 text-sm font-black ${entryTone(plan.level)}`}>{plan.level}｜分數 {plan.score}</div>
          <DataBadge stock={stock} />
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
    <button onClick={onClick} className="w-full rounded-[1.4rem] border border-slate-800 bg-black/35 p-3 text-left active:scale-95">
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

function FocusStockCard({
  stock,
  plan,
  alert,
  rank,
  onClick,
}: {
  stock: Stock;
  plan: EntryPlan;
  alert?: AlertItem;
  rank: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-[1.8rem] border border-emerald-400/40 bg-gradient-to-br from-emerald-950/40 to-slate-950 p-4 text-left shadow-[0_0_35px_rgba(16,185,129,0.16)] active:scale-95"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-emerald-300">FOCUS #{rank}</div>
          <div className="mt-1 text-2xl font-black text-white">{stockDisplayName(stock)}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{stock.code}｜{stock.industry}</div>
          <DataBadge stock={stock} />
        </div>

        <div className="text-right">
          <div className={stock.changePercent >= 0 ? "text-2xl font-black text-red-300" : "text-2xl font-black text-emerald-300"}>
            {formatPercent(stock.changePercent)}
          </div>
          <div className="text-xs font-black text-slate-400">{formatPrice(stock.price)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-black">
        <div className="rounded-2xl border border-emerald-400/20 bg-black/30 p-2 text-emerald-200">
          判斷<br />{plan.level}
        </div>
        <div className="rounded-2xl border border-cyan-400/20 bg-black/30 p-2 text-cyan-200">
          買點<br />{formatPrice(plan.buyLow)}
        </div>
        <div className="rounded-2xl border border-red-400/20 bg-black/30 p-2 text-red-200">
          停損<br />{formatPrice(plan.stopPrice)}
        </div>
      </div>

      {alert && (
        <div className={`mt-3 rounded-2xl border p-3 ${alertBg(alert.level)}`}>
          <div className={`text-xs font-black ${alertTone(alert.level)}`}>{alert.level}｜{alert.type}</div>
          <div className="mt-1 text-xs font-bold text-slate-200">{alert.message}</div>
        </div>
      )}
    </button>
  );
}

function AvoidStockCard({ alert, onClick }: { alert: AlertItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full rounded-[1.6rem] border p-4 text-left active:scale-95 ${alertBg(alert.level)}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black text-red-300">AVOID｜不要碰</div>
          <div className="mt-1 text-xl font-black text-white">{alert.name}</div>
          <div className="mt-1 text-xs font-bold text-slate-400">{alert.code}｜{alert.industry}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-black text-red-300">{alert.type}</div>
          <div className="text-xs font-black text-slate-400">{formatPrice(alert.price)}</div>
        </div>
      </div>
      <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-200">{alert.message}</div>
    </button>
  );
}

function QuickActionButton({
  title,
  sub,
  onClick,
}: {
  title: string;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-950/20 p-3 text-left shadow-[0_0_22px_rgba(34,211,238,0.08)] active:scale-95"
    >
      <div className="text-sm font-black text-cyan-100">{title}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
    </button>
  );
}
function KlineModal({
  stock,
  entry,
  onClose,
}: {
  stock: Stock;
  entry: EntryPlan;
  onClose: () => void;
}) {
  const [candles, setCandles] = useState<KlineCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadKline() {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${KLINE_API_URL}?code=${encodeURIComponent(stock.code)}&t=${Date.now()}`, {
        cache: "no-store",
      });

      const json = await response.json();

      if (!json.ok || !Array.isArray(json.candles) || json.candles.length === 0) {
        throw new Error(json.message || "K線資料不足");
      }

      setCandles(json.candles);
    } catch (err: any) {
      setMessage(err?.message || "K線載入失敗");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKline();
  }, [stock.code]);

  const chartData = candles.slice(-40);
  const last = chartData[chartData.length - 1];
  const prev = chartData[chartData.length - 2];

  const signal = klineSignal(stock, chartData, entry);

  const maxHigh = chartData.length
    ? Math.max(...chartData.map((c) => c.high), stock.price, signal.buyHigh, signal.stopLine, signal.atrLine)
    : stock.price;

  const minLow = chartData.length
    ? Math.min(...chartData.map((c) => c.low), stock.price, signal.buyLow, signal.stopLine, signal.atrLine)
    : stock.price;

  const maxVolume = chartData.length ? Math.max(...chartData.map((c) => c.volume), 1) : 1;

  const width = 340;
  const height = 260;
  const priceTop = 16;
  const priceHeight = 170;
  const volumeTop = 210;
  const volumeHeight = 38;
  const gap = Math.max(6, width / Math.max(chartData.length, 1));
  const candleWidth = Math.max(3, Math.min(8, gap * 0.55));

  function yPrice(price: number) {
    if (maxHigh === minLow) return priceTop + priceHeight / 2;
    return priceTop + ((maxHigh - price) / (maxHigh - minLow)) * priceHeight;
  }

  function yVolume(volume: number) {
    return volumeTop + volumeHeight - (volume / maxVolume) * volumeHeight;
  }

  const ma5 = chartData.map((_, index) => {
    const part = chartData.slice(Math.max(0, index - 4), index + 1);
    return part.reduce((sum, item) => sum + item.close, 0) / part.length;
  });

  const ma10 = chartData.map((_, index) => {
    const part = chartData.slice(Math.max(0, index - 9), index + 1);
    return part.reduce((sum, item) => sum + item.close, 0) / part.length;
  });

  const ma5Path = ma5
    .map((value, index) => {
      const x = index * gap + gap / 2;
      const y = yPrice(value);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const ma10Path = ma10
    .map((value, index) => {
      const x = index * gap + gap / 2;
      const y = yPrice(value);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const change = last && prev ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const trend = last && last.close >= last.open ? "日K收紅" : last ? "日K收黑" : "等待資料";

  const currentY = yPrice(stock.price);
  const buyLowY = yPrice(signal.buyLow);
  const buyHighY = yPrice(signal.buyHigh);
  const stopY = yPrice(signal.stopLine);
  const atrY = yPrice(signal.atrLine);

  return (
    <ModalShell title={`${stockDisplayName(stock)} K線訊號`} sub={`${stock.code}｜v66 進出場判斷`} onClose={onClose} z={150}>
      <section className={`rounded-[1.8rem] border border-cyan-500/40 bg-cyan-950/20 p-4 shadow-[0_0_28px_rgba(34,211,238,0.12)] ${signal.tone}`}>
        <div className="text-xs font-black text-slate-400">K線實戰結論</div>
        <div className="mt-1 text-4xl font-black">{signal.action}</div>
        <div className="mt-2 text-sm font-bold leading-6 text-slate-300">{signal.reason}</div>
      </section>
      <section className="mt-4 rounded-[1.8rem] border border-slate-700 bg-black/40 p-3">
        {loading && <div className="p-8 text-center text-sm font-black text-cyan-300">K線載入中...</div>}

        {!loading && message && (
          <div className="p-8 text-center">
            <div className="text-lg font-black text-red-300">{message}</div>
            <button onClick={loadKline} className="mt-4 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-black text-white">
              重新載入
            </button>
          </div>
        )}

        {!loading && !message && chartData.length > 0 && (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full">
            <rect
              x="0"
              y={Math.min(buyLowY, buyHighY)}
              width={width}
              height={Math.max(2, Math.abs(buyHighY - buyLowY))}
              fill="rgba(34,211,238,0.12)"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth="1"
            />

            <line x1="0" y1={currentY} x2={width} y2={currentY} stroke="#ffffff" strokeWidth="1.4" strokeDasharray="5 4" />
            <line x1="0" y1={stopY} x2={width} y2={stopY} stroke="#f87171" strokeWidth="1.5" strokeDasharray="6 4" />
            <line x1="0" y1={atrY} x2={width} y2={atrY} stroke="#fb923c" strokeWidth="1.5" strokeDasharray="6 4" />

            <line x1="0" y1={yPrice(maxHigh)} x2={width} y2={yPrice(maxHigh)} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
            <line x1="0" y1={yPrice(minLow)} x2={width} y2={yPrice(minLow)} stroke="rgba(148,163,184,0.25)" strokeWidth="1" />
            <line x1="0" y1={volumeTop} x2={width} y2={volumeTop} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />

            {chartData.map((candle, index) => {
              const x = index * gap + gap / 2;
              const openY = yPrice(candle.open);
              const closeY = yPrice(candle.close);
              const highY = yPrice(candle.high);
              const lowY = yPrice(candle.low);
              const isUp = candle.close >= candle.open;
              const bodyY = Math.min(openY, closeY);
              const bodyH = Math.max(2, Math.abs(closeY - openY));
              const stroke = isUp ? "#fca5a5" : "#6ee7b7";
              const fill = isUp ? "rgba(248,113,113,0.45)" : "rgba(52,211,153,0.45)";
              const volumeY = yVolume(candle.volume);
              const volumeH = volumeTop + volumeHeight - volumeY;

              return (
                <g key={`${candle.time}-${index}`}>
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={stroke} strokeWidth="1.5" />
                  <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyH} rx="1" fill={fill} stroke={stroke} strokeWidth="1" />
                  <rect x={x - candleWidth / 2} y={volumeY} width={candleWidth} height={Math.max(1, volumeH)} fill={fill} />
                </g>
              );
            })}

            {ma5Path && <path d={ma5Path} fill="none" stroke="#fde047" strokeWidth="1.7" />}
            {ma10Path && <path d={ma10Path} fill="none" stroke="#38bdf8" strokeWidth="1.7" />}

            <text x="4" y="12" fill="#94a3b8" fontSize="10">
              高 {formatPrice(maxHigh)}
            </text>
            <text x="4" y={priceTop + priceHeight + 12} fill="#94a3b8" fontSize="10">
              低 {formatPrice(minLow)}
            </text>
            <text x="235" y={currentY - 4} fill="#ffffff" fontSize="10">
              現價 {formatPrice(stock.price)}
            </text>
            <text x="235" y={stopY - 4} fill="#f87171" fontSize="10">
              停損 {formatPrice(signal.stopLine)}
            </text>
            <text x="235" y={atrY - 4} fill="#fb923c" fontSize="10">
              ATR {formatPrice(signal.atrLine)}
            </text>
            <text x="4" y={Math.min(buyLowY, buyHighY) - 4} fill="#67e8f9" fontSize="10">
              買點區 {formatPrice(signal.buyLow)}～{formatPrice(signal.buyHigh)}
            </text>
          </svg>
        )}
      </section>
      <section className="mt-4 grid grid-cols-2 gap-2">
        <DetailRow label="K線狀態" value={trend} tone={last && last.close >= last.open ? "text-red-300" : "text-emerald-300"} />
        <DetailRow label="日漲跌" value={formatPercent(change)} tone={change >= 0 ? "text-red-300" : "text-emerald-300"} />
        <DetailRow label="MA5 / MA10" value={signal.maText} tone={signal.maText.includes("偏強") ? "text-emerald-300" : "text-yellow-300"} />
        <DetailRow label="K線分數" value={`${entry.score} 分`} tone={entry.score >= 68 ? "text-emerald-300" : entry.score >= 45 ? "text-yellow-300" : "text-red-300"} />
        <DetailRow label="買點區" value={`${formatPrice(signal.buyLow)}～${formatPrice(signal.buyHigh)}`} tone="text-cyan-300" />
        <DetailRow label="停損線" value={formatPrice(signal.stopLine)} tone="text-red-300" />
        <DetailRow label="ATR移動線" value={formatPrice(signal.atrLine)} tone="text-orange-300" />
        <DetailRow label="現價" value={formatPrice(stock.price)} tone="text-white" />
      </section>

      <section className="mt-4 rounded-[1.6rem] border border-yellow-500/30 bg-yellow-950/20 p-4">
        <div className="text-lg font-black text-yellow-100">20項實戰提醒</div>
        <div className="mt-2 text-sm font-bold leading-6 text-slate-300">
          1. 現價在買點區附近才考慮。<br />
          2. 站上 MA5 且 MA5 高於 MA10，短線較強。<br />
          3. 離 MA5 太遠，不追高。<br />
          4. 跌破停損線，先保護本金。<br />
          5. 跌破 ATR 移動線，先減碼觀察。<br />
          6. 跌破 MA10，短線轉弱。<br />
          7. 長紅但量能不足，容易回測。<br />
          8. 紅K加量較健康。<br />
          9. 黑K跌破均線要小心。<br />
          10. 回測不破買點區才是低風險。<br />
          11. 追高風險高時只觀察。<br />
          12. 第一停利用分批，不猜最高點。<br />
          13. ATR線往上移，停利跟著上移。<br />
          14. 產業不是主線，部位要小。<br />
          15. 紅燈警報出現，先不要加碼。<br />
          16. 爆量不漲要防出貨。<br />
          17. 資金減少時先保守。<br />
          18. 可進場不等於一定會漲。<br />
          19. 等回測比追高安全。<br />
          20. 停損價到了就照紀律。
        </div>
      </section>
    </ModalShell>
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
  alerts,
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
  onOpenKline,
}: {
  stock: Stock;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  moneyHistory: Record<string, MoneyHistory>;
  industryStatus: string;
  position?: Position;
  alerts: AlertItem[];
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
  onOpenKline: (code: string) => void;
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
      <div className="rounded-[1.8rem] border border-cyan-400/30 bg-gradient-to-br from-slate-950 to-cyan-950/30 p-4 shadow-[0_0_32px_rgba(34,211,238,0.15)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-cyan-300">REALTIME PRICE</div>
            <div className="mt-1 text-4xl font-black text-white">{formatPrice(stock.price)}</div>
          </div>

          <div className="text-right">
            <div className={stock.changePercent >= 0 ? "text-3xl font-black text-red-300" : "text-3xl font-black text-emerald-300"}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className={`mt-1 text-xs font-bold ${dataFreshTone(stock.updatedAt)}`}>
              {dataFreshText(stock.updatedAt)}｜{stock.updatedAt || lastSuccessAt || "--"}
            </div>
          </div>
        </div>

        <DataBadge stock={stock} />
      </div>

      {alerts.length > 0 && (
        <section className="mt-3 rounded-[1.6rem] border border-red-500/40 bg-red-950/20 p-4 shadow-[0_0_30px_rgba(239,68,68,0.16)]">
          <div className="text-lg font-black text-red-100">這檔警報</div>
          <div className="mt-3 space-y-2">
            {alerts.slice(0, 5).map((item) => (
              <div key={item.id} className={`rounded-2xl border p-3 ${alertBg(item.level)}`}>
                <div className={`text-sm font-black ${alertTone(item.level)}`}>{item.level}｜{item.type}</div>
                <div className="mt-1 text-sm font-bold text-slate-200">{item.message}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className={`mt-3 rounded-[1.6rem] border border-emerald-500/40 bg-emerald-950/20 p-4 ${entryTone(entry.level)}`}>
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

      <section className="mt-3 rounded-[1.6rem] border border-cyan-500/40 bg-cyan-950/20 p-4">
        <div className="text-lg font-black text-cyan-100">輸入我的持倉</div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <input
            value={buyPriceText}
            onChange={(e) => setBuyPriceText(e.target.value)}
            placeholder="我的買進價"
            inputMode="decimal"
            className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none"
          />
          <input
            value={sharesText}
            onChange={(e) => setSharesText(e.target.value)}
            placeholder="張數，可不填"
            inputMode="decimal"
            className="rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-black text-white outline-none"
          />
        </div>

        <input
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="備註，可不填"
          className="mt-2 w-full rounded-2xl border border-slate-700 bg-black/40 px-3 py-3 text-base font-bold text-white outline-none"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={saveMyPosition} className="rounded-2xl bg-cyan-500 py-3 text-sm font-black text-white">
            儲存我的買點
          </button>
          <button onClick={() => onDeletePosition(stock.code)} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
            刪除買點
          </button>
        </div>
      </section>

      <section className={`mt-3 rounded-[1.6rem] bg-black/30 p-4 ${riskTone(plan.action)}`}>
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
      <section className="mt-3 rounded-[1.6rem] border border-emerald-500/40 bg-emerald-950/20 p-4">
        <div className="text-lg font-black text-emerald-100">資金增減趨勢</div>
        <div className={`mt-2 text-2xl font-black ${moneyTrendTone(moneyLabel)}`}>{moneyLabel}</div>
        <div className="mt-2 text-sm font-bold text-emerald-100">
          成交金額：{formatAmount(moneyData.prevAmount)} → {formatAmount(moneyData.nowAmount)}
          <br />
          金額變化：{formatPercent(moneyData.amountChangePercent)}
        </div>
      </section>

      <section className={`mt-3 rounded-[1.6rem] bg-black/30 p-4 ${directionTone(direction)}`}>
        <div className="text-xs font-bold text-slate-400">即時股價穩定狀態</div>
        <div className="mt-1 text-xl font-black">{directionText(direction)}</div>
        <div className="mt-2 text-sm font-bold text-slate-300">
          {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          <br />
          主線結論：{decision}
          <br />
          資料來源：{sourceLabel(stock.priceSource)}
          <br />
          穩定保護：{stock.stableNote || "正常更新"}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            onClose();
            setTimeout(() => onOpenKline(stock.code), 80);
          }}
          className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200"
        >
          📈 K線20項訊號
        </button>

        <button
          onClick={() => (isWatch ? onRemoveWatch(stock.code) : onAddWatch(stock.code))}
          className={`rounded-2xl py-3 text-sm font-black ${isWatch ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"}`}
        >
          {isWatch ? "📌 移除觀察" : "📌 加入觀察"}
        </button>

        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`col-span-2 rounded-2xl py-3 text-sm font-black ${isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"}`}
        >
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
  const [activeEtfHoldings, setActiveEtfHoldings] = useState<ActiveEtfHolding[]>(ACTIVE_ETF_HOLDINGS);
  const [activeEtfSource, setActiveEtfSource] = useState("前端示範資料");
  const [activeEtfList, setActiveEtfList] = useState<ActiveEtfInfo[]>([]);
  const [activeEtfUpdatedAt, setActiveEtfUpdatedAt] = useState("");
  const [activeEtfUsableForTrading, setActiveEtfUsableForTrading] = useState(false);
  const [activeEtfDataLevel, setActiveEtfDataLevel] = useState("MOCK_ONLY");
  const [activeEtfConfidence, setActiveEtfConfidence] = useState(0);
  const [activeEtfWarning, setActiveEtfWarning] = useState("尚未取得主動ETF實戰狀態。");
  const [tab, setTab] = useState<TabKey>("home");
  const [popup, setPopup] = useState<PopupKey>("");
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedKlineCode, setSelectedKlineCode] = useState("");
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
  const ma5KlineCodes = useMemo(() => {
  return top50.slice(0, 10).map((item) => item.code).join(",");
}, [top50]);

const [ma5KlineMap, setMa5KlineMap] = useState<Record<string, any[]>>({});
useEffect(() => {
  const codes = ma5KlineCodes.split(",").filter(Boolean);
  if (!codes.length) return;

  let cancelled = false;

  async function loadMa5Klines() {
    const result: Record<string, any[]> = {};

    await Promise.all(
      codes.map(async (code) => {
        const rows = await fetchDailyKlineForMa5(code);
        if (rows.length >= 5) {
          result[code] = rows;
        }
      })
    );

    if (!cancelled) {
      setMa5KlineMap((prev) => ({
        ...prev,
        ...result,
      }));
    }
  }

  loadMa5Klines();

  return () => {
    cancelled = true;
  };
}, [ma5KlineCodes]);
  const nextDayCandidates = useMemo(() => {
  return buildNextDayCandidates(top50);
}, [top50]);
const top50WithMa5Kline = useMemo(() => {
  return top50.map((stock) => ({
    ...stock,
    dailyK: ma5KlineMap[stock.code] || (stock as any).dailyK || (stock as any).kline || [],
  }));
}, [top50, ma5KlineMap]);

const fiveDayBreakAlerts = useMemo(() => {
  return buildFiveDayBreakAlerts(top50WithMa5Kline);
}, [top50WithMa5Kline]);
const mergedNextDayWatchList = useMemo(() => {
  const ma5Items = fiveDayBreakAlerts.map((item) => ({
    code: item.stock.code,
    name: stockDisplayName(item.stock),
    industry: item.stock.industry || "其他",
    score: item.score + 8,
    tag: "5日線突破",
    reason: item.reason,
    warning: "剛突破不等於立刻買；明天 9:10 後看量能與分K是否站穩。",
    stock: item.stock,
  }));

  const nextDayItems = nextDayCandidates.map((item) => ({
    code: item.stock.code,
    name: stockDisplayName(item.stock),
    industry: item.stock.industry || "其他",
    score: item.score,
    tag: item.level,
    reason: item.reasons.join("、"),
    warning: item.warning,
    stock: item.stock,
  }));

  return Array.from(
    new Map([...ma5Items, ...nextDayItems].map((item) => [item.code, item])).values()
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}, [fiveDayBreakAlerts, nextDayCandidates]);
const isAfterCloseMode = useMemo(() => {
  const now = new Date();
  return now.getHours() > 13 || (now.getHours() === 13 && now.getMinutes() >= 30);
}, []);
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

  const selectedKlineStock = useMemo(
    () => stocks.find((s) => s.code === selectedKlineCode) || searchHistory.find((s) => s.code === selectedKlineCode) || null,
    [stocks, searchHistory, selectedKlineCode]
  );

  const selectedKlineEntry = useMemo(() => {
    if (!selectedKlineStock) return null;

    return entryPlan(
      selectedKlineStock,
      top50.length > 0 ? top50 : [selectedKlineStock],
      mainIndustries,
      settings,
      moneyHistory,
      stockIndustryStatus(selectedKlineStock)
    );
  }, [selectedKlineStock, top50, mainIndustries, settings, moneyHistory, industryRanking]);

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

  const allAlerts = useMemo(() => {
    return top50
      .flatMap((stock) =>
        buildStockAlerts(
          stock,
          top50,
          mainIndustries,
          settings,
          moneyHistory,
          positions[stock.code],
          favoriteCodes.includes(stock.code),
          stockIndustryStatus(stock)
        )
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 80);
  }, [top50, mainIndustries, settings, moneyHistory, positions, favoriteCodes, industryRanking]);

  const redAlerts = useMemo(() => allAlerts.filter((a) => a.level === "紅燈"), [allAlerts]);
  const yellowAlerts = useMemo(() => allAlerts.filter((a) => a.level === "黃燈"), [allAlerts]);
  const greenAlerts = useMemo(() => allAlerts.filter((a) => a.level === "綠燈"), [allAlerts]);

  const avoidAlerts = useMemo(
    () =>
      allAlerts
        .filter((alert) => alert.level === "紅燈")
        .filter((alert) => ["跌破開盤", "追高風險", "爆量不漲", "資金減少", "跌破ATR", "主線退潮"].includes(alert.type))
        .slice(0, 10),
    [allAlerts]
  );

  const openStatus = open910Status();

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

  const marketMode = useMemo(() => {
    if (!top50.length) return "等待資料";
    if (redAlerts.length >= 5 || moneyDownList.length >= 6 || failedList.length >= 6) return "風險偏高";
    if (entryGoodList.length >= 3 && openStatus.includes("可進入")) return "9:10實戰可觀察";
    if (entryGoodList.length >= 2) return "可進攻";
    return "只觀察";
  }, [top50, redAlerts, moneyDownList, failedList, entryGoodList, openStatus]);

  const marketModeTone =
    marketMode === "可進攻" || marketMode === "9:10實戰可觀察"
      ? "text-emerald-300"
      : marketMode === "風險偏高"
        ? "text-red-300"
        : "text-yellow-300";

  const homeDecision = homeMainDecision(marketMode, redAlerts.length, greenAlerts.length);
  const homeAction = homeActionText(redAlerts.length, entryGoodList.length, avoidAlerts.length);

  const sopSteps = useMemo(
    () => makeSopSteps(openStatus, entryGoodList.length, redAlerts.length, entryWaitList.length, snapshot),
    [openStatus, entryGoodList.length, redAlerts.length, entryWaitList.length, snapshot]
  );

  const nowAction = homeAction;

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

  const focusRows = useMemo(() => {
    return entryRows
      .filter((row) => row.plan.level === "可進場觀察" || row.plan.level === "等回測再進")
      .filter((row) => !redAlerts.some((alert) => alert.code === row.stock.code && ["跌破開盤", "追高風險", "爆量不漲", "資金減少", "跌破ATR"].includes(alert.type)))
      .slice(0, 5);
  }, [entryRows, redAlerts]);

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
    let totalCost = 0;
    let totalMarketValue = 0;
    let totalPnl = 0;
    let todayPnl = 0;

    Object.values(positions).forEach((p) => {
      const stock = stocks.find((s) => s.code === p.code) || searchHistory.find((s) => s.code === p.code);
      if (!stock || p.buyPrice <= 0 || p.shares <= 0) return;

      const sharesUnit = p.shares * 1000;
      const cost = p.buyPrice * sharesUnit;
      const marketValue = stock.price * sharesUnit;
      const pnl = marketValue - cost;
      const dayPnl = (stock.price - stock.previousClose) * sharesUnit;

      totalCost += cost;
      totalMarketValue += marketValue;
      totalPnl += pnl;
      todayPnl += dayPnl;
    });

    const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const todayPnlPercent = totalCost > 0 ? (todayPnl / totalCost) * 100 : 0;

    return {
      count: Object.values(positions).length,
      totalCost,
      totalMarketValue,
      totalPnl,
      todayPnl,
      totalPnlPercent,
      todayPnlPercent,
    };
  }, [positions, stocks, searchHistory]);

  const bestPosition = positionRows.length ? [...positionRows].sort((a, b) => b.pnlPercent - a.pnlPercent)[0] : null;
  const dangerPosition = positionRows.length ? positionRows.find((row) => row.action.includes("停損") || row.action.includes("出場") || row.action.includes("減少")) || positionRows[0] : null;

  const topIndustry = industryRanking[0];
  const totalAmount = top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0);

  const protectedCount = useMemo(() => stocks.filter((stock) => stock.stableNote && stock.stableNote !== "正常更新").length, [stocks]);
  const twseCount = useMemo(() => stocks.filter((stock) => stock.priceSource?.includes("TWSE")).length, [stocks]);
  const yahooCount = useMemo(() => stocks.filter((stock) => stock.priceSource?.includes("Yahoo")).length, [stocks]);
  const snapshotPickRate = useMemo(
    () => (snapshot ? snapshotSuccessRate(snapshot.picks, stocks, searchHistory, "可觀察") : { total: 0, done: 0, success: 0, rate: 0 }),
    [snapshot, stocks, searchHistory]
  );

  const snapshotAvoidRate = useMemo(
    () => (snapshot ? snapshotSuccessRate(snapshot.avoids, stocks, searchHistory, "不要碰") : { total: 0, done: 0, success: 0, rate: 0 }),
    [snapshot, stocks, searchHistory]
  );

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
  async function loadActiveEtf() {
  try {
    const response = await fetch(`${ACTIVE_ETF_API_URL}?t=${Date.now()}`, {
      cache: "no-store",
    });

    const json = await response.json();

    if (!json.ok || !Array.isArray(json.holdings)) {
      throw new Error("主動ETF API 回傳格式錯誤");
    }

    setActiveEtfHoldings(json.holdings);
    setActiveEtfSource(json.source || "api/active-etf");
    setActiveEtfList(Array.isArray(json.etfs) ? json.etfs : []);
    setActiveEtfUpdatedAt(json.updatedAt || "");
    setActiveEtfUsableForTrading(Boolean(json.usableForTrading));
    setActiveEtfDataLevel(json.dataLevel || "MOCK_ONLY");
    setActiveEtfConfidence(Number(json.confidence || 0));
    setActiveEtfWarning(json.warning || json.message || "尚未解析真實持股權重。");
  } catch {
    setActiveEtfHoldings(ACTIVE_ETF_HOLDINGS);
    setActiveEtfSource("API失敗，使用前端示範資料");
    setActiveEtfList([]);
    setActiveEtfUpdatedAt("");
    setActiveEtfUsableForTrading(false);
    setActiveEtfDataLevel("API_FAILED");
    setActiveEtfConfidence(0);
    setActiveEtfWarning("API 失敗，目前只能使用前端示範資料，不可當成真實ETF加減碼。");
  }
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

      const normalizedRaw = list
        .map((raw: any) => normalizeStock(raw, dataTime))
        .filter((stock: Stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);

      if (normalizedRaw.length === 0) throw new Error("API回傳空資料");

      const normalized = stableMergeList(normalizedRaw, stocks).sort((a: Stock, b: Stock) => b.changePercent - a.changePercent);

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock: Stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (stock.stableNote && stock.stableNote !== "正常更新") nextDirections[stock.code] = "hold";
        else if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "api/realtime";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCache(false);

      updateMoneyHistory(normalized);

      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          stocks: normalized,
          lastSuccessAt: successTime,
          apiDataTime: dataTime,
          source: dataSource,
        })
      );
    } catch (err: any) {
      setUsingCache(true);
      setError(err?.message || "資料更新失敗，已保留上次成功資料");
    } finally {
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  async function refreshOneStock(code: string) {
    const raw = String(code || "").trim();
    const onlyCode = cleanCode(raw);
    const q = onlyCode || raw;

    if (!q) return null;

    try {
      const response = await fetch(`${SEARCH_API_URL}?q=${encodeURIComponent(q)}&t=${Date.now()}`, { cache: "no-store" });
      const json = await response.json();

      if (!json.ok || !json.stock) return null;

      const rawStock = normalizeStock(json.stock, json.stock.updatedAt || json.updatedAtTaiwan || nowText());
      const oldStock = stocks.find((item) => item.code === rawStock.code) || searchHistory.find((item) => item.code === rawStock.code);
      const stock = stableMergeStock(rawStock, oldStock);

            setStocks((old) => {
        const exists = old.some((item) => item.code === stock.code);

        const next = exists
          ? old.map((item) => {
              if (item.code !== stock.code) return item;
              return stableMergeStock(stock, item);
            })
          : [stock, ...old];

        return next.sort((a, b) => b.changePercent - a.changePercent);
      });

      setSearchHistory((old) => {
        const next = Array.from(
          new Map([{ ...stock, name: stockDisplayName(stock) }, ...old].map((item) => [item.code, item])).values()
        ).slice(0, 20);

        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
        return next;
      });

      setPreviousPriceMap((old) => ({
        ...old,
        [stock.code]: lastPriceMap[stock.code] || stock.price,
      }));

      setLastPriceMap((old) => {
        const oldPrice = old[stock.code];

        setPriceDirections((directionOld) => ({
          ...directionOld,
          [stock.code]:
            stock.stableNote && stock.stableNote !== "正常更新"
              ? "hold"
              : oldPrice === undefined
                ? "new"
                : stock.price > oldPrice
                  ? "up"
                  : stock.price < oldPrice
                    ? "down"
                    : "same",
        }));

        return {
          ...old,
          [stock.code]: stock.price,
        };
      });

      setLastSuccessAt(nowText());
      return stock;
    } catch {
      return null;
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

      const stock = await refreshOneStock(q);

      if (!stock) {
        setQueryMessage("查無資料，請確認代號或名稱。");
        return;
      }

      setSelectedCode(stock.code);
      setQueryMessage(`已查到 ${stock.code} ${stockDisplayName(stock)}`);
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
    loadActiveEtf();
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

    favoriteCodes.forEach((code) => {
      refreshOneStock(code);
    });

    const timer = window.setInterval(() => {
      favoriteCodes.forEach((code) => {
        refreshOneStock(code);
      });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [favoriteCodes.join(",")]);
  useEffect(() => {
    if (!selectedCode) return;

    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      await refreshOneStock(selectedCode);
    };

    run();

    const timer = window.setInterval(() => {
      run();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selectedCode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      const taiwan = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Taipei" }));

      const hh = taiwan.getHours();
      const mm = taiwan.getMinutes();
      const today = todayKey();
      const autoKey = `auto-snapshot-${today}`;

      const alreadyDone = localStorage.getItem(autoKey);

      if (hh === 9 && mm === 10 && !alreadyDone && top50.length > 0) {
        const next: Open910Snapshot = {
          id: `${today}-${Date.now()}`,
          dateKey: today,
          createdAt: nowText(),
          topIndustries: mainIndustries.slice(0, 3),
          top50: top50.map((stock) =>
            toSnapshotStock(stock, "前50", decisionText(stock, top50, mainIndustries, settings, moneyHistory))
          ),
          picks: entryGoodList.map((row) => toSnapshotStock(row.stock, "可觀察", row.plan.reason)),
          avoids: entryBadList.map((row) => toSnapshotStock(row.stock, "不要碰", row.plan.warning)),
        };

        setSnapshot(next);
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
        localStorage.setItem(autoKey, "done");
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [top50, mainIndustries, entryGoodList, entryBadList, settings, moneyHistory]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_28%),radial-gradient(circle_at_90%_15%,rgba(239,68,68,0.14),transparent_25%),radial-gradient(circle_at_50%_90%,rgba(16,185,129,0.12),transparent_30%)]" />

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-36 pt-10">
        <header className="rounded-[2rem] border border-cyan-400/30 bg-slate-950/80 p-5 shadow-[0_0_45px_rgba(34,211,238,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[0.25em] text-cyan-300">TW STOCK RADAR v70</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">盤中主線雷達</h1>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
                K線20項訊號｜買點區｜停損線｜ATR移動線｜MA5 / MA10
              </p>
            </div>

            <button
              onClick={() => loadStocks()}
              className="shrink-0 rounded-[1.4rem] border border-red-400/40 bg-red-500/20 px-4 py-3 text-sm font-black text-red-100 shadow-[0_0_25px_rgba(239,68,68,0.25)] active:scale-95"
            >
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-[2rem] border border-cyan-400/30 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 p-5 shadow-[0_0_45px_rgba(34,211,238,0.16)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black tracking-[0.2em] text-cyan-300">MAIN DECISION</div>
              <div className={`mt-2 text-5xl font-black ${marketModeTone}`}>{marketMode}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-right">
              <div className="text-xs font-bold text-slate-500">狀態</div>
              <div className={`mt-1 text-sm font-black ${open910Tone(openStatus)}`}>{openStatus}</div>
            </div>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-cyan-400/20 bg-black/35 p-4">
            <div className="text-xs font-bold text-slate-500">現在動作</div>
            <div className="mt-1 text-2xl font-black text-white">{homeDecision}</div>
            <div className="mt-2 text-sm font-bold text-slate-300">{homeAction}</div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <DetailRow label="最強主線" value={topIndustry ? topIndustry.industry : "--"} tone="text-yellow-300" />
            <DetailRow label="TWSE即時" value={`${twseCount} 檔`} tone="text-cyan-300" />
            <DetailRow label="Yahoo補價" value={`${yahooCount} 檔`} tone="text-blue-300" />
            <DetailRow label="保護中" value={`${protectedCount} 檔`} tone={protectedCount > 0 ? "text-yellow-300" : "text-emerald-300"} />
          </div>
        </section>
        <section className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-red-400/40 bg-red-950/25 p-4 text-left shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <div className="text-xs font-black text-red-300">RED</div>
            <div className="mt-1 text-4xl font-black text-red-200">{redAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">先避開</div>
          </button>

          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-yellow-400/40 bg-yellow-950/20 p-4 text-left shadow-[0_0_30px_rgba(234,179,8,0.12)]">
            <div className="text-xs font-black text-yellow-300">YELLOW</div>
            <div className="mt-1 text-4xl font-black text-yellow-200">{yellowAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">等確認</div>
          </button>

          <button onClick={() => setPopup("alerts")} className="rounded-[1.5rem] border border-emerald-400/40 bg-emerald-950/20 p-4 text-left shadow-[0_0_30px_rgba(16,185,129,0.12)]">
            <div className="text-xs font-black text-emerald-300">GREEN</div>
            <div className="mt-1 text-4xl font-black text-emerald-200">{greenAlerts.length}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">可觀察</div>
          </button>
        </section>

        <section className="mt-4 rounded-[1.8rem] border border-blue-400/30 bg-blue-950/20 p-4 shadow-[0_0_28px_rgba(59,130,246,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-blue-100">
                即時狀態：{updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：{settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-yellow-300">
                {protectedCount > 0 ? `防跳價保護中：${protectedCount} 檔` : "防跳價保護：正常"}
              </div>
            </div>

            <div className="text-right text-xs font-bold text-cyan-300">
              {source || "api/realtime"}<br />
              {formatAmount(totalAmount)}
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-4 gap-2">
          <QuickActionButton title="快照" sub="9:10鎖定" onClick={createSnapshot} />
          <QuickActionButton title="SOP" sub="開盤流程" onClick={() => setPopup("sop")} />
          <QuickActionButton title="進場" sub="候選清單" onClick={() => setPopup("entry")} />
          <QuickActionButton title="查詢" sub="全個股" onClick={() => setPopup("search")} />
        </section>

        <section ref={contentRef} className="mt-4 scroll-mt-4">
          {tab === "home" && (
            <div className="space-y-4">
<div className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs font-black text-cyan-300">NEXT DAY MASTER LIST</div>
      <div className="mt-1 text-2xl font-black text-white">明日優先觀察合併排序</div>
      <div className="mt-1 text-sm font-bold leading-relaxed text-slate-300">
        合併「5日線突破」與「收盤後隔日強勢候選」，依分數排序。
      </div>
    </div>

    <div className="rounded-2xl bg-black/40 px-3 py-2 text-right">
      <div className="text-xs font-black text-slate-400">觀察</div>
      <div className="text-2xl font-black text-cyan-200">{mergedNextDayWatchList.length}</div>
    </div>
  </div>

  <div className="mt-3 space-y-2">
    {mergedNextDayWatchList.length === 0 && (
      <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">
        目前沒有明日優先觀察名單。
      </div>
    )}

    {mergedNextDayWatchList.slice(0, 5).map((item, index) => (
      <button
        key={item.code}
        onClick={() => setSelectedCode(item.code)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-slate-400">
              #{index + 1}｜{item.tag}
            </div>
            <div className="text-lg font-black text-white">
              {item.code} {item.name}
            </div>
            <div className="mt-1 text-xs font-bold text-cyan-200">
              {item.industry}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-black text-slate-400">總分</div>
            <div className="text-2xl font-black text-cyan-200">{item.score}</div>
          </div>
        </div>

        <div className="mt-2 text-xs font-bold text-slate-300">
          ・{item.reason}
        </div>

        <div className="mt-2 rounded-xl bg-yellow-400/10 p-2 text-xs font-black text-yellow-200">
          {item.warning}
        </div>
      </button>
    ))}
  </div>
</div>
<div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs font-black text-emerald-300">MA5 BREAK WATCH</div>
      <div className="mt-1 text-2xl font-black text-white">剛突破5日線提示</div>
      <div className="mt-1 text-sm font-bold leading-relaxed text-slate-300">
        僅做畫面提示，不跳通知；先確認有沒有取得 5日線資料，避免白畫面。
      </div>
    </div>

    <div className="rounded-2xl bg-black/40 px-3 py-2 text-right">
      <div className="text-xs font-black text-slate-400">突破</div>
      <div className="text-2xl font-black text-emerald-200">{fiveDayBreakAlerts.length}</div>
    </div>
  </div>

  <div className="mt-3 space-y-2">
    {fiveDayBreakAlerts.length === 0 && (
      <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">
        目前沒有偵測到剛突破 5日線的個股；系統已嘗試抓前 10 檔日K計算 ma5。
      </div>
    )}

    {fiveDayBreakAlerts.slice(0, 3).map((item, index) => (
      <button
        key={item.stock.code}
        onClick={() => setSelectedCode(item.stock.code)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-slate-400">
              #{index + 1}｜5日線突破
            </div>
            <div className="text-lg font-black text-white">
              {item.stock.code} {stockDisplayName(item.stock)}
            </div>
            <div className="mt-1 text-xs font-bold text-emerald-200">
              {item.reason}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-black text-slate-400">突破分數</div>
            <div className="text-2xl font-black text-emerald-200">{item.score}</div>
          </div>
        </div>

        <div className="mt-2 rounded-xl bg-yellow-400/10 p-2 text-xs font-black text-yellow-200">
          提醒：剛突破不等於立刻買，先看量能、分K是否站穩，開高過多不追。
        </div>
      </button>
    ))}
  </div>
</div>
        <div className="rounded-3xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-4">
  <div className="flex items-start justify-between gap-3">
    <div>
      <div className="text-xs font-black text-fuchsia-300">AFTER CLOSE RADAR</div>
      <div className="mt-1 text-2xl font-black text-white">收盤後隔日強勢候選</div>
      <div className="mt-1 text-sm font-bold leading-relaxed text-slate-300">
        {isAfterCloseMode
          ? "現在是收盤後模式：依漲幅、量能、收盤強度與產業強弱排序。"
          : "下午 1:30 後自動切換收盤後模式；盤中僅供預覽。"}
      </div>
    </div>

    <div className="rounded-2xl bg-black/40 px-3 py-2 text-right">
      <div className="text-xs font-black text-slate-400">候選</div>
      <div className="text-2xl font-black text-fuchsia-200">{nextDayCandidates.length}</div>
    </div>
  </div>

  <div className="mt-3 space-y-2">
    {nextDayCandidates.length === 0 && (
      <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">
        目前沒有符合條件的隔日強勢候選。
      </div>
    )}

    {nextDayCandidates.slice(0, 5).map((item, index) => (
      <button
        key={item.stock.code}
        onClick={() => setSelectedCode(item.stock.code)}
        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-black text-slate-400">
              #{index + 1}｜{item.level}
            </div>
            <div className="text-lg font-black text-white">
              {item.stock.code} {stockDisplayName(item.stock)}
            </div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {item.stock.industry || "其他"}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-black text-slate-400">隔日分數</div>
            <div className="text-2xl font-black text-fuchsia-200">{item.score}</div>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {item.reasons.map((reason) => (
            <div key={reason} className="text-xs font-bold text-slate-300">
              ・{reason}
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-xl bg-yellow-400/10 p-2 text-xs font-black text-yellow-200">
          {item.warning}
        </div>
      </button>
    ))}
  </div>
</div>
              <NeonPanel className="border-emerald-400/35 shadow-[0_0_38px_rgba(16,185,129,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black tracking-[0.18em] text-emerald-300">FOCUS LIST</div>
                    <h3 className="mt-1 text-2xl font-black text-white">今日只看這幾檔</h3>
                  </div>
                  <button onClick={() => setPopup("entry")} className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200">
                    看全部
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {focusRows.length === 0 && (
                    <div className="rounded-[1.5rem] border border-slate-700 bg-black/35 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確重點候選，先不要硬做。
                    </div>
                  )}

                  {focusRows.map((row, index) => {
                    const firstAlert = allAlerts.find((alert) => alert.code === row.stock.code);
                    return (
                      <FocusStockCard
                        key={row.stock.code}
                        stock={row.stock}
                        plan={row.plan}
                        alert={firstAlert}
                        rank={index + 1}
                        onClick={() => setSelectedCode(row.stock.code)}
                      />
                    );
                  })}
                </div>
              </NeonPanel>

              <NeonPanel className="border-red-400/35 shadow-[0_0_38px_rgba(239,68,68,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black tracking-[0.18em] text-red-300">AVOID LIST</div>
                    <h3 className="mt-1 text-2xl font-black text-white">不要碰清單</h3>
                  </div>
                  <button onClick={() => setPopup("avoid")} className="rounded-2xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200">
                    看全部
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {avoidAlerts.length === 0 && (
                    <div className="rounded-[1.5rem] border border-slate-700 bg-black/35 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯不要碰清單。
                    </div>
                  )}

                  {avoidAlerts.slice(0, 5).map((alert) => (
                    <AvoidStockCard key={alert.id} alert={alert} onClick={() => setSelectedCode(alert.code)} />
                  ))}
                </div>
              </NeonPanel>
            </div>
          )}
          {tab === "top50" && (
            <div className="space-y-3">
              {entryRows.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          )}
  {tab === "activeEtf" && (() => {
  const flows = buildActiveEtfFlows(activeEtfHoldings);
  const addList = flows.filter((item) => item.weightChange > 0);
  const cutList = flows.filter((item) => item.weightChange < 0);

  const industryMap = new Map<string, number>();
  addList.forEach((item) => {
    industryMap.set(item.industry, (industryMap.get(item.industry) || 0) + item.weightChange);
  });
  const hotIndustries = Array.from(industryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-cyan-400/30 bg-cyan-500/10 p-4">
        <div className="text-xs font-black text-cyan-300">ACTIVE ETF FLOW</div>
        <div className="mt-1 text-2xl font-black text-white">主動ETF加減碼雷達</div>
        <div className="mt-1 text-sm font-bold text-slate-300">
  v92 主動ETF資料來源等待版：目前已確認官方頁面會出現大量 ETF 清單，暫不解析為持股；等待官方 CSV / XLS / JSON 持股資料源。
</div>

<div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-3">
  <div className="text-xs font-black text-yellow-300">DATA STATUS</div>
  <div className="mt-1 text-sm font-black text-yellow-100">
    目前：v92 安全等待資料源｜尚未取得官方持股檔
  </div>
  <div className="mt-1 text-xs font-bold text-slate-300">
    用途：保留主動ETF雷達版面；目前僅供觀察流程，不當成真實加減碼依據。
  </div>
</div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">加碼股數</div>
            <div className="text-xl font-black text-red-300">{addList.length}</div>
          </div>
          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">減碼股數</div>
            <div className="text-xl font-black text-emerald-300">{cutList.length}</div>
          </div>
          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">追蹤ETF</div>
            <div className="text-xl font-black text-cyan-300">
              {new Set(activeEtfHoldings.map((x) => x.etfCode)).size}
            </div>
          </div>
        </div>
      </div>
      <div className={`rounded-3xl border p-4 ${
        activeEtfUsableForTrading
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-yellow-400/30 bg-yellow-500/10"
      }`}>
        <div className="text-xs font-black text-yellow-300">TRADING SAFETY</div>
        <div className="mt-1 text-2xl font-black text-white">主動ETF實戰安全狀態</div>

        <div className={`mt-2 text-3xl font-black ${
          activeEtfUsableForTrading ? "text-emerald-300" : "text-yellow-300"
        }`}>
          {activeEtfUsableForTrading ? "可實戰觀察" : "尚未可用"}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">資料等級</div>
            <div className="mt-1 text-sm font-black text-cyan-300">
  {activeEtfDataLevel === "MOCK_WITH_REAL_SOURCE_CHECK"
    ? "來源檢查中"
    : activeEtfDataLevel === "MOCK_ONLY"
      ? "示範資料"
      : activeEtfDataLevel === "REAL_PARSED"
        ? "真實已解析"
        : activeEtfDataLevel}
</div>
          </div>

          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">信心分數</div>
            <div className="mt-1 text-xl font-black text-yellow-300">{activeEtfConfidence}分</div>
          </div>

          <div className="rounded-2xl bg-black/30 p-3">
            <div className="text-xs font-bold text-slate-400">真實資料</div>
            <div className={`mt-1 text-sm font-black ${
              activeEtfUsableForTrading ? "text-emerald-300" : "text-red-300"
            }`}>
              {activeEtfUsableForTrading ? "已解析" : "未解析"}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-black/30 p-3 text-sm font-bold leading-6 text-slate-200">
          {activeEtfWarning}
        </div>

        {!activeEtfUsableForTrading && (
          <div className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-black text-red-200">
            提醒：目前尚未取得官方持股檔，主動ETF加減碼維持示範資料，不能當成真實買賣依據。
          </div>
        )}
      </div>
            <div className="rounded-3xl border border-blue-400/30 bg-blue-500/10 p-4">
        <div className="text-xs font-black text-blue-300">TRACKING ETF LIST</div>
        <div className="text-xl font-black text-white">追蹤中的主動ETF清單</div>
        <div className="mt-1 text-xs font-bold text-slate-400">
          更新時間：{activeEtfUpdatedAt ? new Date(activeEtfUpdatedAt).toLocaleString("zh-TW") : "--"}
        </div>

        <div className="mt-3 space-y-2">
          {activeEtfList.length === 0 && (
            <div className="rounded-2xl bg-black/30 p-3 text-sm font-bold text-slate-400">
              尚未取得 ETF 清單，先使用持股資料統計。
            </div>
          )}

          {activeEtfList.map((etf) => (
            <div key={etf.etfCode} className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-slate-400">{etf.issuer}</div>
                  <div className="mt-1 text-lg font-black text-white">
                    {etf.etfCode} {etf.etfName}
                  </div>
                  <div className="mt-1 text-xs font-bold text-slate-400">{etf.note}</div>

<div className="mt-2 grid grid-cols-2 gap-2 text-xs font-black">
  <div className="rounded-2xl bg-black/30 p-2 text-blue-200">
  來源<br />官方資料源等待中
</div>
  <div className="rounded-2xl bg-black/30 p-2 text-yellow-200">
  抓取狀態<br />等待官方持股檔
</div>
  <div className="col-span-2 rounded-2xl bg-black/30 p-2 text-slate-300">
    最後抓取<br />
    {etf.lastFetchAt ? new Date(etf.lastFetchAt).toLocaleString("zh-TW") : "--"}
  </div>
</div>
                </div>

                <div className="text-right">
                  <div className={etf.mode === "real" ? "text-sm font-black text-emerald-300" : "text-sm font-black text-yellow-300"}>
                    {etf.mode === "real" ? "REAL" : "MOCK"}
                  </div>
                  <div className="mt-1 text-xs font-black text-cyan-300">{etf.status}</div>
<div className="mt-1 text-[10px] font-black text-slate-400">
  {etf.mode === "real" ? "真實資料" : "等待官方檔"}
</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-4">
        <div className="text-xs font-black text-red-300">BUY MORE</div>
        <div className="text-xl font-black text-white">主動ETF今日加碼排行</div>

        <div className="mt-3 space-y-3">
          {addList.map((item, index) => (
            <button
              key={item.code}
              onClick={() => setQueryText(item.code)}
              className="w-full rounded-2xl border border-white/10 bg-black/35 p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-slate-400">#{index + 1}｜{item.industry}</div>
                  <div className="text-lg font-black text-white">{item.code} {item.name}</div>
                </div>
                <div className={`text-right text-lg font-black ${activeEtfTone(item.status)}`}>
                  +{item.weightChange.toFixed(2)}%
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-red-500/20 px-2 py-1 text-red-200">{item.status}</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">加碼ETF：{item.addEtfCount}</span>
              </div>

              <div className="mt-2 space-y-1 text-xs font-bold text-slate-300">
                {item.detail.map((text) => (
                  <div key={text}>・{text}</div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 p-4">
        <div className="text-xs font-black text-emerald-300">SELL / CUT</div>
        <div className="text-xl font-black text-white">主動ETF今日減碼排行</div>

        <div className="mt-3 space-y-3">
          {cutList.map((item, index) => (
            <button
              key={item.code}
              onClick={() => setQueryText(item.code)}
              className="w-full rounded-2xl border border-white/10 bg-black/35 p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-slate-400">#{index + 1}｜{item.industry}</div>
                  <div className="text-lg font-black text-white">{item.code} {item.name}</div>
                </div>
                <div className={`text-right text-lg font-black ${activeEtfTone(item.status)}`}>
                  {item.weightChange.toFixed(2)}%
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-emerald-200">{item.status}</span>
                <span className="rounded-full bg-white/10 px-2 py-1 text-slate-200">減碼ETF：{item.cutEtfCount}</span>
              </div>

              <div className="mt-2 space-y-1 text-xs font-bold text-slate-300">
                {item.detail.map((text) => (
                  <div key={text}>・{text}</div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-400/30 bg-yellow-500/10 p-4">
        <div className="text-xs font-black text-yellow-300">HOT INDUSTRY</div>
        <div className="text-xl font-black text-white">主動ETF資金流入產業</div>

        <div className="mt-3 space-y-2">
          {hotIndustries.map(([industry, value], index) => (
            <div key={industry} className="flex items-center justify-between rounded-2xl bg-black/30 p-3">
              <div className="font-black text-white">#{index + 1} {industry}</div>
              <div className="font-black text-red-300">+{value.toFixed(2)}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
})()}
                    
          {tab === "portfolio" && (
            <div className="space-y-4">
              <section className="rounded-[2rem] border border-cyan-400/30 bg-gradient-to-br from-slate-950 via-slate-950 to-cyan-950/30 p-5 shadow-[0_0_45px_rgba(34,211,238,0.16)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black tracking-[0.2em] text-cyan-300">MY PORTFOLIO</div>
                    <div className="mt-2 text-3xl font-black text-white">我的庫存股</div>
                    <div className="mt-2 text-sm font-bold text-slate-400">即時損益｜市值｜成本｜報酬率</div>
                  </div>

                  <button
                    onClick={() => setPopup("positions")}
                    className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-200"
                  >
                    編輯<br />庫存
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-3">
                    <div className="text-xs font-bold text-slate-500">今日損益</div>
                    <div className={`mt-1 text-2xl font-black ${positionStats.todayPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatAmount(positionStats.todayPnl)}
                    </div>
                    <div className={`mt-1 text-xs font-black ${positionStats.todayPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatPercent(positionStats.todayPnlPercent)}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-3">
                    <div className="text-xs font-bold text-slate-500">累積損益</div>
                    <div className={`mt-1 text-2xl font-black ${positionStats.totalPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatAmount(positionStats.totalPnl)}
                    </div>
                    <div className={`mt-1 text-xs font-black ${positionStats.totalPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                      {formatPercent(positionStats.totalPnlPercent)}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-black/35 p-3">
                    <div className="text-xs font-bold text-slate-500">股票市值</div>
                    <div className="mt-1 text-2xl font-black text-white">
                      {formatAmount(positionStats.totalMarketValue)}
                    </div>
                    <div className="mt-1 text-xs font-black text-slate-400">
                      成本 {formatAmount(positionStats.totalCost)}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-700 bg-slate-950/90 p-4 shadow-[0_0_35px_rgba(15,23,42,0.8)]">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-lg font-black text-white">庫存股</div>
                  <div className="text-xs font-black text-slate-400">{positionStats.count} 檔</div>
                </div>

                <div className="space-y-3">
                  {positionRows.length === 0 && (
                    <div className="rounded-[1.5rem] border border-slate-700 bg-black/35 p-6 text-center">
                      <div className="text-xl font-black text-slate-300">尚未建立庫存股</div>
                      <div className="mt-2 text-sm font-bold text-slate-500">
                        點個股 → 輸入我的持倉 → 儲存買點，就會出現在這裡。
                      </div>
                    </div>
                  )}

                  {positionRows.map((row) => {
                    const stock = row.stock;
                    const sharesUnit = row.position.shares * 1000;
                    const cost = row.position.buyPrice * sharesUnit;
                    const marketValue = stock.price * sharesUnit;
                    const totalPnl = marketValue - cost;
                    const todayPnl = (stock.price - stock.previousClose) * sharesUnit;
                    const totalPnlPercent = cost > 0 ? (totalPnl / cost) * 100 : 0;

                    return (
                      <button
                        key={stock.code}
                        onClick={() => setSelectedCode(stock.code)}
                        className="w-full rounded-[1.6rem] border border-slate-800 bg-black/35 p-4 text-left active:scale-95"
                      >
                        <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-3">
                          <div>
                            <div className="text-xs font-black text-orange-300">現股</div>
                            <div className="mt-1 text-xl font-black text-white">{stockDisplayName(stock)}</div>
                            <div className="mt-1 text-xs font-bold text-slate-400">{stock.code}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-500">今日損益</div>
                            <div className={`mt-1 text-xl font-black ${todayPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                              {formatAmount(todayPnl)}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-500">股價</div>
                            <div className={stock.changePercent >= 0 ? "mt-1 text-xl font-black text-red-300" : "mt-1 text-xl font-black text-emerald-300"}>
                              {formatPrice(stock.price)}
                            </div>
                            <div className={stock.changePercent >= 0 ? "text-xs font-black text-red-300" : "text-xs font-black text-emerald-300"}>
                              {formatPercent(stock.changePercent)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-black">
                          <div className="rounded-2xl bg-black/35 p-2 text-slate-300">
                            張數<br />{row.position.shares || 0}
                          </div>
                          <div className="rounded-2xl bg-black/35 p-2 text-yellow-300">
                            成本<br />{formatPrice(row.position.buyPrice)}
                          </div>
                          <div className={`rounded-2xl bg-black/35 p-2 ${totalPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                            總損益<br />{formatAmount(totalPnl)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-2xl bg-black/35 px-3 py-2">
                          <div className="text-xs font-bold text-slate-400">
                            市值 {formatAmount(marketValue)}｜成本 {formatAmount(cost)}
                          </div>
                          <div className={`text-sm font-black ${totalPnl >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                            {formatPercent(totalPnlPercent)}
                          </div>
                        </div>

                        <div className="mt-2 text-xs font-bold text-cyan-300">
                          點擊看個股資料 / K線20項訊號
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
          {tab === "favorite" && (
            <div className="space-y-3">
              {favoriteStocks.length === 0 && (
                <div className="rounded-[1.6rem] border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有自選股。
                </div>
              )}

              {favoriteStocks.map((stock) => {
                const firstAlert = allAlerts.find((alert) => alert.code === stock.code);

                return (
                  <SimpleStockButton
                    key={stock.code}
                    stock={stock}
                    label={firstAlert ? `${firstAlert.level}｜${firstAlert.type}` : "自選即時"}
                    tone={firstAlert ? alertTone(firstAlert.level) : "text-yellow-300"}
                    reason={firstAlert ? firstAlert.message : `更新：${stock.updatedAt || lastSuccessAt || "--"}`}
                    onClick={() => setSelectedCode(stock.code)}
                  />
                );
              })}
            </div>
          )}

          {tab === "more" && (
            <div className="grid grid-cols-2 gap-3">
              <ActionCard title="盤中警報中心" sub="紅黃綠燈排序" badge={allAlerts.length} tone="text-red-300" onClick={() => setPopup("alerts")} />
              <ActionCard title="不要碰清單" sub="先避開風險" badge={avoidAlerts.length} tone="text-red-300" onClick={() => setPopup("avoid")} />
              <ActionCard title="明日實戰SOP" sub="開盤流程" badge="📋" tone="text-cyan-300" onClick={() => setPopup("sop")} />
              <ActionCard title="9:10快照" sub="鎖定 / 驗證" badge="📌" tone="text-emerald-300" onClick={() => setPopup("snapshot")} />
              <ActionCard title="進場候選" sub="低風險買點" badge={entryGoodList.length} tone="text-emerald-300" onClick={() => setPopup("entry")} />
              <ActionCard title="資金慢慢增加" sub="個股資金增溫" badge={moneyUpList.length} tone="text-emerald-300" onClick={() => setPopup("moneyUp")} />
              <ActionCard title="資金減少警戒" sub="退潮 / 爆量不漲" badge={moneyDownList.length} tone="text-red-300" onClick={() => setPopup("moneyDown")} />
              <ActionCard title="產業強弱排行" sub="主線強弱集中看" badge={industryRanking.length} tone="text-yellow-300" onClick={() => setPopup("industry")} />
              <ActionCard title="持倉總表" sub="損益 / 停利 / 風險" badge={positionStats.count} tone="text-cyan-300" onClick={() => setPopup("positions")} />
              <ActionCard title="今日50強" sub="完整排行" badge={top50.length} tone="text-red-300" onClick={() => setPopup("top50")} />
              <ActionCard title="全個股查詢" sub="不限50強" badge="🔍" tone="text-cyan-300" onClick={() => setPopup("search")} />
              <ActionCard title="設定" sub="更新頻率" badge="⚙️" tone="text-purple-300" onClick={() => setPopup("settings")} />
            </div>
          )}
        </section>
      </div>
      {popup === "alerts" && (
        <ModalShell title="盤中實戰警報中心" sub="紅燈先處理，綠燈只代表觀察機會" onClose={() => setPopup("")}>
          <section className={`rounded-[1.8rem] border p-4 ${redAlerts.length > 0 ? "border-red-500/40 bg-red-950/20" : "border-emerald-500/40 bg-emerald-950/20"}`}>
            <div className="text-xs font-bold text-slate-300">警報摘要</div>
            <div className={`mt-1 text-2xl font-black ${redAlerts.length > 0 ? "text-red-300" : "text-emerald-300"}`}>
              {alertSummaryText(allAlerts)}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <DetailRow label="紅燈" value={`${redAlerts.length}`} tone="text-red-300" />
              <DetailRow label="黃燈" value={`${yellowAlerts.length}`} tone="text-yellow-300" />
              <DetailRow label="綠燈" value={`${greenAlerts.length}`} tone="text-emerald-300" />
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-red-100">紅燈警報</div>
            <div className="mt-3 space-y-3">
              {redAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有紅燈警報。</div>}
              {redAlerts.map((alert) => (
                <AlertButton key={alert.id} alert={alert} onClick={() => setSelectedCode(alert.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-yellow-100">黃燈警報</div>
            <div className="mt-3 space-y-3">
              {yellowAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有黃燈警報。</div>}
              {yellowAlerts.slice(0, 20).map((alert) => (
                <AlertButton key={alert.id} alert={alert} onClick={() => setSelectedCode(alert.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-emerald-100">綠燈觀察</div>
            <div className="mt-3 space-y-3">
              {greenAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有綠燈觀察。</div>}
              {greenAlerts.slice(0, 20).map((alert) => (
                <AlertButton key={alert.id} alert={alert} onClick={() => setSelectedCode(alert.code)} />
              ))}
            </div>
          </section>
        </ModalShell>
      )}

      {popup === "avoid" && (
        <ModalShell title="不要碰清單" sub="跌破開盤、追高風險、爆量不漲、資金減少" onClose={() => setPopup("")}>
          <section className="rounded-[1.8rem] border border-red-500/40 bg-red-950/20 p-4 shadow-[0_0_32px_rgba(239,68,68,0.16)]">
            <div className="text-xs font-bold text-red-300">先避開</div>
            <div className="mt-1 text-2xl font-black text-red-100">這些不是進場名單</div>
            <div className="mt-2 text-sm font-bold text-slate-300">出現紅燈時先保護本金，不要因為漲幅排行就追進去。</div>
          </section>

          <div className="mt-4 space-y-3">
            {avoidAlerts.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有明顯不要碰清單。</div>}
            {avoidAlerts.map((alert) => (
              <AvoidStockCard key={alert.id} alert={alert} onClick={() => setSelectedCode(alert.code)} />
            ))}
          </div>
        </ModalShell>
      )}

      {popup === "sop" && (
        <ModalShell title="明日實戰SOP" sub="照順序做，不追高、不硬買" onClose={() => setPopup("")}>
          <section className="rounded-[1.8rem] border border-cyan-500/40 bg-cyan-950/20 p-4">
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
          <section className="rounded-[1.8rem] border border-emerald-500/40 bg-emerald-950/20 p-4">
            <div className="text-xs font-bold text-emerald-300">提醒</div>
            <div className="mt-1 text-2xl font-black text-emerald-100">這不是保證買進</div>
            <div className="mt-2 text-sm font-bold text-slate-300">
              只代表條件相對安全。進場後仍要照停損價、ATR移動線、停利區執行。
            </div>
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
              {entryWaitList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有等待回測清單。</div>}
              {entryWaitList.map((row) => (
                <EntryStockButton key={row.stock.code} stock={row.stock} plan={row.plan} onClick={() => setSelectedCode(row.stock.code)} />
              ))}
            </div>
          </section>

          <section className="mt-4">
            <div className="text-lg font-black text-red-100">不建議進場</div>
            <div className="mt-3 space-y-3">
              {entryBadList.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">目前沒有不建議進場清單。</div>}
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
            <div className="rounded-[1.8rem] border border-yellow-500/40 bg-yellow-950/20 p-5">
              <div className="text-2xl font-black text-yellow-100">尚未鎖定快照</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                每天 09:10 會自動保存，也可以手動按下鎖定。
              </div>
              <button onClick={createSnapshot} className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-black text-white">
                鎖定快照
              </button>
            </div>
          )}

          {snapshot && (
            <>
              <section className="rounded-[1.8rem] border border-emerald-500/40 bg-emerald-950/20 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <DetailRow label="可觀察成功率" value={`${snapshotPickRate.rate.toFixed(0)}%`} tone="text-emerald-300" />
                  <DetailRow label="不要碰警報率" value={`${snapshotAvoidRate.rate.toFixed(0)}%`} tone="text-red-300" />
                </div>
              </section>

              <section className="mt-4">
                <div className="text-lg font-black text-emerald-100">快照可觀察</div>
                <div className="mt-3 space-y-3">
                  {snapshot.picks.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">快照沒有可觀察清單。</div>}
                  {snapshot.picks.map((item) => (
                    <SnapshotButton key={`${item.code}-pick`} item={item} current={snapshotCurrentStock(item, stocks, searchHistory)} onClick={() => setSelectedCode(item.code)} />
                  ))}
                </div>
              </section>

              <section className="mt-4">
                <div className="text-lg font-black text-red-100">快照不要碰</div>
                <div className="mt-3 space-y-3">
                  {snapshot.avoids.length === 0 && <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">快照沒有不要碰清單。</div>}
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
            {popupList(popup).length === 0 && (
              <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">
                目前沒有符合條件的股票。
              </div>
            )}

            {popupList(popup).map((stock) => {
              const firstAlert = allAlerts.find((alert) => alert.code === stock.code);
              const label = firstAlert
                ? `${firstAlert.level}｜${firstAlert.type}`
                : decisionText(stock, top50, mainIndustries, settings, moneyHistory);

              const tone = firstAlert
                ? alertTone(firstAlert.level)
                : riskTone(decisionText(stock, top50, mainIndustries, settings, moneyHistory));

              return (
                <SimpleStockButton
                  key={stock.code}
                  stock={stock}
                  label={label}
                  tone={tone}
                  reason={firstAlert ? firstAlert.message : `更新：${stock.updatedAt || lastSuccessAt || "--"}`}
                  onClick={() => setSelectedCode(stock.code)}
                />
              );
            })}
          </div>
        </ModalShell>
      )}

      {popup === "industry" && (
        <ModalShell title="產業主線強弱排行" sub="依資金、量能、強弱排序" onClose={() => setPopup("")}>
          <div className="space-y-3">
            {industryRanking.map((item, index) => (
              <button
                key={item.industry}
                onClick={() => setIndustryPopup(item.industry)}
                className="w-full rounded-[1.7rem] border border-cyan-400/20 bg-slate-950/90 p-4 text-left shadow-[0_0_20px_rgba(34,211,238,0.08)] active:scale-95"
              >
                <div className="text-xs font-bold text-slate-500">#{index + 1} 主線強弱排序</div>
                <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
                <div className={`mt-1 text-sm font-black ${riskTone(item.strength)}`}>
                  {item.light}｜{item.status}｜{item.strength}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">{item.reason}</div>
              </button>
            ))}
          </div>
        </ModalShell>
      )}

      {industryPopup && (
        <ModalShell title={`${industryPopup} 主線個股`} sub="該產業內資金排序" onClose={() => setIndustryPopup("")} z={110}>
          <div className="space-y-3">
            {industrySelectedList.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">
                目前沒有該產業股票。
              </div>
            )}

            {industrySelectedList.map((stock) => {
              const firstAlert = allAlerts.find((alert) => alert.code === stock.code);

              return (
                <SimpleStockButton
                  key={stock.code}
                  stock={stock}
                  label={firstAlert ? `${firstAlert.level}｜${firstAlert.type}` : decisionText(stock, top50, mainIndustries, settings, moneyHistory)}
                  tone={firstAlert ? alertTone(firstAlert.level) : riskTone(decisionText(stock, top50, mainIndustries, settings, moneyHistory))}
                  reason={firstAlert ? firstAlert.message : `更新：${stock.updatedAt || lastSuccessAt || "--"}`}
                  onClick={() => setSelectedCode(stock.code)}
                />
              );
            })}
          </div>
        </ModalShell>
      )}
      {popup === "positions" && (
        <ModalShell title="持倉總表風險雷達" sub="你的買進價、損益、停利、停損集中看" onClose={() => setPopup("")}>
          <div className="rounded-[1.8rem] border border-cyan-500/40 bg-cyan-950/20 p-4 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
            <div className="grid grid-cols-2 gap-2">
              <DetailRow label="持倉檔數" value={`${positionStats.count} 檔`} tone="text-cyan-300" />
              <DetailRow
                label="持倉總損益"
                value={formatAmount(positionStats.totalPnl)}
                tone={positionStats.totalPnl >= 0 ? "text-red-300" : "text-emerald-300"}
              />
              <DetailRow
                label="最賺股票"
                value={bestPosition ? `${stockDisplayName(bestPosition.stock)} ${formatPercent(bestPosition.pnlPercent)}` : "--"}
                tone="text-red-300"
              />
              <DetailRow
                label="最高風險"
                value={dangerPosition ? `${stockDisplayName(dangerPosition.stock)}｜${dangerPosition.action}` : "--"}
                tone="text-yellow-300"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {positionRows.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-6 text-center text-sm font-bold text-slate-400">
                目前還沒有輸入買進價。
              </div>
            )}

            {positionRows.map((row) => {
              const firstAlert = allAlerts.find((alert) => alert.code === row.stock.code);

              return (
                <SimpleStockButton
                  key={row.stock.code}
                  stock={row.stock}
                  label={firstAlert ? `${firstAlert.level}｜${firstAlert.type}` : row.action}
                  tone={firstAlert ? alertTone(firstAlert.level) : riskTone(row.action)}
                  reason={firstAlert ? firstAlert.message : row.danger}
                  onClick={() => setSelectedCode(row.stock.code)}
                />
              );
            })}
          </div>
        </ModalShell>
      )}

      {popup === "search" && (
        <ModalShell title="全個股查詢" sub="輸入代號或中文名稱" onClose={() => setPopup("")}>
          <div className="rounded-[1.8rem] border border-cyan-500/40 bg-cyan-950/20 p-4 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
            <div className="flex gap-2">
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchAnyStock();
                }}
                placeholder="例如 華邦電、群創、2330"
                className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
              />
              <button onClick={searchAnyStock} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-white">
                {queryLoading ? "查詢中" : "查詢"}
              </button>
            </div>

            {queryMessage && <div className="mt-3 text-sm font-bold text-yellow-200">{queryMessage}</div>}
          </div>

          <div className="mt-4 space-y-3">
            {searchHistory.length === 0 && (
              <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                尚無查詢紀錄。
              </div>
            )}

            {searchHistory.map((stock) => (
              <SimpleStockButton
                key={stock.code}
                stock={stock}
                label="查詢紀錄"
                tone="text-cyan-300"
                reason={`更新：${stock.updatedAt || lastSuccessAt || "--"}`}
                onClick={() => setSelectedCode(stock.code)}
              />
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
                  <button
                    key={String(value)}
                    onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value) })}
                    className={`rounded-2xl py-3 text-sm font-black ${
                      settings.refreshSeconds === Number(value)
                        ? "bg-cyan-500 text-white shadow-[0_0_24px_rgba(34,211,238,0.28)]"
                        : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setMoneyHistory({});
                localStorage.removeItem(MONEY_HISTORY_KEY);
              }}
              className="w-full rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200"
            >
              重置資金增減紀錄
            </button>

            <button onClick={clearSnapshot} className="w-full rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
              重置9:10快照
            </button>
          </div>
        </ModalShell>
      )}
      {selectedKlineStock && selectedKlineEntry && (
        <KlineModal
          stock={selectedKlineStock}
          entry={selectedKlineEntry}
          onClose={() => setSelectedKlineCode("")}
        />
      )}

      {selectedStock && (
        <>
          <div className="fixed right-4 top-24 z-[140] rounded-2xl border border-cyan-400/30 bg-black/80 px-3 py-2 text-xs font-black text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
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
            alerts={allAlerts.filter((alert) => alert.code === selectedStock.code)}
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
            onOpenKline={(code) => {
              setSelectedCode("");
              setSelectedKlineCode(code);
            }}
          />
        </>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-400/20 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1 text-center">
          {[
            ["home", "", "首頁"],
            ["top50", "", "50強"],
            ["portfolio", "", "庫存"],
            ["activeEtf", "🧠", "ETF"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setSelectedKlineCode("");
                setPopup("");
                setIndustryPopup("");
                setTab(key as TabKey);
                jumpToContent();
              }}
              className={`rounded-2xl py-2 text-xs font-black ${
                tab === key
                  ? "border border-cyan-400/30 bg-cyan-500/15 text-cyan-200 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                  : "text-slate-400"
              }`}
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
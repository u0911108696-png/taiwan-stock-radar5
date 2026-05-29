import { useEffect, useMemo, useRef, useState } from "react";

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

type KLine = {
  date: string;
  open?: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

type TabKey = "home" | "top50" | "tomorrow" | "favorite" | "more";

type MoreView =
  | "menu"
  | "entryReady"
  | "entryPullback"
  | "reclaimOpen"
  | "breakOpen"
  | "chaseWarning"
  | "avoidList"
  | "continuationStrong"
  | "quietContinuation"
  | "fakeStrong"
  | "industry"
  | "industryDetail"
  | "realAtrSafe"
  | "atrMissing"
  | "settings"
  | "data";

type PriceDirection = "up" | "down" | "same" | "new";
type AtrMode = "短線" | "標準" | "寬鬆";
type HoldingStatus = "未進場" | "已進場";
type ProfitAnchor = "今日高點" | "近N日高點" | "持有後最高價";

type SortKey =
  | "entry"
  | "continuation"
  | "opening"
  | "money"
  | "industry"
  | "atr"
  | "change"
  | "price";

type TopFilter =
  | "全部"
  | "可進場"
  | "等回測"
  | "站回開盤"
  | "跌破開盤"
  | "禁止追高"
  | "續航中"
  | "假強警報"
  | "主流產業"
  | "ATR安全"
  | "真實ATR";

type PositionInfo = {
  entryPrice?: number;
  holdingStatus?: HoldingStatus;
  highestPrice?: number;
};

type Settings = {
  maxPrice: number;
  hotPercent: number;
  refreshSeconds: number;
  dataSaver: boolean;
  atrMode: AtrMode;
  atrMultiple: number;
  atrDays: number;
  profitAnchor: ProfitAnchor;
  klineCacheMinutes: number;
  klineLimit: number;
  klineBatchSize: number;
  klineSaveMode: boolean;
  topFilter: TopFilter;
};

type ApiResponse = {
  stocks?: any[];
  data?: any[];
  rankedStocks?: any[];
  updatedAt?: string;
  updatedAtTaiwan?: string;
  source?: string;
};

type KLineCacheItem = {
  code: string;
  savedAt: number;
  klines: KLine[];
  ok: boolean;
  message?: string;
};

type AtrInfo = {
  atr: number;
  source: "真實ATR" | "簡化ATR";
  hasReal: boolean;
  highN: number;
  lowN: number;
  rangePercent: number;
};

type OpeningState =
  | "主力開盤卡位"
  | "開高走強"
  | "開高走弱"
  | "開高過熱"
  | "低調轉強"
  | "開盤普通"
  | "開盤偏弱";

type ContinuationState =
  | "開盤強續航"
  | "續航中"
  | "低調續航"
  | "假強警報"
  | "開盤強轉弱"
  | "轉弱中"
  | "等確認";

type MoneyState = "資金流入" | "資金剛轉強" | "資金過熱" | "資金退潮" | "資金觀望";
type VolumeState = "量能強" | "量能普通" | "量能不足";
type PriceVolumeState = "量價同步" | "量價背離" | "量縮觀望" | "轉弱退潮";

type EntryState =
  | "可進場觀察"
  | "等回測進場"
  | "站回開盤警報"
  | "跌破開盤警報"
  | "禁止追高"
  | "不適合進場"
  | "等待確認";

type RiskLevel = "低風險" | "中風險" | "高風險";

type IndustryItem = {
  industry: string;
  count: number;
  avg: number;
  avgOpenPremium: number;
  avgEntry: number;
  avgContinuation: number;
  entryReadyCount: number;
  pullbackCount: number;
  chaseWarningCount: number;
  reclaimOpenCount: number;
  breakOpenCount: number;
  continuationCount: number;
  fakeStrongCount: number;
  atrSafeCount: number;
  realAtrCount: number;
  weakCount: number;
  hotCount: number;
  score: number;
  entryRate: number;
  pullbackRate: number;
  chaseRate: number;
  continuationRate: number;
  safetyRate: number;
  concentrationRate: number;
  status: "可進場主流" | "等回測主流" | "追高風險" | "轉弱退潮" | "續航觀察" | "觀察中";
  stocks: Stock[];
};

const API_URL = "/api/stocks";
const KLINE_API_URL = "/api/kline";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const POSITION_KEY = "taiwan-stock-radar-position-info";
const SETTINGS_KEY = "taiwan-stock-radar-entry-alert-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-entry-alert-cache";
const KLINE_CACHE_KEY = "taiwan-stock-radar-kline-cache-entry-alert";

const defaultSettings: Settings = {
  maxPrice: 200,
  hotPercent: 8,
  refreshSeconds: 30,
  dataSaver: false,
  atrMode: "標準",
  atrMultiple: 2,
  atrDays: 14,
  profitAnchor: "今日高點",
  klineCacheMinutes: 30,
  klineLimit: 50,
  klineBatchSize: 5,
  klineSaveMode: false,
  topFilter: "全部",
};

const industryMap: Record<string, string> = {
  "1101": "水泥", "1102": "水泥",
  "1216": "食品", "1227": "食品",
  "1301": "塑化", "1303": "塑化", "6505": "塑化",
  "2002": "鋼鐵", "2014": "鋼鐵", "2027": "鋼鐵",
  "2201": "汽車", "2207": "汽車",
  "2301": "電子", "2303": "半導體", "2308": "電源能源",
  "2313": "電子零組件", "2317": "電子代工", "2327": "電子零組件",
  "2330": "半導體", "2354": "電子", "2356": "電腦週邊", "2357": "電腦週邊",
  "2367": "電子零組件", "2379": "半導體", "2382": "電子代工",
  "2408": "半導體", "2409": "面板", "2454": "半導體",
  "2603": "航運", "2609": "航運", "2615": "航運", "2618": "航運",
  "2881": "金融", "2882": "金融", "2884": "金融", "2886": "金融",
  "2891": "金融", "2892": "金融",
  "3008": "光學", "3017": "電子零組件",
  "3034": "半導體", "3035": "半導體", "3037": "電子零組件",
  "3042": "光電", "3231": "電子代工", "3406": "光學",
  "3443": "半導體", "3481": "面板",
  "3711": "半導體", "3714": "半導體",
  "4966": "半導體", "6415": "半導體", "6669": "電子代工",
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

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function nowText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  return value.toLocaleString("zh-TW");
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

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const name = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);

  const price = n(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = n(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = n(raw.openPrice ?? raw.open ?? raw.o ?? price);

  const rawHigh = n(raw.highPrice ?? raw.high ?? raw.h ?? Math.max(price, openPrice, previousClose));
  const rawLow = n(raw.lowPrice ?? raw.low ?? raw.l ?? Math.min(price, openPrice, previousClose));

  const highPrice = Math.max(rawHigh, price, openPrice, previousClose);
  const lowPrice = Math.min(rawLow || price, price, openPrice || price, previousClose || price);

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
    highPrice,
    lowPrice,
    industry:
      raw.industry && raw.industry !== "其他"
        ? String(raw.industry)
        : industryMap[code] ?? "其他",
    updatedAt: String(raw.updatedAt ?? raw.time ?? raw.updateTime ?? updateTime),
  };
}

function normalizeKLine(raw: any): KLine | null {
  const high = n(raw.high ?? raw.h ?? raw.High);
  const low = n(raw.low ?? raw.l ?? raw.Low);
  const close = n(raw.close ?? raw.c ?? raw.Close);
  const open = n(raw.open ?? raw.o ?? raw.Open);
  const volume = n(raw.volume ?? raw.v ?? raw.Volume);
  const date = String(raw.date ?? raw.t ?? raw.Date ?? "");

  if (high <= 0 || low <= 0 || close <= 0) return null;
  return { date, open, high, low, close, volume };
}

function trueAtrFromKLines(klines: KLine[], days: number) {
  if (!klines || klines.length < Math.min(days, 7)) return null;

  const sorted = [...klines].slice(-Math.max(days + 1, 8));
  const ranges: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );

    if (Number.isFinite(tr) && tr > 0) ranges.push(tr);
  }

  const recent = ranges.slice(-days);
  if (recent.length < Math.min(days, 7)) return null;

  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}

function simplifiedAtr(stock: Stock) {
  const range1 = Math.abs(stock.highPrice - stock.lowPrice);
  const range2 = Math.abs(stock.highPrice - stock.previousClose);
  const range3 = Math.abs(stock.lowPrice - stock.previousClose);
  const raw = Math.max(range1, range2, range3);
  const minAtr = stock.price * 0.018;
  const atr = Math.max(raw, minAtr);

  return Number.isFinite(atr) && atr > 0 ? atr : stock.price * 0.02;
}

function getAtrInfo(stock: Stock, settings: Settings, klines?: KLine[]): AtrInfo {
  const realAtr = trueAtrFromKLines(klines || [], settings.atrDays);
  const rows = klines && klines.length > 0 ? klines.slice(-settings.atrDays) : [];

  if (realAtr && rows.length >= Math.min(settings.atrDays, 7)) {
    const highN = Math.max(...rows.map((row) => row.high), stock.highPrice, stock.price);
    const lowN = Math.min(...rows.map((row) => row.low), stock.lowPrice, stock.price);

    return {
      atr: realAtr,
      source: "真實ATR",
      hasReal: true,
      highN,
      lowN,
      rangePercent: stock.price > 0 ? ((highN - lowN) / stock.price) * 100 : 0,
    };
  }

  const atr = simplifiedAtr(stock);

  return {
    atr,
    source: "簡化ATR",
    hasReal: false,
    highN: Math.max(stock.highPrice, stock.price, stock.openPrice),
    lowN: Math.min(stock.lowPrice, stock.price, stock.openPrice || stock.price),
    rangePercent: stock.price > 0 ? ((stock.highPrice - stock.lowPrice) / stock.price) * 100 : 0,
  };
}

function getEntryPrice(stock: Stock, position?: PositionInfo) {
  return position?.entryPrice && position.entryPrice > 0 ? position.entryPrice : stock.openPrice;
}

function getAnchorPrice(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  const entry = getEntryPrice(stock, position);

  if (settings.profitAnchor === "今日高點") return Math.max(stock.highPrice, stock.price, entry);
  if (settings.profitAnchor === "持有後最高價") return Math.max(position?.highestPrice || 0, stock.price, entry);

  return Math.max(atrInfo.highN, stock.price, entry);
}

function atrStopLoss(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  return Math.max(0, getEntryPrice(stock, position) - atrInfo.atr * settings.atrMultiple);
}

function atrTrailingStop(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  return Math.max(0, getAnchorPrice(stock, settings, atrInfo, position) - atrInfo.atr * settings.atrMultiple);
}

function atrDistancePercent(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  const line = atrTrailingStop(stock, settings, atrInfo, position);
  if (stock.price <= 0) return 999;
  return ((stock.price - line) / stock.price) * 100;
}

function isAtrBroken(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  if (position?.holdingStatus !== "已進場") return false;
  return stock.price < atrTrailingStop(stock, settings, atrInfo, position);
}

function isAtrNear(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  const d = atrDistancePercent(stock, settings, atrInfo, position);
  return d >= 0 && d <= 2.5;
}

function atrStatus(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  if (isHot(stock, settings)) return "過熱";
  if (isAtrBroken(stock, settings, atrInfo, position)) return "跌破停利";
  if (isAtrNear(stock, settings, atrInfo, position)) return position?.holdingStatus === "已進場" ? "接近停利" : "觀察偏近";
  return "安全";
}

function atrTone(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  const status = atrStatus(stock, settings, atrInfo, position);
  if (status === "安全") return "text-emerald-300";
  if (status === "接近停利" || status === "觀察偏近") return "text-yellow-300";
  if (status === "跌破停利") return "text-red-300";
  return "text-orange-300";
}

function atrRiskScore(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  if (isAtrBroken(stock, settings, atrInfo, position)) return 100;
  const d = atrDistancePercent(stock, settings, atrInfo, position);
  if (d >= 10) return 10;
  if (d <= 0) return 100;
  return Math.round(100 - d * 9);
}

function openingPremium(stock: Stock) {
  return stock.openPremiumPercent ?? 0;
}

function openingAfterPercent(stock: Stock) {
  if (stock.openPrice <= 0) return 0;
  return ((stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function isHot(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || openingAfterPercent(stock) >= 4 || openingPremium(stock) >= 6;
}

function isWeak(stock: Stock) {
  return stock.price < stock.openPrice || stock.price < stock.previousClose || stock.changePercent < 2;
}

function isBreakout(stock: Stock) {
  return stock.changePercent >= 3 && stock.price >= stock.openPrice;
}

function isNearOpen(stock: Stock) {
  if (stock.openPrice <= 0) return false;
  return Math.abs(stock.price - stock.openPrice) / stock.openPrice <= 0.015;
}

function distanceFromOpen(stock: Stock) {
  return openingAfterPercent(stock);
}

function isMain(stock: Stock, mainIndustries: string[]) {
  return mainIndustries.includes(stock.industry);
}

function volumeRankPercent(stock: Stock, list: Stock[]) {
  if (!stock.volume || stock.volume <= 0) return 0;

  const sorted = [...list].sort((a, b) => b.volume - a.volume);
  const index = sorted.findIndex((item) => item.code === stock.code);

  if (index < 0 || sorted.length <= 1) return 0;

  return Math.round(((sorted.length - index) / sorted.length) * 100);
}

function volumeState(stock: Stock, list: Stock[]): VolumeState {
  const rank = volumeRankPercent(stock, list);

  if (rank >= 75) return "量能強";
  if (rank >= 40) return "量能普通";
  return "量能不足";
}

function priceVolumeState(stock: Stock, list: Stock[], settings: Settings): PriceVolumeState {
  const vol = volumeState(stock, list);

  if (stock.price < stock.openPrice || stock.price < stock.previousClose) return "轉弱退潮";
  if (stock.changePercent >= 3 && vol === "量能強") return "量價同步";
  if (stock.changePercent >= settings.hotPercent && vol !== "量能強") return "量價背離";
  if (vol === "量能不足") return "量縮觀望";

  return "量價同步";
}

function openingState(stock: Stock, list: Stock[], settings: Settings): OpeningState {
  const premium = openingPremium(stock);
  const afterOpen = openingAfterPercent(stock);
  const pv = priceVolumeState(stock, list, settings);
  const vol = volumeState(stock, list);

  if (premium >= 5 && stock.changePercent >= settings.hotPercent) return "開高過熱";
  if (premium >= 2 && afterOpen >= 0.5 && pv === "量價同步" && vol === "量能強") return "主力開盤卡位";
  if (premium >= 2 && afterOpen > 0) return "開高走強";
  if (premium >= 2 && afterOpen < 0) return "開高走弱";
  if (premium >= 0 && premium < 2 && afterOpen > 0.8 && pv === "量價同步") return "低調轉強";
  if (premium < 0 || stock.price < stock.previousClose) return "開盤偏弱";
  return "開盤普通";
}

function openingTone(state: OpeningState) {
  if (state === "主力開盤卡位") return "text-emerald-300";
  if (state === "開高走強") return "text-cyan-300";
  if (state === "低調轉強") return "text-blue-300";
  if (state === "開高過熱") return "text-orange-300";
  if (state === "開高走弱" || state === "開盤偏弱") return "text-red-300";
  return "text-slate-300";
}

function openingScore(stock: Stock, list: Stock[], settings: Settings) {
  let score = 0;
  const premium = openingPremium(stock);
  const afterOpen = openingAfterPercent(stock);
  const state = openingState(stock, list, settings);
  const volRank = volumeRankPercent(stock, list);

  score += Math.max(0, Math.min(30, premium * 6));
  score += Math.max(0, Math.min(20, afterOpen * 8));
  score += Math.min(25, volRank * 0.25);

  if (state === "主力開盤卡位") score += 25;
  if (state === "開高走強") score += 18;
  if (state === "低調轉強") score += 20;
  if (state === "開高過熱") score -= 15;
  if (state === "開高走弱") score -= 25;
  if (state === "開盤偏弱") score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function openingSentence(stock: Stock, list: Stock[], settings: Settings) {
  const state = openingState(stock, list, settings);
  const premium = openingPremium(stock);
  const afterOpen = openingAfterPercent(stock);

  if (state === "主力開盤卡位") return `開盤溢價 ${formatPercent(premium)}，開盤後 ${formatPercent(afterOpen)}，量價同步，主力資金可能先卡位。`;
  if (state === "開高走強") return `開盤溢價 ${formatPercent(premium)}，目前仍站上開盤，開盤資金有延續。`;
  if (state === "開高走弱") return `開盤溢價 ${formatPercent(premium)}，但現價跌回開盤下，可能開高走弱。`;
  if (state === "開高過熱") return `開盤溢價 ${formatPercent(premium)} 且漲幅偏大，主力資金有進來但不適合追高。`;
  if (state === "低調轉強") return `開盤不算太高，但開盤後轉強，這種通常比追高安全。`;
  if (state === "開盤偏弱") return `開盤資金偏弱，先不要急。`;
  return `開盤溢價 ${formatPercent(premium)}，目前沒有明顯開盤主力訊號。`;
}

function continuationState(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
): ContinuationState {
  const open = openingState(stock, list, settings);
  const pv = priceVolumeState(stock, list, settings);
  const afterOpen = openingAfterPercent(stock);
  const atr = atrStatus(stock, settings, atrInfo, position);
  const premium = openingPremium(stock);

  if (premium >= 2 && afterOpen < 0 && (priceDirections[stock.code] === "down" || pv === "轉弱退潮")) return "開盤強轉弱";
  if (premium >= 2 && (afterOpen < 0 || pv === "量價背離" || priceDirections[stock.code] === "down")) return "假強警報";
  if (premium >= 2 && afterOpen > 0 && priceDirections[stock.code] !== "down" && pv === "量價同步" && atr === "安全") return "開盤強續航";
  if (premium >= 0 && premium < 2 && afterOpen > 0.8 && !isHot(stock, settings)) return "低調續航";
  if (afterOpen > 0 && priceDirections[stock.code] === "up" && pv === "量價同步" && atr === "安全") return "續航中";
  if (stock.price < stock.openPrice) return "轉弱中";
  return "等確認";
}

function continuationTone(state: ContinuationState) {
  if (state === "開盤強續航" || state === "續航中") return "text-emerald-300";
  if (state === "低調續航") return "text-blue-300";
  if (state === "轉弱中" || state === "開盤強轉弱") return "text-red-300";
  if (state === "假強警報") return "text-orange-300";
  return "text-slate-300";
}

function continuationScore(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  let score = 0;
  const state = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  const open = openingState(stock, list, settings);
  const pv = priceVolumeState(stock, list, settings);
  const afterOpen = openingAfterPercent(stock);
  const volRank = volumeRankPercent(stock, list);
  const atr = atrStatus(stock, settings, atrInfo, position);

  score += Math.min(20, Math.max(0, openingPremium(stock)) * 4);
  score += Math.min(25, Math.max(0, afterOpen) * 8);
  score += Math.min(20, volRank * 0.2);

  if (priceDirections[stock.code] === "up") score += 12;
  if (priceDirections[stock.code] === "same") score += 4;
  if (priceDirections[stock.code] === "down") score -= 15;

  if (pv === "量價同步") score += 15;
  if (pv === "量價背離") score -= 18;
  if (pv === "轉弱退潮") score -= 25;

  if (atr === "安全") score += 10;
  if (atrInfo.hasReal) score += 4;
  if (isMain(stock, mainIndustries)) score += 12;

  if (open === "主力開盤卡位") score += 12;
  if (open === "開高走強") score += 8;
  if (open === "低調轉強") score += 10;
  if (open === "開高走弱") score -= 25;
  if (open === "開高過熱") score -= 15;

  if (state === "開盤強續航") score += 20;
  if (state === "低調續航") score += 18;
  if (state === "續航中") score += 14;
  if (state === "假強警報") score -= 25;
  if (state === "開盤強轉弱" || state === "轉弱中") score -= 30;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function continuationSentence(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const state = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);

  if (state === "開盤強續航") return "開盤有溢價，盤中仍站上開盤且量價同步，主力續航偏強。";
  if (state === "低調續航") return "開盤不高，但盤中轉強，這種比追高更安全。";
  if (state === "續航中") return "盤中股價續強，量價配合，目前仍有續航。";
  if (state === "假強警報") return "開盤看似強，但盤中轉弱或量價背離，避免追高。";
  if (state === "開盤強轉弱" || state === "轉弱中") return "開盤強但盤中轉弱，可能是開高出貨或換手。";
  return "尚未確認續航，先等站穩開盤價與量價同步。";
}

function moneyScore(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  let score = 0;

  const volRank = volumeRankPercent(stock, list);
  const pv = priceVolumeState(stock, list, settings);
  const atr = atrStatus(stock, settings, atrInfo, position);
  const openState = openingState(stock, list, settings);
  const contState = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);

  score += Math.min(28, volRank * 0.28);
  score += Math.min(18, Math.max(0, stock.changePercent) * 2.2);
  score += Math.min(18, Math.max(0, openingPremium(stock)) * 4);

  if (openingAfterPercent(stock) > 0) score += 10;
  if (stock.price >= stock.openPrice) score += 10;
  if (stock.price >= stock.previousClose) score += 8;
  if (priceDirections[stock.code] === "up") score += 10;
  if (isMain(stock, mainIndustries)) score += 14;
  if (pv === "量價同步") score += 14;
  if (atr === "安全") score += 8;
  if (atrInfo.hasReal) score += 4;

  if (openState === "主力開盤卡位") score += 14;
  if (openState === "開高走強") score += 10;
  if (openState === "低調轉強") score += 12;

  if (contState === "開盤強續航") score += 18;
  if (contState === "低調續航") score += 16;
  if (contState === "續航中") score += 12;
  if (contState === "假強警報") score -= 25;
  if (contState === "開盤強轉弱") score -= 28;

  if (openState === "開高過熱") score -= 18;
  if (openState === "開高走弱") score -= 25;
  if (isHot(stock, settings)) score -= 18;
  if (pv === "量價背離") score -= 15;
  if (pv === "轉弱退潮") score -= 25;
  if (priceDirections[stock.code] === "down") score -= 15;
  if (isWeak(stock)) score -= 22;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function moneyState(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
): MoneyState {
  const score = moneyScore(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  const pv = priceVolumeState(stock, list, settings);
  const open = openingState(stock, list, settings);
  const cont = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);

  if (isWeak(stock) || pv === "轉弱退潮" || priceDirections[stock.code] === "down" || open === "開高走弱" || cont === "假強警報") return "資金退潮";
  if ((isHot(stock, settings) || open === "開高過熱") && score >= 55) return "資金過熱";
  if (cont === "開盤強續航" || cont === "續航中") return "資金流入";
  if (cont === "低調續航") return "資金剛轉強";
  if (open === "主力開盤卡位" || open === "開高走強") return "資金流入";
  if (open === "低調轉強") return "資金剛轉強";
  if (score >= 70 && pv === "量價同步") return "資金流入";

  return "資金觀望";
}

function moneyTone(state: MoneyState) {
  if (state === "資金流入") return "text-emerald-300";
  if (state === "資金剛轉強") return "text-cyan-300";
  if (state === "資金過熱") return "text-orange-300";
  if (state === "資金退潮") return "text-red-300";
  return "text-slate-300";
}

function riskLevel(
  stock: Stock,
  settings: Settings,
  atrInfo: AtrInfo,
  position?: PositionInfo
): RiskLevel {
  let risk = 0;

  const openDistance = Math.abs(openingAfterPercent(stock));
  if (openDistance <= 1.5) risk += 0;
  else if (openDistance <= 3) risk += 1;
  else risk += 2;

  if (stock.changePercent >= settings.hotPercent) risk += 2;
  else if (stock.changePercent >= 6) risk += 1;

  const atrDistance = atrDistancePercent(stock, settings, atrInfo, position);
  if (atrDistance <= 2.5) risk += 2;
  else if (atrDistance <= 5) risk += 1;

  if (isHot(stock, settings)) risk += 2;

  if (risk >= 4) return "高風險";
  if (risk >= 2) return "中風險";
  return "低風險";
}

function entryScore(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  let score = 0;
  const cont = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  const pv = priceVolumeState(stock, list, settings);
  const atr = atrStatus(stock, settings, atrInfo, position);
  const risk = riskLevel(stock, settings, atrInfo, position);

  if (isMain(stock, mainIndustries)) score += 22;
  if (cont === "開盤強續航" || cont === "續航中") score += 24;
  if (cont === "低調續航") score += 22;
  if (stock.price >= stock.openPrice) score += 10;
  if (priceDirections[stock.code] === "up") score += 12;
  if (pv === "量價同步") score += 12;
  if (atr === "安全") score += 12;
  if (stock.price <= settings.maxPrice) score += 8;
  if (isNearOpen(stock)) score += 8;

  if (isReclaimOpenAlert(stock, previousPriceMap, priceDirections)) score += 12;

  if (risk === "低風險") score += 8;
  if (risk === "中風險") score -= 6;
  if (risk === "高風險") score -= 18;

  if (isChaseWarning(stock, settings)) score -= 30;
  if (isBreakOpenAlert(stock, previousPriceMap)) score -= 25;
  if (cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中") score -= 35;
  if (moneyState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position) === "資金退潮") score -= 30;
  if (isWeak(stock)) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function isReclaimOpenAlert(
  stock: Stock,
  previousPriceMap: Record<string, number>,
  priceDirections: Record<string, PriceDirection>
) {
  const prev = previousPriceMap[stock.code];
  if (!prev || stock.openPrice <= 0) return false;
  return prev < stock.openPrice && stock.price >= stock.openPrice && priceDirections[stock.code] === "up";
}

function isBreakOpenAlert(stock: Stock, previousPriceMap: Record<string, number>) {
  const prev = previousPriceMap[stock.code];
  if (!prev || stock.openPrice <= 0) return false;
  return prev >= stock.openPrice && stock.price < stock.openPrice;
}

function isChaseWarning(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || openingAfterPercent(stock) >= 4 || openingPremium(stock) >= 6;
}

function entryState(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
): EntryState {
  const cont = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  const score = entryScore(stock, list, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
  const risk = riskLevel(stock, settings, atrInfo, position);

  if (isBreakOpenAlert(stock, previousPriceMap)) return "跌破開盤警報";
  if (isReclaimOpenAlert(stock, previousPriceMap, priceDirections)) return "站回開盤警報";
  if (isChaseWarning(stock, settings)) return "禁止追高";
  if (cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中") return "不適合進場";

  if (
    isMain(stock, mainIndustries) &&
    (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航") &&
    atrStatus(stock, settings, atrInfo, position) === "安全" &&
    risk !== "高風險" &&
    score >= 72
  ) {
    return "可進場觀察";
  }

  if ((cont === "開盤強續航" || cont === "續航中") && (openingAfterPercent(stock) > 2.5 || stock.changePercent >= 6)) {
    return "等回測進場";
  }

  if (isNearOpen(stock) && stock.price >= stock.previousClose) return "等回測進場";

  return "等待確認";
}

function entryTone(state: EntryState) {
  if (state === "可進場觀察" || state === "站回開盤警報") return "text-emerald-300";
  if (state === "等回測進場" || state === "等待確認") return "text-yellow-300";
  if (state === "禁止追高") return "text-orange-300";
  return "text-red-300";
}

function entryReason(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const reasons: string[] = [];
  const cont = continuationState(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);

  if (isMain(stock, mainIndustries)) reasons.push("主流產業");
  if (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航") reasons.push("盤中續航");
  if (priceVolumeState(stock, list, settings) === "量價同步") reasons.push("量價同步");
  if (atrStatus(stock, settings, atrInfo, position) === "安全") reasons.push("ATR安全");
  if (isNearOpen(stock)) reasons.push("接近開盤支撐");
  if (isReclaimOpenAlert(stock, previousPriceMap, priceDirections)) reasons.push("站回開盤");
  if (isBreakOpenAlert(stock, previousPriceMap)) reasons.push("跌破開盤");
  if (isChaseWarning(stock, settings)) reasons.push("追高警報");

  return reasons.length ? reasons.join(" / ") : "等待更明確訊號";
}

function entrySentence(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const state = entryState(stock, list, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
  const risk = riskLevel(stock, settings, atrInfo, position);

  if (state === "可進場觀察") return `主流產業續航中，量價同步且ATR安全，屬於${risk}，可列入進場觀察。`;
  if (state === "等回測進場") return `條件不差，但位置不夠漂亮，等回測開盤價附近再觀察。`;
  if (state === "站回開盤警報") return `剛站回開盤價且即時轉強，可觀察是否量價同步。`;
  if (state === "跌破開盤警報") return `跌破開盤價，續航失敗機率升高，小心轉弱。`;
  if (state === "禁止追高") return `漲幅或開盤後漲幅偏大，禁止追高，等回測。`;
  if (state === "不適合進場") return `假強、轉弱或資金退潮，不適合進場。`;

  return `尚未確認進場條件，先等站穩開盤價、續航與量價同步。`;
}

function idealEntryZone(stock: Stock) {
  const low = stock.openPrice;
  const high = stock.openPrice * 1.015;
  return `${formatPrice(low)} ～ ${formatPrice(high)}`;
}

function chaseZone(stock: Stock) {
  return `高於 ${formatPrice(stock.openPrice * 1.03)}`;
}

function mainScore(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const e = entryScore(stock, list, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
  const c = continuationScore(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  const m = moneyScore(stock, list, mainIndustries, settings, priceDirections, atrInfo, position);
  return Math.round(e * 0.5 + c * 0.3 + m * 0.2);
}

function decisionLabel(
  stock: Stock,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const entry = entryState(stock, list, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);

  if (isAtrBroken(stock, settings, atrInfo, position)) return "跌破ATR";
  if (entry === "可進場觀察") return "可進場";
  if (entry === "等回測進場") return "等回測";
  if (entry === "站回開盤警報") return "站回開盤";
  if (entry === "跌破開盤警報") return "跌破開盤";
  if (entry === "禁止追高") return "禁止追高";
  if (entry === "不適合進場") return "移除";
  return "等待確認";
}

function decisionTone(label: string) {
  if (label === "可進場" || label === "站回開盤") return "text-emerald-300";
  if (label === "等回測" || label === "等待確認") return "text-yellow-300";
  if (label === "禁止追高") return "text-orange-300";
  if (label === "跌破ATR" || label === "跌破開盤") return "text-red-300";
  return "text-slate-300";
}

function directionText(direction?: PriceDirection) {
  if (direction === "up") return "↑ 股價上升";
  if (direction === "down") return "↓ 股價下降";
  if (direction === "same") return "→ 股價持平";
  if (direction === "new") return "新資料";
  return "--";
}

function directionTone(direction?: PriceDirection) {
  if (direction === "up") return "text-red-300";
  if (direction === "down") return "text-emerald-300";
  if (direction === "same") return "text-slate-300";
  return "text-cyan-300";
}

function previousPriceOf(stock: Stock, previousPriceMap: Record<string, number>) {
  return previousPriceMap[stock.code];
}

function instantDiff(stock: Stock, previousPriceMap: Record<string, number>) {
  const prev = previousPriceOf(stock, previousPriceMap);
  if (!prev || prev <= 0) return 0;
  return stock.price - prev;
}

function instantPercent(stock: Stock, previousPriceMap: Record<string, number>) {
  const prev = previousPriceOf(stock, previousPriceMap);
  if (!prev || prev <= 0) return 0;
  return ((stock.price - prev) / prev) * 100;
}

function getIndustryRanking(
  stocks: Stock[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  previousPriceMap: Record<string, number>,
  mainIndustries: string[],
  getAtr: (stock: Stock) => AtrInfo,
  getPos: (stock: Stock) => PositionInfo | undefined
): IndustryItem[] {
  const map = new Map<string, IndustryItem>();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const atr = getAtr(stock);
    const pos = getPos(stock);
    const entry = entryState(stock, stocks, mainIndustries, settings, priceDirections, previousPriceMap, atr, pos);
    const cont = continuationState(stock, stocks, mainIndustries, settings, priceDirections, atr, pos);

    const item =
      map.get(key) ??
      {
        industry: key,
        count: 0,
        avg: 0,
        avgOpenPremium: 0,
        avgEntry: 0,
        avgContinuation: 0,
        entryReadyCount: 0,
        pullbackCount: 0,
        chaseWarningCount: 0,
        reclaimOpenCount: 0,
        breakOpenCount: 0,
        continuationCount: 0,
        fakeStrongCount: 0,
        atrSafeCount: 0,
        realAtrCount: 0,
        weakCount: 0,
        hotCount: 0,
        score: 0,
        entryRate: 0,
        pullbackRate: 0,
        chaseRate: 0,
        continuationRate: 0,
        safetyRate: 0,
        concentrationRate: 0,
        status: "觀察中",
        stocks: [],
      };

    item.count += 1;
    item.avg += stock.changePercent;
    item.avgOpenPremium += openingPremium(stock);
    item.avgEntry += entryScore(stock, stocks, mainIndustries, settings, priceDirections, previousPriceMap, atr, pos);
    item.avgContinuation += continuationScore(stock, stocks, mainIndustries, settings, priceDirections, atr, pos);
    item.stocks.push(stock);

    if (entry === "可進場觀察") item.entryReadyCount += 1;
    if (entry === "等回測進場") item.pullbackCount += 1;
    if (entry === "禁止追高") item.chaseWarningCount += 1;
    if (entry === "站回開盤警報") item.reclaimOpenCount += 1;
    if (entry === "跌破開盤警報") item.breakOpenCount += 1;
    if (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航") item.continuationCount += 1;
    if (cont === "假強警報") item.fakeStrongCount += 1;
    if (atrStatus(stock, settings, atr, pos) === "安全") item.atrSafeCount += 1;
    if (atr.hasReal) item.realAtrCount += 1;
    if (isWeak(stock)) item.weakCount += 1;
    if (isHot(stock, settings)) item.hotCount += 1;

    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avg = item.avg / Math.max(item.count, 1);
      const avgOpenPremium = item.avgOpenPremium / Math.max(item.count, 1);
      const avgEntry = item.avgEntry / Math.max(item.count, 1);
      const avgContinuation = item.avgContinuation / Math.max(item.count, 1);
      const entryRate = (item.entryReadyCount / Math.max(item.count, 1)) * 100;
      const pullbackRate = (item.pullbackCount / Math.max(item.count, 1)) * 100;
      const chaseRate = (item.chaseWarningCount / Math.max(item.count, 1)) * 100;
      const continuationRate = (item.continuationCount / Math.max(item.count, 1)) * 100;
      const safetyRate = (item.atrSafeCount / Math.max(item.count, 1)) * 100;
      const concentrationRate = (item.count / Math.max(stocks.length, 1)) * 100;

      let status: IndustryItem["status"] = "觀察中";

      if (item.breakOpenCount >= Math.max(2, Math.ceil(item.count * 0.35)) || item.weakCount >= Math.max(2, Math.ceil(item.count * 0.45))) status = "轉弱退潮";
      else if (chaseRate >= 35) status = "追高風險";
      else if (entryRate >= 25 && safetyRate >= 45) status = "可進場主流";
      else if (pullbackRate >= 30) status = "等回測主流";
      else if (continuationRate >= 35) status = "續航觀察";

      const score =
        item.count * 8 +
        avgEntry * 1.2 +
        avgContinuation * 0.8 +
        item.entryReadyCount * 14 +
        item.reclaimOpenCount * 10 +
        item.pullbackCount * 6 +
        item.continuationCount * 6 +
        item.atrSafeCount * 4 +
        item.realAtrCount * 2 -
        item.chaseWarningCount * 8 -
        item.breakOpenCount * 12 -
        item.fakeStrongCount * 10 -
        item.weakCount * 6;

      return {
        ...item,
        avg,
        avgOpenPremium,
        avgEntry,
        avgContinuation,
        entryRate,
        pullbackRate,
        chaseRate,
        continuationRate,
        safetyRate,
        concentrationRate,
        status,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function getKLinks(code: string, name: string) {
  return {
    yahoo: `https://tw.stock.yahoo.com/quote/${code}.TW/technical-analysis`,
    tradingView: `https://www.tradingview.com/chart/?symbol=TWSE%3A${code}`,
    goodinfo: `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${code}`,
    google: `https://www.google.com/search?q=${code}+${encodeURIComponent(name)}+K線`,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function industryTone(status: IndustryItem["status"]) {
  if (status === "可進場主流") return "text-emerald-300";
  if (status === "等回測主流" || status === "續航觀察") return "text-yellow-300";
  if (status === "追高風險") return "text-orange-300";
  if (status === "轉弱退潮") return "text-red-300";
  return "text-slate-300";
}

function MiniCard({
  title,
  value,
  sub,
  tone,
  onClick,
}: {
  title: string;
  value: string | number;
  sub: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left active:scale-95">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-xl font-black ${tone}`}>{value}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{sub}</div>
    </button>
  );
}

function ActionCard({
  title,
  sub,
  badge,
  tone,
  onClick,
}: {
  title: string;
  sub: string;
  badge: string | number;
  tone: string;
  onClick: () => void;
}) {
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

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-black/30 p-3">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-black text-white">{value}</div>
    </div>
  );
}

function IndustryCard({ item, rank, onClick }: { item: IndustryItem; rank: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 進場產業排行</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${industryTone(item.status)}`}>{item.status}</div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black text-yellow-300">{item.count}檔</div>
          <div className="text-sm font-black text-emerald-300">進場 {item.avgEntry.toFixed(0)}</div>
          <div className="text-xs font-black text-slate-400">續航 {item.avgContinuation.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">可進場<br />{item.entryRate.toFixed(0)}%</div>
        <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">等回測<br />{item.pullbackRate.toFixed(0)}%</div>
        <div className="rounded-2xl bg-black/30 p-2 text-orange-300">追高<br />{item.chaseRate.toFixed(0)}%</div>
      </div>
    </button>
  );
}

function StockCard({
  stock,
  rank,
  industryRank,
  top50,
  mainIndustries,
  settings,
  favoriteCodes,
  tomorrowCodes,
  priceDirections,
  previousPriceMap,
  klineMap,
  positionMap,
  lastSuccessAt,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddTomorrow,
  onRemoveTomorrow,
}: {
  stock: Stock;
  rank: number;
  industryRank?: number;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  tomorrowCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  klineMap: Record<string, KLine[]>;
  positionMap: Record<string, PositionInfo>;
  lastSuccessAt: string;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddTomorrow: (code: string) => void;
  onRemoveTomorrow: (code: string) => void;
}) {
  const position = positionMap[stock.code];
  const atrInfo = getAtrInfo(stock, settings, klineMap[stock.code]);
  const label = decisionLabel(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
  const entry = entryState(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
  const money = moneyState(stock, top50, mainIndustries, settings, priceDirections, atrInfo, position);
  const open = openingState(stock, top50, settings);
  const cont = continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfo, position);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceOf(stock, previousPriceMap);
  const diff = instantDiff(stock, previousPriceMap);
  const diffPct = instantPercent(stock, previousPriceMap);
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const mainIndex = mainIndustries.indexOf(stock.industry);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry}
              {mainIndex >= 0 ? `｜主流${mainIndex + 1}` : ""}
              {industryRank ? `｜產業第${industryRank}` : ""}
            </div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(label)}`}>{label}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${entryTone(entry)}`}>{entry}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${continuationTone(cont)}`}>{cont}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${openingTone(open)}`}>{open}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${moneyTone(money)}`}>{money}</span>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-200">
            進場 {entryScore(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)}
          </span>
          <span className="rounded-full bg-blue-950 px-3 py-1 text-blue-200">{riskLevel(stock, settings, atrInfo, position)}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">開盤後 {formatPercent(openingAfterPercent(stock))}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${atrTone(stock, settings, atrInfo, position)}`}>ATR {atrStatus(stock, settings, atrInfo, position)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          {entryReason(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {entrySentence(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)}
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}　
          {prevPrice !== undefined ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}` : "尚無上一筆"}
          {prevPrice !== undefined && (
            <>
              {" ｜ "}
              {diff > 0 ? "+" : ""}
              {diff.toFixed(2)}
              {" / "}
              {formatPercent(diffPct)}
            </>
          )}
          <br />
          更新：{stock.updatedAt || lastSuccessAt || "--"}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => (isTomorrow ? onRemoveTomorrow(stock.code) : onAddTomorrow(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isTomorrow ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isTomorrow ? "📌 移除觀察" : "📌 明日觀察"}
        </button>

        <button
          onClick={() => (isFavorite ? onRemoveFavorite(stock.code) : onAddFavorite(stock.code))}
          className={`rounded-2xl py-2 text-sm font-black ${
            isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
          }`}
        >
          {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [tab, setTab] = useState<TabKey>("home");
  const [moreView, setMoreView] = useState<MoreView>("menu");
  const [selectedCode, setSelectedCode] = useState("");
  const [selectedIndustry, setSelectedIndustry] = useState("");

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [tomorrowCodes, setTomorrowCodes] = useState<string[]>([]);
  const [positionMap, setPositionMap] = useState<Record<string, PositionInfo>>({});
  const [entryInput, setEntryInput] = useState("");

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("entry");
  const [showFilters, setShowFilters] = useState(false);

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

  const [klineMap, setKlineMap] = useState<Record<string, KLine[]>>({});
  const [klineFailMap, setKlineFailMap] = useState<Record<string, string>>({});
  const [klineLoading, setKlineLoading] = useState(false);
  const [klineLoadedCount, setKlineLoadedCount] = useState(0);
  const [klineTargetCount, setKlineTargetCount] = useState(0);
  const [klineLastUpdatedAt, setKlineLastUpdatedAt] = useState("");

  const inFlightRef = useRef<Set<string>>(new Set());

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  function atrInfoOf(stock: Stock) {
    return getAtrInfo(stock, settings, klineMap[stock.code]);
  }

  function posOf(stock: Stock) {
    return positionMap[stock.code];
  }

  const industryRanking = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections, previousPriceMap, [], atrInfoOf, posOf),
    [top50, settings, priceDirections, previousPriceMap, klineMap, positionMap]
  );

  const mainIndustries = useMemo(() => industryRanking.slice(0, 3).map((item) => item.industry), [industryRanking]);

  const finalIndustryRanking = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections, previousPriceMap, mainIndustries, atrInfoOf, posOf),
    [top50, settings, priceDirections, previousPriceMap, klineMap, positionMap, mainIndustries]
  );

  const entryReadyList = useMemo(
    () =>
      top50
        .filter((stock) => entryState(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(stock), posOf(stock)) === "可進場觀察")
        .sort((a, b) => entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a))),
    [top50, mainIndustries, settings, priceDirections, previousPriceMap, klineMap, positionMap]
  );

  const entryPullbackList = useMemo(
    () =>
      top50
        .filter((stock) => entryState(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(stock), posOf(stock)) === "等回測進場")
        .sort((a, b) => entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a))),
    [top50, mainIndustries, settings, priceDirections, previousPriceMap, klineMap, positionMap]
  );

  const reclaimOpenList = useMemo(
    () =>
      top50
        .filter((stock) => isReclaimOpenAlert(stock, previousPriceMap, priceDirections))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, previousPriceMap, priceDirections]
  );

  const breakOpenList = useMemo(
    () =>
      top50
        .filter((stock) => isBreakOpenAlert(stock, previousPriceMap))
        .sort((a, b) => a.changePercent - b.changePercent),
    [top50, previousPriceMap]
  );

  const chaseWarningList = useMemo(
    () =>
      top50
        .filter((stock) => isChaseWarning(stock, settings))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, settings]
  );

  const continuationStrongList = useMemo(
    () =>
      top50
        .filter((stock) => {
          const state = continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock));
          return state === "開盤強續航" || state === "續航中";
        })
        .sort((a, b) => continuationScore(b, top50, mainIndustries, settings, priceDirections, atrInfoOf(b), posOf(b)) - continuationScore(a, top50, mainIndustries, settings, priceDirections, atrInfoOf(a), posOf(a))),
    [top50, mainIndustries, settings, priceDirections, klineMap, positionMap]
  );

  const quietContinuationList = useMemo(
    () =>
      top50
        .filter((stock) => continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "低調續航")
        .sort((a, b) => continuationScore(b, top50, mainIndustries, settings, priceDirections, atrInfoOf(b), posOf(b)) - continuationScore(a, top50, mainIndustries, settings, priceDirections, atrInfoOf(a), posOf(a))),
    [top50, mainIndustries, settings, priceDirections, klineMap, positionMap]
  );

  const fakeStrongList = useMemo(
    () =>
      top50
        .filter((stock) => continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "假強警報")
        .sort((a, b) => openingPremium(b) - openingPremium(a)),
    [top50, mainIndustries, settings, priceDirections, klineMap, positionMap]
  );

  const avoidList = useMemo(() => {
    const set = new Map<string, Stock>();

    [...fakeStrongList, ...breakOpenList].forEach((stock) => set.set(stock.code, stock));

    top50.forEach((stock) => {
      const atr = atrInfoOf(stock);
      const pos = posOf(stock);
      const money = moneyState(stock, top50, mainIndustries, settings, priceDirections, atr, pos);
      if (money === "資金退潮" || isWeak(stock)) set.set(stock.code, stock);
    });

    return Array.from(set.values()).sort((a, b) => a.changePercent - b.changePercent);
  }, [top50, fakeStrongList, breakOpenList, mainIndustries, settings, priceDirections, klineMap, positionMap]);

  const realAtrSafeList = useMemo(
    () =>
      top50.filter((stock) => {
        const atr = atrInfoOf(stock);
        return atr.hasReal && atrStatus(stock, settings, atr, posOf(stock)) === "安全";
      }),
    [top50, settings, klineMap, positionMap]
  );

  const atrMissingList = useMemo(
    () => top50.filter((stock) => !atrInfoOf(stock).hasReal),
    [top50, settings, klineMap]
  );

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const tomorrowStocksManual = useMemo(
    () => tomorrowCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [tomorrowCodes, stocks]
  );

  const tomorrowAutoList = useMemo(() => [...entryReadyList, ...entryPullbackList].slice(0, 20), [entryReadyList, entryPullbackList]);

  const tomorrowCombined = useMemo(() => {
    const map = new Map<string, Stock>();
    [...tomorrowStocksManual, ...tomorrowAutoList].forEach((stock) => map.set(stock.code, stock));
    return Array.from(map.values());
  }, [tomorrowStocksManual, tomorrowAutoList]);

  const tomorrowGroupedByIndustry = useMemo(() => {
    const map = new Map<string, Stock[]>();

    tomorrowCombined.forEach((stock) => {
      const list = map.get(stock.industry) || [];
      list.push(stock);
      map.set(stock.industry, list);
    });

    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [tomorrowCombined]);

  const selectedIndustryItem = useMemo(
    () => finalIndustryRanking.find((item) => item.industry === selectedIndustry) || null,
    [finalIndustryRanking, selectedIndustry]
  );

  const selectedIndustryStocks = useMemo(() => {
    if (!selectedIndustry) return [];

    return top50
      .filter((stock) => stock.industry === selectedIndustry)
      .sort((a, b) => entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a)));
  }, [selectedIndustry, top50, mainIndustries, settings, priceDirections, previousPriceMap, klineMap, positionMap]);

  const industryMapList = useMemo(() => {
    const map = new Map<string, Stock[]>();

    top50.forEach((stock) => {
      const list = map.get(stock.industry) || [];
      list.push(stock);
      map.set(stock.industry, list);
    });

    map.forEach((list, key) => {
      map.set(
        key,
        list.sort((a, b) => entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a)))
      );
    });

    return map;
  }, [top50, mainIndustries, settings, priceDirections, previousPriceMap, klineMap, positionMap]);

  function industryRankOf(stock: Stock) {
    const list = industryMapList.get(stock.industry) || [];
    const index = list.findIndex((item) => item.code === stock.code);
    return index >= 0 ? index + 1 : undefined;
  }

  const entryConcentrationRate = useMemo(() => {
    const count = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    return top50.length ? Math.round((count / top50.length) * 100) : 0;
  }, [top50, mainIndustries]);

  const entryMarketStructure = useMemo(() => {
    if (chaseWarningList.length >= 12) return "追高風險高";
    if (breakOpenList.length >= 10 || avoidList.length >= 18) return "轉弱避開";
    if (entryReadyList.length >= 5 && entryConcentrationRate >= 35) return "可進場主流";
    if (entryPullbackList.length >= 8) return "等回測為主";
    return "等待確認";
  }, [chaseWarningList, breakOpenList, avoidList, entryReadyList, entryPullbackList, entryConcentrationRate]);

  const entryHomeSentence = useMemo(() => {
    const top = finalIndustryRanking[0];

    if (!top) return "目前進場方向尚未明確，先等資料更新。";
    if (top.status === "可進場主流") return `${top.industry} 是目前進場主流，優先找續航、ATR安全、低追高風險的股票。`;
    if (top.status === "等回測主流") return `${top.industry} 續航不差，但位置偏高，等回測開盤價附近。`;
    if (top.status === "追高風險") return `${top.industry} 強但追高風險高，先不要追。`;
    if (top.status === "轉弱退潮") return `${top.industry} 轉弱訊號多，先避開。`;
    return `${top.industry} 暫列第一，但仍要確認站上開盤、續航與量價同步。`;
  }, [finalIndustryRanking]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "使用快取";
    if (lastSuccessAt) return "即時正常";
    return "讀取中";
  }, [updating, error, usingCache, lastSuccessAt]);

  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.code === selectedCode) || null,
    [stocks, selectedCode]
  );

  const atrCompletionRate = useMemo(() => {
    const total = Math.max(1, Math.min(settings.klineLimit, top50.length));
    const real = top50.slice(0, settings.klineLimit).filter((stock) => atrInfoOf(stock).hasReal).length;
    return Math.round((real / total) * 100);
  }, [top50, settings.klineLimit, klineMap]);

  useEffect(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    setSettings(mergedSettings);
    setAutoSeconds(mergedSettings.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setTomorrowCodes(safeParse(localStorage.getItem(TOMORROW_KEY), []));
    setPositionMap(safeParse(localStorage.getItem(POSITION_KEY), {}));

    const savedKlineCache = safeParse<Record<string, KLineCacheItem>>(localStorage.getItem(KLINE_CACHE_KEY), {});
    const restored: Record<string, KLine[]> = {};

    Object.values(savedKlineCache).forEach((item) => {
      if (item.ok && Array.isArray(item.klines)) restored[item.code] = item.klines;
    });

    setKlineMap(restored);

    const cached = safeParse<any>(localStorage.getItem(LAST_SUCCESS_KEY), null);

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
  }, []);

  useEffect(() => {
    loadStocks({ withKline: true });
  }, []);

  useEffect(() => {
    if (settings.refreshSeconds <= 0 || settings.dataSaver) return;

    const timer = window.setInterval(() => {
      setAutoSeconds((sec) => {
        if (sec <= 1) {
          loadStocks({ withKline: false });
          return settings.refreshSeconds;
        }
        return sec - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [settings.refreshSeconds, settings.dataSaver, lastPriceMap]);

  useEffect(() => {
    if (selectedStock && !klineMap[selectedStock.code] && !inFlightRef.current.has(selectedStock.code)) {
      fetchKLine(selectedStock.code);
    }

    if (selectedStock) {
      const pos = positionMap[selectedStock.code];
      setEntryInput(pos?.entryPrice ? String(pos.entryPrice) : String(selectedStock.openPrice || ""));
    }
  }, [selectedStock]);

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

  function saveTomorrow(next: string[]) {
    const clean = Array.from(new Set(next.map(cleanCode).filter(Boolean))).slice(0, 80);
    setTomorrowCodes(clean);
    localStorage.setItem(TOMORROW_KEY, JSON.stringify(clean));
  }

  function savePositionMap(next: Record<string, PositionInfo>) {
    setPositionMap(next);
    localStorage.setItem(POSITION_KEY, JSON.stringify(next));
  }

  function addFavorite(code: string) {
    saveFavorites([...favoriteCodes, code]);
  }

  function removeFavorite(code: string) {
    saveFavorites(favoriteCodes.filter((item) => item !== code));
  }

  function addTomorrow(code: string) {
    saveTomorrow([...tomorrowCodes, code]);
  }

  function removeTomorrow(code: string) {
    saveTomorrow(tomorrowCodes.filter((item) => item !== code));
  }

  async function fetchKLine(code: string, force = false) {
    const clean = cleanCode(code);
    if (!clean) return null;

    if (inFlightRef.current.has(clean)) return null;
    inFlightRef.current.add(clean);

    try {
      const cache = safeParse<Record<string, KLineCacheItem>>(localStorage.getItem(KLINE_CACHE_KEY), {});
      const cached = cache[clean];
      const freshMs = settings.klineCacheMinutes * 60 * 1000;

      if (!force && cached && Date.now() - cached.savedAt < freshMs) {
        if (cached.ok && cached.klines.length >= 7) {
          setKlineMap((old) => ({ ...old, [clean]: cached.klines }));
          return cached.klines;
        }

        setKlineFailMap((old) => ({ ...old, [clean]: cached.message || "快取資料不足" }));
        return null;
      }

      const response = await fetch(`${KLINE_API_URL}?code=${clean}&days=${Math.max(settings.atrDays + 16, 30)}&t=${Date.now()}`, {
        cache: "no-store",
      });

      const json = await response.json();
      const list = Array.isArray(json.klines) ? json.klines : Array.isArray(json.data) ? json.data : [];
      const klines = list.map(normalizeKLine).filter(Boolean) as KLine[];

      const item: KLineCacheItem = {
        code: clean,
        savedAt: Date.now(),
        klines,
        ok: Boolean(json.ok) && klines.length >= 7,
        message: json.message || "",
      };

      cache[clean] = item;
      localStorage.setItem(KLINE_CACHE_KEY, JSON.stringify(cache));

      if (item.ok) {
        setKlineMap((old) => ({ ...old, [clean]: klines }));
        setKlineFailMap((old) => {
          const next = { ...old };
          delete next[clean];
          return next;
        });
        return klines;
      }

      setKlineFailMap((old) => ({ ...old, [clean]: item.message || "日K資料不足" }));
      return null;
    } catch (err: any) {
      setKlineFailMap((old) => ({ ...old, [clean]: err?.message || "日K讀取失敗" }));
      return null;
    } finally {
      inFlightRef.current.delete(clean);
    }
  }

  function buildKlineTargets(list: Stock[]) {
    const holdingCodes = Object.entries(positionMap)
      .filter(([, pos]) => pos.holdingStatus === "已進場")
      .map(([code]) => code);

    const base = [
      ...holdingCodes,
      ...favoriteCodes,
      ...tomorrowCodes,
      ...entryReadyList.map((stock) => stock.code),
      ...entryPullbackList.map((stock) => stock.code),
      ...reclaimOpenList.map((stock) => stock.code),
      ...continuationStrongList.map((stock) => stock.code),
      ...list.map((stock) => stock.code),
    ];

    const unique = Array.from(new Set(base.map(cleanCode).filter(Boolean)));

    if (settings.klineSaveMode) {
      const important = [
        ...holdingCodes,
        ...favoriteCodes,
        ...tomorrowCodes,
        ...entryReadyList.slice(0, 10).map((stock) => stock.code),
        ...entryPullbackList.slice(0, 10).map((stock) => stock.code),
      ];

      return Array.from(new Set(important.map(cleanCode).filter(Boolean))).slice(0, settings.klineLimit);
    }

    return unique.slice(0, settings.klineLimit);
  }

  async function loadKLinesBatch(list: Stock[], force = false) {
    const targets = buildKlineTargets(list);

    setKlineTargetCount(targets.length);
    setKlineLoadedCount(0);
    setKlineLoading(true);

    for (let i = 0; i < targets.length; i += settings.klineBatchSize) {
      const batch = targets.slice(i, i + settings.klineBatchSize);
      await Promise.all(batch.map((code) => fetchKLine(code, force)));
      setKlineLoadedCount((old) => Math.min(targets.length, old + batch.length));
      await sleep(120);
    }

    setKlineLastUpdatedAt(nowText());
    setKlineLoading(false);
  }

  async function loadStocks({ withKline = true, forceKline = false } = {}) {
    try {
      setUpdating(true);
      setError("");
      setLastAttemptAt(nowText());

      const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API錯誤：${response.status}`);

      const json: ApiResponse = await response.json();

      const list = Array.isArray(json.rankedStocks)
        ? json.rankedStocks
        : Array.isArray(json.stocks)
          ? json.stocks
          : Array.isArray(json.data)
            ? json.data
            : [];

      const dataTime =
        json.updatedAtTaiwan ||
        (json.updatedAt ? new Date(json.updatedAt).toLocaleString("zh-TW") : nowText());

      const normalized = list
        .map((raw) => normalizeStock(raw, dataTime))
        .filter((stock) => stock.code && stock.name && Number.isFinite(stock.changePercent))
        .sort((a, b) => b.changePercent - a.changePercent);

      if (normalized.length === 0) throw new Error("API回傳空資料");

      const oldPriceMap = { ...lastPriceMap };
      const nextPriceMap: Record<string, number> = {};
      const nextDirections: Record<string, PriceDirection> = {};

      normalized.forEach((stock) => {
        const oldPrice = oldPriceMap[stock.code];
        nextPriceMap[stock.code] = stock.price;

        if (oldPrice === undefined) nextDirections[stock.code] = "new";
        else if (stock.price > oldPrice) nextDirections[stock.code] = "up";
        else if (stock.price < oldPrice) nextDirections[stock.code] = "down";
        else nextDirections[stock.code] = "same";
      });

      const successTime = nowText();
      const dataSource = json.source || "TWSE MIS + Yahoo fallback";

      setStocks(normalized);
      setPreviousPriceMap(oldPriceMap);
      setLastPriceMap(nextPriceMap);
      setPriceDirections(nextDirections);
      setLastSuccessAt(successTime);
      setApiDataTime(dataTime);
      setSource(dataSource);
      setUsingCache(false);

      setPositionMap((old) => {
        const next = { ...old };

        normalized.forEach((stock) => {
          const pos = next[stock.code];

          if (pos?.holdingStatus === "已進場") {
            next[stock.code] = {
              ...pos,
              highestPrice: Math.max(pos.highestPrice || 0, stock.price, stock.highPrice),
            };
          }
        });

        localStorage.setItem(POSITION_KEY, JSON.stringify(next));
        return next;
      });

      localStorage.setItem(
        LAST_SUCCESS_KEY,
        JSON.stringify({
          stocks: normalized,
          lastSuccessAt: successTime,
          apiDataTime: dataTime,
          source: dataSource,
        })
      );

      if (withKline) {
        loadKLinesBatch(normalized.slice(0, 50), forceKline);
      }
    } catch (err: any) {
      setUsingCache(true);
      setError(err?.message || "資料更新失敗，已保留上次成功資料");
    } finally {
      setUpdating(false);
      setAutoSeconds(settings.refreshSeconds);
    }
  }

  function filterTopList(list: Stock[]) {
    if (tab !== "top50") return list;

    if (settings.topFilter === "可進場") return list.filter((stock) => entryState(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(stock), posOf(stock)) === "可進場觀察");
    if (settings.topFilter === "等回測") return list.filter((stock) => entryState(stock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(stock), posOf(stock)) === "等回測進場");
    if (settings.topFilter === "站回開盤") return list.filter((stock) => isReclaimOpenAlert(stock, previousPriceMap, priceDirections));
    if (settings.topFilter === "跌破開盤") return list.filter((stock) => isBreakOpenAlert(stock, previousPriceMap));
    if (settings.topFilter === "禁止追高") return list.filter((stock) => isChaseWarning(stock, settings));

    if (settings.topFilter === "續航中") {
      return list.filter((stock) => {
        const state = continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock));
        return state === "開盤強續航" || state === "續航中";
      });
    }

    if (settings.topFilter === "假強警報") return list.filter((stock) => continuationState(stock, top50, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "假強警報");
    if (settings.topFilter === "主流產業") return list.filter((stock) => mainIndustries.includes(stock.industry));
    if (settings.topFilter === "ATR安全") return list.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "安全");
    if (settings.topFilter === "真實ATR") return list.filter((stock) => atrInfoOf(stock).hasReal);

    return list;
  }

  function sortList(list: Stock[]) {
    let arr = filterTopList([...list]);

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword) || stock.industry.includes(keyword));
    }

    if (sortKey === "entry") return arr.sort((a, b) => entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a)));
    if (sortKey === "continuation") return arr.sort((a, b) => continuationScore(b, top50, mainIndustries, settings, priceDirections, atrInfoOf(b), posOf(b)) - continuationScore(a, top50, mainIndustries, settings, priceDirections, atrInfoOf(a), posOf(a)));
    if (sortKey === "opening") return arr.sort((a, b) => openingScore(b, top50, settings) - openingScore(a, top50, settings));
    if (sortKey === "money") return arr.sort((a, b) => moneyScore(b, top50, mainIndustries, settings, priceDirections, atrInfoOf(b), posOf(b)) - moneyScore(a, top50, mainIndustries, settings, priceDirections, atrInfoOf(a), posOf(a)));
    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);
    if (sortKey === "atr") return arr.sort((a, b) => atrRiskScore(a, settings, atrInfoOf(a), posOf(a)) - atrRiskScore(b, settings, atrInfoOf(b), posOf(b)));
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = finalIndustryRanking.findIndex((item) => item.industry === a.industry);
        const ib = finalIndustryRanking.findIndex((item) => item.industry === b.industry);

        if (ia !== ib) return ia - ib;

        return entryScore(b, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(b), posOf(b)) - entryScore(a, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfoOf(a), posOf(a));
      });
    }

    return arr;
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return sortList(top50);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "entryReady") return sortList(entryReadyList);
      if (moreView === "entryPullback") return sortList(entryPullbackList);
      if (moreView === "reclaimOpen") return sortList(reclaimOpenList);
      if (moreView === "breakOpen") return sortList(breakOpenList);
      if (moreView === "chaseWarning") return sortList(chaseWarningList);
      if (moreView === "avoidList") return sortList(avoidList);
      if (moreView === "continuationStrong") return sortList(continuationStrongList);
      if (moreView === "quietContinuation") return sortList(quietContinuationList);
      if (moreView === "fakeStrong") return sortList(fakeStrongList);
      if (moreView === "realAtrSafe") return sortList(realAtrSafeList);
      if (moreView === "atrMissing") return sortList(atrMissingList);
      if (moreView === "industryDetail") return sortList(selectedIndustryStocks);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    entryReadyList,
    entryPullbackList,
    reclaimOpenList,
    breakOpenList,
    chaseWarningList,
    avoidList,
    continuationStrongList,
    quietContinuationList,
    fakeStrongList,
    realAtrSafeList,
    atrMissingList,
    selectedIndustryStocks,
    searchText,
    sortKey,
    mainIndustries,
    settings,
    priceDirections,
    previousPriceMap,
    klineMap,
    positionMap,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  function openIndustry(industry: string) {
    setSelectedIndustry(industry);
    setTab("more");
    setMoreView("industryDetail");
  }

  function clearKlineCache() {
    localStorage.removeItem(KLINE_CACHE_KEY);
    setKlineMap({});
    setKlineFailMap({});
    setKlineLoadedCount(0);
    setKlineTargetCount(0);
  }

  function addWatchableToTomorrow() {
    saveTomorrow([...tomorrowCodes, ...entryReadyList.map((stock) => stock.code), ...entryPullbackList.map((stock) => stock.code)]);
    setTab("tomorrow");
  }

  function setAtrMode(mode: AtrMode) {
    const multiple = mode === "短線" ? 1.5 : mode === "標準" ? 2 : 3;
    saveSettings({ ...settings, atrMode: mode, atrMultiple: multiple });
  }

  const cardProps = {
    top50,
    mainIndustries,
    settings,
    favoriteCodes,
    tomorrowCodes,
    priceDirections,
    previousPriceMap,
    klineMap,
    positionMap,
    lastSuccessAt,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddTomorrow: addTomorrow,
    onRemoveTomorrow: removeTomorrow,
  };

  if (selectedStock) {
    const position = positionMap[selectedStock.code];
    const atrInfo = getAtrInfo(selectedStock, settings, klineMap[selectedStock.code]);
    const entry = entryState(selectedStock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
    const money = moneyState(selectedStock, top50, mainIndustries, settings, priceDirections, atrInfo, position);
    const open = openingState(selectedStock, top50, settings);
    const cont = continuationState(selectedStock, top50, mainIndustries, settings, priceDirections, atrInfo, position);
    const label = decisionLabel(selectedStock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position);
    const direction = priceDirections[selectedStock.code];
    const prevPrice = previousPriceOf(selectedStock, previousPriceMap);
    const diff = instantDiff(selectedStock, previousPriceMap);
    const diffPct = instantPercent(selectedStock, previousPriceMap);
    const links = getKLinks(selectedStock.code, selectedStock.name);
    const manualEntry = position?.entryPrice || selectedStock.openPrice;
    const manualStop = Math.max(0, manualEntry - atrInfo.atr * settings.atrMultiple);

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
          <button onClick={() => setSelectedCode("")} className="mb-4 rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">
            ← 返回上一頁
          </button>

          <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-slate-400">{selectedStock.code}｜{selectedStock.industry}</div>
                <h1 className="mt-1 text-3xl font-black">{selectedStock.name}</h1>
                <div className="mt-1 text-xs font-bold text-cyan-300">
                  {selectedStock.industry} 產業第 {industryRankOf(selectedStock) || "--"} 名
                </div>
              </div>

              <div className={`text-right text-3xl font-black ${selectedStock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPercent(selectedStock.changePercent)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${entryTone(entry)}`}>
              <div className="text-xs font-bold text-slate-400">進場判斷</div>
              <div className="mt-1 text-3xl font-black">{entry}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {entrySentence(selectedStock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(label)}`}>
              <div className="text-xs font-bold text-slate-400">今天該怎麼做</div>
              <div className="mt-1 text-3xl font-black">{label}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                進場分數：{entryScore(selectedStock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)}｜
                風險：{riskLevel(selectedStock, settings, atrInfo, position)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${continuationTone(cont)}`}>
              <div className="text-xs font-bold text-slate-400">盤中續航</div>
              <div className="mt-1 text-2xl font-black">{cont}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {continuationSentence(selectedStock, top50, mainIndustries, settings, priceDirections, atrInfo, position)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${moneyTone(money)}`}>
              <div className="text-xs font-bold text-slate-400">資金判斷</div>
              <div className="mt-1 text-2xl font-black">{money}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                開盤：{open}｜量價：{priceVolumeState(selectedStock, top50, settings)}
              </div>
            </div>

            <section className="mt-4 rounded-2xl bg-blue-950/30 p-4">
              <div className="text-lg font-black text-blue-100">進場價格區間</div>
              <div className="mt-2 text-sm font-bold text-blue-100">
                理想觀察區：{idealEntryZone(selectedStock)}
                <br />
                追高風險區：{chaseZone(selectedStock)}
                <br />
                目前開盤後強弱：{formatPercent(openingAfterPercent(selectedStock))}
                <br />
                開盤溢價率：{formatPercent(openingPremium(selectedStock))}
              </div>
            </section>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${atrTone(selectedStock, settings, atrInfo, position)}`}>
              <div className="text-xs font-bold text-slate-400">日K狀態：{atrInfo.hasReal ? "真實ATR已完成" : klineFailMap[selectedStock.code] ? "使用簡化ATR" : "日K讀取中或等待補抓"}</div>
              <div className="mt-1 text-2xl font-black">ATR狀態：{atrStatus(selectedStock, settings, atrInfo, position)}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                ATR數值：{formatPrice(atrInfo.atr)}
                <br />
                進場後停損：{formatPrice(manualStop)}
                <br />
                進場後移動停利：{formatPrice(atrTrailingStop(selectedStock, settings, atrInfo, position))}
              </div>

              {!atrInfo.hasReal && (
                <button
                  onClick={() => fetchKLine(selectedStock.code, true)}
                  className="mt-3 w-full rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200"
                >
                  重新補抓這檔日K
                </button>
              )}
            </div>

            <section className="mt-4 rounded-2xl bg-slate-950 p-4">
              <div className="text-lg font-black">持有中模式 / 手動進場價</div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["未進場", "已進場"] as HoldingStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      const old = positionMap[selectedStock.code] || {};
                      savePositionMap({
                        ...positionMap,
                        [selectedStock.code]: {
                          ...old,
                          holdingStatus: status,
                          highestPrice: status === "已進場" ? Math.max(old.highestPrice || 0, selectedStock.price, selectedStock.highPrice) : old.highestPrice,
                        },
                      });
                    }}
                    className={`rounded-2xl py-3 text-sm font-black ${
                      (position?.holdingStatus || "未進場") === status ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  value={entryInput}
                  onChange={(e) => setEntryInput(e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  placeholder="輸入進場價"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
                />
                <button
                  onClick={() => {
                    const value = Number(entryInput);
                    if (Number.isFinite(value) && value > 0) {
                      const old = positionMap[selectedStock.code] || {};
                      savePositionMap({
                        ...positionMap,
                        [selectedStock.code]: {
                          ...old,
                          entryPrice: value,
                          highestPrice: Math.max(old.highestPrice || 0, selectedStock.price),
                        },
                      });
                    }
                  }}
                  className="rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white"
                >
                  保存
                </button>
              </div>
            </section>

            <div className="mt-4 rounded-2xl bg-black/30 p-4">
              <div className="text-xs font-bold text-slate-500">即時股價</div>
              <div className={`mt-1 text-xl font-black ${directionTone(direction)}`}>{directionText(direction)}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {prevPrice !== undefined
                  ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${selectedStock.price.toFixed(2)}｜${diff > 0 ? "+" : ""}${diff.toFixed(2)}｜${formatPercent(diffPct)}`
                  : "尚無上一筆股價，等待下一次更新比對。"}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <DetailRow label="進場分數" value={entryScore(selectedStock, top50, mainIndustries, settings, priceDirections, previousPriceMap, atrInfo, position)} />
              <DetailRow label="進場風險" value={riskLevel(selectedStock, settings, atrInfo, position)} />
              <DetailRow label="續航分數" value={continuationScore(selectedStock, top50, mainIndustries, settings, priceDirections, atrInfo, position)} />
              <DetailRow label="量價狀態" value={priceVolumeState(selectedStock, top50, settings)} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
            <h2 className="text-xl font-black">K線入口</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => window.open(links.yahoo)} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">Yahoo K線</button>
              <button onClick={() => window.open(links.tradingView)} className="rounded-2xl bg-blue-500/20 py-3 text-sm font-black text-blue-200">TradingView</button>
              <button onClick={() => window.open(links.goodinfo)} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">Goodinfo</button>
              <button onClick={() => window.open(links.google)} className="rounded-2xl bg-slate-700 py-3 text-sm font-black text-slate-200">Google搜尋</button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 pb-36 pt-14">
        <header className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-slate-400">台股進場確認與警報版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">進場雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                先看主流 → 看續航 → 看位置 → 判斷能不能進場。
              </p>
            </div>

            <button onClick={() => loadStocks({ withKline: true })} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">即時股價狀態：{dataStatus}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：
                {settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-cyan-300">
                日K：{klineLoading ? `讀取中 ${klineLoadedCount}/${klineTargetCount}` : `完成 ${Object.keys(klineMap).length}｜失敗 ${Object.keys(klineFailMap).length}`}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              健康檢查
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">今日進場方向</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {mainIndustries.length ? mainIndustries.map((name, i) => `${i + 1}.${name}`).join("　") : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{entryHomeSentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="進場集中度" value={`${entryConcentrationRate}%`} />
            <DetailRow label="盤中型態" value={entryMarketStructure} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="可進場觀察" value={entryReadyList.length} sub="主流 + 續航 + ATR" tone="text-emerald-300" onClick={() => goMore("entryReady")} />
          <MiniCard title="等回測進場" value={entryPullbackList.length} sub="條件好但位置高" tone="text-yellow-300" onClick={() => goMore("entryPullback")} />
          <MiniCard title="站回開盤" value={reclaimOpenList.length} sub="重新轉強警報" tone="text-cyan-300" onClick={() => goMore("reclaimOpen")} />
          <MiniCard title="跌破開盤" value={breakOpenList.length} sub="續航失敗警報" tone="text-red-300" onClick={() => goMore("breakOpen")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="進場產業排行" sub="主流產業內進場排名" badge={finalIndustryRanking.length} tone="text-yellow-300" onClick={() => goMore("industry")} />
          <ActionCard title="禁止追高" sub="位置太高先等回測" badge={chaseWarningList.length} tone="text-orange-300" onClick={() => goMore("chaseWarning")} />
          <ActionCard title="不要碰清單" sub="假強 / 退潮 / 跌破" badge={avoidList.length} tone="text-red-300" onClick={() => goMore("avoidList")} />
          <ActionCard title="50強" sub="含進場分數" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="明日觀察" sub="進場等待" badge={tomorrowCombined.length} tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <ActionCard title="只更新股價" sub="不重抓日K" badge="快" tone="text-cyan-300" onClick={() => loadStocks({ withKline: false })} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">可搜尋股票、代號、產業。</p>
            </div>

            <button onClick={() => setShowFilters(!showFilters)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">
              篩選
            </button>
          </div>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號、名稱、產業"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["entry", "進場"],
                  ["continuation", "續航"],
                  ["opening", "開盤"],
                  ["money", "資金"],
                  ["industry", "產業"],
                  ["atr", "ATR"],
                  ["change", "漲幅"],
                  ["price", "低價"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key as SortKey)}
                    className={`rounded-2xl py-3 text-xs font-black ${
                      sortKey === key ? "bg-indigo-500 text-white" : "bg-black/30 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "top50" && (
                <div className="grid grid-cols-3 gap-2">
                  {(["全部", "可進場", "等回測", "站回開盤", "跌破開盤", "禁止追高", "續航中", "假強警報", "主流產業", "ATR安全", "真實ATR"] as TopFilter[]).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => saveSettings({ ...settings, topFilter: filter })}
                      className={`rounded-2xl py-3 text-xs font-black ${
                        settings.topFilter === filter ? "bg-cyan-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {tab === "more" && (
          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">更多功能</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="可進場觀察" sub="主流 + 續航 + ATR" badge={entryReadyList.length} tone="text-emerald-300" onClick={() => setMoreView("entryReady")} />
              <ActionCard title="等回測進場" sub="位置太高等回測" badge={entryPullbackList.length} tone="text-yellow-300" onClick={() => setMoreView("entryPullback")} />
              <ActionCard title="站回開盤警報" sub="重新站上開盤" badge={reclaimOpenList.length} tone="text-cyan-300" onClick={() => setMoreView("reclaimOpen")} />
              <ActionCard title="跌破開盤警報" sub="續航失敗警報" badge={breakOpenList.length} tone="text-red-300" onClick={() => setMoreView("breakOpen")} />
              <ActionCard title="禁止追高" sub="等回測不要追" badge={chaseWarningList.length} tone="text-orange-300" onClick={() => setMoreView("chaseWarning")} />
              <ActionCard title="不要碰清單" sub="假強 / 退潮 / 跌破" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoidList")} />
              <ActionCard title="進場產業排行" sub="產業內進場排序" badge={finalIndustryRanking.length} tone="text-yellow-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="快取 / 數量 / ATR" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
            </div>
          </section>
        )}

        <section className="mt-4">
          <div className="mb-3">
            <h2 className="text-2xl font-black">
              {tab === "home" && "今日重點"}
              {tab === "top50" && "📊 今日50強"}
              {tab === "tomorrow" && "📌 明日觀察"}
              {tab === "favorite" && "⭐ 自選股"}
              {tab === "more" && moreView === "entryReady" && "🟢 可進場觀察"}
              {tab === "more" && moreView === "entryPullback" && "🟡 等回測進場"}
              {tab === "more" && moreView === "reclaimOpen" && "🔵 站回開盤警報"}
              {tab === "more" && moreView === "breakOpen" && "🔴 跌破開盤警報"}
              {tab === "more" && moreView === "chaseWarning" && "🟠 禁止追高"}
              {tab === "more" && moreView === "avoidList" && "⛔ 不要碰清單"}
              {tab === "more" && moreView === "industry" && "🏭 進場產業排行"}
              {tab === "more" && moreView === "industryDetail" && `🏭 ${selectedIndustry}`}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              主流：{mainIndustries.slice(0, 3).join("、") || "--"}｜型態：{entryMarketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">主流產業內進場排行</h3>
                <div className="mt-3 space-y-3">
                  {finalIndustryRanking.slice(0, 3).map((item, index) => (
                    <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">今日可進場觀察 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {entryReadyList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確可進場觀察股。
                    </div>
                  )}
                  {entryReadyList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">等回測進場 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {entryPullbackList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確等回測股。
                    </div>
                  )}
                  {entryPullbackList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">不要碰清單</h3>
                <div className="mt-3 space-y-3">
                  {avoidList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯不要碰名單。
                    </div>
                  )}
                  {avoidList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">明日觀察：進場等待</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  續航強但位置高的股票，明天優先等回測。
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={addWatchableToTomorrow} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
                    加入可進場/等回測
                  </button>
                  <button onClick={() => saveTomorrow([])} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                    一鍵清空
                  </button>
                </div>
              </section>

              {tomorrowGroupedByIndustry.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                  目前沒有股票
                </div>
              )}

              {tomorrowGroupedByIndustry.map(([industry, list]) => (
                <section key={industry}>
                  <h3 className="mb-2 text-xl font-black">{industry}｜{list.length}檔</h3>
                  <div className="space-y-3">
                    {list.map((stock, index) => (
                      <StockCard key={stock.code} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {finalIndustryRanking.map((item, index) => (
                <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industryDetail" && selectedIndustryItem && (
            <section className="mb-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
              <div className="text-sm font-bold text-cyan-300">產業進場詳情</div>
              <div className="mt-1 text-3xl font-black">{selectedIndustryItem.industry}</div>
              <div className={`mt-2 text-xl font-black ${industryTone(selectedIndustryItem.status)}`}>{selectedIndustryItem.status}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
                <div className="rounded-2xl bg-black/30 p-3 text-emerald-300">可進場<br />{selectedIndustryItem.entryRate.toFixed(0)}%</div>
                <div className="rounded-2xl bg-black/30 p-3 text-yellow-300">等回測<br />{selectedIndustryItem.pullbackRate.toFixed(0)}%</div>
                <div className="rounded-2xl bg-black/30 p-3 text-orange-300">追高率<br />{selectedIndustryItem.chaseRate.toFixed(0)}%</div>
              </div>
            </section>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">日K抓取數量</div>
                <div className="grid grid-cols-3 gap-2">
                  {[20, 30, 50].map((num) => (
                    <button
                      key={num}
                      onClick={() => saveSettings({ ...settings, klineLimit: num })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.klineLimit === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      前{num}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">日K快取時間</div>
                <div className="grid grid-cols-3 gap-2">
                  {[10, 30, 60].map((min) => (
                    <button
                      key={min}
                      onClick={() => saveSettings({ ...settings, klineCacheMinutes: min })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.klineCacheMinutes === min ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {min}分
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => saveSettings({ ...settings, klineSaveMode: !settings.klineSaveMode })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.klineSaveMode ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                省流量日K模式：{settings.klineSaveMode ? "開啟" : "關閉"}
              </button>

              <div>
                <div className="mb-2 text-lg font-black">ATR模式</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["短線", "標準", "寬鬆"] as AtrMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setAtrMode(mode)}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.atrMode === mode ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

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
                      onClick={() => saveSettings({ ...settings, refreshSeconds: Number(value), dataSaver: Number(value) === 0 })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.refreshSeconds === Number(value) ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料健康檢查：{dataStatus}</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>日K載入進度：{klineLoading ? `${klineLoadedCount}/${klineTargetCount}` : "目前未載入中"}</div>
                <div>真實ATR完成率：{atrCompletionRate}%</div>
                <div>可進場股數：{entryReadyList.length}</div>
                <div>等回測股數：{entryPullbackList.length}</div>
                <div>追高警報股數：{chaseWarningList.length}</div>
                <div>跌破開盤股數：{breakOpenList.length}</div>
                <div>站回開盤股數：{reclaimOpenList.length}</div>
                <div>不要碰股數：{avoidList.length}</div>
                <div>進場主流產業：{mainIndustries[0] || "--"}</div>
                <div>盤中型態：{entryMarketStructure}</div>
                <div>最後日K更新：{klineLastUpdatedAt || "--"}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => loadStocks({ withKline: false })} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                  只更新股價
                </button>
                <button onClick={() => loadKLinesBatch(top50, true)} className="rounded-2xl bg-yellow-500/20 py-3 text-sm font-black text-yellow-200">
                  重新抓日K
                </button>
                <button onClick={clearKlineCache} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                  清除日K快取
                </button>
                <button onClick={() => loadStocks({ withKline: true, forceKline: true })} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">
                  股價+日K全更新
                </button>
              </div>
            </div>
          )}

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["industry", "settings", "data", "menu"].includes(moreView)) && (
              <div className="space-y-3">
                {currentList.length === 0 && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                    目前沒有符合條件的股票。
                  </div>
                )}

                {currentList.map((stock, index) => (
                  <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                ))}
              </div>
            )}
        </section>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-black/90 px-3 pb-8 pt-3 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 text-center">
          {[
            ["home", "📊", "首頁"],
            ["top50", "🔥", "50強"],
            ["tomorrow", "📌", "觀察"],
            ["favorite", "⭐", "自選"],
            ["more", "☰", "更多"],
          ].map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedCode("");
                setTab(key as TabKey);
              }}
              className={`rounded-2xl py-2 text-xs font-black ${
                tab === key ? "bg-slate-800 text-yellow-300" : "text-slate-400"
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
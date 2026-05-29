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
  | "industry"
  | "industryDetail"
  | "industryWatchable"
  | "industryHot"
  | "strongIndustry"
  | "weakIndustry"
  | "hotIndustry"
  | "watchable"
  | "waitPullback"
  | "atrSafe"
  | "realAtrSafe"
  | "atrNear"
  | "atrBroken"
  | "atrMissing"
  | "holdingRisk"
  | "settings"
  | "data";

type PriceDirection = "up" | "down" | "same" | "new";
type DecisionMode = "保守" | "標準" | "積極";
type AtrMode = "短線" | "標準" | "寬鬆";
type ProfitAnchor = "今日高點" | "近N日高點" | "持有後最高價";
type HoldingStatus = "未進場" | "已進場";
type SortKey = "decision" | "score" | "atr" | "change" | "price" | "industry";
type TopFilter =
  | "全部"
  | "可觀察"
  | "等回測"
  | "不追高"
  | "ATR安全"
  | "真實ATR"
  | "主流產業"
  | "ATR風險"
  | "跌破ATR";

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
  decisionMode: DecisionMode;
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

type IndustryItem = {
  industry: string;
  count: number;
  avg: number;
  strongCount: number;
  weakCount: number;
  hotCount: number;
  atrSafeCount: number;
  realAtrCount: number;
  watchableCount: number;
  score: number;
  safetyRate: number;
  hotRate: number;
  weakRate: number;
  concentrationRate: number;
  status: "延續中" | "轉弱中" | "過熱中" | "觀察中";
  stocks: Stock[];
};

const API_URL = "/api/stocks";
const KLINE_API_URL = "/api/kline";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const POSITION_KEY = "taiwan-stock-radar-position-info";
const SETTINGS_KEY = "taiwan-stock-radar-main-industry-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-main-industry-cache";
const KLINE_CACHE_KEY = "taiwan-stock-radar-kline-cache-v3";

const defaultSettings: Settings = {
  maxPrice: 200,
  hotPercent: 8,
  refreshSeconds: 30,
  dataSaver: false,
  decisionMode: "標準",
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

function nowText() {
  return new Date().toLocaleTimeString("zh-TW", { hour12: false });
}

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
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
      : previousClose > 0
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

  if (settings.profitAnchor === "今日高點") {
    return Math.max(stock.highPrice, stock.price, entry);
  }

  if (settings.profitAnchor === "持有後最高價") {
    return Math.max(position?.highestPrice || 0, stock.price, entry);
  }

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

function atrSentence(stock: Stock, settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  const d = atrDistancePercent(stock, settings, atrInfo, position);
  const status = atrStatus(stock, settings, atrInfo, position);

  if (status === "跌破停利") return "已跌破ATR停利線，風控優先。";
  if (status === "接近停利") return `距離停利線約 ${d.toFixed(2)}%，小心轉弱。`;
  if (status === "觀察偏近") return `未進場觀察股，距離ATR觀察線約 ${d.toFixed(2)}%，不要追高。`;
  if (d < 4) return `距離ATR線約 ${d.toFixed(2)}%，偏近。`;
  return `距離ATR線約 ${d.toFixed(2)}%，目前安全。`;
}

function isHot(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || (stock.openPremiumPercent ?? 0) >= 5;
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
  if (stock.openPrice <= 0) return 999;
  return ((stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function isMain(stock: Stock, mainIndustries: string[]) {
  return mainIndustries.includes(stock.industry);
}

function isWaitPullback(stock: Stock, mainIndustries: string[], settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  return (
    isMain(stock, mainIndustries) &&
    isNearOpen(stock) &&
    stock.price >= stock.previousClose &&
    !isHot(stock, settings) &&
    !isAtrBroken(stock, settings, atrInfo, position)
  );
}

function mainScore(stock: Stock, mainIndustries: string[], settings: Settings, atrInfo: AtrInfo, position?: PositionInfo) {
  let score = 0;

  if (isMain(stock, mainIndustries)) score += 32;
  if (stock.price > 0 && stock.price <= settings.maxPrice) score += 22;
  if (stock.changePercent >= 3 && stock.changePercent <= 7.5) score += 18;
  if (stock.price >= stock.openPrice) score += 12;
  if (isBreakout(stock)) score += 10;
  if (isNearOpen(stock)) score += 8;
  if (atrStatus(stock, settings, atrInfo, position) === "安全") score += 10;
  if (atrInfo.hasReal) score += 5;

  if (isHot(stock, settings)) score -= 35;
  if (isWeak(stock)) score -= 30;
  if (isAtrBroken(stock, settings, atrInfo, position)) score -= 35;
  if (isAtrNear(stock, settings, atrInfo, position)) score -= 8;

  if (settings.decisionMode === "保守" && !isMain(stock, mainIndustries)) score -= 30;
  if (settings.decisionMode === "保守" && stock.price > settings.maxPrice) score -= 25;
  if (settings.decisionMode === "積極" && stock.changePercent >= 5) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
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

function decisionLabel(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  if (isAtrBroken(stock, settings, atrInfo, position)) return "跌破ATR";
  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock) || priceDirections[stock.code] === "down") return "移除";
  if (isWaitPullback(stock, mainIndustries, settings, atrInfo, position)) return "等回測";

  const score = mainScore(stock, mainIndustries, settings, atrInfo, position);

  if (settings.decisionMode === "保守") {
    if (isMain(stock, mainIndustries) && stock.price <= settings.maxPrice && score >= 70) return "可觀察";
    return "等回測";
  }

  if (settings.decisionMode === "積極") {
    if (score >= 68 && !isWeak(stock)) return "可觀察";
    if (!isMain(stock, mainIndustries) && stock.changePercent >= 5) return "可觀察";
    return "等回測";
  }

  if (isMain(stock, mainIndustries) && score >= 70) return "可觀察";
  return "等回測";
}

function decisionTone(label: string) {
  if (label === "可觀察") return "text-emerald-300";
  if (label === "等回測") return "text-yellow-300";
  if (label === "不追高") return "text-orange-300";
  if (label === "跌破ATR") return "text-red-300";
  return "text-slate-300";
}

function decisionReason(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  atrInfo: AtrInfo,
  position?: PositionInfo
) {
  const reasons: string[] = [];

  if (isMain(stock, mainIndustries)) reasons.push("主流產業");
  if (stock.price <= settings.maxPrice) reasons.push(`${settings.maxPrice}內`);
  if (priceDirections[stock.code] === "up") reasons.push("即時上升");
  if (stock.price >= stock.openPrice) reasons.push("站上開盤");
  if (isBreakout(stock)) reasons.push("突破");
  if (isNearOpen(stock)) reasons.push("接近開盤");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  if (!isWeak(stock)) reasons.push("未轉弱");
  if (atrStatus(stock, settings, atrInfo, position) === "安全") reasons.push("ATR安全");
  if (atrInfo.hasReal) reasons.push("真實ATR");

  return reasons.length ? reasons.join(" / ") : "暫無明確理由";
}

function getIndustryRanking(
  stocks: Stock[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>,
  mainIndustries: string[],
  getAtr: (stock: Stock) => AtrInfo,
  getPos: (stock: Stock) => PositionInfo | undefined
): IndustryItem[] {
  const map = new Map<string, IndustryItem>();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const atr = getAtr(stock);
    const pos = getPos(stock);
    const status = atrStatus(stock, settings, atr, pos);

    const item =
      map.get(key) ??
      {
        industry: key,
        count: 0,
        avg: 0,
        strongCount: 0,
        weakCount: 0,
        hotCount: 0,
        atrSafeCount: 0,
        realAtrCount: 0,
        watchableCount: 0,
        score: 0,
        safetyRate: 0,
        hotRate: 0,
        weakRate: 0,
        concentrationRate: 0,
        status: "觀察中",
        stocks: [],
      };

    item.count += 1;
    item.avg += stock.changePercent;
    item.stocks.push(stock);

    if (priceDirections[stock.code] === "up" && stock.price >= stock.openPrice) item.strongCount += 1;
    if (isWeak(stock)) item.weakCount += 1;
    if (isHot(stock, settings)) item.hotCount += 1;
    if (status === "安全") item.atrSafeCount += 1;
    if (atr.hasReal) item.realAtrCount += 1;

    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avg = item.avg / Math.max(item.count, 1);
      const safetyRate = (item.atrSafeCount / Math.max(item.count, 1)) * 100;
      const hotRate = (item.hotCount / Math.max(item.count, 1)) * 100;
      const weakRate = (item.weakCount / Math.max(item.count, 1)) * 100;
      const concentrationRate = (item.count / Math.max(stocks.length, 1)) * 100;

      let status: IndustryItem["status"] = "觀察中";

      if (hotRate >= 35) status = "過熱中";
      else if (weakRate >= 40) status = "轉弱中";
      else if (avg >= 3 && safetyRate >= 50 && item.strongCount >= Math.max(1, Math.ceil(item.count * 0.35))) status = "延續中";

      const score =
        item.count * 11 +
        avg * 3.5 +
        item.strongCount * 6 +
        item.atrSafeCount * 4 +
        item.realAtrCount * 2 -
        item.hotCount * 4 -
        item.weakCount * 5;

      return {
        ...item,
        avg,
        safetyRate,
        hotRate,
        weakRate,
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
  if (status === "延續中") return "text-emerald-300";
  if (status === "過熱中") return "text-orange-300";
  if (status === "轉弱中") return "text-red-300";
  return "text-yellow-300";
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
          <div className="text-xs font-bold text-slate-500">#{rank} 今日主流產業</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${industryTone(item.status)}`}>{item.status}</div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black text-yellow-300">{item.count}檔</div>
          <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
            平均 {formatPercent(item.avg)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">安全率<br />{item.safetyRate.toFixed(0)}%</div>
        <div className="rounded-2xl bg-black/30 p-2 text-orange-300">過熱率<br />{item.hotRate.toFixed(0)}%</div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">轉弱率<br />{item.weakRate.toFixed(0)}%</div>
      </div>
    </button>
  );
}

function StockCard({
  stock,
  rank,
  industryRank,
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
  const label = decisionLabel(stock, mainIndustries, settings, priceDirections, atrInfo, position);
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
          <span className={`rounded-full bg-black/40 px-3 py-1 ${atrTone(stock, settings, atrInfo, position)}`}>ATR {atrStatus(stock, settings, atrInfo, position)}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">{atrInfo.source}</span>
          <span className="rounded-full bg-orange-950 px-3 py-1 text-orange-200">主線 {mainScore(stock, mainIndustries, settings, atrInfo, position)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {position?.holdingStatus === "已進場" && <span className="rounded-full bg-purple-500/20 px-3 py-1 text-purple-200">已進場</span>}
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          {decisionReason(stock, mainIndustries, settings, priceDirections, atrInfo, position)}
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
  const [sortKey, setSortKey] = useState<SortKey>("industry");
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
      ...watchableList.map((stock) => stock.code),
      ...list.map((stock) => stock.code),
    ];

    const unique = Array.from(new Set(base.map(cleanCode).filter(Boolean)));

    if (settings.klineSaveMode) {
      const important = [
        ...holdingCodes,
        ...favoriteCodes,
        ...tomorrowCodes,
        ...watchableList.slice(0, 10).map((stock) => stock.code),
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

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  function atrInfoOf(stock: Stock) {
    return getAtrInfo(stock, settings, klineMap[stock.code]);
  }

  function posOf(stock: Stock) {
    return positionMap[stock.code];
  }

  const industryRanking = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections, [], atrInfoOf, posOf),
    [top50, settings, priceDirections, klineMap, positionMap]
  );

  const mainIndustries = useMemo(() => industryRanking.slice(0, 3).map((item) => item.industry), [industryRanking]);

  const finalIndustryRanking = useMemo(
    () => getIndustryRanking(top50, settings, priceDirections, mainIndustries, atrInfoOf, posOf),
    [top50, settings, priceDirections, klineMap, positionMap, mainIndustries]
  );

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
        list.sort((a, b) => mainScore(b, mainIndustries, settings, atrInfoOf(b), posOf(b)) - mainScore(a, mainIndustries, settings, atrInfoOf(a), posOf(a)))
      );
    });

    return map;
  }, [top50, mainIndustries, settings, klineMap, positionMap]);

  function industryRankOf(stock: Stock) {
    const list = industryMapList.get(stock.industry) || [];
    const index = list.findIndex((item) => item.code === stock.code);
    return index >= 0 ? index + 1 : undefined;
  }

  const watchableList = useMemo(
    () =>
      top50
        .filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "可觀察")
        .sort((a, b) => mainScore(b, mainIndustries, settings, atrInfoOf(b), posOf(b)) - mainScore(a, mainIndustries, settings, atrInfoOf(a), posOf(a))),
    [top50, mainIndustries, settings, priceDirections, klineMap, positionMap]
  );

  const waitPullbackList = useMemo(
    () =>
      top50
        .filter((stock) => isWaitPullback(stock, mainIndustries, settings, atrInfoOf(stock), posOf(stock)))
        .sort((a, b) => Math.abs(distanceFromOpen(a)) - Math.abs(distanceFromOpen(b))),
    [top50, mainIndustries, settings, klineMap, positionMap]
  );

  const atrSafeList = useMemo(
    () => top50.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "安全"),
    [top50, settings, klineMap, positionMap]
  );

  const realAtrSafeList = useMemo(
    () => atrSafeList.filter((stock) => atrInfoOf(stock).hasReal),
    [atrSafeList, klineMap, settings]
  );

  const atrNearList = useMemo(
    () => top50.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "接近停利" || atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "觀察偏近"),
    [top50, settings, klineMap, positionMap]
  );

  const atrBrokenList = useMemo(
    () => top50.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "跌破停利"),
    [top50, settings, klineMap, positionMap]
  );

  const atrMissingList = useMemo(
    () => top50.filter((stock) => !atrInfoOf(stock).hasReal),
    [top50, settings, klineMap]
  );

  const holdingRiskList = useMemo(
    () =>
      top50
        .filter((stock) => posOf(stock)?.holdingStatus === "已進場")
        .filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) !== "安全"),
    [top50, settings, klineMap, positionMap]
  );

  const strongIndustryList = useMemo(() => finalIndustryRanking.filter((item) => item.status === "延續中"), [finalIndustryRanking]);
  const weakIndustryList = useMemo(() => finalIndustryRanking.filter((item) => item.status === "轉弱中"), [finalIndustryRanking]);
  const hotIndustryList = useMemo(() => finalIndustryRanking.filter((item) => item.status === "過熱中"), [finalIndustryRanking]);

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const tomorrowStocksManual = useMemo(
    () => tomorrowCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [tomorrowCodes, stocks]
  );

  const tomorrowAutoList = useMemo(() => watchableList.slice(0, 20), [watchableList]);

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

  const tomorrowAtrBroken = useMemo(
    () => tomorrowCombined.filter((stock) => isAtrBroken(stock, settings, atrInfoOf(stock), posOf(stock))),
    [tomorrowCombined, settings, klineMap, positionMap]
  );

  const atrCompletionRate = useMemo(() => {
    const total = Math.max(1, Math.min(settings.klineLimit, top50.length));
    const real = top50.slice(0, settings.klineLimit).filter((stock) => atrInfoOf(stock).hasReal).length;
    return Math.round((real / total) * 100);
  }, [top50, settings.klineLimit, klineMap]);

  const mainConcentrationRate = useMemo(() => {
    const count = top50.filter((stock) => mainIndustries.includes(stock.industry)).length;
    return top50.length ? Math.round((count / top50.length) * 100) : 0;
  }, [top50, mainIndustries]);

  const marketStructure = useMemo(() => {
    if (hotIndustryList.length >= 2) return "過熱退潮";
    if (mainConcentrationRate >= 40 && strongIndustryList.length >= 2) return "主線清楚";
    if (mainConcentrationRate < 25) return "題材分散";
    return "等回測";
  }, [hotIndustryList, mainConcentrationRate, strongIndustryList]);

  const dataStatus = useMemo(() => {
    if (updating) return "更新中";
    if (error) return "API錯誤";
    if (usingCache) return "使用快取";
    if (lastSuccessAt) return "即時正常";
    return "讀取中";
  }, [updating, error, usingCache, lastSuccessAt]);

  const riskMode = useMemo(() => {
    if (holdingRiskList.length >= 2 || atrBrokenList.length >= 5) return { label: "風控優先", tone: "text-red-300" };
    if (atrNearList.length >= 8) return { label: "小心", tone: "text-yellow-300" };
    return { label: "正常", tone: "text-emerald-300" };
  }, [holdingRiskList, atrBrokenList, atrNearList]);

  const mainIndustrySentence = useMemo(() => {
    const top = finalIndustryRanking[0];

    if (!top) return "目前主流產業尚未形成，先等資料更新。";
    if (top.status === "延續中") return `${top.industry}是目前主線，安全率 ${top.safetyRate.toFixed(0)}%，優先從裡面挑ATR安全股。`;
    if (top.status === "過熱中") return `${top.industry}雖然強，但過熱率 ${top.hotRate.toFixed(0)}%，不建議追高。`;
    if (top.status === "轉弱中") return `${top.industry}進榜多但轉弱率偏高，先等回測確認。`;
    return `${top.industry}暫列第一，但仍屬觀察中，先看個股是否站上開盤。`;
  }, [finalIndustryRanking]);

  const todaySummary = useMemo(() => {
    const main = mainIndustries.slice(0, 3).join("、") || "主流產業";

    if (marketStructure === "主線清楚") return `今天主線集中在 ${main}，優先挑主流內ATR安全股。`;
    if (marketStructure === "過熱退潮") return `今天有產業過熱，主流仍要看，但不要追高。`;
    if (marketStructure === "題材分散") return `今天題材分散，先看產業排名前3名，不急著追。`;
    return `今天先等回測，主流產業內接近開盤且ATR安全者優先。`;
  }, [marketStructure, mainIndustries]);

  const selectedStock = useMemo(
    () => stocks.find((stock) => stock.code === selectedCode) || null,
    [stocks, selectedCode]
  );

  useEffect(() => {
    if (selectedStock && !klineMap[selectedStock.code] && !inFlightRef.current.has(selectedStock.code)) {
      fetchKLine(selectedStock.code);
    }

    if (selectedStock) {
      const pos = positionMap[selectedStock.code];
      setEntryInput(pos?.entryPrice ? String(pos.entryPrice) : String(selectedStock.openPrice || ""));
    }
  }, [selectedStock]);

  const selectedIndustryItem = useMemo(
    () => finalIndustryRanking.find((item) => item.industry === selectedIndustry) || null,
    [finalIndustryRanking, selectedIndustry]
  );

  const selectedIndustryStocks = useMemo(() => {
    if (!selectedIndustry) return [];

    return top50
      .filter((stock) => stock.industry === selectedIndustry)
      .sort((a, b) => {
        const atrA = atrInfoOf(a);
        const atrB = atrInfoOf(b);
        const posA = posOf(a);
        const posB = posOf(b);

        const safeA = atrStatus(a, settings, atrA, posA) === "安全" ? 1 : 0;
        const safeB = atrStatus(b, settings, atrB, posB) === "安全" ? 1 : 0;

        if (safeA !== safeB) return safeB - safeA;

        return mainScore(b, mainIndustries, settings, atrB, posB) - mainScore(a, mainIndustries, settings, atrA, posA);
      });
  }, [selectedIndustry, top50, settings, klineMap, positionMap, mainIndustries]);

  function filterTopList(list: Stock[]) {
    if (tab !== "top50") return list;

    if (settings.topFilter === "可觀察") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "可觀察");
    if (settings.topFilter === "等回測") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "等回測");
    if (settings.topFilter === "不追高") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections, atrInfoOf(stock), posOf(stock)) === "不追高");
    if (settings.topFilter === "ATR安全") return list.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "安全");
    if (settings.topFilter === "真實ATR") return list.filter((stock) => atrInfoOf(stock).hasReal);
    if (settings.topFilter === "主流產業") return list.filter((stock) => mainIndustries.includes(stock.industry));
    if (settings.topFilter === "ATR風險") return list.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) !== "安全");
    if (settings.topFilter === "跌破ATR") return list.filter((stock) => atrStatus(stock, settings, atrInfoOf(stock), posOf(stock)) === "跌破停利");

    return list;
  }

  function sortList(list: Stock[]) {
    let arr = filterTopList([...list]);

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword) || stock.industry.includes(keyword));
    }

    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);
    if (sortKey === "score") return arr.sort((a, b) => mainScore(b, mainIndustries, settings, atrInfoOf(b), posOf(b)) - mainScore(a, mainIndustries, settings, atrInfoOf(a), posOf(a)));
    if (sortKey === "atr") return arr.sort((a, b) => atrRiskScore(a, settings, atrInfoOf(a), posOf(a)) - atrRiskScore(b, settings, atrInfoOf(b), posOf(b)));
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = finalIndustryRanking.findIndex((item) => item.industry === a.industry);
        const ib = finalIndustryRanking.findIndex((item) => item.industry === b.industry);

        if (ia !== ib) return ia - ib;

        return mainScore(b, mainIndustries, settings, atrInfoOf(b), posOf(b)) - mainScore(a, mainIndustries, settings, atrInfoOf(a), posOf(a));
      });
    }

    return arr.sort((a, b) => {
      const order: Record<string, number> = { 可觀察: 1, 等回測: 2, 不追高: 3, 移除: 4, 跌破ATR: 5 };
      const da = decisionLabel(a, mainIndustries, settings, priceDirections, atrInfoOf(a), posOf(a));
      const db = decisionLabel(b, mainIndustries, settings, priceDirections, atrInfoOf(b), posOf(b));
      return (order[da] || 99) - (order[db] || 99);
    });
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return sortList(top50);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "watchable") return sortList(watchableList);
      if (moreView === "waitPullback") return sortList(waitPullbackList);
      if (moreView === "atrSafe") return sortList(atrSafeList);
      if (moreView === "realAtrSafe") return sortList(realAtrSafeList);
      if (moreView === "atrNear") return sortList(atrNearList);
      if (moreView === "atrBroken") return sortList(atrBrokenList);
      if (moreView === "atrMissing") return sortList(atrMissingList);
      if (moreView === "holdingRisk") return sortList(holdingRiskList);
      if (moreView === "industryDetail") return sortList(selectedIndustryStocks);
      if (moreView === "industryWatchable") {
        return sortList(
          selectedIndustryStocks.filter((stock) => {
            const atr = atrInfoOf(stock);
            const pos = posOf(stock);
            return stock.price <= settings.maxPrice && !isHot(stock, settings) && atrStatus(stock, settings, atr, pos) === "安全";
          })
        );
      }
      if (moreView === "industryHot") return sortList(selectedIndustryStocks.filter((stock) => isHot(stock, settings)));
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    watchableList,
    waitPullbackList,
    atrSafeList,
    realAtrSafeList,
    atrNearList,
    atrBrokenList,
    atrMissingList,
    holdingRiskList,
    selectedIndustryStocks,
    searchText,
    sortKey,
    mainIndustries,
    settings,
    priceDirections,
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
    saveTomorrow([...tomorrowCodes, ...watchableList.map((stock) => stock.code)]);
    setTab("tomorrow");
  }

  function removeAtrBrokenTomorrow() {
    const removeSet = new Set(tomorrowAtrBroken.map((stock) => stock.code));
    saveTomorrow(tomorrowCodes.filter((code) => !removeSet.has(code)));
  }

  function setAtrMode(mode: AtrMode) {
    const multiple = mode === "短線" ? 1.5 : mode === "標準" ? 2 : 3;
    saveSettings({ ...settings, atrMode: mode, atrMultiple: multiple });
  }

  const cardProps = {
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
    const label = decisionLabel(selectedStock, mainIndustries, settings, priceDirections, atrInfo, position);
    const direction = priceDirections[selectedStock.code];
    const prevPrice = previousPriceOf(selectedStock, previousPriceMap);
    const diff = instantDiff(selectedStock, previousPriceMap);
    const diffPct = instantPercent(selectedStock, previousPriceMap);
    const links = getKLinks(selectedStock.code, selectedStock.name);

    const todayAction =
      isAtrBroken(selectedStock, settings, atrInfo, position)
        ? "跌破移除"
        : isAtrNear(selectedStock, settings, atrInfo, position)
          ? position?.holdingStatus === "已進場"
            ? "守ATR"
            : "觀察偏近"
          : label === "可觀察"
            ? "可觀察"
            : label === "等回測"
              ? "等回測"
              : "不追高";

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

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(label)}`}>
              <div className="text-xs font-bold text-slate-400">今天該怎麼做</div>
              <div className="mt-1 text-3xl font-black">{todayAction}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {decisionReason(selectedStock, mainIndustries, settings, priceDirections, atrInfo, position)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${atrTone(selectedStock, settings, atrInfo, position)}`}>
              <div className="text-xs font-bold text-slate-400">日K狀態：{atrInfo.hasReal ? "真實ATR已完成" : klineFailMap[selectedStock.code] ? "使用簡化ATR" : "日K讀取中或等待補抓"}</div>
              <div className="mt-1 text-2xl font-black">ATR狀態：{atrStatus(selectedStock, settings, atrInfo, position)}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {atrSentence(selectedStock, settings, atrInfo, position)}
                <br />
                ATR來源：{atrInfo.source}
                <br />
                ATR數值：{formatPrice(atrInfo.atr)}
                <br />
                ATR停損價：{formatPrice(atrStopLoss(selectedStock, settings, atrInfo, position))}
                <br />
                ATR移動停利價：{formatPrice(atrTrailingStop(selectedStock, settings, atrInfo, position))}
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

            <section className="mt-4 rounded-2xl bg-yellow-950/30 p-4">
              <div className="text-lg font-black text-yellow-100">近{settings.atrDays}日波動</div>
              <div className="mt-2 text-sm font-bold text-yellow-100">
                近{settings.atrDays}日最高：{formatPrice(atrInfo.highN)}
                <br />
                近{settings.atrDays}日最低：{formatPrice(atrInfo.lowN)}
                <br />
                波動幅度：{formatPercent(atrInfo.rangePercent)}
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
              <DetailRow label="主線分數" value={mainScore(selectedStock, mainIndustries, settings, atrInfo, position)} />
              <DetailRow label="ATR風險分" value={atrRiskScore(selectedStock, settings, atrInfo, position)} />
              <DetailRow label="產業排名" value={`${selectedStock.industry} 第 ${industryRankOf(selectedStock) || "--"}`} />
              <DetailRow label="停利基準" value={settings.profitAnchor} />
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
              <div className="text-sm font-bold text-slate-400">台股主流產業優化版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">主流產業雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                先看主流產業，再從主流裡挑安全股。
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
          <div className="text-xs font-bold text-yellow-300">今日主流產業</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {mainIndustries.length ? mainIndustries.map((name, i) => `${i + 1}.${name}`).join("　") : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{mainIndustrySentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="主流集中度" value={`${mainConcentrationRate}%`} />
            <DetailRow label="盤面結構" value={marketStructure} />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
          <div className="text-xs font-bold text-emerald-300">今日決策總結</div>
          <div className="mt-1 text-xl font-black text-emerald-100">{todaySummary}</div>
          <div className={`mt-2 text-2xl font-black ${riskMode.tone}`}>風控模式：{riskMode.label}</div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="主流集中度" value={`${mainConcentrationRate}%`} sub="前三產業佔50強比例" tone="text-cyan-300" onClick={() => goMore("industry")} />
          <MiniCard title="延續產業" value={strongIndustryList.length} sub="安全率高且轉強" tone="text-emerald-300" onClick={() => goMore("strongIndustry")} />
          <MiniCard title="過熱產業" value={hotIndustryList.length} sub="不適合追高" tone="text-orange-300" onClick={() => goMore("hotIndustry")} />
          <MiniCard title="轉弱產業" value={weakIndustryList.length} sub="小心退潮" tone="text-red-300" onClick={() => goMore("weakIndustry")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="產業熱度" sub="主流產業完整排行" badge={finalIndustryRanking.length} tone="text-cyan-300" onClick={() => goMore("industry")} />
          <ActionCard title="產業輪動" sub="轉強 / 退潮 / 過熱" badge={marketStructure} tone="text-yellow-300" onClick={() => goMore("strongIndustry")} />
          <ActionCard title="50強" sub="含產業排名" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="明日觀察" sub="依產業分組" badge={tomorrowCombined.length} tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <ActionCard title="可觀察雷達" sub="主流 + ATR安全" badge={watchableList.length} tone="text-emerald-300" onClick={() => goMore("watchable")} />
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
              <div className="grid grid-cols-6 gap-2">
                {[
                  ["industry", "產業"],
                  ["decision", "決策"],
                  ["score", "主線"],
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
                  {(["全部", "可觀察", "等回測", "不追高", "ATR安全", "真實ATR", "主流產業", "ATR風險", "跌破ATR"] as TopFilter[]).map((filter) => (
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
              <ActionCard title="產業熱度" sub="主流產業排行" badge={finalIndustryRanking.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="轉強產業" sub="延續中產業" badge={strongIndustryList.length} tone="text-emerald-300" onClick={() => setMoreView("strongIndustry")} />
              <ActionCard title="退潮產業" sub="轉弱中產業" badge={weakIndustryList.length} tone="text-red-300" onClick={() => setMoreView("weakIndustry")} />
              <ActionCard title="過熱產業" sub="不追高提醒" badge={hotIndustryList.length} tone="text-orange-300" onClick={() => setMoreView("hotIndustry")} />
              <ActionCard title="真實ATR安全股" sub="日K成功 + ATR安全" badge={realAtrSafeList.length} tone="text-emerald-300" onClick={() => setMoreView("realAtrSafe")} />
              <ActionCard title="ATR資料不足" sub="使用簡化ATR備援" badge={atrMissingList.length} tone="text-yellow-300" onClick={() => setMoreView("atrMissing")} />
              <ActionCard title="持有中風控" sub="已進場股票" badge={holdingRiskList.length} tone="text-orange-300" onClick={() => setMoreView("holdingRisk")} />
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
              {tab === "more" && moreView === "industry" && "🏭 產業熱度"}
              {tab === "more" && moreView === "industryDetail" && `🏭 ${selectedIndustry}`}
              {tab === "more" && moreView === "industryWatchable" && `✅ ${selectedIndustry} 可觀察`}
              {tab === "more" && moreView === "industryHot" && `🔥 ${selectedIndustry} 過熱`}
              {tab === "more" && moreView === "strongIndustry" && "🟢 轉強產業"}
              {tab === "more" && moreView === "weakIndustry" && "🔴 退潮產業"}
              {tab === "more" && moreView === "hotIndustry" && "🟠 過熱產業"}
              {tab === "more" && moreView === "watchable" && "✅ 可觀察雷達"}
              {tab === "more" && moreView === "waitPullback" && "↩️ 等回測雷達"}
              {tab === "more" && moreView === "atrSafe" && "🟢 ATR安全股"}
              {tab === "more" && moreView === "realAtrSafe" && "🟢 真實ATR安全股"}
              {tab === "more" && moreView === "atrNear" && "🟡 接近ATR線"}
              {tab === "more" && moreView === "atrBroken" && "🔴 跌破ATR"}
              {tab === "more" && moreView === "atrMissing" && "🟡 ATR資料不足"}
              {tab === "more" && moreView === "holdingRisk" && "⚠️ 持有中風控"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              主流：{mainIndustries.slice(0, 3).join("、") || "--"}｜結構：{marketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
                <h3 className="text-xl font-black">前三主流產業</h3>
                <div className="mt-3 space-y-3">
                  {finalIndustryRanking.slice(0, 3).map((item, index) => (
                    <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">主流裡最該看 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {watchableList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確可觀察股票。
                    </div>
                  )}
                  {watchableList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} industryRank={industryRankOf(stock)} {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">明日觀察：依產業分組</h3>
                <div className="mt-2 text-sm font-bold text-cyan-100">
                  先看主流產業是否延續，再看個股是否ATR安全。
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={addWatchableToTomorrow} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
                    加入可觀察
                  </button>
                  <button onClick={removeAtrBrokenTomorrow} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                    移除跌破ATR
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

          {tab === "more" && moreView === "strongIndustry" && (
            <div className="space-y-3">
              {strongIndustryList.length === 0 && <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">目前沒有明確轉強產業。</div>}
              {strongIndustryList.map((item, index) => (
                <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "weakIndustry" && (
            <div className="space-y-3">
              {weakIndustryList.length === 0 && <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">目前沒有明顯退潮產業。</div>}
              {weakIndustryList.map((item, index) => (
                <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "hotIndustry" && (
            <div className="space-y-3">
              {hotIndustryList.length === 0 && <div className="rounded-2xl bg-slate-950 p-5 text-slate-400">目前沒有明顯過熱產業。</div>}
              {hotIndustryList.map((item, index) => (
                <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => openIndustry(item.industry)} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industryDetail" && selectedIndustryItem && (
            <section className="mb-4 rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-5">
              <div className="text-sm font-bold text-cyan-300">產業詳情</div>
              <div className="mt-1 text-3xl font-black">{selectedIndustryItem.industry}</div>
              <div className={`mt-2 text-xl font-black ${industryTone(selectedIndustryItem.status)}`}>{selectedIndustryItem.status}</div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
                <div className="rounded-2xl bg-black/30 p-3 text-emerald-300">安全率<br />{selectedIndustryItem.safetyRate.toFixed(0)}%</div>
                <div className="rounded-2xl bg-black/30 p-3 text-orange-300">過熱率<br />{selectedIndustryItem.hotRate.toFixed(0)}%</div>
                <div className="rounded-2xl bg-black/30 p-3 text-red-300">轉弱率<br />{selectedIndustryItem.weakRate.toFixed(0)}%</div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => setMoreView("industryWatchable")} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
                  產業內可觀察
                </button>
                <button onClick={() => setMoreView("industryHot")} className="rounded-2xl bg-orange-500/20 py-3 text-sm font-black text-orange-200">
                  產業內過熱
                </button>
              </div>
            </section>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
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

              <button
                onClick={() => saveSettings({ ...settings, klineSaveMode: !settings.klineSaveMode })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.klineSaveMode ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                省流量日K模式：{settings.klineSaveMode ? "開啟" : "關閉"}
              </button>

              <div>
                <div className="mb-2 text-lg font-black">ATR天數</div>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 20].map((days) => (
                    <button
                      key={days}
                      onClick={() => saveSettings({ ...settings, atrDays: days })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.atrDays === days ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {days}日
                    </button>
                  ))}
                </div>
              </div>

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
                <div>真實ATR：{Object.keys(klineMap).length} 檔</div>
                <div>日K失敗：{Object.keys(klineFailMap).length} 檔</div>
                <div>產業數量：{finalIndustryRanking.length}</div>
                <div>前三產業：{mainIndustries.join("、") || "--"}</div>
                <div>主流集中度：{mainConcentrationRate}%</div>
                <div>盤面結構：{marketStructure}</div>
                <div>過熱產業數：{hotIndustryList.length}</div>
                <div>轉弱產業數：{weakIndustryList.length}</div>
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
            !(tab === "more" && ["industry", "strongIndustry", "weakIndustry", "hotIndustry", "settings", "data", "menu"].includes(moreView)) && (
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
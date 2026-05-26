import { useEffect, useMemo, useState } from "react";

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

type TabKey = "home" | "top50" | "tomorrow" | "favorite" | "more";

type MoreView =
  | "menu"
  | "industry"
  | "watchable"
  | "waitPullback"
  | "atrSafe"
  | "atrWatchable"
  | "atrPullback"
  | "atrNear"
  | "atrBroken"
  | "atrMainRisk"
  | "chaseRisk"
  | "tomorrowPriority"
  | "data"
  | "settings";

type PriceDirection = "up" | "down" | "same" | "new";
type DecisionMode = "保守" | "標準" | "積極";
type AtrMode = "短線" | "標準" | "寬鬆";
type AtrSensitivity = "敏感" | "標準" | "保守";
type RiskDisplayMode = "簡單" | "詳細";

type TopFilter =
  | "全部"
  | "可觀察"
  | "等回測"
  | "不追高"
  | "ATR安全"
  | "ATR安全可觀察"
  | "ATR風險"
  | "跌破ATR";

type SortKey = "decision" | "score" | "atr" | "change" | "price";

type Settings = {
  maxPrice: number;
  hotPercent: number;
  refreshSeconds: number;
  dataSaver: boolean;
  decisionMode: DecisionMode;
  atrMode: AtrMode;
  atrMultiple: number;
  atrSensitivity: AtrSensitivity;
  riskDisplayMode: RiskDisplayMode;
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

type IndustryItem = {
  industry: string;
  count: number;
  avg: number;
  strongCount: number;
  hotCount: number;
  weakCount: number;
  score: number;
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const ENTRY_PRICE_KEY = "taiwan-stock-radar-entry-prices";
const SETTINGS_KEY = "taiwan-stock-radar-atr-practical-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-atr-practical-cache";

const defaultSettings: Settings = {
  maxPrice: 200,
  hotPercent: 8,
  refreshSeconds: 30,
  dataSaver: false,
  decisionMode: "標準",
  atrMode: "標準",
  atrMultiple: 2,
  atrSensitivity: "標準",
  riskDisplayMode: "詳細",
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

function isMain(stock: Stock, mainIndustries: string[]) {
  return mainIndustries.includes(stock.industry);
}

function sensitivityFloor(settings: Settings) {
  if (settings.atrSensitivity === "敏感") return 0.012;
  if (settings.atrSensitivity === "保守") return 0.025;
  return 0.018;
}

function simplifiedAtr(stock: Stock, settings: Settings) {
  const range1 = Math.abs(stock.highPrice - stock.lowPrice);
  const range2 = Math.abs(stock.highPrice - stock.previousClose);
  const range3 = Math.abs(stock.lowPrice - stock.previousClose);
  const rawAtr = Math.max(range1, range2, range3);

  const minAtr = stock.price * sensitivityFloor(settings);
  const atr = Math.max(rawAtr, minAtr);

  return Number.isFinite(atr) && atr > 0 ? atr : stock.price * 0.02;
}

function atrStopLossFromEntry(entryPrice: number, stock: Stock, settings: Settings) {
  return Math.max(0, entryPrice - simplifiedAtr(stock, settings) * settings.atrMultiple);
}

function atrStopLoss(stock: Stock, settings: Settings, entryPrice?: number) {
  const base = entryPrice && entryPrice > 0 ? entryPrice : stock.openPrice;
  return atrStopLossFromEntry(base, stock, settings);
}

function atrTrailingStop(stock: Stock, settings: Settings, entryPrice?: number) {
  const base = entryPrice && entryPrice > 0 ? entryPrice : stock.openPrice;
  const anchor = Math.max(stock.price, stock.highPrice, base);
  return Math.max(0, anchor - simplifiedAtr(stock, settings) * settings.atrMultiple);
}

function atrDistancePercent(stock: Stock, settings: Settings, entryPrice?: number) {
  const line = atrTrailingStop(stock, settings, entryPrice);
  if (stock.price <= 0) return 999;
  return ((stock.price - line) / stock.price) * 100;
}

function isAtrBroken(stock: Stock, settings: Settings, entryPrice?: number) {
  return stock.price < atrTrailingStop(stock, settings, entryPrice);
}

function isAtrNear(stock: Stock, settings: Settings, entryPrice?: number) {
  const d = atrDistancePercent(stock, settings, entryPrice);
  return d >= 0 && d <= 2.5;
}

function atrRiskScore(stock: Stock, settings: Settings, entryPrice?: number) {
  if (isAtrBroken(stock, settings, entryPrice)) return 100;
  const d = atrDistancePercent(stock, settings, entryPrice);
  if (d >= 10) return 10;
  if (d <= 0) return 100;
  return Math.round(100 - d * 9);
}

function atrStatus(stock: Stock, settings: Settings, entryPrice?: number) {
  if (isHot(stock, settings)) return "過熱";
  if (isAtrBroken(stock, settings, entryPrice)) return "跌破停利";
  if (isAtrNear(stock, settings, entryPrice)) return "接近停利";
  return "安全";
}

function atrTone(stock: Stock, settings: Settings, entryPrice?: number) {
  const status = atrStatus(stock, settings, entryPrice);
  if (status === "安全") return "text-emerald-300";
  if (status === "接近停利") return "text-yellow-300";
  if (status === "跌破停利") return "text-red-300";
  return "text-orange-300";
}

function atrSentence(stock: Stock, settings: Settings, entryPrice?: number) {
  const d = atrDistancePercent(stock, settings, entryPrice);
  const status = atrStatus(stock, settings, entryPrice);

  if (status === "跌破停利") return "已跌破ATR停利線，風控優先。";
  if (status === "接近停利") return `距離停利線約 ${d.toFixed(2)}%，小心轉弱。`;
  if (d < 4) return `距離停利線約 ${d.toFixed(2)}%，偏近。`;
  return `距離停利線約 ${d.toFixed(2)}%，目前安全。`;
}

function isAtrTooSensitive(stock: Stock, settings: Settings) {
  const rawRange = Math.abs(stock.highPrice - stock.lowPrice);
  const atr = simplifiedAtr(stock, settings);
  return atrDistancePercent(stock, settings) < 1.5 || atr <= rawRange * 1.05;
}

function isWaitPullback(stock: Stock, mainIndustries: string[], settings: Settings) {
  return (
    isMain(stock, mainIndustries) &&
    isNearOpen(stock) &&
    stock.price >= stock.previousClose &&
    !isHot(stock, settings) &&
    !isAtrBroken(stock, settings)
  );
}

function mainScore(stock: Stock, mainIndustries: string[], settings: Settings) {
  let score = 0;

  if (isMain(stock, mainIndustries)) score += 30;
  if (stock.price > 0 && stock.price <= settings.maxPrice) score += 25;
  if (stock.changePercent >= 3 && stock.changePercent <= 7.5) score += 18;
  if (stock.price >= stock.openPrice) score += 14;
  if (isBreakout(stock)) score += 10;
  if (isNearOpen(stock)) score += 8;
  if (!isAtrBroken(stock, settings)) score += 10;

  if (isHot(stock, settings)) score -= 35;
  if (isWeak(stock)) score -= 30;
  if (isAtrBroken(stock, settings)) score -= 35;
  if (isAtrNear(stock, settings)) score -= 10;

  if (settings.decisionMode === "保守" && !isMain(stock, mainIndustries)) score -= 30;
  if (settings.decisionMode === "保守" && stock.price > settings.maxPrice) score -= 25;
  if (settings.decisionMode === "積極" && stock.changePercent >= 5) score += 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function instantScore(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  let score = 0;

  if (priceDirections[stock.code] === "up") score += 30;
  if (stock.price >= stock.openPrice) score += 25;
  if (isMain(stock, mainIndustries)) score += 20;
  if (!isHot(stock, settings)) score += 15;
  if (isBreakout(stock)) score += 10;
  if (!isAtrBroken(stock, settings)) score += 10;

  if (priceDirections[stock.code] === "down") score -= 25;
  if (isWeak(stock)) score -= 30;
  if (isHot(stock, settings)) score -= 25;
  if (isAtrBroken(stock, settings)) score -= 35;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function decisionLabel(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  if (isAtrBroken(stock, settings)) return "跌破ATR";
  if (isHot(stock, settings)) return "不追高";
  if (isWeak(stock) || priceDirections[stock.code] === "down") return "移除";
  if (isWaitPullback(stock, mainIndustries, settings)) return "等回測";

  const score = mainScore(stock, mainIndustries, settings);
  const instant = instantScore(stock, mainIndustries, settings, priceDirections);

  if (settings.decisionMode === "保守") {
    if (isMain(stock, mainIndustries) && stock.price <= settings.maxPrice && score >= 70 && !isHot(stock, settings)) return "可觀察";
    return "等回測";
  }

  if (settings.decisionMode === "積極") {
    if ((score >= 70 || instant >= 70) && !isHot(stock, settings) && !isWeak(stock)) return "可觀察";
    if (!isMain(stock, mainIndustries) && stock.changePercent >= 5 && !isAtrBroken(stock, settings)) return "可觀察";
    return "等回測";
  }

  if (isMain(stock, mainIndustries) && score >= 70 && !isHot(stock, settings)) return "可觀察";
  if (instant >= 75 && !isHot(stock, settings)) return "可觀察";

  return "等回測";
}

function decisionTone(label: string) {
  if (label === "可觀察") return "text-emerald-300";
  if (label === "等回測") return "text-yellow-300";
  if (label === "不追高") return "text-orange-300";
  if (label === "移除") return "text-emerald-300";
  if (label === "跌破ATR") return "text-red-300";
  return "text-slate-300";
}

function decisionReason(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  const reasons: string[] = [];

  if (isMain(stock, mainIndustries)) reasons.push("主流");
  if (stock.price <= settings.maxPrice) reasons.push(`${settings.maxPrice}內`);
  if (priceDirections[stock.code] === "up") reasons.push("即時上升");
  if (stock.price >= stock.openPrice) reasons.push("站上開盤");
  if (isBreakout(stock)) reasons.push("突破");
  if (isNearOpen(stock)) reasons.push("接近開盤");
  if (!isHot(stock, settings)) reasons.push("未過熱");
  if (!isWeak(stock)) reasons.push("未轉弱");
  if (!isAtrBroken(stock, settings)) reasons.push("ATR安全");

  return reasons.length ? reasons.join(" / ") : "暫無明確理由";
}

function avoidReason(stock: Stock, mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];

  if (isHot(stock, settings)) reasons.push("過熱");
  if (stock.price < stock.openPrice) reasons.push("跌破開盤");
  if (stock.price < stock.previousClose) reasons.push("跌破昨收");
  if (!isMain(stock, mainIndustries)) reasons.push("非主流");
  if (stock.price > settings.maxPrice) reasons.push(`超過${settings.maxPrice}元`);
  if (isAtrBroken(stock, settings)) reasons.push("跌破ATR停利");

  return reasons.length ? reasons.join(" / ") : "暫無明顯風險";
}

function getIndustryRanking(
  stocks: Stock[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
): IndustryItem[] {
  const map = new Map<string, IndustryItem>();

  stocks.forEach((stock) => {
    const key = stock.industry || "其他";
    const item =
      map.get(key) ??
      {
        industry: key,
        count: 0,
        avg: 0,
        strongCount: 0,
        hotCount: 0,
        weakCount: 0,
        score: 0,
      };

    item.count += 1;
    if (priceDirections[stock.code] === "up" && stock.price >= stock.openPrice) item.strongCount += 1;
    if (isHot(stock, settings)) item.hotCount += 1;
    if (isWeak(stock)) item.weakCount += 1;
    item.avg += stock.changePercent;
    map.set(key, item);
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      avg: item.avg / Math.max(item.count, 1),
      score:
        item.count * 10 +
        (item.avg / Math.max(item.count, 1)) * 3 +
        item.strongCount * 6 -
        item.hotCount * 3 -
        item.weakCount * 3,
    }))
    .sort((a, b) => b.score - a.score);
}

function atrTomorrowGroup(
  stock: Stock,
  mainIndustries: string[],
  settings: Settings,
  priceDirections: Record<string, PriceDirection>
) {
  if (isHot(stock, settings)) return "過熱不追";
  if (isAtrBroken(stock, settings)) return "跌破ATR";
  if (isAtrNear(stock, settings)) return "接近ATR停利";
  if (decisionLabel(stock, mainIndustries, settings, priceDirections) === "可觀察") return "可觀察 + ATR安全";
  if (decisionLabel(stock, mainIndustries, settings, priceDirections) === "等回測") return "等回測 + ATR安全";
  return "接近ATR停利";
}

function getKLinks(code: string, name: string) {
  return {
    yahoo: `https://tw.stock.yahoo.com/quote/${code}.TW/technical-analysis`,
    tradingView: `https://www.tradingview.com/chart/?symbol=TWSE%3A${code}`,
    goodinfo: `https://goodinfo.tw/tw/StockDetail.asp?STOCK_ID=${code}`,
    google: `https://www.google.com/search?q=${code}+${encodeURIComponent(name)}+K線`,
  };
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

function AtrBar({ stock, settings, entryPrice }: { stock: Stock; settings: Settings; entryPrice?: number }) {
  const distance = Math.max(0, Math.min(100, atrDistancePercent(stock, settings, entryPrice) * 8));
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-xs font-black text-slate-400">
        <span>ATR距離條</span>
        <span>{formatPercent(atrDistancePercent(stock, settings, entryPrice))}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/50">
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${distance}%` }} />
      </div>
    </div>
  );
}

function StockCard({
  stock,
  rank,
  mainIndustries,
  settings,
  favoriteCodes,
  tomorrowCodes,
  priceDirections,
  previousPriceMap,
  entryPrices,
  lastSuccessAt,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddTomorrow,
  onRemoveTomorrow,
}: {
  stock: Stock;
  rank: number;
  mainIndustries: string[];
  settings: Settings;
  favoriteCodes: string[];
  tomorrowCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  entryPrices: Record<string, number>;
  lastSuccessAt: string;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddTomorrow: (code: string) => void;
  onRemoveTomorrow: (code: string) => void;
}) {
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceOf(stock, previousPriceMap);
  const diff = instantDiff(stock, previousPriceMap);
  const diffPct = instantPercent(stock, previousPriceMap);
  const label = decisionLabel(stock, mainIndustries, settings, priceDirections);
  const mrIndex = mainIndustries.indexOf(stock.industry);
  const mr = mrIndex >= 0 ? `主流${mrIndex + 1}` : "";
  const entry = entryPrices[stock.code];
  const aStatus = atrStatus(stock, settings, entry);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry} {mr && `｜${mr}`}
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
          <span className={`rounded-full bg-black/40 px-3 py-1 ${atrTone(stock, settings, entry)}`}>ATR {aStatus}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">主線 {mainScore(stock, mainIndustries, settings)}</span>
          <span className="rounded-full bg-orange-950 px-3 py-1 text-orange-200">ATR風險 {atrRiskScore(stock, settings, entry)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          風控一句話：{atrSentence(stock, settings, entry)}
        </div>

        {settings.riskDisplayMode === "詳細" && (
          <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${atrTone(stock, settings, entry)}`}>
            ATR停利線：{formatPrice(atrTrailingStop(stock, settings, entry))}｜
            距離：{formatPercent(atrDistancePercent(stock, settings, entry))}｜
            進場價：{entry ? formatPrice(entry) : "開盤價"}
          </div>
        )}

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

  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [tomorrowCodes, setTomorrowCodes] = useState<string[]>([]);
  const [entryPrices, setEntryPrices] = useState<Record<string, number>>({});
  const [entryInput, setEntryInput] = useState("");

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("decision");
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

  useEffect(() => {
    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const mergedSettings = { ...defaultSettings, ...savedSettings };
    setSettings(mergedSettings);
    setAutoSeconds(mergedSettings.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setTomorrowCodes(safeParse(localStorage.getItem(TOMORROW_KEY), []));
    setEntryPrices(safeParse(localStorage.getItem(ENTRY_PRICE_KEY), {}));

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

  function saveEntryPrices(next: Record<string, number>) {
    setEntryPrices(next);
    localStorage.setItem(ENTRY_PRICE_KEY, JSON.stringify(next));
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

  async function loadStocks() {
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

      localStorage.setItem(
        LAST_SUCCESS_KEY,
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

  useEffect(() => {
    loadStocks();
  }, []);

  useEffect(() => {
    if (settings.refreshSeconds <= 0 || settings.dataSaver) return;

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
  }, [settings.refreshSeconds, settings.dataSaver, lastPriceMap]);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);
  const industries = useMemo(() => getIndustryRanking(top50, settings, priceDirections), [top50, settings, priceDirections]);
  const mainIndustries = useMemo(() => industries.slice(0, 3).map((item) => item.industry), [industries]);

  const watchableList = useMemo(
    () =>
      top50
        .filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "可觀察")
        .filter((stock) => !isAtrBroken(stock, settings, entryPrices[stock.code]))
        .sort((a, b) => mainScore(b, mainIndustries, settings) - mainScore(a, mainIndustries, settings)),
    [top50, mainIndustries, settings, priceDirections, entryPrices]
  );

  const waitPullbackList = useMemo(
    () =>
      top50
        .filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "等回測")
        .filter((stock) => isWaitPullback(stock, mainIndustries, settings))
        .sort((a, b) => Math.abs(distanceFromOpen(a)) - Math.abs(distanceFromOpen(b))),
    [top50, mainIndustries, settings, priceDirections]
  );

  const chaseRiskList = useMemo(
    () =>
      top50
        .filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "不追高")
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, mainIndustries, settings, priceDirections]
  );

  const atrSafeList = useMemo(
    () =>
      top50
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "安全")
        .filter((stock) => !isHot(stock, settings))
        .sort((a, b) => atrRiskScore(a, settings, entryPrices[a.code]) - atrRiskScore(b, settings, entryPrices[b.code])),
    [top50, settings, entryPrices]
  );

  const atrWatchableList = useMemo(
    () =>
      watchableList
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "安全")
        .filter((stock) => isMain(stock, mainIndustries))
        .filter((stock) => stock.price <= settings.maxPrice),
    [watchableList, settings, entryPrices, mainIndustries]
  );

  const atrPullbackList = useMemo(
    () =>
      waitPullbackList
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "安全")
        .filter((stock) => stock.price >= stock.previousClose),
    [waitPullbackList, settings, entryPrices]
  );

  const atrNearList = useMemo(
    () =>
      top50
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "接近停利")
        .sort((a, b) => atrRiskScore(b, settings, entryPrices[b.code]) - atrRiskScore(a, settings, entryPrices[a.code])),
    [top50, settings, entryPrices]
  );

  const atrBrokenList = useMemo(
    () =>
      top50
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "跌破停利")
        .sort((a, b) => atrRiskScore(b, settings, entryPrices[b.code]) - atrRiskScore(a, settings, entryPrices[a.code])),
    [top50, settings, entryPrices]
  );

  const atrMainRiskList = useMemo(
    () =>
      top50
        .filter((stock) => isMain(stock, mainIndustries))
        .filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) !== "安全"),
    [top50, mainIndustries, settings, entryPrices]
  );

  const avoidList = useMemo(
    () =>
      top50.filter(
        (stock) =>
          isHot(stock, settings) ||
          isWeak(stock) ||
          !isMain(stock, mainIndustries) ||
          stock.price > settings.maxPrice ||
          isAtrBroken(stock, settings, entryPrices[stock.code])
      ),
    [top50, mainIndustries, settings, entryPrices]
  );

  const tomorrowAutoList = useMemo(() => watchableList.slice(0, 20), [watchableList]);

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const tomorrowStocksManual = useMemo(
    () => tomorrowCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [tomorrowCodes, stocks]
  );

  const tomorrowCombined = useMemo(() => {
    const map = new Map<string, Stock>();
    [...tomorrowStocksManual, ...tomorrowAutoList].forEach((stock) => map.set(stock.code, stock));
    return Array.from(map.values());
  }, [tomorrowStocksManual, tomorrowAutoList]);

  const tomorrowAtrBroken = useMemo(
    () => tomorrowCombined.filter((stock) => isAtrBroken(stock, settings, entryPrices[stock.code])),
    [tomorrowCombined, settings, entryPrices]
  );

  const tomorrowPriorityList = useMemo(() => {
    const order: Record<string, number> = {
      "可觀察 + ATR安全": 1,
      "等回測 + ATR安全": 2,
      "接近ATR停利": 3,
      "跌破ATR": 4,
      "過熱不追": 5,
    };

    return [...tomorrowCombined].sort((a, b) => {
      const ga = atrTomorrowGroup(a, mainIndustries, settings, priceDirections);
      const gb = atrTomorrowGroup(b, mainIndustries, settings, priceDirections);
      return (order[ga] || 99) - (order[gb] || 99);
    });
  }, [tomorrowCombined, mainIndustries, settings, priceDirections]);

  const atrControlSummary = useMemo(() => {
    return `目前ATR安全 ${atrSafeList.length} 檔，接近停利 ${atrNearList.length} 檔，跌破 ${atrBrokenList.length} 檔。`;
  }, [atrSafeList, atrNearList, atrBrokenList]);

  const riskMode = useMemo(() => {
    if (atrBrokenList.length >= 5) return { label: "風控優先", tone: "text-red-300" };
    if (atrNearList.length >= 8) return { label: "小心", tone: "text-yellow-300" };
    return { label: "正常", tone: "text-emerald-300" };
  }, [atrBrokenList, atrNearList]);

  const todaySummary = useMemo(() => {
    const main = mainIndustries.slice(0, 3).join("、") || "主流產業";

    if (riskMode.label === "風控優先") return `今天先看風控，跌破ATR增加，避免硬追。`;
    if (riskMode.label === "小心") return `今天${main}有機會，但多檔接近ATR停利線，先小心。`;
    if (watchableList.length >= 5) return `今天${main}偏強，優先看ATR安全可觀察股。`;
    return `今天先等回測，接近開盤且ATR安全者優先。`;
  }, [mainIndustries, riskMode, watchableList]);

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

  useEffect(() => {
    if (selectedStock) {
      setEntryInput(entryPrices[selectedStock.code] ? String(entryPrices[selectedStock.code]) : String(selectedStock.openPrice || ""));
    }
  }, [selectedStock]);

  function filterTopList(list: Stock[]) {
    if (tab !== "top50") return list;

    if (settings.topFilter === "可觀察") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "可觀察");
    if (settings.topFilter === "等回測") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "等回測");
    if (settings.topFilter === "不追高") return list.filter((stock) => decisionLabel(stock, mainIndustries, settings, priceDirections) === "不追高");
    if (settings.topFilter === "ATR安全") return list.filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "安全");
    if (settings.topFilter === "ATR安全可觀察") return list.filter((stock) => atrWatchableList.some((s) => s.code === stock.code));
    if (settings.topFilter === "ATR風險") return list.filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) !== "安全");
    if (settings.topFilter === "跌破ATR") return list.filter((stock) => atrStatus(stock, settings, entryPrices[stock.code]) === "跌破停利");

    return list;
  }

  function sortList(list: Stock[]) {
    let arr = filterTopList([...list]);

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword));
    }

    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);
    if (sortKey === "score") return arr.sort((a, b) => mainScore(b, mainIndustries, settings) - mainScore(a, mainIndustries, settings));
    if (sortKey === "atr") return arr.sort((a, b) => atrRiskScore(a, settings, entryPrices[a.code]) - atrRiskScore(b, settings, entryPrices[b.code]));

    return arr.sort((a, b) => {
      const order: Record<string, number> = { 可觀察: 1, 等回測: 2, 不追高: 3, 移除: 4, 跌破ATR: 5 };
      const da = decisionLabel(a, mainIndustries, settings, priceDirections);
      const db = decisionLabel(b, mainIndustries, settings, priceDirections);
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
      if (moreView === "atrWatchable") return sortList(atrWatchableList);
      if (moreView === "atrPullback") return sortList(atrPullbackList);
      if (moreView === "atrNear") return sortList(atrNearList);
      if (moreView === "atrBroken") return sortList(atrBrokenList);
      if (moreView === "atrMainRisk") return sortList(atrMainRiskList);
      if (moreView === "chaseRisk") return sortList(chaseRiskList);
      if (moreView === "tomorrowPriority") return sortList(tomorrowPriorityList);
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
    atrWatchableList,
    atrPullbackList,
    atrNearList,
    atrBrokenList,
    atrMainRiskList,
    chaseRiskList,
    tomorrowPriorityList,
    searchText,
    sortKey,
    mainIndustries,
    settings,
    priceDirections,
    entryPrices,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  function openLink(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function addWatchableToTomorrow() {
    saveTomorrow([...tomorrowCodes, ...watchableList.map((stock) => stock.code)]);
    setTab("tomorrow");
  }

  function removeAtrBrokenTomorrow() {
    const removeSet = new Set(tomorrowAtrBroken.map((stock) => stock.code));
    saveTomorrow(tomorrowCodes.filter((code) => !removeSet.has(code)));
  }

  function clearTomorrow() {
    saveTomorrow([]);
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
    entryPrices,
    lastSuccessAt,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: addFavorite,
    onRemoveFavorite: removeFavorite,
    onAddTomorrow: addTomorrow,
    onRemoveTomorrow: removeTomorrow,
  };

  if (selectedStock) {
    const links = getKLinks(selectedStock.code, selectedStock.name);
    const entry = entryPrices[selectedStock.code];
    const label = decisionLabel(selectedStock, mainIndustries, settings, priceDirections);
    const direction = priceDirections[selectedStock.code];
    const prevPrice = previousPriceOf(selectedStock, previousPriceMap);
    const diff = instantDiff(selectedStock, previousPriceMap);
    const diffPct = instantPercent(selectedStock, previousPriceMap);
    const isFavorite = favoriteCodes.includes(selectedStock.code);
    const isTomorrow = tomorrowCodes.includes(selectedStock.code);
    const aStatus = atrStatus(selectedStock, settings, entry);

    const todayAction =
      isAtrBroken(selectedStock, settings, entry)
        ? "跌破移除"
        : isAtrNear(selectedStock, settings, entry)
          ? "守ATR"
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
                <div className="text-sm font-bold text-slate-400">
                  {selectedStock.code}｜{selectedStock.industry}
                </div>
                <h1 className="mt-1 text-3xl font-black">{selectedStock.name}</h1>
              </div>

              <div className={`text-right text-3xl font-black ${selectedStock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPercent(selectedStock.changePercent)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(label)}`}>
              <div className="text-xs font-bold text-slate-400">今天該怎麼做</div>
              <div className="mt-1 text-3xl font-black">{todayAction}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {decisionReason(selectedStock, mainIndustries, settings, priceDirections)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${atrTone(selectedStock, settings, entry)}`}>
              <div className="text-xs font-bold text-slate-400">ATR移動停利停損</div>
              <div className="mt-1 text-2xl font-black">ATR狀態：{aStatus}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {atrSentence(selectedStock, settings, entry)}
                <br />
                ATR停損價：{formatPrice(atrStopLoss(selectedStock, settings, entry))}
                <br />
                ATR移動停利價：{formatPrice(atrTrailingStop(selectedStock, settings, entry))}
                <br />
                ATR風險分：{atrRiskScore(selectedStock, settings, entry)}
              </div>
              <AtrBar stock={selectedStock} settings={settings} entryPrice={entry} />

              {isAtrTooSensitive(selectedStock, settings) && (
                <div className="mt-3 rounded-2xl bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
                  ATR可能偏敏感，建議切到「保守」敏感度或提高倍數。
                </div>
              )}
            </div>

            <section className="mt-4 rounded-2xl bg-slate-950 p-4">
              <div className="text-lg font-black">手動進場價</div>
              <div className="mt-2 flex gap-2">
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
                      saveEntryPrices({ ...entryPrices, [selectedStock.code]: value });
                    }
                  }}
                  className="rounded-2xl bg-purple-500 px-4 py-3 text-sm font-black text-white"
                >
                  保存
                </button>
              </div>
              <div className="mt-2 text-xs font-bold text-slate-400">
                目前使用：{entry ? `${formatPrice(entry)}（手動）` : `${formatPrice(selectedStock.openPrice)}（開盤價）`}
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
              <DetailRow label="主線分數" value={mainScore(selectedStock, mainIndustries, settings)} />
              <DetailRow label="即時強度分" value={instantScore(selectedStock, mainIndustries, settings, priceDirections)} />
              <DetailRow label="ATR模式" value={`${settings.atrMode} ${settings.atrMultiple}倍`} />
              <DetailRow label="ATR敏感度" value={settings.atrSensitivity} />
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
            <h2 className="text-xl font-black">K線入口</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => openLink(links.yahoo)} className="rounded-2xl bg-purple-500/20 py-3 text-sm font-black text-purple-200">Yahoo K線</button>
              <button onClick={() => openLink(links.tradingView)} className="rounded-2xl bg-blue-500/20 py-3 text-sm font-black text-blue-200">TradingView</button>
              <button onClick={() => openLink(links.goodinfo)} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">Goodinfo</button>
              <button onClick={() => openLink(links.google)} className="rounded-2xl bg-slate-700 py-3 text-sm font-black text-slate-200">Google搜尋</button>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">ATR說明</h2>
            <div className="mt-2 text-sm font-bold leading-6 text-slate-300">
              目前是「簡化ATR估算」，還不是真實14日ATR。它用今日高低波動、昨收、開盤、即時價格估算，主要用來輔助停利停損，不是買賣保證。
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-5">
            <h2 className="text-xl font-black">一鍵加入</h2>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => (isTomorrow ? removeTomorrow(selectedStock.code) : addTomorrow(selectedStock.code))}
                className={`rounded-2xl py-3 text-sm font-black ${
                  isTomorrow ? "bg-cyan-500/20 text-cyan-300" : "bg-slate-800 text-slate-200"
                }`}
              >
                {isTomorrow ? "📌 移除明日觀察" : "📌 加入明日觀察"}
              </button>

              <button
                onClick={() => (isFavorite ? removeFavorite(selectedStock.code) : addFavorite(selectedStock.code))}
                className={`rounded-2xl py-3 text-sm font-black ${
                  isFavorite ? "bg-yellow-500/20 text-yellow-300" : "bg-slate-800 text-slate-200"
                }`}
              >
                {isFavorite ? "★ 移除自選" : "☆ 加入自選"}
              </button>
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
              <div className="text-sm font-bold text-slate-400">台股ATR主線實戰優化版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">ATR實戰風控雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                ATR安全、手動進場價、移動停利停損。
              </p>
            </div>

            <button onClick={loadStocks} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
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
                ATR資料來源：簡化ATR估算，非真實14日ATR
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              健康檢查
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">ATR風控總結</div>
          <div className="mt-1 text-xl font-black text-yellow-100">{atrControlSummary}</div>
          <div className={`mt-2 text-2xl font-black ${riskMode.tone}`}>今天風控模式：{riskMode.label}</div>
          <div className="mt-2 text-sm font-bold text-slate-300">{todaySummary}</div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="ATR安全可觀察" value={atrWatchableList.length} sub="主流 + 低價 + ATR安全" tone="text-emerald-300" onClick={() => goMore("atrWatchable")} />
          <MiniCard title="ATR安全回測" value={atrPullbackList.length} sub="等回測 + 未跌昨收" tone="text-yellow-300" onClick={() => goMore("atrPullback")} />
          <MiniCard title="ATR主流風險" value={atrMainRiskList.length} sub="主流但風控距離太近" tone="text-orange-300" onClick={() => goMore("atrMainRisk")} />
          <MiniCard title="跌破ATR" value={atrBrokenList.length} sub="建議移出觀察" tone="text-red-300" onClick={() => goMore("atrBroken")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="50強" sub="含ATR實戰風控" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="明日觀察" sub={`跌破 ${tomorrowAtrBroken.length}`} badge={tomorrowCombined.length} tone="text-cyan-300" onClick={() => setTab("tomorrow")} />
          <ActionCard title="可觀察雷達" sub="主線 + ATR安全" badge={watchableList.length} tone="text-emerald-300" onClick={() => goMore("watchable")} />
          <ActionCard title="等回測雷達" sub="回測 + ATR安全" badge={waitPullbackList.length} tone="text-yellow-300" onClick={() => goMore("waitPullback")} />
          <ActionCard title="接近ATR" sub="小心守停利線" badge={atrNearList.length} tone="text-yellow-300" onClick={() => goMore("atrNear")} />
          <ActionCard title="跌破ATR" sub="風控優先" badge={atrBrokenList.length} tone="text-red-300" onClick={() => goMore("atrBroken")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">點股票卡片可輸入手動進場價。</p>
            </div>

            <button onClick={() => setShowFilters(!showFilters)} className="rounded-2xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200">
              篩選
            </button>
          </div>

          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜尋股票代號或名稱，例如 2330"
            className="mt-3 w-full rounded-2xl border border-slate-700 bg-black/40 px-4 py-3 text-lg font-black text-white outline-none"
          />

          {showFilters && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-5 gap-2">
                {[
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
                  {(["全部", "可觀察", "等回測", "不追高", "ATR安全", "ATR安全可觀察", "ATR風險", "跌破ATR"] as TopFilter[]).map((filter) => (
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
              <ActionCard title="ATR安全可觀察" sub="可觀察 + ATR安全" badge={atrWatchableList.length} tone="text-emerald-300" onClick={() => setMoreView("atrWatchable")} />
              <ActionCard title="ATR安全回測" sub="等回測 + 未跌昨收" badge={atrPullbackList.length} tone="text-yellow-300" onClick={() => setMoreView("atrPullback")} />
              <ActionCard title="ATR高風險主流" sub="主流但風控近" badge={atrMainRiskList.length} tone="text-orange-300" onClick={() => setMoreView("atrMainRisk")} />
              <ActionCard title="ATR安全股" sub="距離停利線有空間" badge={atrSafeList.length} tone="text-emerald-300" onClick={() => setMoreView("atrSafe")} />
              <ActionCard title="接近停利線" sub="小心守ATR" badge={atrNearList.length} tone="text-yellow-300" onClick={() => setMoreView("atrNear")} />
              <ActionCard title="跌破ATR" sub="建議移出觀察" badge={atrBrokenList.length} tone="text-red-300" onClick={() => setMoreView("atrBroken")} />
              <ActionCard title="明日優先雷達" sub="含ATR排序" badge={tomorrowPriorityList.length} tone="text-purple-300" onClick={() => setMoreView("tomorrowPriority")} />
              <ActionCard title="追高風險雷達" sub="過熱 + ATR近" badge={chaseRiskList.length} tone="text-red-300" onClick={() => setMoreView("chaseRisk")} />
              <ActionCard title="產業熱度" sub="主流產業排名" badge={industries.length} tone="text-cyan-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="ATR敏感度 / 顯示模式" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
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
              {tab === "more" && moreView === "watchable" && "✅ 可觀察雷達"}
              {tab === "more" && moreView === "waitPullback" && "↩️ 等回測雷達"}
              {tab === "more" && moreView === "atrSafe" && "🟢 ATR安全股"}
              {tab === "more" && moreView === "atrWatchable" && "✅ ATR安全可觀察"}
              {tab === "more" && moreView === "atrPullback" && "↩️ ATR安全回測"}
              {tab === "more" && moreView === "atrNear" && "🟡 接近ATR停利"}
              {tab === "more" && moreView === "atrBroken" && "🔴 跌破ATR停利"}
              {tab === "more" && moreView === "atrMainRisk" && "⚠️ ATR主流風險"}
              {tab === "more" && moreView === "tomorrowPriority" && "📌 明日優先雷達"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              主流：{mainIndustries.slice(0, 3).join("、") || "--"}｜ATR：{settings.atrMode} {settings.atrMultiple}倍｜敏感度：{settings.atrSensitivity}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">今日最該看 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {atrWatchableList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確ATR安全可觀察股票。
                    </div>
                  )}
                  {atrWatchableList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">今日先避開 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {avoidList.slice(0, 5).map((stock, index) => (
                    <div key={stock.code}>
                      <StockCard stock={stock} rank={index + 1} {...cardProps} />
                      <div className="mt-1 rounded-2xl bg-red-950/50 p-3 text-xs font-black text-red-100">
                        避開原因：{avoidReason(stock, mainIndustries, settings)}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-5">
              <section className="rounded-3xl border border-cyan-500/40 bg-cyan-950/20 p-4">
                <h3 className="text-xl font-black">風控優先排序</h3>
                <div className="mt-2 space-y-2 text-sm font-black text-cyan-100">
                  <div className="rounded-2xl bg-black/30 p-3">1. 可觀察 + ATR安全</div>
                  <div className="rounded-2xl bg-black/30 p-3">2. 等回測 + ATR安全</div>
                  <div className="rounded-2xl bg-black/30 p-3">3. 接近ATR停利</div>
                  <div className="rounded-2xl bg-black/30 p-3">4. 跌破ATR</div>
                  <div className="rounded-2xl bg-black/30 p-3">5. 過熱不追</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={addWatchableToTomorrow} className="rounded-2xl bg-emerald-500/20 py-3 text-sm font-black text-emerald-200">
                    加入可觀察
                  </button>
                  <button onClick={removeAtrBrokenTomorrow} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                    移除跌破ATR
                  </button>
                  <button onClick={clearTomorrow} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                    一鍵清空
                  </button>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xl font-black">明日優先清單</h3>
                <div className="space-y-3">
                  {tomorrowPriorityList.length === 0 && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-center text-sm font-bold text-slate-500">
                      目前沒有股票
                    </div>
                  )}
                  {tomorrowPriorityList.map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industries.slice(0, 12).map((item, index) => (
                <div key={item.industry} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-500">#{index + 1}</div>
                      <div className="text-2xl font-black">{item.industry}</div>
                      <div className="mt-1 text-xs font-bold text-cyan-300">
                        轉強 {item.strongCount}｜轉弱 {item.weakCount}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-yellow-300">{item.count} 檔</div>
                      <div className={`text-sm font-black ${item.avg >= 0 ? "text-red-300" : "text-emerald-300"}`}>
                        平均 {formatPercent(item.avg)}
                      </div>
                      <div className="text-xs font-black text-slate-400">強度 {item.score.toFixed(0)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">ATR敏感度</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["敏感", "標準", "保守"] as AtrSensitivity[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => saveSettings({ ...settings, atrSensitivity: mode })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.atrSensitivity === mode ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs font-bold text-slate-400">
                  若常常太快跌破ATR，請改成「保守」。
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
                <div className="mt-2 text-xs font-bold text-slate-400">
                  短線：1.5倍｜標準：2倍｜寬鬆：3倍
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">ATR倍數</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1.5, 2, 2.5, 3].map((m) => (
                    <button
                      key={m}
                      onClick={() => saveSettings({ ...settings, atrMultiple: m, atrMode: m <= 1.5 ? "短線" : m >= 3 ? "寬鬆" : "標準" })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.atrMultiple === m ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {m}倍
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">風控顯示模式</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["簡單", "詳細"] as RiskDisplayMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => saveSettings({ ...settings, riskDisplayMode: mode })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.riskDisplayMode === mode ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">決策模式</div>
                <div className="grid grid-cols-3 gap-2">
                  {(["保守", "標準", "積極"] as DecisionMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => saveSettings({ ...settings, decisionMode: mode })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.decisionMode === mode ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">股價上限</div>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 150, 200, 300].map((price) => (
                    <button
                      key={price}
                      onClick={() => saveSettings({ ...settings, maxPrice: price })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.maxPrice === price ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {price}
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

              <button
                onClick={() => saveSettings({ ...settings, dataSaver: !settings.dataSaver, refreshSeconds: settings.dataSaver ? 30 : 0 })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.dataSaver ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                省流量模式：{settings.dataSaver ? "開啟" : "關閉"}
              </button>
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
                <div>是否使用快取：{usingCache ? "是" : "否"}</div>
                <div>更新失敗原因：{error || "無"}</div>
                <div>ATR提醒：目前為簡化ATR，還不是真實14日ATR</div>
                <div>ATR模式：{settings.atrMode}</div>
                <div>ATR倍數：{settings.atrMultiple}</div>
                <div>ATR敏感度：{settings.atrSensitivity}</div>
                <div>ATR安全股：{atrSafeList.length}</div>
                <div>接近ATR：{atrNearList.length}</div>
                <div>跌破ATR：{atrBrokenList.length}</div>
                <div>已保存進場價：{Object.keys(entryPrices).length} 檔</div>
                <div>自動更新頻率：{settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${settings.refreshSeconds}秒`}</div>
                <div>下一次更新：{settings.dataSaver || settings.refreshSeconds === 0 ? "--" : `${autoSeconds}s`}</div>
              </div>

              {(usingCache || error) && (
                <div className="mt-3 rounded-2xl border border-yellow-500 bg-yellow-950/50 p-3 text-sm font-black text-yellow-200">
                  ⚠️ {error || "目前使用上次成功資料，畫面不會清空。"}
                </div>
              )}

              <button onClick={loadStocks} className="mt-4 w-full rounded-2xl bg-blue-500/20 py-3 text-lg font-black text-blue-200">
                重新讀取資料
              </button>
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
                  <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} {...cardProps} />
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
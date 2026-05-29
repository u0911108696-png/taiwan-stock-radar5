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

type TabKey = "home" | "top50" | "tomorrow" | "favorite" | "more";
type MoreView =
  | "menu"
  | "entryReady"
  | "entryWatch"
  | "pullback"
  | "stableStrong"
  | "unstable"
  | "reclaimOpen"
  | "breakOpen"
  | "chaseWarning"
  | "avoid"
  | "industry"
  | "settings"
  | "data";

type PriceDirection = "up" | "down" | "same" | "new";

type Settings = {
  refreshSeconds: number;
  dataSaver: boolean;
  maxPrice: number;
  hotPercent: number;
  confirmTimes: number;
  breakConfirmTimes: number;
  stableIndustryLock: boolean;
  topFilter: string;
};

type ApiResponse = {
  stocks?: any[];
  data?: any[];
  rankedStocks?: any[];
  updatedAt?: string;
  updatedAtTaiwan?: string;
  source?: string;
};

type SignalHistory = {
  code: string;
  prices: number[];
  entryRaw: boolean[];
  breakOpenRaw: boolean[];
  reclaimOpenRaw: boolean[];
  chaseRaw: boolean[];
  avoidRaw: boolean[];
  lastState?: string;
  changedAt?: string;
};

type IndustryItem = {
  industry: string;
  count: number;
  entryCount: number;
  watchCount: number;
  pullbackCount: number;
  avoidCount: number;
  avgScore: number;
  status: string;
  stocks: Stock[];
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-stable-entry-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-stable-entry-cache";
const SIGNAL_KEY = "taiwan-stock-radar-stable-signals";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-locked-main-industries";

const defaultSettings: Settings = {
  refreshSeconds: 30,
  dataSaver: false,
  maxPrice: 200,
  hotPercent: 8,
  confirmTimes: 3,
  breakConfirmTimes: 2,
  stableIndustryLock: true,
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

function cleanCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const name = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);

  const price = n(raw.price ?? raw.close ?? raw.lastPrice ?? raw.z);
  const previousClose = n(raw.previousClose ?? raw.prevClose ?? raw.yesterdayClose ?? raw.y);
  const openPrice = n(raw.openPrice ?? raw.open ?? raw.o ?? price);

  const highPrice = Math.max(
    n(raw.highPrice ?? raw.high ?? raw.h ?? price),
    price,
    openPrice,
    previousClose
  );

  const lowPrice = Math.min(
    n(raw.lowPrice ?? raw.low ?? raw.l ?? price),
    price,
    openPrice || price,
    previousClose || price
  );

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

function openingPremium(stock: Stock) {
  return stock.openPremiumPercent ?? 0;
}

function afterOpenPercent(stock: Stock) {
  if (stock.openPrice <= 0) return 0;
  return ((stock.price - stock.openPrice) / stock.openPrice) * 100;
}

function isNearOpen(stock: Stock) {
  if (stock.openPrice <= 0) return false;
  return Math.abs(stock.price - stock.openPrice) / stock.openPrice <= 0.015;
}

function isHot(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || afterOpenPercent(stock) >= 4 || openingPremium(stock) >= 6;
}

function isWeak(stock: Stock) {
  return stock.price < stock.openPrice || stock.price < stock.previousClose || stock.changePercent < 2;
}

function volumeRank(stock: Stock, list: Stock[]) {
  if (!stock.volume || stock.volume <= 0) return 0;
  const sorted = [...list].sort((a, b) => b.volume - a.volume);
  const index = sorted.findIndex((s) => s.code === stock.code);
  if (index < 0 || sorted.length <= 1) return 0;
  return Math.round(((sorted.length - index) / sorted.length) * 100);
}

function volumeState(stock: Stock, list: Stock[]) {
  const rank = volumeRank(stock, list);
  if (rank >= 75) return "量能強";
  if (rank >= 40) return "量能普通";
  return "量能不足";
}

function priceVolumeState(stock: Stock, list: Stock[], settings: Settings) {
  const vol = volumeState(stock, list);

  if (stock.price < stock.openPrice || stock.price < stock.previousClose) return "轉弱退潮";
  if (stock.changePercent >= 3 && vol === "量能強") return "量價同步";
  if (stock.changePercent >= settings.hotPercent && vol !== "量能強") return "量價背離";
  if (vol === "量能不足") return "量縮觀望";

  return "量價同步";
}

function rawContinuation(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const premium = openingPremium(stock);
  const afterOpen = afterOpenPercent(stock);
  const pv = priceVolumeState(stock, list, settings);
  const isMain = mainIndustries.includes(stock.industry);

  if (premium >= 2 && afterOpen < 0) return "開盤強轉弱";
  if (premium >= 2 && pv === "量價背離") return "假強警報";
  if (premium >= 2 && afterOpen > 0 && pv === "量價同步") return "開盤強續航";
  if (premium >= 0 && premium < 2 && afterOpen > 0.8 && pv === "量價同步") return "低調續航";
  if (afterOpen > 0 && isMain && pv === "量價同步") return "續航中";
  if (stock.price < stock.openPrice) return "轉弱中";
  return "等確認";
}

function rawEntryScore(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  let score = 0;
  const cont = rawContinuation(stock, list, mainIndustries, settings);
  const pv = priceVolumeState(stock, list, settings);

  if (mainIndustries.includes(stock.industry)) score += 22;
  if (cont === "開盤強續航" || cont === "續航中") score += 24;
  if (cont === "低調續航") score += 22;
  if (stock.price >= stock.openPrice) score += 10;
  if (pv === "量價同步") score += 14;
  if (volumeState(stock, list) === "量能強") score += 10;
  if (stock.price <= settings.maxPrice) score += 8;
  if (isNearOpen(stock)) score += 8;
  if (!isHot(stock, settings)) score += 10;

  if (isHot(stock, settings)) score -= 28;
  if (isWeak(stock)) score -= 25;
  if (cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中") score -= 35;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function rawEntryOk(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const score = rawEntryScore(stock, list, mainIndustries, settings);
  const cont = rawContinuation(stock, list, mainIndustries, settings);

  return (
    score >= 72 &&
    mainIndustries.includes(stock.industry) &&
    !isHot(stock, settings) &&
    !isWeak(stock) &&
    (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航")
  );
}

function rawPullbackOk(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const cont = rawContinuation(stock, list, mainIndustries, settings);
  return (
    !isWeak(stock) &&
    !isHot(stock, settings) &&
    (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航") &&
    (afterOpenPercent(stock) > 2.2 || stock.changePercent >= 5.5 || isNearOpen(stock))
  );
}

function rawChaseWarning(stock: Stock, settings: Settings) {
  return isHot(stock, settings);
}

function rawAvoid(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const cont = rawContinuation(stock, list, mainIndustries, settings);
  return isWeak(stock) || cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中";
}

function isReclaimOpen(stock: Stock, prevPrice?: number) {
  if (!prevPrice || stock.openPrice <= 0) return false;
  return prevPrice < stock.openPrice && stock.price >= stock.openPrice;
}

function isBreakOpen(stock: Stock, prevPrice?: number) {
  if (!prevPrice || stock.openPrice <= 0) return false;
  return prevPrice >= stock.openPrice && stock.price < stock.openPrice;
}

function lastNAllTrue(values: boolean[] | undefined, n: number) {
  if (!values || values.length < n) return false;
  return values.slice(-n).every(Boolean);
}

function lastNAnyTrue(values: boolean[] | undefined, n: number) {
  if (!values || values.length < n) return false;
  return values.slice(-n).some(Boolean);
}

function trendText(stock: Stock, history?: SignalHistory) {
  if (!history || history.prices.length < 2) return "新資料";
  const recent = history.prices.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];

  if (last > first) return "短線上升";
  if (last < first) return "短線下降";
  return "短線持平";
}

function stableCount(values: boolean[] | undefined) {
  if (!values || values.length === 0) return 0;
  let count = 0;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i]) count += 1;
    else break;
  }
  return count;
}

function signalStability(stock: Stock, history?: SignalHistory, settings?: Settings) {
  if (!history || !settings) return "等待資料";
  const count = stableCount(history.entryRaw);
  if (count >= settings.confirmTimes) return "穩定";
  if (count > 0) return `確認中 ${count}/${settings.confirmTimes}`;
  return "未確認";
}

function stableEntryState(stock: Stock, history: SignalHistory | undefined, settings: Settings) {
  const entryOk = lastNAllTrue(history?.entryRaw, settings.confirmTimes);
  const breakOk = lastNAllTrue(history?.breakOpenRaw, settings.breakConfirmTimes);
  const reclaimOk = lastNAllTrue(history?.reclaimOpenRaw, settings.breakConfirmTimes);
  const chaseOk = lastNAllTrue(history?.chaseRaw, settings.breakConfirmTimes);
  const avoidOk = lastNAllTrue(history?.avoidRaw, settings.breakConfirmTimes);
  const hadEntryRecently = lastNAnyTrue(history?.entryRaw, 5);

  if (breakOk) return "跌破開盤警報";
  if (reclaimOk) return "站回開盤警報";
  if (chaseOk) return "禁止追高";
  if (avoidOk) return "不適合進場";
  if (entryOk) return "可進場觀察";
  if (hadEntryRecently) return "進場確認中";
  return "等待確認";
}

function stableDecision(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const state = stableEntryState(stock, history, settings);

  if (state === "可進場觀察") return "可進場";
  if (state === "進場確認中") return "觀察中";
  if (state === "站回開盤警報") return "站回開盤";
  if (state === "跌破開盤警報") return "跌破開盤";
  if (state === "禁止追高") return "禁止追高";
  if (state === "不適合進場") return "移除";

  if (rawPullbackOk(stock, list, mainIndustries, settings)) return "等回測";

  return "等待確認";
}

function decisionTone(label: string) {
  if (label === "可進場" || label === "站回開盤") return "text-emerald-300";
  if (label === "觀察中" || label === "等回測" || label === "等待確認") return "text-yellow-300";
  if (label === "禁止追高") return "text-orange-300";
  if (label === "跌破開盤") return "text-red-300";
  return "text-slate-300";
}

function entryTone(label: string) {
  if (label === "可進場觀察" || label === "站回開盤警報") return "text-emerald-300";
  if (label === "進場確認中" || label === "等待確認") return "text-yellow-300";
  if (label === "禁止追高") return "text-orange-300";
  return "text-red-300";
}

function continuationTone(label: string) {
  if (label === "開盤強續航" || label === "續航中") return "text-emerald-300";
  if (label === "低調續航") return "text-blue-300";
  if (label === "假強警報") return "text-orange-300";
  if (label === "開盤強轉弱" || label === "轉弱中") return "text-red-300";
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

function entrySentence(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const state = stableEntryState(stock, history, settings);
  const stability = signalStability(stock, history, settings);

  if (state === "可進場觀察") return `連續 ${settings.confirmTimes} 次符合進場條件，訊號較穩定，可列入觀察。`;
  if (state === "進場確認中") return `目前有進場訊號，但還沒連續確認完成，先不要急。穩定度：${stability}`;
  if (state === "站回開盤警報") return `連續站回開盤價，轉強訊號比單次更新更可靠。`;
  if (state === "跌破開盤警報") return `連續跌破開盤價，續航失敗機率提高。`;
  if (state === "禁止追高") return `連續出現追高風險，等回測，不要追。`;
  if (state === "不適合進場") return `連續出現轉弱、假強或資金退潮，不適合進場。`;

  if (rawPullbackOk(stock, list, mainIndustries, settings)) return `條件不差，但位置偏高，等回測開盤價附近。`;

  return `目前沒有穩定進場訊號，先等連續 ${settings.confirmTimes} 次確認。`;
}

function reasonText(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const reasons: string[] = [];

  if (mainIndustries.includes(stock.industry)) reasons.push("主流產業");
  if (rawContinuation(stock, list, mainIndustries, settings).includes("續航")) reasons.push("續航");
  if (priceVolumeState(stock, list, settings) === "量價同步") reasons.push("量價同步");
  if (isNearOpen(stock)) reasons.push("接近開盤");
  if (lastNAllTrue(history?.entryRaw, settings.confirmTimes)) reasons.push("連續確認");
  if (lastNAllTrue(history?.breakOpenRaw, settings.breakConfirmTimes)) reasons.push("連續跌破開盤");
  if (lastNAllTrue(history?.reclaimOpenRaw, settings.breakConfirmTimes)) reasons.push("連續站回開盤");
  if (lastNAllTrue(history?.chaseRaw, settings.breakConfirmTimes)) reasons.push("追高風險");

  return reasons.length ? reasons.join(" / ") : "等待穩定訊號";
}

function getIndustryRanking(
  stocks: Stock[],
  mainIndustries: string[],
  settings: Settings,
  signalMap: Record<string, SignalHistory>
): IndustryItem[] {
  const map = new Map<string, IndustryItem>();

  stocks.forEach((stock) => {
    const history = signalMap[stock.code];
    const decision = stableDecision(stock, history, stocks, mainIndustries, settings);
    const score = rawEntryScore(stock, stocks, mainIndustries, settings);

    const item =
      map.get(stock.industry) ??
      {
        industry: stock.industry,
        count: 0,
        entryCount: 0,
        watchCount: 0,
        pullbackCount: 0,
        avoidCount: 0,
        avgScore: 0,
        status: "觀察中",
        stocks: [],
      };

    item.count += 1;
    item.avgScore += score;
    item.stocks.push(stock);

    if (decision === "可進場") item.entryCount += 1;
    if (decision === "觀察中" || decision === "等待確認") item.watchCount += 1;
    if (decision === "等回測") item.pullbackCount += 1;
    if (decision === "移除" || decision === "跌破開盤") item.avoidCount += 1;

    map.set(stock.industry, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avgScore = item.avgScore / Math.max(item.count, 1);
      let status = "觀察中";

      if (item.avoidCount >= Math.max(2, item.count * 0.35)) status = "轉弱退潮";
      else if (item.entryCount >= Math.max(1, item.count * 0.25)) status = "可進場主流";
      else if (item.pullbackCount >= Math.max(1, item.count * 0.3)) status = "等回測主流";
      else if (avgScore >= 60) status = "續航觀察";

      return { ...item, avgScore, status };
    })
    .sort((a, b) => {
      const scoreA = a.entryCount * 20 + a.pullbackCount * 8 + a.avgScore - a.avoidCount * 18;
      const scoreB = b.entryCount * 20 + b.pullbackCount * 8 + b.avgScore - b.avoidCount * 18;
      return scoreB - scoreA;
    });
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
  const tone =
    item.status === "可進場主流"
      ? "text-emerald-300"
      : item.status === "等回測主流"
        ? "text-yellow-300"
        : item.status === "轉弱退潮"
          ? "text-red-300"
          : "text-slate-300";

  return (
    <button onClick={onClick} className="w-full rounded-3xl border border-slate-800 bg-slate-950 p-4 text-left active:scale-95">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 穩定進場產業</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${tone}`}>{item.status}</div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black text-yellow-300">{item.count}檔</div>
          <div className="text-sm font-black text-emerald-300">進場 {item.entryCount}</div>
          <div className="text-xs font-black text-slate-400">均分 {item.avgScore.toFixed(0)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">可進場<br />{item.entryCount}</div>
        <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">等回測<br />{item.pullbackCount}</div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">避開<br />{item.avoidCount}</div>
      </div>
    </button>
  );
}

function StockCard({
  stock,
  rank,
  top50,
  mainIndustries,
  settings,
  signalMap,
  favoriteCodes,
  tomorrowCodes,
  priceDirections,
  previousPriceMap,
  lastSuccessAt,
  onOpen,
  onAddFavorite,
  onRemoveFavorite,
  onAddTomorrow,
  onRemoveTomorrow,
}: {
  stock: Stock;
  rank: number;
  top50: Stock[];
  mainIndustries: string[];
  settings: Settings;
  signalMap: Record<string, SignalHistory>;
  favoriteCodes: string[];
  tomorrowCodes: string[];
  priceDirections: Record<string, PriceDirection>;
  previousPriceMap: Record<string, number>;
  lastSuccessAt: string;
  onOpen: (code: string) => void;
  onAddFavorite: (code: string) => void;
  onRemoveFavorite: (code: string) => void;
  onAddTomorrow: (code: string) => void;
  onRemoveTomorrow: (code: string) => void;
}) {
  const history = signalMap[stock.code];
  const decision = stableDecision(stock, history, top50, mainIndustries, settings);
  const entry = stableEntryState(stock, history, settings);
  const cont = rawContinuation(stock, top50, mainIndustries, settings);
  const score = rawEntryScore(stock, top50, mainIndustries, settings);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const diff = prevPrice ? stock.price - prevPrice : 0;
  const diffPct = prevPrice ? ((stock.price - prevPrice) / prevPrice) * 100 : 0;
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
              {mainIndex >= 0 ? `｜鎖定主流${mainIndex + 1}` : ""}
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
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(decision)}`}>{decision}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${entryTone(entry)}`}>{entry}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${continuationTone(cont)}`}>{cont}</span>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-200">分數 {score}</span>
          <span className="rounded-full bg-blue-950 px-3 py-1 text-blue-200">{signalStability(stock, history, settings)}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">開盤後 {formatPercent(afterOpenPercent(stock))}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{priceVolumeState(stock, top50, settings)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-200">
          {reasonText(stock, history, top50, mainIndustries, settings)}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {entrySentence(stock, history, top50, mainIndustries, settings)}
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}｜{trendText(stock, history)}
          <br />
          {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}｜${diff > 0 ? "+" : ""}${diff.toFixed(2)}｜${formatPercent(diffPct)}` : "尚無上一筆"}
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
  const [signalMap, setSignalMap] = useState<Record<string, SignalHistory>>({});

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
  const [lockedIndustries, setLockedIndustries] = useState<string[]>([]);

  const initedRef = useRef(false);

  const top50 = useMemo(() => stocks.slice(0, 50), [stocks]);

  const rawIndustryRanking = useMemo(() => {
    const map = new Map<string, { industry: string; count: number; score: number }>();

    top50.forEach((stock) => {
      const item = map.get(stock.industry) || { industry: stock.industry, count: 0, score: 0 };
      item.count += 1;
      item.score += stock.changePercent + Math.max(0, openingPremium(stock)) + volumeRank(stock, top50) * 0.05;
      map.set(stock.industry, item);
    });

    return Array.from(map.values()).sort((a, b) => b.count * 10 + b.score - (a.count * 10 + a.score));
  }, [top50]);

  const mainIndustries = useMemo(() => {
    if (settings.stableIndustryLock && lockedIndustries.length > 0) return lockedIndustries;
    return rawIndustryRanking.slice(0, 3).map((item) => item.industry);
  }, [rawIndustryRanking, lockedIndustries, settings.stableIndustryLock]);

  const industryRanking = useMemo(
    () => getIndustryRanking(top50, mainIndustries, settings, signalMap),
    [top50, mainIndustries, settings, signalMap]
  );

  const entryReadyList = useMemo(
    () =>
      top50
        .filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "可進場")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const entryWatchList = useMemo(
    () =>
      top50
        .filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "觀察中")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const pullbackList = useMemo(
    () =>
      top50
        .filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "等回測")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const stableStrongList = useMemo(
    () =>
      top50
        .filter((stock) => {
          const h = signalMap[stock.code];
          return lastNAllTrue(h?.entryRaw, settings.confirmTimes);
        })
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const unstableList = useMemo(
    () =>
      top50
        .filter((stock) => {
          const h = signalMap[stock.code];
          const count = stableCount(h?.entryRaw);
          return count > 0 && count < settings.confirmTimes;
        })
        .sort((a, b) => stableCount(signalMap[b.code]?.entryRaw) - stableCount(signalMap[a.code]?.entryRaw)),
    [top50, signalMap, settings]
  );

  const reclaimOpenList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.reclaimOpenRaw, settings.breakConfirmTimes))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, signalMap, settings]
  );

  const breakOpenList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.breakOpenRaw, settings.breakConfirmTimes))
        .sort((a, b) => a.changePercent - b.changePercent),
    [top50, signalMap, settings]
  );

  const chaseWarningList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.chaseRaw, settings.breakConfirmTimes))
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, signalMap, settings]
  );

  const avoidList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.avoidRaw, settings.breakConfirmTimes))
        .sort((a, b) => a.changePercent - b.changePercent),
    [top50, signalMap, settings]
  );

  const favoriteStocks = useMemo(
    () => favoriteCodes.map((code) => stocks.find((s) => s.code === code)).filter(Boolean) as Stock[],
    [favoriteCodes, stocks]
  );

  const tomorrowStocks = useMemo(() => {
    const map = new Map<string, Stock>();
    tomorrowCodes.forEach((code) => {
      const stock = stocks.find((s) => s.code === code);
      if (stock) map.set(code, stock);
    });
    [...entryReadyList, ...pullbackList].slice(0, 20).forEach((stock) => map.set(stock.code, stock));
    return Array.from(map.values());
  }, [tomorrowCodes, stocks, entryReadyList, pullbackList]);

  const selectedStock = useMemo(() => stocks.find((s) => s.code === selectedCode) || null, [stocks, selectedCode]);

  const marketStructure = useMemo(() => {
    if (avoidList.length >= 18 || breakOpenList.length >= 10) return "轉弱避開";
    if (chaseWarningList.length >= 12) return "追高風險";
    if (entryReadyList.length >= 5) return "穩定可進場";
    if (entryWatchList.length >= 8) return "確認中";
    if (pullbackList.length >= 8) return "等回測";
    return "等待確認";
  }, [avoidList, breakOpenList, chaseWarningList, entryReadyList, entryWatchList, pullbackList]);

  const homeSentence = useMemo(() => {
    if (mainIndustries.length === 0) return "目前主流尚未形成，先等資料。";
    if (marketStructure === "穩定可進場") return `${mainIndustries[0]} 為目前鎖定主流，已有連續確認的進場股。`;
    if (marketStructure === "確認中") return `${mainIndustries[0]} 有訊號，但多數還在確認中，不要急。`;
    if (marketStructure === "等回測") return `${mainIndustries[0]} 條件不差，但位置偏高，等回測。`;
    if (marketStructure === "追高風險") return `目前追高警報偏多，先不要追。`;
    if (marketStructure === "轉弱避開") return `目前跌破或轉弱訊號偏多，先保守。`;
    return `目前還沒有穩定進場方向，等待連續 ${settings.confirmTimes} 次確認。`;
  }, [mainIndustries, marketStructure, settings.confirmTimes]);

  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    const savedSettings = safeParse(localStorage.getItem(SETTINGS_KEY), defaultSettings);
    const merged = { ...defaultSettings, ...savedSettings };
    setSettings(merged);
    setAutoSeconds(merged.refreshSeconds);

    setFavoriteCodes(safeParse(localStorage.getItem(FAVORITE_KEY), []));
    setTomorrowCodes(safeParse(localStorage.getItem(TOMORROW_KEY), []));
    setSignalMap(safeParse(localStorage.getItem(SIGNAL_KEY), {}));
    setLockedIndustries(safeParse(localStorage.getItem(LOCKED_INDUSTRY_KEY), []));

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
  }, [settings.refreshSeconds, settings.dataSaver, lastPriceMap, mainIndustries, signalMap]);

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

  function lockCurrentIndustries() {
    const list = rawIndustryRanking.slice(0, 3).map((item) => item.industry);
    setLockedIndustries(list);
    localStorage.setItem(LOCKED_INDUSTRY_KEY, JSON.stringify(list));
  }

  function clearLockedIndustries() {
    setLockedIndustries([]);
    localStorage.removeItem(LOCKED_INDUSTRY_KEY);
  }

  function resetSignals() {
    setSignalMap({});
    localStorage.removeItem(SIGNAL_KEY);
  }

  function updateSignalHistory(list: Stock[], oldPrices: Record<string, number>, nextDirections: Record<string, PriceDirection>) {
    setSignalMap((old) => {
      const next = { ...old };
      const activeMain = settings.stableIndustryLock && lockedIndustries.length > 0
        ? lockedIndustries
        : rawIndustryRanking.slice(0, 3).map((item) => item.industry);

      list.slice(0, 80).forEach((stock) => {
        const prevPrice = oldPrices[stock.code];
        const oldItem = next[stock.code] || {
          code: stock.code,
          prices: [],
          entryRaw: [],
          breakOpenRaw: [],
          reclaimOpenRaw: [],
          chaseRaw: [],
          avoidRaw: [],
        };

        const entryOk = rawEntryOk(stock, list.slice(0, 50), activeMain, settings);
        const breakOk = isBreakOpen(stock, prevPrice);
        const reclaimOk = isReclaimOpen(stock, prevPrice) && nextDirections[stock.code] === "up";
        const chaseOk = rawChaseWarning(stock, settings);
        const avoidOk = rawAvoid(stock, list.slice(0, 50), activeMain, settings);

        const updated: SignalHistory = {
          ...oldItem,
          prices: [...oldItem.prices, stock.price].slice(-8),
          entryRaw: [...oldItem.entryRaw, entryOk].slice(-8),
          breakOpenRaw: [...oldItem.breakOpenRaw, breakOk].slice(-8),
          reclaimOpenRaw: [...oldItem.reclaimOpenRaw, reclaimOk].slice(-8),
          chaseRaw: [...oldItem.chaseRaw, chaseOk].slice(-8),
          avoidRaw: [...oldItem.avoidRaw, avoidOk].slice(-8),
          changedAt: nowText(),
        };

        next[stock.code] = updated;
      });

      localStorage.setItem(SIGNAL_KEY, JSON.stringify(next));
      return next;
    });
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

      updateSignalHistory(normalized, oldPriceMap, nextDirections);

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

  function filterList(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topFilter === "可進場") arr = arr.filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "可進場");
      if (settings.topFilter === "確認中") arr = arr.filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "觀察中");
      if (settings.topFilter === "等回測") arr = arr.filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "等回測");
      if (settings.topFilter === "站回開盤") arr = arr.filter((stock) => stableEntryState(stock, signalMap[stock.code], settings) === "站回開盤警報");
      if (settings.topFilter === "跌破開盤") arr = arr.filter((stock) => stableEntryState(stock, signalMap[stock.code], settings) === "跌破開盤警報");
      if (settings.topFilter === "禁止追高") arr = arr.filter((stock) => stableEntryState(stock, signalMap[stock.code], settings) === "禁止追高");
      if (settings.topFilter === "主流產業") arr = arr.filter((stock) => mainIndustries.includes(stock.industry));
    }

    const keyword = searchText.trim();
    if (keyword) {
      arr = arr.filter((stock) => stock.code.includes(keyword) || stock.name.includes(keyword) || stock.industry.includes(keyword));
    }

    return arr;
  }

  function sortList(list: Stock[]) {
    const arr = filterList(list);

    if (sortKey === "entry") {
      return arr.sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings));
    }

    if (sortKey === "continuation") {
      return arr.sort((a, b) => {
        const aa = rawContinuation(a, top50, mainIndustries, settings);
        const bb = rawContinuation(b, top50, mainIndustries, settings);
        const scoreA = aa.includes("續航") ? 100 : aa === "等確認" ? 40 : 0;
        const scoreB = bb.includes("續航") ? 100 : bb === "等確認" ? 40 : 0;
        return scoreB - scoreA;
      });
    }

    if (sortKey === "opening") return arr.sort((a, b) => openingPremium(b) + afterOpenPercent(b) - (openingPremium(a) + afterOpenPercent(a)));
    if (sortKey === "money") return arr.sort((a, b) => volumeRank(b, top50) + b.changePercent - (volumeRank(a, top50) + a.changePercent));
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = industryRanking.findIndex((item) => item.industry === a.industry);
        const ib = industryRanking.findIndex((item) => item.industry === b.industry);
        return ia - ib;
      });
    }
    if (sortKey === "change") return arr.sort((a, b) => b.changePercent - a.changePercent);
    if (sortKey === "price") return arr.sort((a, b) => a.price - b.price);

    return arr;
  }

  const currentList = useMemo(() => {
    if (tab === "top50") return sortList(top50);
    if (tab === "favorite") return sortList(favoriteStocks);

    if (tab === "more") {
      if (moreView === "entryReady") return sortList(entryReadyList);
      if (moreView === "entryWatch") return sortList(entryWatchList);
      if (moreView === "pullback") return sortList(pullbackList);
      if (moreView === "stableStrong") return sortList(stableStrongList);
      if (moreView === "unstable") return sortList(unstableList);
      if (moreView === "reclaimOpen") return sortList(reclaimOpenList);
      if (moreView === "breakOpen") return sortList(breakOpenList);
      if (moreView === "chaseWarning") return sortList(chaseWarningList);
      if (moreView === "avoid") return sortList(avoidList);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    entryReadyList,
    entryWatchList,
    pullbackList,
    stableStrongList,
    unstableList,
    reclaimOpenList,
    breakOpenList,
    chaseWarningList,
    avoidList,
    searchText,
    sortKey,
    settings,
    signalMap,
    mainIndustries,
  ]);

  function goMore(view: MoreView) {
    setSelectedCode("");
    setTab("more");
    setMoreView(view);
  }

  const cardProps = {
    top50,
    mainIndustries,
    settings,
    signalMap,
    favoriteCodes,
    tomorrowCodes,
    priceDirections,
    previousPriceMap,
    lastSuccessAt,
    onOpen: (code: string) => setSelectedCode(code),
    onAddFavorite: (code: string) => saveFavorites([...favoriteCodes, code]),
    onRemoveFavorite: (code: string) => saveFavorites(favoriteCodes.filter((item) => item !== code)),
    onAddTomorrow: (code: string) => saveTomorrow([...tomorrowCodes, code]),
    onRemoveTomorrow: (code: string) => saveTomorrow(tomorrowCodes.filter((item) => item !== code)),
  };

  if (selectedStock) {
    const history = signalMap[selectedStock.code];
    const decision = stableDecision(selectedStock, history, top50, mainIndustries, settings);
    const entry = stableEntryState(selectedStock, history, settings);
    const cont = rawContinuation(selectedStock, top50, mainIndustries, settings);
    const score = rawEntryScore(selectedStock, top50, mainIndustries, settings);
    const prevPrice = previousPriceMap[selectedStock.code];
    const direction = priceDirections[selectedStock.code];

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
              </div>

              <div className={`text-right text-3xl font-black ${selectedStock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
                {formatPercent(selectedStock.changePercent)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(decision)}`}>
              <div className="text-xs font-bold text-slate-400">穩定進場結論</div>
              <div className="mt-1 text-3xl font-black">{decision}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {entrySentence(selectedStock, history, top50, mainIndustries, settings)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${entryTone(entry)}`}>
              <div className="text-xs font-bold text-slate-400">連續確認狀態</div>
              <div className="mt-1 text-2xl font-black">{entry}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                穩定度：{signalStability(selectedStock, history, settings)}
                <br />
                進場連續次數：{stableCount(history?.entryRaw)} / {settings.confirmTimes}
                <br />
                跌破連續次數：{stableCount(history?.breakOpenRaw)} / {settings.breakConfirmTimes}
                <br />
                站回連續次數：{stableCount(history?.reclaimOpenRaw)} / {settings.breakConfirmTimes}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${continuationTone(cont)}`}>
              <div className="text-xs font-bold text-slate-400">盤中續航</div>
              <div className="mt-1 text-2xl font-black">{cont}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                趨勢：{trendText(selectedStock, history)}
                <br />
                量價：{priceVolumeState(selectedStock, top50, settings)}
                <br />
                成交量：{volumeState(selectedStock, top50)}
              </div>
            </div>

            <section className="mt-4 rounded-2xl bg-blue-950/30 p-4">
              <div className="text-lg font-black text-blue-100">進場位置</div>
              <div className="mt-2 text-sm font-bold text-blue-100">
                昨收：{formatPrice(selectedStock.previousClose)}
                <br />
                開盤：{formatPrice(selectedStock.openPrice)}
                <br />
                現價：{formatPrice(selectedStock.price)}
                <br />
                開盤溢價：{formatPercent(openingPremium(selectedStock))}
                <br />
                開盤後：{formatPercent(afterOpenPercent(selectedStock))}
                <br />
                理想觀察區：{formatPrice(selectedStock.openPrice)} ～ {formatPrice(selectedStock.openPrice * 1.015)}
                <br />
                追高風險區：高於 {formatPrice(selectedStock.openPrice * 1.03)}
              </div>
            </section>

            <section className="mt-4 rounded-2xl bg-slate-950 p-4">
              <div className="text-lg font-black">即時股價</div>
              <div className={`mt-2 text-xl font-black ${directionTone(direction)}`}>{directionText(direction)}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${selectedStock.price.toFixed(2)}` : "尚無上一筆"}
                <br />
                進場分數：{score}
                <br />
                更新：{selectedStock.updatedAt || lastSuccessAt || "--"}
              </div>
            </section>
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
              <div className="text-sm font-bold text-slate-400">台股進場穩定確認版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">穩定進場雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                連續確認後才顯示進場，避免每次更新就跳來跳去。
              </p>
            </div>

            <button onClick={() => loadStocks()} className="shrink-0 rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white shadow-lg active:scale-95">
              {updating ? "更新中" : "立即"}<br />更新
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-3xl border border-blue-500/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">即時股價狀態：{updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}</div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：
                {settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-cyan-300">
                穩定確認：進場 {settings.confirmTimes} 次｜跌破/站回 {settings.breakConfirmTimes} 次
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              健康檢查
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">今日穩定進場方向</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {mainIndustries.length ? mainIndustries.map((name, i) => `${i + 1}.${name}`).join("　") : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{homeSentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="盤中型態" value={marketStructure} />
            <DetailRow label="主流鎖定" value={settings.stableIndustryLock && lockedIndustries.length ? "已鎖定" : "浮動"} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="可進場" value={entryReadyList.length} sub={`連續 ${settings.confirmTimes} 次確認`} tone="text-emerald-300" onClick={() => goMore("entryReady")} />
          <MiniCard title="確認中" value={entryWatchList.length} sub="有訊號但未完成" tone="text-yellow-300" onClick={() => goMore("entryWatch")} />
          <MiniCard title="站回開盤" value={reclaimOpenList.length} sub="連續站回" tone="text-cyan-300" onClick={() => goMore("reclaimOpen")} />
          <MiniCard title="跌破開盤" value={breakOpenList.length} sub="連續跌破" tone="text-red-300" onClick={() => goMore("breakOpen")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="穩定強勢" sub="連續進場確認" badge={stableStrongList.length} tone="text-emerald-300" onClick={() => goMore("stableStrong")} />
          <ActionCard title="訊號不穩" sub="尚未連續確認" badge={unstableList.length} tone="text-yellow-300" onClick={() => goMore("unstable")} />
          <ActionCard title="等回測" sub="條件好但位置高" badge={pullbackList.length} tone="text-yellow-300" onClick={() => goMore("pullback")} />
          <ActionCard title="禁止追高" sub="連續追高風險" badge={chaseWarningList.length} tone="text-orange-300" onClick={() => goMore("chaseWarning")} />
          <ActionCard title="不要碰" sub="連續轉弱 / 假強" badge={avoidList.length} tone="text-red-300" onClick={() => goMore("avoid")} />
          <ActionCard title="50強" sub="穩定篩選" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">這版不會單次更新就改結論。</p>
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
                  {["全部", "可進場", "確認中", "等回測", "站回開盤", "跌破開盤", "禁止追高", "主流產業"].map((filter) => (
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
              <ActionCard title="可進場" sub="連續確認完成" badge={entryReadyList.length} tone="text-emerald-300" onClick={() => setMoreView("entryReady")} />
              <ActionCard title="確認中" sub="還差確認次數" badge={entryWatchList.length} tone="text-yellow-300" onClick={() => setMoreView("entryWatch")} />
              <ActionCard title="等回測" sub="位置偏高" badge={pullbackList.length} tone="text-yellow-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="穩定強勢" sub="連續符合" badge={stableStrongList.length} tone="text-emerald-300" onClick={() => setMoreView("stableStrong")} />
              <ActionCard title="訊號不穩" sub="容易跳動" badge={unstableList.length} tone="text-yellow-300" onClick={() => setMoreView("unstable")} />
              <ActionCard title="站回開盤" sub="連續站回" badge={reclaimOpenList.length} tone="text-cyan-300" onClick={() => setMoreView("reclaimOpen")} />
              <ActionCard title="跌破開盤" sub="連續跌破" badge={breakOpenList.length} tone="text-red-300" onClick={() => setMoreView("breakOpen")} />
              <ActionCard title="禁止追高" sub="連續過熱" badge={chaseWarningList.length} tone="text-orange-300" onClick={() => setMoreView("chaseWarning")} />
              <ActionCard title="不要碰" sub="連續轉弱" badge={avoidList.length} tone="text-red-300" onClick={() => setMoreView("avoid")} />
              <ActionCard title="設定" sub="確認次數 / 主流鎖定" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
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
              {tab === "more" && moreView === "entryReady" && "🟢 可進場"}
              {tab === "more" && moreView === "entryWatch" && "🟡 確認中"}
              {tab === "more" && moreView === "pullback" && "🟡 等回測"}
              {tab === "more" && moreView === "stableStrong" && "🟢 穩定強勢"}
              {tab === "more" && moreView === "unstable" && "🟡 訊號不穩"}
              {tab === "more" && moreView === "reclaimOpen" && "🔵 站回開盤"}
              {tab === "more" && moreView === "breakOpen" && "🔴 跌破開盤"}
              {tab === "more" && moreView === "chaseWarning" && "🟠 禁止追高"}
              {tab === "more" && moreView === "avoid" && "⛔ 不要碰"}
              {tab === "more" && moreView === "industry" && "🏭 產業穩定排行"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資料健康檢查"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              主流：{mainIndustries.slice(0, 3).join("、") || "--"}｜型態：{marketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">穩定產業排行</h3>
                <div className="mt-3 space-y-3">
                  {industryRanking.slice(0, 3).map((item, index) => (
                    <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => {}} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">可進場 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {entryReadyList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有連續確認完成的可進場股票。
                    </div>
                  )}
                  {entryReadyList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">確認中 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {entryWatchList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有確認中股票。
                    </div>
                  )}
                  {entryWatchList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">不要碰 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {avoidList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有連續轉弱名單。
                    </div>
                  )}
                  {avoidList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === "tomorrow" && (
            <div className="space-y-3">
              {tomorrowStocks.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-slate-400">
                  目前沒有明日觀察股票。
                </div>
              )}
              {tomorrowStocks.map((stock, index) => (
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">進場確認次數</div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => saveSettings({ ...settings, confirmTimes: num })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.confirmTimes === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {num}次
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">跌破 / 站回確認次數</div>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      onClick={() => saveSettings({ ...settings, breakConfirmTimes: num })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.breakConfirmTimes === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {num}次
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => saveSettings({ ...settings, stableIndustryLock: !settings.stableIndustryLock })}
                className={`w-full rounded-2xl py-3 text-lg font-black ${
                  settings.stableIndustryLock ? "bg-emerald-500/30 text-emerald-200" : "bg-slate-800 text-slate-200"
                }`}
              >
                主流產業鎖定：{settings.stableIndustryLock ? "開啟" : "關閉"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button onClick={lockCurrentIndustries} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                  鎖定目前主流
                </button>
                <button onClick={clearLockedIndustries} className="rounded-2xl bg-slate-800 py-3 text-sm font-black text-slate-200">
                  解除鎖定
                </button>
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

              <button onClick={resetSignals} className="w-full rounded-2xl bg-red-500/20 py-3 text-lg font-black text-red-200">
                重置所有連續確認紀錄
              </button>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資料健康檢查</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>可進場股數：{entryReadyList.length}</div>
                <div>確認中股數：{entryWatchList.length}</div>
                <div>等回測股數：{pullbackList.length}</div>
                <div>站回開盤股數：{reclaimOpenList.length}</div>
                <div>跌破開盤股數：{breakOpenList.length}</div>
                <div>追高警報股數：{chaseWarningList.length}</div>
                <div>不要碰股數：{avoidList.length}</div>
                <div>主流產業：{mainIndustries.join("、") || "--"}</div>
                <div>盤中型態：{marketStructure}</div>
                <div>確認次數：進場 {settings.confirmTimes} 次｜跌破/站回 {settings.breakConfirmTimes} 次</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => loadStocks()} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                  立即更新
                </button>
                <button onClick={resetSignals} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                  重置確認紀錄
                </button>
              </div>
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industryRanking.map((item, index) => (
                <IndustryCard key={item.industry} item={item} rank={index + 1} onClick={() => {}} />
              ))}
            </div>
          )}

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["settings", "data", "industry", "menu"].includes(moreView)) && (
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
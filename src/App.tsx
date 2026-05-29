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
  | "core"
  | "pullback"
  | "newStrong"
  | "overheat"
  | "failed"
  | "holding"
  | "industry"
  | "amount"
  | "settings"
  | "data";

type PriceDirection = "up" | "down" | "same" | "new";

type Settings = {
  refreshSeconds: number;
  dataSaver: boolean;
  maxPrice: number;
  hotPercent: number;
  confirmTimes: number;
  attackConfirmTimes: number;
  noisePercent: number;
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
  moneyAttackRaw: boolean[];
  highQualityRaw: boolean[];
  failRaw: boolean[];
  overheatRaw: boolean[];
  pullbackRaw: boolean[];
  validBreakoutRaw: boolean[];
  moneyOutRaw: boolean[];
  volumeNoRiseRaw: boolean[];
  lowVolumeFakeRaw: boolean[];
  changedAt?: string;
};

type IndustryHistory = {
  industry: string;
  topMoneyRaw: boolean[];
  continuationRaw: boolean[];
  outRaw: boolean[];
};

type IndustryLineItem = {
  industry: string;
  count: number;
  totalAmount: number;
  totalVolume: number;
  avgChange: number;
  amountShare: number;
  volumeShare: number;
  lineWeight: number;
  retentionRate: number;
  attackCount: number;
  attackContinueCount: number;
  highQualityCount: number;
  failCount: number;
  overheatCount: number;
  status: "主線續航" | "主線剛轉入" | "主線分歧" | "主線退潮" | "主線過熱" | "觀察中";
  light: "綠燈" | "黃燈" | "紅燈" | "灰燈";
  stocks: Stock[];
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-mainline-decision-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-mainline-decision-cache";
const SIGNAL_KEY = "taiwan-stock-radar-mainline-decision-signals";
const INDUSTRY_SIGNAL_KEY = "taiwan-stock-radar-mainline-decision-industry";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-mainline-decision-locked";

const defaultSettings: Settings = {
  refreshSeconds: 30,
  dataSaver: false,
  maxPrice: 200,
  hotPercent: 8,
  confirmTimes: 3,
  attackConfirmTimes: 3,
  noisePercent: 0.3,
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

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "--";
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}億`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}萬`;
  return value.toFixed(0);
}

function normalizeStock(raw: any, updateTime: string): Stock {
  const code = String(raw.code ?? raw.symbol ?? raw.stockNo ?? "").replace(".TW", "");
  const name = String(raw.name ?? raw.stockName ?? raw.stockNameZh ?? code);
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
    industry:
      raw.industry && raw.industry !== "其他"
        ? String(raw.industry)
        : industryMap[code] ?? "其他",
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

function isHot(stock: Stock, settings: Settings) {
  return stock.changePercent >= settings.hotPercent || afterOpenPercent(stock) >= 4 || openingPremium(stock) >= 6;
}

function isWeak(stock: Stock) {
  return stock.price < stock.openPrice || stock.price < stock.previousClose || stock.changePercent < 2;
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

function priceVolumeState(stock: Stock, list: Stock[], settings: Settings) {
  const vol = volumeState(stock, list);
  if (stock.price < stock.openPrice || stock.price < stock.previousClose) return "轉弱退潮";
  if (stock.changePercent >= 3 && vol === "量能強") return "量價同步";
  if (stock.changePercent >= settings.hotPercent && vol !== "量能強") return "量價背離";
  if (vol === "量能不足") return "量縮觀望";
  return "量價同步";
}

function priceMovePercent(stock: Stock, prevPrice?: number) {
  if (!prevPrice || prevPrice <= 0) return 0;
  return ((stock.price - prevPrice) / prevPrice) * 100;
}

function isMeaningfulMove(stock: Stock, prevPrice: number | undefined, settings: Settings) {
  return Math.abs(priceMovePercent(stock, prevPrice)) >= settings.noisePercent;
}

function rawValidBreakout(stock: Stock, list: Stock[], settings: Settings) {
  return stock.price >= stock.openPrice * 1.005 && priceVolumeState(stock, list, settings) === "量價同步";
}

function rawInvalidBreakout(stock: Stock, list: Stock[], settings: Settings) {
  const nearOpen = Math.abs(afterOpenPercent(stock)) <= 0.5;
  return stock.price >= stock.openPrice && (volumeState(stock, list) === "量能不足" || nearOpen);
}

function rawContinuation(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const premium = openingPremium(stock);
  const afterOpen = afterOpenPercent(stock);
  const pv = priceVolumeState(stock, list, settings);
  const isMain = mainIndustries.includes(stock.industry);

  if (premium >= 2 && afterOpen < 0) return "開盤強轉弱";
  if (premium >= 2 && pv === "量價背離") return "假強警報";
  if (premium >= 2 && afterOpen > 0.5 && pv === "量價同步") return "開盤強續航";
  if (premium >= 0 && premium < 2 && afterOpen > 0.8 && pv === "量價同步") return "低調續航";
  if (afterOpen > 0.5 && isMain && pv === "量價同步") return "續航中";
  if (stock.price < stock.openPrice) return "轉弱中";
  return "等確認";
}

function rawMoneyAttack(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  return (
    amountRankPercent(stock, list) >= 75 &&
    volumeRankPercent(stock, list) >= 70 &&
    stock.price >= stock.openPrice &&
    priceVolumeState(stock, list, settings) === "量價同步" &&
    rawContinuation(stock, list, mainIndustries, settings).includes("續航") &&
    !isHot(stock, settings)
  );
}

function rawVolumeNoRise(stock: Stock, list: Stock[]) {
  return (
    volumeRankPercent(stock, list) >= 75 &&
    amountRankPercent(stock, list) >= 70 &&
    (stock.price < stock.openPrice || stock.changePercent < 2.5)
  );
}

function rawLowVolumeFake(stock: Stock, list: Stock[], settings: Settings) {
  return stock.changePercent >= 5 && volumeRankPercent(stock, list) <= 35 && priceVolumeState(stock, list, settings) !== "量價同步";
}

function rawMoneyOut(stock: Stock, list: Stock[]) {
  return volumeRankPercent(stock, list) >= 65 && stock.price < stock.openPrice && stock.changePercent < 2;
}

function lastNAllTrue(values: boolean[] | undefined, n: number) {
  if (!values || values.length < n) return false;
  return values.slice(-n).every(Boolean);
}

function lastNAnyTrue(values: boolean[] | undefined, n: number) {
  if (!values || values.length < n) return false;
  return values.slice(-n).some(Boolean);
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

function signalProgress(history: SignalHistory | undefined, total: number, field: keyof SignalHistory) {
  const values = history?.[field];
  const count = Array.isArray(values) ? stableCount(values as boolean[]) : 0;
  return `${Math.min(count, total)}/${total}`;
}

function rawEntryScore(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  let score = 0;
  const cont = rawContinuation(stock, list, mainIndustries, settings);
  const pv = priceVolumeState(stock, list, settings);

  if (mainIndustries.includes(stock.industry)) score += 18;
  if (cont.includes("續航")) score += 20;
  if (stock.price >= stock.openPrice) score += 10;
  if (pv === "量價同步") score += 12;
  if (volumeState(stock, list) === "量能強") score += 10;
  if (amountRankPercent(stock, list) >= 75) score += 10;
  if (stock.price <= settings.maxPrice) score += 6;
  if (!isHot(stock, settings)) score += 8;
  if (rawValidBreakout(stock, list, settings)) score += 10;
  if (rawMoneyAttack(stock, list, mainIndustries, settings)) score += 12;

  if (rawInvalidBreakout(stock, list, settings)) score -= 10;
  if (isHot(stock, settings)) score -= 24;
  if (isWeak(stock)) score -= 25;
  if (cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中") score -= 30;
  if (rawVolumeNoRise(stock, list)) score -= 12;
  if (rawMoneyOut(stock, list)) score -= 18;
  if (rawLowVolumeFake(stock, list, settings)) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function mainlineDecision(
  stock: Stock,
  history: SignalHistory | undefined,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  industryStatus: string
) {
  const attackContinue = lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes);
  const attackRecent = lastNAnyTrue(history?.moneyAttackRaw, 5);
  const fail = lastNAllTrue(history?.failRaw, settings.breakConfirmTimes) || lastNAllTrue(history?.moneyOutRaw, settings.breakConfirmTimes);
  const overheat = lastNAllTrue(history?.overheatRaw, settings.breakConfirmTimes) || isHot(stock, settings);
  const pullback = lastNAllTrue(history?.pullbackRaw, settings.breakConfirmTimes);

  if (fail) return "主線失效";
  if (overheat && attackContinue) return "主線過熱不追";
  if (pullback) return "主線等回測";
  if (industryStatus === "主線續航" && attackContinue && rawEntryScore(stock, list, mainIndustries, settings) >= 72) return "主線核心股";
  if (industryStatus === "主線剛轉入" || attackRecent) return "主線剛轉強";
  if (mainIndustries.includes(stock.industry) && rawMoneyAttack(stock, list, mainIndustries, settings)) return "主線可觀察";
  return "等待主線";
}

function holdingDecision(
  stock: Stock,
  history: SignalHistory | undefined,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  industryStatus: string
) {
  const decision = mainlineDecision(stock, history, list, mainIndustries, settings, industryStatus);

  if (decision === "主線核心股" || decision === "主線可觀察") return "可續抱";
  if (decision === "主線剛轉強" || decision === "主線等回測") return "提高警覺";
  if (decision === "主線過熱不追") return "分批停利";
  if (decision === "主線失效") return "主線失效";
  return "等待確認";
}

function buyZone(stock: Stock) {
  return {
    observe: `${formatPrice(stock.openPrice)} ～ ${formatPrice(stock.openPrice * 1.015)}`,
    breakout: formatPrice(stock.openPrice * 1.005),
    chase: `高於 ${formatPrice(stock.openPrice * 1.03)}`,
  };
}

function decisionTone(label: string) {
  if (["主線核心股", "主線可觀察", "可續抱"].includes(label)) return "text-emerald-300";
  if (["主線等回測", "主線剛轉強", "等待主線", "提高警覺", "等待確認"].includes(label)) return "text-yellow-300";
  if (["主線過熱不追", "分批停利"].includes(label)) return "text-orange-300";
  if (["主線失效"].includes(label)) return "text-red-300";
  return "text-slate-300";
}

function flowTone(label: string) {
  if (label === "主線續航" || label === "綠燈") return "text-emerald-300";
  if (label === "主線剛轉入" || label === "主線分歧" || label === "黃燈") return "text-yellow-300";
  if (label === "主線過熱") return "text-orange-300";
  if (label === "主線退潮" || label === "紅燈") return "text-red-300";
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

function trendText(history?: SignalHistory) {
  if (!history || history.prices.length < 2) return "新資料";
  const recent = history.prices.slice(-3);
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (last > first) return "短線上升";
  if (last < first) return "短線下降";
  return "短線持平";
}

function progressBar(count: number, total: number) {
  const safeTotal = Math.max(1, total);
  const filled = Math.min(count, safeTotal);
  const empty = Math.max(0, safeTotal - filled);
  return "●".repeat(filled) + "○".repeat(empty);
}

function mainlineSentence(decision: string, stock: Stock, industryStatus: string) {
  if (decision === "主線核心股") return `這檔屬於資金續航產業，主攻已連續確認，若不追高可列入主線核心觀察。`;
  if (decision === "主線等回測") return `這檔仍在主線內，但距離開盤價較遠，現在不追，等回測合理位置。`;
  if (decision === "主線剛轉強") return `主線剛轉強，先觀察下一次更新是否延續，不急著追。`;
  if (decision === "主線過熱不追") return `主線短線過熱，成交量放大但位置偏高，不追，持有者可考慮分批停利。`;
  if (decision === "主線失效") return `主攻失效或資金退潮，降低持有意願，先避開。`;
  if (industryStatus === "主線分歧") return `所屬產業資金分歧，只挑最高品質，不碰爆量不漲股。`;
  return `等待資金主線更明確，先看產業續航與主攻確認。`;
}

function getIndustryLineRanking(
  stocks: Stock[],
  mainIndustries: string[],
  settings: Settings,
  signalMap: Record<string, SignalHistory>,
  industryHistoryMap: Record<string, IndustryHistory>
): IndustryLineItem[] {
  const totalVolume = stocks.reduce((sum, stock) => sum + Math.max(0, stock.volume), 0);
  const totalAmount = stocks.reduce((sum, stock) => sum + estimatedAmount(stock), 0);
  const map = new Map<string, IndustryLineItem>();

  stocks.forEach((stock) => {
    const history = signalMap[stock.code];

    const item =
      map.get(stock.industry) ??
      {
        industry: stock.industry,
        count: 0,
        totalAmount: 0,
        totalVolume: 0,
        avgChange: 0,
        amountShare: 0,
        volumeShare: 0,
        lineWeight: 0,
        retentionRate: 0,
        attackCount: 0,
        attackContinueCount: 0,
        highQualityCount: 0,
        failCount: 0,
        overheatCount: 0,
        status: "觀察中",
        light: "灰燈",
        stocks: [],
      };

    item.count += 1;
    item.totalAmount += estimatedAmount(stock);
    item.totalVolume += Math.max(0, stock.volume);
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);

    if (rawMoneyAttack(stock, stocks, mainIndustries, settings)) item.attackCount += 1;
    if (lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes)) item.attackContinueCount += 1;
    if (lastNAllTrue(history?.highQualityRaw, settings.confirmTimes)) item.highQualityCount += 1;
    if (lastNAllTrue(history?.failRaw, settings.breakConfirmTimes) || rawMoneyOut(stock, stocks) || rawVolumeNoRise(stock, stocks)) item.failCount += 1;
    if (isHot(stock, settings)) item.overheatCount += 1;

    map.set(stock.industry, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avgChange = item.avgChange / Math.max(item.count, 1);
      const amountShare = totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0;
      const volumeShare = totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0;
      const h = industryHistoryMap[item.industry];

      const retentionRate = h?.continuationRaw?.length
        ? (h.continuationRaw.filter(Boolean).length / h.continuationRaw.length) * 100
        : 0;

      const overheatRisk = avgChange >= 7 || item.overheatCount >= Math.max(2, item.count * 0.35);
      const divergence = item.attackCount > 0 && item.failCount >= Math.max(1, item.count * 0.25);

      const lineWeight =
        amountShare * 2.4 +
        volumeShare * 1.7 +
        Math.max(0, avgChange) * 4 +
        item.attackCount * 10 +
        item.attackContinueCount * 18 +
        item.highQualityCount * 14 +
        retentionRate * 0.5 -
        item.failCount * 14 -
        item.overheatCount * 7;

      let status: IndustryLineItem["status"] = "觀察中";
      let light: IndustryLineItem["light"] = "灰燈";

      if (item.failCount >= Math.max(2, item.count * 0.35)) {
        status = "主線退潮";
        light = "紅燈";
      } else if (overheatRisk && item.attackContinueCount > 0) {
        status = "主線過熱";
        light = "紅燈";
      } else if (divergence) {
        status = "主線分歧";
        light = "黃燈";
      } else if (retentionRate >= 55 && item.attackContinueCount >= 1 && item.highQualityCount >= 1) {
        status = "主線續航";
        light = "綠燈";
      } else if (amountShare >= 10 || volumeShare >= 10 || item.attackCount >= 1) {
        status = "主線剛轉入";
        light = "黃燈";
      }

      return {
        ...item,
        avgChange,
        amountShare,
        volumeShare,
        lineWeight,
        retentionRate,
        status,
        light,
      };
    })
    .sort((a, b) => b.lineWeight - a.lineWeight);
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

function IndustryLineCard({ item, rank }: { item: IndustryLineItem; rank: number }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 產業主線權重</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${flowTone(item.status)}`}>
            {item.light}｜{item.status}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-black text-yellow-300">{formatAmount(item.totalAmount)}</div>
          <div className="text-sm font-black text-emerald-300">權重 {item.lineWeight.toFixed(0)}</div>
          <div className="text-xs font-black text-slate-400">留存 {item.retentionRate.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">
          主攻續航
          <br />
          {item.attackContinueCount}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
          高品質
          <br />
          {item.highQualityCount}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">
          失效
          <br />
          {item.failCount}
        </div>
      </div>
    </div>
  );
}

function StockCard({
  stock,
  rank,
  top50,
  mainIndustries,
  settings,
  signalMap,
  industryStatus,
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
  industryStatus: string;
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
  const decision = mainlineDecision(stock, history, top50, mainIndustries, settings, industryStatus);
  const holding = holdingDecision(stock, history, top50, mainIndustries, settings, industryStatus);
  const cont = rawContinuation(stock, top50, mainIndustries, settings);
  const score = rawEntryScore(stock, top50, mainIndustries, settings);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const diff = prevPrice ? stock.price - prevPrice : 0;
  const diffPct = prevPrice ? ((stock.price - prevPrice) / prevPrice) * 100 : 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const mainIndex = mainIndustries.indexOf(stock.industry);
  const attackCount = stableCount(history?.moneyAttackRaw);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry}
              {mainIndex >= 0 ? `｜資金主線${mainIndex + 1}` : ""}
            </div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-black/30 p-2">
          <div className="flex items-center justify-between text-xs font-black text-slate-300">
            <span>主攻確認</span>
            <span>{signalProgress(history, settings.attackConfirmTimes, "moneyAttackRaw")}</span>
          </div>
          <div className="mt-1 text-lg tracking-widest text-emerald-300">
            {progressBar(attackCount, settings.attackConfirmTimes)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
          <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">
            估算成交金額
            <br />
            {formatAmount(estimatedAmount(stock))}
          </div>
          <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
            金額/量能排名
            <br />#{amountRankIndex(stock, top50)} / #{volumeRankIndex(stock, top50)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(decision)}`}>{decision}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(holding)}`}>持股：{holding}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${flowTone(industryStatus)}`}>{industryStatus}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(cont)}`}>{cont}</span>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-200">分數 {score}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{priceVolumeState(stock, top50, settings)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {mainlineSentence(decision, stock, industryStatus)}
        </div>

        <div className={`mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold ${directionTone(direction)}`}>
          即時：{directionText(direction)}｜{trendText(history)}
          <br />
          {prevPrice
            ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${stock.price.toFixed(2)}｜${diff > 0 ? "+" : ""}${diff.toFixed(2)}｜${formatPercent(diffPct)}`
            : "尚無上一筆"}
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
  const [industryHistoryMap, setIndustryHistoryMap] = useState<Record<string, IndustryHistory>>({});

  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState("mainline");
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
    const map = new Map<string, { industry: string; amount: number; volume: number; score: number }>();

    top50.forEach((stock) => {
      const item = map.get(stock.industry) || { industry: stock.industry, amount: 0, volume: 0, score: 0 };
      item.amount += estimatedAmount(stock);
      item.volume += Math.max(0, stock.volume);
      item.score += stock.changePercent + Math.max(0, openingPremium(stock)) + estimatedAmount(stock) / 10000000;
      map.set(stock.industry, item);
    });

    return Array.from(map.values()).sort(
      (a, b) => b.amount + b.volume * 10 + b.score * 1000000 - (a.amount + a.volume * 10 + a.score * 1000000)
    );
  }, [top50]);

  const floatingIndustries = useMemo(() => rawIndustryRanking.slice(0, 3).map((item) => item.industry), [rawIndustryRanking]);

  const mainIndustries = useMemo(() => {
    if (settings.stableIndustryLock && lockedIndustries.length > 0) return lockedIndustries;
    return floatingIndustries;
  }, [floatingIndustries, lockedIndustries, settings.stableIndustryLock]);

  const industryLineRanking = useMemo(
    () => getIndustryLineRanking(top50, mainIndustries, settings, signalMap, industryHistoryMap),
    [top50, mainIndustries, settings, signalMap, industryHistoryMap]
  );

  const industryStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    industryLineRanking.forEach((item) => {
      map[item.industry] = item.status;
    });
    return map;
  }, [industryLineRanking]);

  const mainlineCoreList = useMemo(
    () =>
      top50
        .filter((stock) => mainlineDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中") === "主線核心股")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const mainlinePullbackList = useMemo(
    () =>
      top50
        .filter((stock) => mainlineDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中") === "主線等回測")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const mainlineNewStrongList = useMemo(
    () =>
      top50
        .filter((stock) => mainlineDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中") === "主線剛轉強")
        .sort((a, b) => stableCount(signalMap[b.code]?.moneyAttackRaw) - stableCount(signalMap[a.code]?.moneyAttackRaw)),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const mainlineOverheatList = useMemo(
    () =>
      top50
        .filter((stock) => mainlineDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中") === "主線過熱不追")
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const mainlineFailedList = useMemo(
    () =>
      top50
        .filter((stock) => mainlineDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中") === "主線失效")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const holdingList = useMemo(
    () =>
      top50
        .filter((stock) => ["可續抱", "提高警覺", "分批停利", "主線失效"].includes(holdingDecision(stock, signalMap[stock.code], top50, mainIndustries, settings, industryStatusMap[stock.industry] || "觀察中")))
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, signalMap, mainIndustries, settings, industryStatusMap]
  );

  const moneyAmountList = useMemo(() => [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)), [top50]);

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

    [...mainlineCoreList, ...mainlinePullbackList, ...mainlineNewStrongList].slice(0, 20).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [tomorrowCodes, stocks, mainlineCoreList, mainlinePullbackList, mainlineNewStrongList]);

  const selectedStock = useMemo(() => stocks.find((s) => s.code === selectedCode) || null, [stocks, selectedCode]);

  const totalEstimatedAmount = useMemo(() => top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0), [top50]);

  const topLineIndustry = industryLineRanking[0];

  const marketStructure = useMemo(() => {
    if (mainlineFailedList.length >= 6) return "主線失效偏多，避開";
    if (mainlineOverheatList.length >= 6) return "主線過熱，不追";
    if (industryLineRanking.some((item) => item.status === "主線分歧")) return "資金分歧，只挑核心";
    if (mainlineCoreList.length >= 3) return "主線明確，看核心股";
    if (mainlineNewStrongList.length >= 5) return "主線剛轉強，等確認";
    return "等待主線確認";
  }, [mainlineFailedList, mainlineOverheatList, industryLineRanking, mainlineCoreList, mainlineNewStrongList]);

  const homeSentence = useMemo(() => {
    if (!topLineIndustry) return "目前資金主線尚未形成，先等資料。";

    if (marketStructure === "主線明確，看核心股") {
      return `今日主線策略：資金集中在 ${topLineIndustry.industry}，主攻續航股優先，爆量不漲股避開。`;
    }
    if (marketStructure === "主線剛轉強，等確認") {
      return `${topLineIndustry.industry} 主線剛轉強，先等下一次確認，不急追。`;
    }
    if (marketStructure === "資金分歧，只挑核心") {
      return `資金分歧，只挑主線核心股，避開爆量不漲與低量假強。`;
    }
    if (marketStructure === "主線過熱，不追") {
      return `主線過熱，不追高；有持股者留意分批停利。`;
    }
    if (marketStructure === "主線失效偏多，避開") {
      return `主線失效訊號偏多，先避開，等資金重新集中。`;
    }

    return `目前最強主線是 ${topLineIndustry.industry}，但還需要更多主攻確認。`;
  }, [topLineIndustry, marketStructure]);

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
    setIndustryHistoryMap(safeParse(localStorage.getItem(INDUSTRY_SIGNAL_KEY), {}));
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
    const list = floatingIndustries.slice(0, 3);
    setLockedIndustries(list);
    localStorage.setItem(LOCKED_INDUSTRY_KEY, JSON.stringify(list));
  }

  function clearLockedIndustries() {
    setLockedIndustries([]);
    localStorage.removeItem(LOCKED_INDUSTRY_KEY);
  }

  function resetSignals() {
    setSignalMap({});
    setIndustryHistoryMap({});
    localStorage.removeItem(SIGNAL_KEY);
    localStorage.removeItem(INDUSTRY_SIGNAL_KEY);
  }

  function updateIndustryHistory(list: Stock[]) {
    const topIndustries = [...list]
      .slice(0, 50)
      .reduce((map, stock) => {
        const item = map.get(stock.industry) || { industry: stock.industry, amount: 0, volume: 0 };
        item.amount += estimatedAmount(stock);
        item.volume += stock.volume;
        map.set(stock.industry, item);
        return map;
      }, new Map<string, { industry: string; amount: number; volume: number }>());

    const ranked = Array.from(topIndustries.values())
      .sort((a, b) => b.amount + b.volume * 10 - (a.amount + a.volume * 10))
      .slice(0, 3)
      .map((item) => item.industry);

    setIndustryHistoryMap((old) => {
      const next = { ...old };

      Array.from(new Set([...Object.keys(next), ...ranked])).forEach((industry) => {
        const oldItem = next[industry] || {
          industry,
          topMoneyRaw: [],
          continuationRaw: [],
          outRaw: [],
        };

        const industryStocks = list.slice(0, 50).filter((stock) => stock.industry === industry);
        const attackCount = industryStocks.filter((stock) => rawMoneyAttack(stock, list.slice(0, 50), ranked, settings)).length;
        const outCount = industryStocks.filter((stock) => rawMoneyOut(stock, list.slice(0, 50)) || rawVolumeNoRise(stock, list.slice(0, 50))).length;
        const continuation = ranked.includes(industry) && attackCount > 0 && outCount === 0;

        next[industry] = {
          ...oldItem,
          topMoneyRaw: [...oldItem.topMoneyRaw, ranked.includes(industry)].slice(-8),
          continuationRaw: [...oldItem.continuationRaw, continuation].slice(-8),
          outRaw: [...oldItem.outRaw, outCount > 0].slice(-8),
        };
      });

      localStorage.setItem(INDUSTRY_SIGNAL_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateSignalHistory(list: Stock[], oldPrices: Record<string, number>) {
    const activeMain =
      settings.stableIndustryLock && lockedIndustries.length > 0
        ? lockedIndustries
        : floatingIndustries.slice(0, 3);

    setSignalMap((old) => {
      const next = { ...old };
      const topList = list.slice(0, 50);

      list.slice(0, 80).forEach((stock) => {
        const prevPrice = oldPrices[stock.code];
        const oldItem: SignalHistory =
          next[stock.code] || {
            code: stock.code,
            prices: [],
            entryRaw: [],
            moneyAttackRaw: [],
            highQualityRaw: [],
            failRaw: [],
            overheatRaw: [],
            pullbackRaw: [],
            validBreakoutRaw: [],
            moneyOutRaw: [],
            volumeNoRiseRaw: [],
            lowVolumeFakeRaw: [],
          };

        const meaningful = isMeaningfulMove(stock, prevPrice, settings);
        const moneyAttackOk = meaningful && rawMoneyAttack(stock, topList, activeMain, settings);
        const validBreakoutOk = rawValidBreakout(stock, topList, settings);
        const moneyOutOk = rawMoneyOut(stock, topList);
        const volumeNoRiseOk = rawVolumeNoRise(stock, topList);
        const lowVolumeFakeOk = rawLowVolumeFake(stock, topList, settings);
        const failOk = moneyOutOk || volumeNoRiseOk || lowVolumeFakeOk || rawInvalidBreakout(stock, topList, settings);
        const overheatOk = isHot(stock, settings) && (moneyAttackOk || lastNAnyTrue(oldItem.moneyAttackRaw, 5));
        const pullbackOk = moneyAttackOk && afterOpenPercent(stock) > 2.5 && !overheatOk;
        const entryOk = moneyAttackOk && validBreakoutOk && !failOk && !overheatOk;
        const highQualityOk = entryOk && activeMain.includes(stock.industry) && priceVolumeState(stock, topList, settings) === "量價同步";

        next[stock.code] = {
          ...oldItem,
          prices: [...oldItem.prices, stock.price].slice(-8),
          entryRaw: [...oldItem.entryRaw, entryOk].slice(-8),
          moneyAttackRaw: [...oldItem.moneyAttackRaw, moneyAttackOk].slice(-8),
          highQualityRaw: [...oldItem.highQualityRaw, highQualityOk].slice(-8),
          failRaw: [...oldItem.failRaw, failOk].slice(-8),
          overheatRaw: [...oldItem.overheatRaw, overheatOk].slice(-8),
          pullbackRaw: [...oldItem.pullbackRaw, pullbackOk].slice(-8),
          validBreakoutRaw: [...oldItem.validBreakoutRaw, validBreakoutOk].slice(-8),
          moneyOutRaw: [...oldItem.moneyOutRaw, moneyOutOk].slice(-8),
          volumeNoRiseRaw: [...oldItem.volumeNoRiseRaw, volumeNoRiseOk].slice(-8),
          lowVolumeFakeRaw: [...oldItem.lowVolumeFakeRaw, lowVolumeFakeOk].slice(-8),
          changedAt: nowText(),
        };
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

      updateIndustryHistory(normalized);
      updateSignalHistory(normalized, oldPriceMap);

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

  function stockIndustryStatus(stock: Stock) {
    return industryStatusMap[stock.industry] || "觀察中";
  }

  function filterList(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topFilter === "主線核心") arr = arr.filter((stock) => mainlineCoreList.some((item) => item.code === stock.code));
      if (settings.topFilter === "等回測") arr = arr.filter((stock) => mainlinePullbackList.some((item) => item.code === stock.code));
      if (settings.topFilter === "剛轉強") arr = arr.filter((stock) => mainlineNewStrongList.some((item) => item.code === stock.code));
      if (settings.topFilter === "過熱不追") arr = arr.filter((stock) => mainlineOverheatList.some((item) => item.code === stock.code));
      if (settings.topFilter === "主線失效") arr = arr.filter((stock) => mainlineFailedList.some((item) => item.code === stock.code));
      if (settings.topFilter === "持股管理") arr = arr.filter((stock) => holdingList.some((item) => item.code === stock.code));
      if (settings.topFilter === "成交金額") arr = arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
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

    if (sortKey === "mainline") {
      return arr.sort((a, b) => {
        const ah = signalMap[a.code];
        const bh = signalMap[b.code];

        const aIndustry = industryLineRanking.find((item) => item.industry === a.industry)?.lineWeight || 0;
        const bIndustry = industryLineRanking.find((item) => item.industry === b.industry)?.lineWeight || 0;

        const aScore =
          aIndustry +
          stableCount(ah?.moneyAttackRaw) * 30 +
          amountRankPercent(a, top50) +
          volumeRankPercent(a, top50) +
          rawEntryScore(a, top50, mainIndustries, settings) -
          (isHot(a, settings) ? 30 : 0) -
          (lastNAllTrue(ah?.failRaw, settings.breakConfirmTimes) ? 60 : 0);

        const bScore =
          bIndustry +
          stableCount(bh?.moneyAttackRaw) * 30 +
          amountRankPercent(b, top50) +
          volumeRankPercent(b, top50) +
          rawEntryScore(b, top50, mainIndustries, settings) -
          (isHot(b, settings) ? 30 : 0) -
          (lastNAllTrue(bh?.failRaw, settings.breakConfirmTimes) ? 60 : 0);

        return bScore - aScore;
      });
    }

    if (sortKey === "money") return arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
    if (sortKey === "volume") return arr.sort((a, b) => b.volume - a.volume);
    if (sortKey === "entry") return arr.sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings));
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = industryLineRanking.findIndex((item) => item.industry === a.industry);
        const ib = industryLineRanking.findIndex((item) => item.industry === b.industry);
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
      if (moreView === "core") return sortList(mainlineCoreList);
      if (moreView === "pullback") return sortList(mainlinePullbackList);
      if (moreView === "newStrong") return sortList(mainlineNewStrongList);
      if (moreView === "overheat") return sortList(mainlineOverheatList);
      if (moreView === "failed") return sortList(mainlineFailedList);
      if (moreView === "holding") return sortList(holdingList);
      if (moreView === "amount") return sortList(moneyAmountList);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    mainlineCoreList,
    mainlinePullbackList,
    mainlineNewStrongList,
    mainlineOverheatList,
    mainlineFailedList,
    holdingList,
    moneyAmountList,
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

  const cardBaseProps = {
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

  function stockCardPropsFor(stock: Stock) {
    return {
      ...cardBaseProps,
      industryStatus: stockIndustryStatus(stock),
    };
  }

  if (selectedStock) {
    const history = signalMap[selectedStock.code];
    const industryStatus = stockIndustryStatus(selectedStock);
    const decision = mainlineDecision(selectedStock, history, top50, mainIndustries, settings, industryStatus);
    const holding = holdingDecision(selectedStock, history, top50, mainIndustries, settings, industryStatus);
    const cont = rawContinuation(selectedStock, top50, mainIndustries, settings);
    const score = rawEntryScore(selectedStock, top50, mainIndustries, settings);
    const prevPrice = previousPriceMap[selectedStock.code];
    const direction = priceDirections[selectedStock.code];
    const zone = buyZone(selectedStock);

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
              <div className="text-xs font-bold text-slate-400">主線一句話</div>
              <div className="mt-1 text-3xl font-black">{decision}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {mainlineSentence(decision, selectedStock, industryStatus)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(holding)}`}>
              <div className="text-xs font-bold text-slate-400">現在該怎麼做 / 持股管理</div>
              <div className="mt-1 text-2xl font-black">{holding}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                主線停損提醒：跌破開盤價或主攻失效，降低持有意願。
                <br />
                主線停利提醒：短線過熱、成交量放大但股價不再創高，分批停利。
              </div>
            </div>

            <section className={`mt-4 rounded-2xl bg-black/30 p-4 ${flowTone(industryStatus)}`}>
              <div className="text-xs font-bold text-slate-400">所屬產業主線</div>
              <div className="mt-1 text-2xl font-black">{industryStatus}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                產業：{selectedStock.industry}
                <br />
                主流：{mainIndustries.includes(selectedStock.industry) ? "是" : "否"}
              </div>
            </section>

            <section className="mt-4 rounded-2xl bg-blue-950/30 p-4">
              <div className="text-lg font-black text-blue-100">主線買點區</div>
              <div className="mt-2 text-sm font-bold text-blue-100">
                理想觀察區：{zone.observe}
                <br />
                有效突破區：{zone.breakout}
                <br />
                追高風險區：{zone.chase}
                <br />
                目前開盤後：{formatPercent(afterOpenPercent(selectedStock))}
              </div>
            </section>

            <section className="mt-4 rounded-2xl bg-yellow-950/30 p-4">
              <div className="text-lg font-black text-yellow-100">資金與主攻確認</div>
              <div className="mt-2 text-sm font-bold text-yellow-100">
                估算成交金額：{formatAmount(estimatedAmount(selectedStock))}
                <br />
                成交金額排名：#{amountRankIndex(selectedStock, top50)}
                <br />
                成交量排名：#{volumeRankIndex(selectedStock, top50)}
                <br />
                主攻確認：{signalProgress(history, settings.attackConfirmTimes, "moneyAttackRaw")}
                <br />
                進場確認：{signalProgress(history, settings.confirmTimes, "entryRaw")}
              </div>
            </section>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(cont)}`}>
              <div className="text-xs font-bold text-slate-400">盤中續航</div>
              <div className="mt-1 text-2xl font-black">{cont}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                趨勢：{trendText(history)}
                <br />
                量價：{priceVolumeState(selectedStock, top50, settings)}
                <br />
                成交量：{volumeState(selectedStock, top50)}
              </div>
            </div>

            <section className="mt-4 rounded-2xl bg-slate-950 p-4">
              <div className="text-lg font-black">即時股價</div>
              <div className={`mt-2 text-xl font-black ${directionTone(direction)}`}>{directionText(direction)}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {prevPrice ? `上一筆 ${prevPrice.toFixed(2)} → 現在 ${selectedStock.price.toFixed(2)}` : "尚無上一筆"}
                <br />
                進場分數：{score}
                <br />
                開盤：{formatPrice(selectedStock.openPrice)}｜現價：{formatPrice(selectedStock.price)}
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
              <div className="text-sm font-bold text-slate-400">台股資金主線進出場決策版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">主線決策雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                先找資金主線 → 找主攻核心股 → 判斷能不能進 → 過熱不追 → 失效避開。
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
              <div className="text-lg font-black">
                即時股價狀態：{updating ? "更新中" : error ? "API錯誤" : usingCache ? "使用快取" : "即時正常"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功：{lastSuccessAt || "尚未成功"}｜下一次：
                {settings.dataSaver || settings.refreshSeconds === 0 ? "手動" : `${autoSeconds}秒後`}
              </div>
              <div className="mt-1 text-xs font-bold text-cyan-300">
                50強估算總成交金額：{formatAmount(totalEstimatedAmount)}
              </div>
            </div>

            <button onClick={() => goMore("data")} className="rounded-2xl bg-blue-500/20 px-4 py-2 text-sm font-black text-blue-200">
              主線統計
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">今日主線策略</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {topLineIndustry ? `${topLineIndustry.light}｜${topLineIndustry.industry}｜${topLineIndustry.status}` : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{homeSentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="盤中型態" value={marketStructure} />
            <DetailRow label="最強主線" value={topLineIndustry?.industry || "--"} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="主線核心股" value={mainlineCoreList.length} sub="主線+主攻續航" tone="text-emerald-300" onClick={() => goMore("core")} />
          <MiniCard title="主線等回測" value={mainlinePullbackList.length} sub="不追高" tone="text-yellow-300" onClick={() => goMore("pullback")} />
          <MiniCard title="主線剛轉強" value={mainlineNewStrongList.length} sub="等下一次確認" tone="text-yellow-300" onClick={() => goMore("newStrong")} />
          <MiniCard title="主線失效" value={mainlineFailedList.length} sub="避開" tone="text-red-300" onClick={() => goMore("failed")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="主線過熱不追" sub="等回測 / 停利" badge={mainlineOverheatList.length} tone="text-orange-300" onClick={() => goMore("overheat")} />
          <ActionCard title="持股管理" sub="續抱 / 警覺 / 停利" badge={holdingList.length} tone="text-purple-300" onClick={() => goMore("holding")} />
          <ActionCard title="產業主線權重" sub="主線排行" badge={industryLineRanking.length} tone="text-yellow-300" onClick={() => goMore("industry")} />
          <ActionCard title="成交金額排行" sub="資金核心排名" badge={moneyAmountList.length} tone="text-yellow-300" onClick={() => goMore("amount")} />
          <ActionCard title="50強" sub="主線篩選" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
          <ActionCard title="設定" sub="確認次數 / 主流鎖定" badge="⚙️" tone="text-purple-300" onClick={() => goMore("settings")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">這版主要看資金主線進出場決策。</p>
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
                  ["mainline", "主線"],
                  ["money", "金額"],
                  ["volume", "成交量"],
                  ["entry", "進場"],
                  ["industry", "產業"],
                  ["change", "漲幅"],
                  ["price", "低價"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setSortKey(key)}
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
                  {["全部", "主線核心", "等回測", "剛轉強", "過熱不追", "主線失效", "持股管理", "成交金額", "主流產業"].map((filter) => (
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
            <h2 className="text-xl font-black">主線決策雷達</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="主線核心股" sub="只等合理位置" badge={mainlineCoreList.length} tone="text-emerald-300" onClick={() => setMoreView("core")} />
              <ActionCard title="主線等回測" sub="不追高" badge={mainlinePullbackList.length} tone="text-yellow-300" onClick={() => setMoreView("pullback")} />
              <ActionCard title="主線剛轉強" sub="等確認" badge={mainlineNewStrongList.length} tone="text-yellow-300" onClick={() => setMoreView("newStrong")} />
              <ActionCard title="主線過熱" sub="不追 / 停利" badge={mainlineOverheatList.length} tone="text-orange-300" onClick={() => setMoreView("overheat")} />
              <ActionCard title="主線失效" sub="避開" badge={mainlineFailedList.length} tone="text-red-300" onClick={() => setMoreView("failed")} />
              <ActionCard title="持股管理" sub="可續抱 / 分批停利" badge={holdingList.length} tone="text-purple-300" onClick={() => setMoreView("holding")} />
              <ActionCard title="產業主線權重" sub="主線排行" badge={industryLineRanking.length} tone="text-yellow-300" onClick={() => setMoreView("industry")} />
              <ActionCard title="設定" sub="主攻確認 / 降噪" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
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
              {tab === "more" && moreView === "core" && "🟢 主線核心股"}
              {tab === "more" && moreView === "pullback" && "🟡 主線等回測"}
              {tab === "more" && moreView === "newStrong" && "🟡 主線剛轉強"}
              {tab === "more" && moreView === "overheat" && "🟠 主線過熱不追"}
              {tab === "more" && moreView === "failed" && "🔴 主線失效"}
              {tab === "more" && moreView === "holding" && "🟣 持股管理"}
              {tab === "more" && moreView === "industry" && "🏭 產業主線權重"}
              {tab === "more" && moreView === "amount" && "💰 成交金額排行"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 主線統計"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              資金主線：{industryLineRanking.slice(0, 3).map((item) => item.industry).join("、") || "--"}｜型態：{marketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">產業主線權重排行</h3>
                <div className="mt-3 space-y-3">
                  {industryLineRanking.slice(0, 3).map((item, index) => (
                    <IndustryLineCard key={item.industry} item={item} rank={index + 1} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">主線核心股 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {mainlineCoreList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確主線核心股。
                    </div>
                  )}
                  {mainlineCoreList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">主線等回測 / 剛轉強 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {[...mainlinePullbackList, ...mainlineNewStrongList].slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有等回測或剛轉強股票。
                    </div>
                  )}
                  {[...mainlinePullbackList, ...mainlineNewStrongList].slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">主線失效 / 過熱警報</h3>
                <div className="mt-3 space-y-3">
                  {[...mainlineFailedList, ...mainlineOverheatList].slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯主線失效或過熱。
                    </div>
                  )}
                  {[...mainlineFailedList, ...mainlineOverheatList].slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
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
                <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "industry" && (
            <div className="space-y-3">
              {industryLineRanking.map((item, index) => (
                <IndustryLineCard key={item.industry} item={item} rank={index + 1} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
              <div>
                <div className="mb-2 text-lg font-black">主攻確認次數</div>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map((num) => (
                    <button
                      key={num}
                      onClick={() => saveSettings({ ...settings, attackConfirmTimes: num })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.attackConfirmTimes === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {num}次
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-lg font-black">降噪幅度</div>
                <div className="grid grid-cols-3 gap-2">
                  {[0.2, 0.3, 0.5].map((num) => (
                    <button
                      key={num}
                      onClick={() => saveSettings({ ...settings, noisePercent: num })}
                      className={`rounded-2xl py-3 text-sm font-black ${
                        settings.noisePercent === num ? "bg-purple-500 text-white" : "bg-black/30 text-slate-300"
                      }`}
                    >
                      {num}%
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
                重置所有主線確認紀錄
              </button>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">主線統計</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>50強總成交金額估算：{formatAmount(totalEstimatedAmount)}</div>
                <div>主線核心股數：{mainlineCoreList.length}</div>
                <div>主線等回測股數：{mainlinePullbackList.length}</div>
                <div>主線剛轉強股數：{mainlineNewStrongList.length}</div>
                <div>主線失效股數：{mainlineFailedList.length}</div>
                <div>主線過熱股數：{mainlineOverheatList.length}</div>
                <div>持股管理股數：{holdingList.length}</div>
                <div>今日最強主線：{topLineIndustry?.industry || "--"}</div>
                <div>盤中型態：{marketStructure}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => loadStocks()} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                  立即更新
                </button>
                <button onClick={resetSignals} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                  重置主線紀錄
                </button>
              </div>
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
                  <StockCard key={`${stock.code}-${index}`} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
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
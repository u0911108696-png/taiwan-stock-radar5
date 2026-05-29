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
  | "industryMoney"
  | "moneyAmount"
  | "volumeAttack"
  | "volumeNoRise"
  | "lowVolumeFake"
  | "moneyOut"
  | "highQuality"
  | "entryReady"
  | "confirming"
  | "noise"
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
  noisePercent: number;
  cooldownTicks: number;
  signalHoldTicks: number;
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
  avoidRaw: boolean[];
  highQualityRaw: boolean[];
  noiseRaw: boolean[];
  moneyAttackRaw: boolean[];
  volumeNoRiseRaw: boolean[];
  lowVolumeFakeRaw: boolean[];
  moneyOutRaw: boolean[];
  validBreakoutRaw: boolean[];
  invalidBreakoutRaw: boolean[];
  holdLeft?: number;
  cooldownLeft?: number;
  changedAt?: string;
};

type IndustryHistory = {
  industry: string;
  topRaw: boolean[];
  moneyRankRaw: boolean[];
};

type IndustryMoneyItem = {
  industry: string;
  count: number;
  totalVolume: number;
  totalAmount: number;
  avgChange: number;
  volumeShare: number;
  amountShare: number;
  moneyScore: number;
  concentration: number;
  attackCount: number;
  highQualityCount: number;
  entryCount: number;
  volumeNoRiseCount: number;
  lowVolumeFakeCount: number;
  moneyOutCount: number;
  noiseCount: number;
  stability: number;
  status: string;
  stocks: Stock[];
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-money-volume-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-money-volume-cache";
const SIGNAL_KEY = "taiwan-stock-radar-money-volume-signals";
const INDUSTRY_SIGNAL_KEY = "taiwan-stock-radar-money-volume-industry-signals";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-money-volume-locked-industries";

const defaultSettings: Settings = {
  refreshSeconds: 30,
  dataSaver: false,
  maxPrice: 200,
  hotPercent: 8,
  confirmTimes: 3,
  breakConfirmTimes: 2,
  noisePercent: 0.3,
  cooldownTicks: 2,
  signalHoldTicks: 3,
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

function volumeRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => b.volume - a.volume);
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function amountRankIndex(stock: Stock, list: Stock[]) {
  const sorted = [...list].sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
  const index = sorted.findIndex((s) => s.code === stock.code);
  return index >= 0 ? index + 1 : 999;
}

function volumeRankPercent(stock: Stock, list: Stock[]) {
  if (!stock.volume || stock.volume <= 0) return 0;

  const rank = volumeRankIndex(stock, list);
  if (rank >= 999 || list.length <= 1) return 0;

  return Math.round(((list.length - rank + 1) / list.length) * 100);
}

function amountRankPercent(stock: Stock, list: Stock[]) {
  const rank = amountRankIndex(stock, list);
  if (rank >= 999 || list.length <= 1) return 0;

  return Math.round(((list.length - rank + 1) / list.length) * 100);
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

function rawValidBreakout(stock: Stock, list: Stock[], settings: Settings) {
  return stock.price >= stock.openPrice * 1.005 && priceVolumeState(stock, list, settings) === "量價同步";
}

function rawInvalidBreakout(stock: Stock, list: Stock[], settings: Settings) {
  const nearOpen = Math.abs(afterOpenPercent(stock)) <= 0.5;
  return stock.price >= stock.openPrice && (volumeState(stock, list) === "量能不足" || nearOpen);
}

function rawEntryScore(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  let score = 0;
  const cont = rawContinuation(stock, list, mainIndustries, settings);
  const pv = priceVolumeState(stock, list, settings);

  if (mainIndustries.includes(stock.industry)) score += 18;
  if (cont === "開盤強續航" || cont === "續航中") score += 18;
  if (cont === "低調續航") score += 18;
  if (stock.price >= stock.openPrice) score += 10;
  if (pv === "量價同步") score += 12;
  if (volumeState(stock, list) === "量能強") score += 10;
  if (amountRankPercent(stock, list) >= 75) score += 10;
  if (stock.price <= settings.maxPrice) score += 6;
  if (!isHot(stock, settings)) score += 8;
  if (rawValidBreakout(stock, list, settings)) score += 10;

  if (rawInvalidBreakout(stock, list, settings)) score -= 10;
  if (isHot(stock, settings)) score -= 24;
  if (isWeak(stock)) score -= 25;
  if (cont === "假強警報" || cont === "開盤強轉弱" || cont === "轉弱中") score -= 30;

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
    rawValidBreakout(stock, list, settings) &&
    (cont === "開盤強續航" || cont === "續航中" || cont === "低調續航")
  );
}

function rawAvoid(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  const cont = rawContinuation(stock, list, mainIndustries, settings);

  return (
    isWeak(stock) ||
    cont === "假強警報" ||
    cont === "開盤強轉弱" ||
    cont === "轉弱中" ||
    rawInvalidBreakout(stock, list, settings)
  );
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

function rawMoneyQuality(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  if (rawMoneyAttack(stock, list, mainIndustries, settings)) return "主力主攻";
  if (rawVolumeNoRise(stock, list)) return "爆量不漲";
  if (rawMoneyOut(stock, list)) return "量增價弱";
  if (rawLowVolumeFake(stock, list, settings)) return "低量假強";
  if (amountRankPercent(stock, list) >= 65 && stock.price >= stock.openPrice) return "資金轉入";
  if (volumeRankPercent(stock, list) >= 60) return "量增觀察";
  return "資金普通";
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

function falseBreakCount(history?: SignalHistory) {
  if (!history) return 0;

  const recent = [
    ...(history.invalidBreakoutRaw || []).slice(-5),
    ...(history.avoidRaw || []).slice(-5),
    ...(history.noiseRaw || []).slice(-5),
  ];

  return recent.filter(Boolean).length;
}

function signalProgress(history: SignalHistory | undefined, settings: Settings) {
  const count = stableCount(history?.entryRaw);
  return `${Math.min(count, settings.confirmTimes)}/${settings.confirmTimes}`;
}

function signalQuality(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const highQuality = lastNAllTrue(history?.highQualityRaw, settings.confirmTimes);
  const noise = lastNAllTrue(history?.noiseRaw, settings.breakConfirmTimes) || falseBreakCount(history) >= 3;
  const entryOk = lastNAllTrue(history?.entryRaw, settings.confirmTimes);

  if (highQuality && entryOk) return "高品質";
  if (noise) return "雜訊多";
  if (rawEntryScore(stock, list, mainIndustries, settings) >= 60) return "普通";
  return "偏弱";
}

function stableEntryState(stock: Stock, history: SignalHistory | undefined, settings: Settings) {
  const entryOk = lastNAllTrue(history?.entryRaw, settings.confirmTimes);
  const chaseOk = isHot(stock, settings);
  const avoidOk = lastNAllTrue(history?.avoidRaw, settings.breakConfirmTimes);
  const validBreakout = lastNAllTrue(history?.validBreakoutRaw, settings.confirmTimes);
  const invalidBreakout = lastNAllTrue(history?.invalidBreakoutRaw, settings.breakConfirmTimes);
  const hadEntryRecently = lastNAnyTrue(history?.entryRaw, 5);
  const cooldown = (history?.cooldownLeft || 0) > 0;
  const hold = (history?.holdLeft || 0) > 0;

  if (invalidBreakout) return "無效突破";
  if (chaseOk) return "禁止追高";
  if (avoidOk) return "不適合進場";
  if (cooldown) return "冷卻中";
  if (entryOk && validBreakout) return "可進場觀察";
  if (hold) return "訊號保留";
  if (hadEntryRecently) return "進場確認中";

  return "等待確認";
}

function stableDecision(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const state = stableEntryState(stock, history, settings);

  if (state === "可進場觀察") return "可進場";
  if (state === "訊號保留") return "保留觀察";
  if (state === "進場確認中") return "確認中";
  if (state === "無效突破") return "無效突破";
  if (state === "禁止追高") return "禁止追高";
  if (state === "冷卻中") return "冷卻中";
  if (state === "不適合進場") return "移除";

  return "等待確認";
}

function decisionTone(label: string) {
  if (label === "可進場" || label === "保留觀察" || label === "主力主攻" || label === "資金轉入") return "text-emerald-300";
  if (label === "確認中" || label === "等待確認" || label === "冷卻中" || label === "量增觀察") return "text-yellow-300";
  if (label === "禁止追高" || label === "無效突破" || label === "爆量不漲" || label === "低量假強") return "text-orange-300";
  if (label === "量增價弱" || label === "資金退潮") return "text-red-300";
  return "text-slate-300";
}

function continuationTone(label: string) {
  if (label === "開盤強續航" || label === "續航中") return "text-emerald-300";
  if (label === "低調續航") return "text-blue-300";
  if (label === "假強警報" || label === "無效突破") return "text-orange-300";
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

function moneySentence(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  const quality = rawMoneyQuality(stock, list, mainIndustries, settings);

  if (quality === "主力主攻") return "這檔成交金額排名前段，股價站上開盤且量價同步，屬於主力主攻股。";
  if (quality === "資金轉入") return "成交金額進入前段，股價也站上開盤，資金有轉入跡象。";
  if (quality === "爆量不漲") return "成交量與成交金額偏大，但股價沒有有效上攻，可能是換手或出貨。";
  if (quality === "量增價弱") return "量增加但股價跌回開盤下，資金退潮風險升高。";
  if (quality === "低量假強") return "漲幅看起來強，但量能排名偏低，小心低量假強。";
  if (quality === "量增觀察") return "量能有放大，但還沒形成明確主攻，先觀察是否量價同步。";

  return "目前資金沒有特別集中，先看產業主流與量價是否轉強。";
}

function getIndustryMoneyRanking(
  stocks: Stock[],
  mainIndustries: string[],
  settings: Settings,
  signalMap: Record<string, SignalHistory>,
  industryHistoryMap: Record<string, IndustryHistory>
): IndustryMoneyItem[] {
  const totalVolume = stocks.reduce((sum, stock) => sum + Math.max(0, stock.volume), 0);
  const totalAmount = stocks.reduce((sum, stock) => sum + estimatedAmount(stock), 0);
  const map = new Map<string, IndustryMoneyItem>();

  stocks.forEach((stock) => {
    const history = signalMap[stock.code];
    const moneyQuality = rawMoneyQuality(stock, stocks, mainIndustries, settings);
    const quality = signalQuality(stock, history, stocks, mainIndustries, settings);
    const decision = stableDecision(stock, history, stocks, mainIndustries, settings);

    const item =
      map.get(stock.industry) ??
      {
        industry: stock.industry,
        count: 0,
        totalVolume: 0,
        totalAmount: 0,
        avgChange: 0,
        volumeShare: 0,
        amountShare: 0,
        moneyScore: 0,
        concentration: 0,
        attackCount: 0,
        highQualityCount: 0,
        entryCount: 0,
        volumeNoRiseCount: 0,
        lowVolumeFakeCount: 0,
        moneyOutCount: 0,
        noiseCount: 0,
        stability: 0,
        status: "觀察中",
        stocks: [],
      };

    item.count += 1;
    item.totalVolume += Math.max(0, stock.volume);
    item.totalAmount += estimatedAmount(stock);
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);

    if (moneyQuality === "主力主攻") item.attackCount += 1;
    if (moneyQuality === "爆量不漲") item.volumeNoRiseCount += 1;
    if (moneyQuality === "低量假強") item.lowVolumeFakeCount += 1;
    if (moneyQuality === "量增價弱") item.moneyOutCount += 1;
    if (quality === "高品質") item.highQualityCount += 1;
    if (quality === "雜訊多") item.noiseCount += 1;
    if (decision === "可進場" || decision === "保留觀察") item.entryCount += 1;

    map.set(stock.industry, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avgChange = item.avgChange / Math.max(item.count, 1);
      const volumeShare = totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0;
      const amountShare = totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0;

      const industryHistory = industryHistoryMap[item.industry];
      const stability = industryHistory?.moneyRankRaw?.length
        ? (industryHistory.moneyRankRaw.filter(Boolean).length / industryHistory.moneyRankRaw.length) * 100
        : 0;

      const concentration = Math.min(100, amountShare * 2.2 + volumeShare * 1.5 + item.attackCount * 8 + item.highQualityCount * 10);

      const moneyScore =
        amountShare * 2.6 +
        volumeShare * 1.8 +
        Math.max(0, avgChange) * 4 +
        item.attackCount * 15 +
        item.highQualityCount * 12 +
        item.entryCount * 8 +
        stability * 0.35 -
        item.noiseCount * 10 -
        item.volumeNoRiseCount * 8 -
        item.moneyOutCount * 12 -
        item.lowVolumeFakeCount * 10;

      let status = "觀察中";

      if (item.moneyOutCount >= Math.max(1, item.count * 0.25)) status = "資金退潮";
      else if (item.volumeNoRiseCount >= Math.max(1, item.count * 0.25)) status = "爆量換手";
      else if (item.attackCount >= Math.max(1, item.count * 0.18) && item.highQualityCount >= 1) status = "主力主攻";
      else if (amountShare >= 18 && avgChange > 2) status = "資金集中";
      else if (stability >= 60) status = "穩定主流";
      else if (amountShare >= 10 || volumeShare >= 10) status = "資金轉入";
      else if (item.lowVolumeFakeCount >= Math.max(1, item.count * 0.25)) status = "低量假強";

      return {
        ...item,
        avgChange,
        volumeShare,
        amountShare,
        moneyScore,
        concentration,
        stability,
        status,
      };
    })
    .sort((a, b) => b.moneyScore - a.moneyScore);
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

function IndustryMoneyCard({ item, rank }: { item: IndustryMoneyItem; rank: number }) {
  const tone =
    item.status === "主力主攻" || item.status === "資金集中" || item.status === "穩定主流"
      ? "text-emerald-300"
      : item.status === "資金轉入"
        ? "text-cyan-300"
        : item.status === "爆量換手" || item.status === "低量假強"
          ? "text-orange-300"
          : item.status === "資金退潮"
            ? "text-red-300"
            : "text-slate-300";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 資金流向產業</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${tone}`}>{item.status}</div>
        </div>

        <div className="text-right">
          <div className="text-xl font-black text-yellow-300">{formatAmount(item.totalAmount)}</div>
          <div className="text-sm font-black text-emerald-300">占比 {item.amountShare.toFixed(1)}%</div>
          <div className="text-xs font-black text-slate-400">量占 {item.volumeShare.toFixed(1)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">
          主攻
          <br />
          {item.attackCount}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
          集中度
          <br />
          {item.concentration.toFixed(0)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-orange-300">
          退潮
          <br />
          {item.moneyOutCount}
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
  const cont = rawContinuation(stock, top50, mainIndustries, settings);
  const score = rawEntryScore(stock, top50, mainIndustries, settings);
  const quality = signalQuality(stock, history, top50, mainIndustries, settings);
  const moneyQuality = rawMoneyQuality(stock, top50, mainIndustries, settings);
  const direction = priceDirections[stock.code];
  const prevPrice = previousPriceMap[stock.code];
  const diff = prevPrice ? stock.price - prevPrice : 0;
  const diffPct = prevPrice ? ((stock.price - prevPrice) / prevPrice) * 100 : 0;
  const isFavorite = favoriteCodes.includes(stock.code);
  const isTomorrow = tomorrowCodes.includes(stock.code);
  const mainIndex = mainIndustries.indexOf(stock.industry);
  const count = stableCount(history?.entryRaw);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <button onClick={() => onOpen(stock.code)} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-500">#{rank}　{stock.code}</div>
            <div className="mt-1 text-lg font-black text-white">{stock.name}</div>
            <div className="mt-1 text-xs font-bold text-slate-400">
              {stock.industry}
              {mainIndex >= 0 ? `｜資金主流${mainIndex + 1}` : ""}
            </div>
          </div>

          <div className="text-right">
            <div className={`text-xl font-black ${stock.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
              {formatPercent(stock.changePercent)}
            </div>
            <div className="mt-1 text-sm font-black text-white">{formatNumber(stock.price)}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-black">
          <div className="rounded-2xl bg-black/30 p-2 text-yellow-300">
            估算成交金額
            <br />
            {formatAmount(estimatedAmount(stock))}
          </div>
          <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
            資金/量能排名
            <br />#{amountRankIndex(stock, top50)} / #{volumeRankIndex(stock, top50)}
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-black/30 p-2">
          <div className="flex items-center justify-between text-xs font-black text-slate-300">
            <span>確認進度</span>
            <span>{signalProgress(history, settings)}</span>
          </div>
          <div className="mt-1 text-lg tracking-widest text-emerald-300">
            {progressBar(count, settings.confirmTimes)}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(moneyQuality)}`}>{moneyQuality}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(decision)}`}>{decision}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${continuationTone(cont)}`}>{cont}</span>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-200">分數 {score}</span>
          <span className="rounded-full bg-blue-950 px-3 py-1 text-blue-200">品質 {quality}</span>
          <span className="rounded-full bg-cyan-950 px-3 py-1 text-cyan-200">開盤後 {formatPercent(afterOpenPercent(stock))}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{priceVolumeState(stock, top50, settings)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {moneySentence(stock, history, top50, mainIndustries, settings)}
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
  const [sortKey, setSortKey] = useState("money");
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
    const map = new Map<string, { industry: string; count: number; amount: number; volume: number; score: number }>();

    top50.forEach((stock) => {
      const item = map.get(stock.industry) || { industry: stock.industry, count: 0, amount: 0, volume: 0, score: 0 };
      item.count += 1;
      item.amount += estimatedAmount(stock);
      item.volume += Math.max(0, stock.volume);
      item.score += stock.changePercent + Math.max(0, openingPremium(stock)) + estimatedAmount(stock) / 10000000;
      map.set(stock.industry, item);
    });

    return Array.from(map.values()).sort((a, b) => b.amount + b.volume * 10 + b.score * 1000000 - (a.amount + a.volume * 10 + a.score * 1000000));
  }, [top50]);

  const floatingIndustries = useMemo(() => rawIndustryRanking.slice(0, 3).map((item) => item.industry), [rawIndustryRanking]);

  const mainIndustries = useMemo(() => {
    if (settings.stableIndustryLock && lockedIndustries.length > 0) return lockedIndustries;
    return floatingIndustries;
  }, [floatingIndustries, lockedIndustries, settings.stableIndustryLock]);

  const industryMoneyRanking = useMemo(
    () => getIndustryMoneyRanking(top50, mainIndustries, settings, signalMap, industryHistoryMap),
    [top50, mainIndustries, settings, signalMap, industryHistoryMap]
  );

  const highQualityList = useMemo(
    () =>
      top50
        .filter((stock) => signalQuality(stock, signalMap[stock.code], top50, mainIndustries, settings) === "高品質")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const entryReadyList = useMemo(
    () =>
      top50
        .filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "可進場")
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const confirmingList = useMemo(
    () =>
      top50
        .filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "確認中")
        .sort((a, b) => stableCount(signalMap[b.code]?.entryRaw) - stableCount(signalMap[a.code]?.entryRaw)),
    [top50, signalMap, mainIndustries, settings]
  );

  const moneyAmountList = useMemo(
    () =>
      [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50]
  );

  const volumeAttackList = useMemo(
    () =>
      top50
        .filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "主力主攻")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings]
  );

  const volumeNoRiseList = useMemo(
    () =>
      top50
        .filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "爆量不漲")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings]
  );

  const lowVolumeFakeList = useMemo(
    () =>
      top50
        .filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "低量假強")
        .sort((a, b) => b.changePercent - a.changePercent),
    [top50, mainIndustries, settings]
  );

  const moneyOutList = useMemo(
    () =>
      top50
        .filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "量增價弱")
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, mainIndustries, settings]
  );

  const noiseList = useMemo(
    () =>
      top50
        .filter((stock) => signalQuality(stock, signalMap[stock.code], top50, mainIndustries, settings) === "雜訊多")
        .sort((a, b) => falseBreakCount(signalMap[b.code]) - falseBreakCount(signalMap[a.code])),
    [top50, signalMap, mainIndustries, settings]
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

    [...volumeAttackList, ...highQualityList, ...entryReadyList].slice(0, 20).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [tomorrowCodes, stocks, volumeAttackList, highQualityList, entryReadyList]);

  const selectedStock = useMemo(() => stocks.find((s) => s.code === selectedCode) || null, [stocks, selectedCode]);

  const totalEstimatedAmount = useMemo(() => top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0), [top50]);

  const marketStructure = useMemo(() => {
    if (moneyOutList.length >= 8) return "資金退潮偏多";
    if (volumeNoRiseList.length >= 8) return "爆量換手偏多";
    if (lowVolumeFakeList.length >= 8) return "低量假強偏多";
    if (volumeAttackList.length >= 5) return "主力主攻明確";
    if (industryMoneyRanking[0]?.amountShare >= 20) return "資金集中產業";
    if (confirmingList.length >= 8) return "資金確認中";
    return "等待資金集中";
  }, [moneyOutList, volumeNoRiseList, lowVolumeFakeList, volumeAttackList, industryMoneyRanking, confirmingList]);

  const topMoneyIndustry = industryMoneyRanking[0];

  const homeSentence = useMemo(() => {
    if (!topMoneyIndustry) return "目前資金方向尚未形成，先等資料。";

    if (topMoneyIndustry.status === "主力主攻") return `今日資金主要集中在 ${topMoneyIndustry.industry}，成交金額與高品質訊號同步放大。`;
    if (topMoneyIndustry.status === "資金集中") return `${topMoneyIndustry.industry} 成交金額占比最高，是目前主要資金集中方向。`;
    if (topMoneyIndustry.status === "資金轉入") return `${topMoneyIndustry.industry} 有資金轉入跡象，先看是否延續量價同步。`;
    if (topMoneyIndustry.status === "爆量換手") return `${topMoneyIndustry.industry} 成交量大但攻擊不足，可能換手，先保守。`;
    if (topMoneyIndustry.status === "資金退潮") return `${topMoneyIndustry.industry} 量增價弱，資金退潮風險升高。`;
    if (topMoneyIndustry.status === "低量假強") return `${topMoneyIndustry.industry} 漲幅看似強，但低量假強偏多，小心追高。`;

    return `目前資金最集中在 ${topMoneyIndustry.industry}，但還需要觀察量價是否同步。`;
  }, [topMoneyIndustry]);

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
    const topByAmount = [...list]
      .slice(0, 50)
      .reduce((map, stock) => {
        const item = map.get(stock.industry) || { industry: stock.industry, amount: 0, volume: 0 };
        item.amount += estimatedAmount(stock);
        item.volume += stock.volume;
        map.set(stock.industry, item);
        return map;
      }, new Map<string, { industry: string; amount: number; volume: number }>());

    const ranked = Array.from(topByAmount.values())
      .sort((a, b) => b.amount + b.volume * 10 - (a.amount + a.volume * 10))
      .slice(0, 3)
      .map((item) => item.industry);

    setIndustryHistoryMap((old) => {
      const next = { ...old };

      Array.from(new Set([...Object.keys(next), ...ranked])).forEach((industry) => {
        const oldItem = next[industry] || {
          industry,
          topRaw: [],
          moneyRankRaw: [],
        };

        next[industry] = {
          ...oldItem,
          topRaw: [...oldItem.topRaw, ranked.includes(industry)].slice(-8),
          moneyRankRaw: [...oldItem.moneyRankRaw, ranked.includes(industry)].slice(-8),
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

      list.slice(0, 80).forEach((stock) => {
        const prevPrice = oldPrices[stock.code];
        const oldItem: SignalHistory =
          next[stock.code] || {
            code: stock.code,
            prices: [],
            entryRaw: [],
            avoidRaw: [],
            highQualityRaw: [],
            noiseRaw: [],
            moneyAttackRaw: [],
            volumeNoRiseRaw: [],
            lowVolumeFakeRaw: [],
            moneyOutRaw: [],
            validBreakoutRaw: [],
            invalidBreakoutRaw: [],
            holdLeft: 0,
            cooldownLeft: 0,
          };

        const meaningful = isMeaningfulMove(stock, prevPrice, settings);
        const topList = list.slice(0, 50);

        const entryOk = meaningful && rawEntryOk(stock, topList, activeMain, settings);
        const avoidOk = rawAvoid(stock, topList, activeMain, settings);
        const validBreakoutOk = rawValidBreakout(stock, topList, settings);
        const invalidBreakoutOk = rawInvalidBreakout(stock, topList, settings);
        const moneyAttackOk = rawMoneyAttack(stock, topList, activeMain, settings);
        const volumeNoRiseOk = rawVolumeNoRise(stock, topList);
        const lowVolumeFakeOk = rawLowVolumeFake(stock, topList, settings);
        const moneyOutOk = rawMoneyOut(stock, topList);

        const highQualityOk =
          entryOk &&
          moneyAttackOk &&
          activeMain.includes(stock.industry) &&
          priceVolumeState(stock, topList, settings) === "量價同步" &&
          !isHot(stock, settings) &&
          !avoidOk;

        const noiseOk =
          !meaningful ||
          invalidBreakoutOk ||
          lowVolumeFakeOk ||
          falseBreakCount(oldItem) >= 3;

        let holdLeft = Math.max(0, (oldItem.holdLeft || 0) - 1);
        let cooldownLeft = Math.max(0, (oldItem.cooldownLeft || 0) - 1);

        const wasEntry = lastNAllTrue(oldItem.entryRaw, settings.confirmTimes);
        const nowBreak = avoidOk || moneyOutOk;

        if (entryOk || moneyAttackOk) holdLeft = settings.signalHoldTicks;
        if (wasEntry && nowBreak) cooldownLeft = settings.cooldownTicks;

        const updated: SignalHistory = {
          ...oldItem,
          prices: [...oldItem.prices, stock.price].slice(-8),
          entryRaw: [...oldItem.entryRaw, entryOk].slice(-8),
          avoidRaw: [...oldItem.avoidRaw, avoidOk].slice(-8),
          highQualityRaw: [...oldItem.highQualityRaw, highQualityOk].slice(-8),
          noiseRaw: [...oldItem.noiseRaw, noiseOk].slice(-8),
          moneyAttackRaw: [...oldItem.moneyAttackRaw, moneyAttackOk].slice(-8),
          volumeNoRiseRaw: [...oldItem.volumeNoRiseRaw, volumeNoRiseOk].slice(-8),
          lowVolumeFakeRaw: [...oldItem.lowVolumeFakeRaw, lowVolumeFakeOk].slice(-8),
          moneyOutRaw: [...oldItem.moneyOutRaw, moneyOutOk].slice(-8),
          validBreakoutRaw: [...oldItem.validBreakoutRaw, validBreakoutOk].slice(-8),
          invalidBreakoutRaw: [...oldItem.invalidBreakoutRaw, invalidBreakoutOk].slice(-8),
          holdLeft,
          cooldownLeft,
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

  function filterList(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topFilter === "主力主攻") arr = arr.filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "主力主攻");
      if (settings.topFilter === "成交金額") arr = arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
      if (settings.topFilter === "爆量不漲") arr = arr.filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "爆量不漲");
      if (settings.topFilter === "量增價弱") arr = arr.filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "量增價弱");
      if (settings.topFilter === "低量假強") arr = arr.filter((stock) => rawMoneyQuality(stock, top50, mainIndustries, settings) === "低量假強");
      if (settings.topFilter === "高品質") arr = arr.filter((stock) => signalQuality(stock, signalMap[stock.code], top50, mainIndustries, settings) === "高品質");
      if (settings.topFilter === "可進場") arr = arr.filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "可進場");
      if (settings.topFilter === "確認中") arr = arr.filter((stock) => stableDecision(stock, signalMap[stock.code], top50, mainIndustries, settings) === "確認中");
      if (settings.topFilter === "雜訊多") arr = arr.filter((stock) => signalQuality(stock, signalMap[stock.code], top50, mainIndustries, settings) === "雜訊多");
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

    if (sortKey === "money") return arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
    if (sortKey === "volume") return arr.sort((a, b) => b.volume - a.volume);
    if (sortKey === "entry") return arr.sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings));
    if (sortKey === "quality") {
      return arr.sort((a, b) => {
        const qa = signalQuality(a, signalMap[a.code], top50, mainIndustries, settings) === "高品質" ? 100 : 0;
        const qb = signalQuality(b, signalMap[b.code], top50, mainIndustries, settings) === "高品質" ? 100 : 0;
        return qb - qa;
      });
    }
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = industryMoneyRanking.findIndex((item) => item.industry === a.industry);
        const ib = industryMoneyRanking.findIndex((item) => item.industry === b.industry);
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
      if (moreView === "moneyAmount") return sortList(moneyAmountList);
      if (moreView === "volumeAttack") return sortList(volumeAttackList);
      if (moreView === "volumeNoRise") return sortList(volumeNoRiseList);
      if (moreView === "lowVolumeFake") return sortList(lowVolumeFakeList);
      if (moreView === "moneyOut") return sortList(moneyOutList);
      if (moreView === "highQuality") return sortList(highQualityList);
      if (moreView === "entryReady") return sortList(entryReadyList);
      if (moreView === "confirming") return sortList(confirmingList);
      if (moreView === "noise") return sortList(noiseList);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    moneyAmountList,
    volumeAttackList,
    volumeNoRiseList,
    lowVolumeFakeList,
    moneyOutList,
    highQualityList,
    entryReadyList,
    confirmingList,
    noiseList,
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
    const moneyQuality = rawMoneyQuality(selectedStock, top50, mainIndustries, settings);
    const decision = stableDecision(selectedStock, history, top50, mainIndustries, settings);
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

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(moneyQuality)}`}>
              <div className="text-xs font-bold text-slate-400">個股資金品質</div>
              <div className="mt-1 text-3xl font-black">{moneyQuality}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {moneySentence(selectedStock, history, top50, mainIndustries, settings)}
              </div>
            </div>

            <section className="mt-4 rounded-2xl bg-yellow-950/30 p-4">
              <div className="text-lg font-black text-yellow-100">資金與量能排名</div>
              <div className="mt-2 text-sm font-bold text-yellow-100">
                估算成交金額：{formatAmount(estimatedAmount(selectedStock))}
                <br />
                成交金額排名：#{amountRankIndex(selectedStock, top50)}
                <br />
                成交量排名：#{volumeRankIndex(selectedStock, top50)}
                <br />
                成交金額強度：{amountRankPercent(selectedStock, top50)}
                <br />
                成交量強度：{volumeRankPercent(selectedStock, top50)}
              </div>
            </section>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(decision)}`}>
              <div className="text-xs font-bold text-slate-400">降噪後進場結論</div>
              <div className="mt-1 text-2xl font-black">{decision}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                進場確認：{signalProgress(history, settings)}
                <br />
                訊號品質：{signalQuality(selectedStock, history, top50, mainIndustries, settings)}
              </div>
            </div>

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${continuationTone(cont)}`}>
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
                開盤後：{formatPercent(afterOpenPercent(selectedStock))}
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
              <div className="text-sm font-bold text-slate-400">台股資金量能主流追蹤版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">資金量能雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                先看資金流去哪個產業，再看產業裡哪幾檔是主力主攻。
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
              資金統計
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">今日資金主流</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {industryMoneyRanking.length
              ? industryMoneyRanking.slice(0, 3).map((item, i) => `${i + 1}.${item.industry}`).join("　")
              : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{homeSentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="盤中型態" value={marketStructure} />
            <DetailRow label="最強產業" value={topMoneyIndustry?.industry || "--"} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="主力主攻" value={volumeAttackList.length} sub="成交金額+量價同步" tone="text-emerald-300" onClick={() => goMore("volumeAttack")} />
          <MiniCard title="成交金額排行" value={moneyAmountList.length} sub="個股資金排名" tone="text-yellow-300" onClick={() => goMore("moneyAmount")} />
          <MiniCard title="爆量不漲" value={volumeNoRiseList.length} sub="可能換手/出貨" tone="text-orange-300" onClick={() => goMore("volumeNoRise")} />
          <MiniCard title="量增價弱" value={moneyOutList.length} sub="資金退潮警報" tone="text-red-300" onClick={() => goMore("moneyOut")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="產業資金流向" sub="成交金額占比" badge={industryMoneyRanking.length} tone="text-yellow-300" onClick={() => goMore("industryMoney")} />
          <ActionCard title="低量假強" sub="漲但量不足" badge={lowVolumeFakeList.length} tone="text-orange-300" onClick={() => goMore("lowVolumeFake")} />
          <ActionCard title="高品質進場" sub="主流+資金+確認" badge={highQualityList.length} tone="text-emerald-300" onClick={() => goMore("highQuality")} />
          <ActionCard title="確認中" sub="資金還在確認" badge={confirmingList.length} tone="text-yellow-300" onClick={() => goMore("confirming")} />
          <ActionCard title="雜訊太多" sub="方向反覆" badge={noiseList.length} tone="text-orange-300" onClick={() => goMore("noise")} />
          <ActionCard title="50強" sub="資金篩選" badge={top50.length} tone="text-red-300" onClick={() => setTab("top50")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">這版主要看資金、交易量、成交金額。</p>
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
                  ["money", "金額"],
                  ["volume", "成交量"],
                  ["entry", "進場"],
                  ["quality", "品質"],
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
                  {["全部", "主力主攻", "成交金額", "爆量不漲", "量增價弱", "低量假強", "高品質", "可進場", "確認中", "雜訊多", "主流產業"].map((filter) => (
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
            <h2 className="text-xl font-black">資金雷達</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="資金主流產業" sub="產業資金流向" badge={industryMoneyRanking.length} tone="text-yellow-300" onClick={() => setMoreView("industryMoney")} />
              <ActionCard title="成交金額排行" sub="個股資金排行" badge={moneyAmountList.length} tone="text-yellow-300" onClick={() => setMoreView("moneyAmount")} />
              <ActionCard title="量價同步主攻" sub="主力主攻股" badge={volumeAttackList.length} tone="text-emerald-300" onClick={() => setMoreView("volumeAttack")} />
              <ActionCard title="爆量不漲" sub="換手/出貨疑慮" badge={volumeNoRiseList.length} tone="text-orange-300" onClick={() => setMoreView("volumeNoRise")} />
              <ActionCard title="資金退潮" sub="量增價弱" badge={moneyOutList.length} tone="text-red-300" onClick={() => setMoreView("moneyOut")} />
              <ActionCard title="低量假強" sub="漲但沒量" badge={lowVolumeFakeList.length} tone="text-orange-300" onClick={() => setMoreView("lowVolumeFake")} />
              <ActionCard title="高品質訊號" sub="主流+確認" badge={highQualityList.length} tone="text-emerald-300" onClick={() => setMoreView("highQuality")} />
              <ActionCard title="設定" sub="降噪 / 主流鎖定" badge="⚙️" tone="text-purple-300" onClick={() => setMoreView("settings")} />
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
              {tab === "more" && moreView === "industryMoney" && "🏭 產業資金流向"}
              {tab === "more" && moreView === "moneyAmount" && "💰 成交金額排行"}
              {tab === "more" && moreView === "volumeAttack" && "🟢 量價同步主攻"}
              {tab === "more" && moreView === "volumeNoRise" && "🟠 爆量不漲"}
              {tab === "more" && moreView === "lowVolumeFake" && "🟠 低量假強"}
              {tab === "more" && moreView === "moneyOut" && "🔴 資金退潮"}
              {tab === "more" && moreView === "highQuality" && "🟢 高品質訊號"}
              {tab === "more" && moreView === "entryReady" && "🟢 可進場"}
              {tab === "more" && moreView === "confirming" && "🟡 確認中"}
              {tab === "more" && moreView === "noise" && "🟠 雜訊太多"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 資金統計"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              資金主流：{industryMoneyRanking.slice(0, 3).map((item) => item.industry).join("、") || "--"}｜型態：{marketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">產業資金流向排行</h3>
                <div className="mt-3 space-y-3">
                  {industryMoneyRanking.slice(0, 3).map((item, index) => (
                    <IndustryMoneyCard key={item.industry} item={item} rank={index + 1} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">主力交易量個股排行 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {volumeAttackList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明確主力主攻股。
                    </div>
                  )}
                  {volumeAttackList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">成交金額排行 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {moneyAmountList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...cardProps} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-orange-500/40 bg-orange-950/20 p-5">
                <h3 className="text-xl font-black">爆量不漲 / 低量假強警報</h3>
                <div className="mt-3 space-y-3">
                  {[...volumeNoRiseList, ...lowVolumeFakeList].slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯警報。
                    </div>
                  )}
                  {[...volumeNoRiseList, ...lowVolumeFakeList].slice(0, 5).map((stock, index) => (
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

          {tab === "more" && moreView === "industryMoney" && (
            <div className="space-y-3">
              {industryMoneyRanking.map((item, index) => (
                <IndustryMoneyCard key={item.industry} item={item} rank={index + 1} />
              ))}
            </div>
          )}

          {tab === "more" && moreView === "settings" && (
            <div className="space-y-4 rounded-3xl border border-purple-500/50 bg-purple-950/20 p-5">
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
                重置所有資金確認紀錄
              </button>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">資金統計</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>50強總成交金額估算：{formatAmount(totalEstimatedAmount)}</div>
                <div>資金前三產業：{industryMoneyRanking.slice(0, 3).map((item) => item.industry).join("、") || "--"}</div>
                <div>第一產業金額占比：{industryMoneyRanking[0]?.amountShare.toFixed(1) || "--"}%</div>
                <div>第一產業量能占比：{industryMoneyRanking[0]?.volumeShare.toFixed(1) || "--"}%</div>
                <div>主力主攻股數：{volumeAttackList.length}</div>
                <div>高品質訊號數：{highQualityList.length}</div>
                <div>量價同步主攻股數：{volumeAttackList.length}</div>
                <div>爆量不漲股數：{volumeNoRiseList.length}</div>
                <div>低量假強股數：{lowVolumeFakeList.length}</div>
                <div>資金退潮股數：{moneyOutList.length}</div>
                <div>雜訊股數：{noiseList.length}</div>
                <div>盤中型態：{marketStructure}</div>
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

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["settings", "data", "industryMoney", "menu"].includes(moreView)) && (
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
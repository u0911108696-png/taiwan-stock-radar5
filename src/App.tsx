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
  | "industryContinuation"
  | "industryNewMoney"
  | "industryDivergence"
  | "industryOut"
  | "attackContinuation"
  | "attackNew"
  | "attackFailed"
  | "moneyAmount"
  | "volumeNoRise"
  | "lowVolumeFake"
  | "highQuality"
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
  highQualityRaw: boolean[];
  noiseRaw: boolean[];
  moneyAttackRaw: boolean[];
  volumeNoRiseRaw: boolean[];
  lowVolumeFakeRaw: boolean[];
  moneyOutRaw: boolean[];
  validBreakoutRaw: boolean[];
  invalidBreakoutRaw: boolean[];
  changedAt?: string;
};

type IndustryHistory = {
  industry: string;
  topMoneyRaw: boolean[];
  continuationRaw: boolean[];
  outRaw: boolean[];
};

type IndustryFlowItem = {
  industry: string;
  count: number;
  totalVolume: number;
  totalAmount: number;
  avgChange: number;
  volumeShare: number;
  amountShare: number;
  continuationScore: number;
  retentionRate: number;
  attackCount: number;
  attackContinuationCount: number;
  highQualityCount: number;
  volumeNoRiseCount: number;
  lowVolumeFakeCount: number;
  moneyOutCount: number;
  noiseCount: number;
  status: "資金續航中" | "資金剛轉入" | "資金分歧" | "資金退潮" | "短線過熱" | "觀察中";
  light: "綠燈" | "黃燈" | "紅燈" | "灰燈";
  stocks: Stock[];
};

const API_URL = "/api/stocks";

const FAVORITE_KEY = "taiwan-stock-radar-favorites";
const TOMORROW_KEY = "taiwan-stock-radar-tomorrow";
const SETTINGS_KEY = "taiwan-stock-radar-flow-continuation-settings";
const LAST_SUCCESS_KEY = "taiwan-stock-radar-flow-continuation-cache";
const SIGNAL_KEY = "taiwan-stock-radar-flow-continuation-signals";
const INDUSTRY_SIGNAL_KEY = "taiwan-stock-radar-flow-continuation-industry-signals";
const LOCKED_INDUSTRY_KEY = "taiwan-stock-radar-flow-continuation-locked-industries";

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

function amountRankPercent(stock: Stock, list: Stock[]) {
  const rank = amountRankIndex(stock, list);
  if (rank >= 999 || list.length <= 1) return 0;
  return Math.round(((list.length - rank + 1) / list.length) * 100);
}

function volumeRankPercent(stock: Stock, list: Stock[]) {
  const rank = volumeRankIndex(stock, list);
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

function rawEntryOk(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  return (
    rawEntryScore(stock, list, mainIndustries, settings) >= 72 &&
    mainIndustries.includes(stock.industry) &&
    rawValidBreakout(stock, list, settings) &&
    rawMoneyAttack(stock, list, mainIndustries, settings) &&
    !isHot(stock, settings) &&
    !isWeak(stock)
  );
}

function rawHighQuality(stock: Stock, list: Stock[], mainIndustries: string[], settings: Settings) {
  return (
    rawEntryOk(stock, list, mainIndustries, settings) &&
    rawMoneyAttack(stock, list, mainIndustries, settings) &&
    priceVolumeState(stock, list, settings) === "量價同步" &&
    !rawVolumeNoRise(stock, list) &&
    !rawMoneyOut(stock, list) &&
    !rawLowVolumeFake(stock, list, settings)
  );
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

function attackState(stock: Stock, history: SignalHistory | undefined, settings: Settings) {
  const attackOk = lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes);
  const attackRecently = lastNAnyTrue(history?.moneyAttackRaw, 5);
  const failed = lastNAllTrue(history?.volumeNoRiseRaw, settings.breakConfirmTimes) || lastNAllTrue(history?.moneyOutRaw, settings.breakConfirmTimes);

  if (attackOk) return "主攻續航中";
  if (failed && attackRecently) return "主攻失效";
  if (attackRecently) return "主攻剛轉強";
  if (rawVolumeNoRise(stock, [] as Stock[])) return "爆量不漲";
  return "等待主攻";
}

function stableDecision(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  if (lastNAllTrue(history?.moneyOutRaw, settings.breakConfirmTimes)) return "資金退潮";
  if (lastNAllTrue(history?.volumeNoRiseRaw, settings.breakConfirmTimes)) return "爆量不漲";
  if (lastNAllTrue(history?.lowVolumeFakeRaw, settings.breakConfirmTimes)) return "低量假強";
  if (lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes)) return "主攻續航";
  if (lastNAllTrue(history?.entryRaw, settings.confirmTimes)) return "可進場";
  if (lastNAnyTrue(history?.moneyAttackRaw, 5)) return "主攻剛轉強";
  if (lastNAnyTrue(history?.entryRaw, 5)) return "確認中";
  if (rawMoneyAttack(stock, list, mainIndustries, settings)) return "資金轉入";
  return "等待確認";
}

function stockMoneyQuality(stock: Stock, history: SignalHistory | undefined, list: Stock[], mainIndustries: string[], settings: Settings) {
  if (lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes)) return "主攻續航中";
  if (lastNAllTrue(history?.volumeNoRiseRaw, settings.breakConfirmTimes)) return "爆量不漲";
  if (lastNAllTrue(history?.moneyOutRaw, settings.breakConfirmTimes)) return "量增價弱";
  if (lastNAllTrue(history?.lowVolumeFakeRaw, settings.breakConfirmTimes)) return "低量假強";
  if (lastNAnyTrue(history?.moneyAttackRaw, 5)) return "主攻剛轉強";
  if (rawMoneyAttack(stock, list, mainIndustries, settings)) return "資金轉入";
  if (volumeRankPercent(stock, list) >= 60) return "量增觀察";
  return "資金普通";
}

function decisionTone(label: string) {
  if (["主攻續航", "主攻續航中", "可進場", "資金轉入"].includes(label)) return "text-emerald-300";
  if (["主攻剛轉強", "確認中", "等待確認", "量增觀察", "資金普通"].includes(label)) return "text-yellow-300";
  if (["爆量不漲", "低量假強", "短線過熱"].includes(label)) return "text-orange-300";
  if (["量增價弱", "資金退潮", "主攻失效"].includes(label)) return "text-red-300";
  return "text-slate-300";
}

function flowTone(label: string) {
  if (label === "資金續航中" || label === "綠燈") return "text-emerald-300";
  if (label === "資金剛轉入" || label === "資金分歧" || label === "黃燈") return "text-yellow-300";
  if (label === "短線過熱") return "text-orange-300";
  if (label === "資金退潮" || label === "紅燈") return "text-red-300";
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

function stockMoneySentence(
  stock: Stock,
  history: SignalHistory | undefined,
  list: Stock[],
  mainIndustries: string[],
  settings: Settings,
  industryStatus: string
) {
  const q = stockMoneyQuality(stock, history, list, mainIndustries, settings);

  if (q === "主攻續航中" && industryStatus === "資金續航中") {
    return `這檔連續 ${settings.attackConfirmTimes} 次維持主力主攻，且所屬產業資金續航中，屬於今日資金核心股。`;
  }
  if (q === "主攻續航中") return "這檔連續維持主力主攻，屬於資金續航個股。";
  if (q === "主攻剛轉強") return "這檔剛出現主攻訊號，先觀察下一次更新是否延續。";
  if (q === "主攻失效") return "原本主攻轉弱，出現爆量不漲或量增價弱，小心換手。";
  if (q === "爆量不漲") return "成交量與成交金額偏大，但價格沒有有效上攻，可能換手或出貨。";
  if (q === "量增價弱") return "量增加但股價跌回開盤下，資金退潮風險升高。";
  if (q === "低量假強") return "漲幅看似強，但量能排名偏低，小心低量假強。";
  if (q === "資金轉入") return "資金有轉入跡象，但還需要連續確認。";
  return "目前還不是明確主攻股，先看產業續航與量價同步。";
}

function getIndustryFlowRanking(
  stocks: Stock[],
  mainIndustries: string[],
  settings: Settings,
  signalMap: Record<string, SignalHistory>,
  industryHistoryMap: Record<string, IndustryHistory>
): IndustryFlowItem[] {
  const totalVolume = stocks.reduce((sum, stock) => sum + Math.max(0, stock.volume), 0);
  const totalAmount = stocks.reduce((sum, stock) => sum + estimatedAmount(stock), 0);
  const map = new Map<string, IndustryFlowItem>();

  stocks.forEach((stock) => {
    const history = signalMap[stock.code];

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
        continuationScore: 0,
        retentionRate: 0,
        attackCount: 0,
        attackContinuationCount: 0,
        highQualityCount: 0,
        volumeNoRiseCount: 0,
        lowVolumeFakeCount: 0,
        moneyOutCount: 0,
        noiseCount: 0,
        status: "觀察中",
        light: "灰燈",
        stocks: [],
      };

    item.count += 1;
    item.totalVolume += Math.max(0, stock.volume);
    item.totalAmount += estimatedAmount(stock);
    item.avgChange += stock.changePercent;
    item.stocks.push(stock);

    if (rawMoneyAttack(stock, stocks, mainIndustries, settings)) item.attackCount += 1;
    if (lastNAllTrue(history?.moneyAttackRaw, settings.attackConfirmTimes)) item.attackContinuationCount += 1;
    if (lastNAllTrue(history?.highQualityRaw, settings.confirmTimes)) item.highQualityCount += 1;
    if (rawVolumeNoRise(stock, stocks)) item.volumeNoRiseCount += 1;
    if (rawLowVolumeFake(stock, stocks, settings)) item.lowVolumeFakeCount += 1;
    if (rawMoneyOut(stock, stocks)) item.moneyOutCount += 1;
    if (lastNAllTrue(history?.noiseRaw, settings.breakConfirmTimes)) item.noiseCount += 1;

    map.set(stock.industry, item);
  });

  return Array.from(map.values())
    .map((item) => {
      const avgChange = item.avgChange / Math.max(item.count, 1);
      const volumeShare = totalVolume > 0 ? (item.totalVolume / totalVolume) * 100 : 0;
      const amountShare = totalAmount > 0 ? (item.totalAmount / totalAmount) * 100 : 0;

      const h = industryHistoryMap[item.industry];
      const retentionRate = h?.continuationRaw?.length
        ? (h.continuationRaw.filter(Boolean).length / h.continuationRaw.length) * 100
        : 0;

      const hotRisk = avgChange >= 7 || amountShare >= 28;
      const divergence =
        item.attackCount > 0 &&
        item.volumeNoRiseCount + item.moneyOutCount + item.lowVolumeFakeCount >= Math.max(1, item.count * 0.25);

      const continuationScore =
        amountShare * 2.4 +
        volumeShare * 1.7 +
        Math.max(0, avgChange) * 4 +
        item.attackCount * 12 +
        item.attackContinuationCount * 18 +
        item.highQualityCount * 14 +
        retentionRate * 0.5 -
        item.volumeNoRiseCount * 9 -
        item.moneyOutCount * 14 -
        item.lowVolumeFakeCount * 10 -
        item.noiseCount * 8 -
        (hotRisk ? 12 : 0);

      let status: IndustryFlowItem["status"] = "觀察中";
      let light: IndustryFlowItem["light"] = "灰燈";

      if (item.moneyOutCount >= Math.max(1, item.count * 0.3)) {
        status = "資金退潮";
        light = "紅燈";
      } else if (hotRisk && item.volumeNoRiseCount + item.lowVolumeFakeCount >= 1) {
        status = "短線過熱";
        light = "紅燈";
      } else if (divergence) {
        status = "資金分歧";
        light = "黃燈";
      } else if (retentionRate >= 60 && item.attackContinuationCount >= 1 && item.highQualityCount >= 1) {
        status = "資金續航中";
        light = "綠燈";
      } else if (amountShare >= 10 || volumeShare >= 10 || item.attackCount >= 1) {
        status = "資金剛轉入";
        light = "黃燈";
      }

      return {
        ...item,
        avgChange,
        volumeShare,
        amountShare,
        continuationScore,
        retentionRate,
        status,
        light,
      };
    })
    .sort((a, b) => b.continuationScore - a.continuationScore);
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

function IndustryFlowCard({ item, rank }: { item: IndustryFlowItem; rank: number }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-slate-500">#{rank} 產業資金續航</div>
          <div className="mt-1 text-2xl font-black text-white">{item.industry}</div>
          <div className={`mt-1 text-sm font-black ${flowTone(item.status)}`}>
            {item.light}｜{item.status}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xl font-black text-yellow-300">{formatAmount(item.totalAmount)}</div>
          <div className="text-sm font-black text-emerald-300">留存 {item.retentionRate.toFixed(0)}%</div>
          <div className="text-xs font-black text-slate-400">金額占 {item.amountShare.toFixed(1)}%</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-2xl bg-black/30 p-2 text-emerald-300">
          主攻續航
          <br />
          {item.attackContinuationCount}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-cyan-300">
          分數
          <br />
          {item.continuationScore.toFixed(0)}
        </div>
        <div className="rounded-2xl bg-black/30 p-2 text-red-300">
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
  const decision = stableDecision(stock, history, top50, mainIndustries, settings);
  const moneyQuality = stockMoneyQuality(stock, history, top50, mainIndustries, settings);
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
              {mainIndex >= 0 ? `｜續航主流${mainIndex + 1}` : ""}
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
            金額/量能排名
            <br />#{amountRankIndex(stock, top50)} / #{volumeRankIndex(stock, top50)}
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

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(moneyQuality)}`}>{moneyQuality}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(decision)}`}>{decision}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(attackState(stock, history, settings))}`}>{attackState(stock, history, settings)}</span>
          <span className={`rounded-full bg-black/40 px-3 py-1 ${decisionTone(cont)}`}>{cont}</span>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-emerald-200">分數 {score}</span>
          <span className="rounded-full bg-purple-950 px-3 py-1 text-purple-200">{priceVolumeState(stock, top50, settings)}</span>
          <span className={`rounded-full bg-black/30 px-3 py-1 ${directionTone(direction)}`}>{directionText(direction)}</span>
          {isTomorrow && <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-cyan-300">明日觀察</span>}
          {isFavorite && <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-yellow-300">自選</span>}
        </div>

        <div className="mt-2 rounded-2xl bg-black/30 p-2 text-xs font-bold text-slate-300">
          {stockMoneySentence(stock, history, top50, mainIndustries, settings, industryStatus)}
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
  const [sortKey, setSortKey] = useState("flow");
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

  const industryFlowRanking = useMemo(
    () => getIndustryFlowRanking(top50, mainIndustries, settings, signalMap, industryHistoryMap),
    [top50, mainIndustries, settings, signalMap, industryHistoryMap]
  );

  const industryStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    industryFlowRanking.forEach((item) => {
      map[item.industry] = item.status;
    });
    return map;
  }, [industryFlowRanking]);

  const industryContinuationList = useMemo(
    () => industryFlowRanking.filter((item) => item.status === "資金續航中"),
    [industryFlowRanking]
  );

  const industryNewMoneyList = useMemo(
    () => industryFlowRanking.filter((item) => item.status === "資金剛轉入"),
    [industryFlowRanking]
  );

  const industryDivergenceList = useMemo(
    () => industryFlowRanking.filter((item) => item.status === "資金分歧" || item.status === "短線過熱"),
    [industryFlowRanking]
  );

  const industryOutList = useMemo(
    () => industryFlowRanking.filter((item) => item.status === "資金退潮"),
    [industryFlowRanking]
  );

  const attackContinuationList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.moneyAttackRaw, settings.attackConfirmTimes))
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
    [top50, signalMap, mainIndustries, settings]
  );

  const attackNewList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAnyTrue(signalMap[stock.code]?.moneyAttackRaw, 5) && !lastNAllTrue(signalMap[stock.code]?.moneyAttackRaw, settings.attackConfirmTimes))
        .sort((a, b) => stableCount(signalMap[b.code]?.moneyAttackRaw) - stableCount(signalMap[a.code]?.moneyAttackRaw)),
    [top50, signalMap, settings]
  );

  const attackFailedList = useMemo(
    () =>
      top50
        .filter((stock) => {
          const h = signalMap[stock.code];
          const hadAttack = lastNAnyTrue(h?.moneyAttackRaw, 5);
          const failed = lastNAllTrue(h?.volumeNoRiseRaw, settings.breakConfirmTimes) || lastNAllTrue(h?.moneyOutRaw, settings.breakConfirmTimes);
          return hadAttack && failed;
        })
        .sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50, signalMap, settings]
  );

  const moneyAmountList = useMemo(() => [...top50].sort((a, b) => estimatedAmount(b) - estimatedAmount(a)), [top50]);

  const volumeNoRiseList = useMemo(
    () => top50.filter((stock) => rawVolumeNoRise(stock, top50)).sort((a, b) => estimatedAmount(b) - estimatedAmount(a)),
    [top50]
  );

  const lowVolumeFakeList = useMemo(
    () => top50.filter((stock) => rawLowVolumeFake(stock, top50, settings)).sort((a, b) => b.changePercent - a.changePercent),
    [top50, settings]
  );

  const highQualityList = useMemo(
    () =>
      top50
        .filter((stock) => lastNAllTrue(signalMap[stock.code]?.highQualityRaw, settings.confirmTimes))
        .sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings)),
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

    [...attackContinuationList, ...highQualityList, ...attackNewList].slice(0, 20).forEach((stock) => map.set(stock.code, stock));

    return Array.from(map.values());
  }, [tomorrowCodes, stocks, attackContinuationList, highQualityList, attackNewList]);

  const selectedStock = useMemo(() => stocks.find((s) => s.code === selectedCode) || null, [stocks, selectedCode]);

  const totalEstimatedAmount = useMemo(() => top50.reduce((sum, stock) => sum + estimatedAmount(stock), 0), [top50]);

  const topFlowIndustry = industryFlowRanking[0];

  const marketStructure = useMemo(() => {
    if (industryOutList.length >= 2 || attackFailedList.length >= 6) return "資金退潮，不追";
    if (industryDivergenceList.length >= 2) return "資金分歧，只挑高品質";
    if (industryContinuationList.length >= 1 && attackContinuationList.length >= 3) return "資金續航，看主攻股";
    if (industryNewMoneyList.length >= 1) return "資金剛轉入，等第二次確認";
    return "等待資金續航";
  }, [industryOutList, attackFailedList, industryDivergenceList, industryContinuationList, attackContinuationList, industryNewMoneyList]);

  const homeSentence = useMemo(() => {
    if (!topFlowIndustry) return "目前資金方向尚未形成，先等資料。";

    if (topFlowIndustry.status === "資金續航中") {
      return `資金續航：優先看 ${topFlowIndustry.industry} 主攻股，避開爆量不漲股。`;
    }
    if (topFlowIndustry.status === "資金剛轉入") {
      return `${topFlowIndustry.industry} 資金剛轉入，先觀察下一次更新是否延續。`;
    }
    if (topFlowIndustry.status === "資金分歧") {
      return `${topFlowIndustry.industry} 有主攻也有換手，資金分歧，只挑高品質。`;
    }
    if (topFlowIndustry.status === "短線過熱") {
      return `${topFlowIndustry.industry} 資金集中但短線過熱，不追，等回測。`;
    }
    if (topFlowIndustry.status === "資金退潮") {
      return `${topFlowIndustry.industry} 量增價弱，資金退潮，不追。`;
    }

    return `目前資金最集中在 ${topFlowIndustry.industry}，但尚未形成明確續航。`;
  }, [topFlowIndustry]);

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
        const outCount = industryStocks.filter((stock) => rawMoneyOut(stock, list.slice(0, 50))).length;
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
            highQualityRaw: [],
            noiseRaw: [],
            moneyAttackRaw: [],
            volumeNoRiseRaw: [],
            lowVolumeFakeRaw: [],
            moneyOutRaw: [],
            validBreakoutRaw: [],
            invalidBreakoutRaw: [],
          };

        const meaningful = isMeaningfulMove(stock, prevPrice, settings);
        const entryOk = meaningful && rawEntryOk(stock, topList, activeMain, settings);
        const highQualityOk = meaningful && rawHighQuality(stock, topList, activeMain, settings);
        const moneyAttackOk = meaningful && rawMoneyAttack(stock, topList, activeMain, settings);
        const volumeNoRiseOk = rawVolumeNoRise(stock, topList);
        const lowVolumeFakeOk = rawLowVolumeFake(stock, topList, settings);
        const moneyOutOk = rawMoneyOut(stock, topList);
        const validBreakoutOk = rawValidBreakout(stock, topList, settings);
        const invalidBreakoutOk = rawInvalidBreakout(stock, topList, settings);
        const noiseOk = !meaningful || invalidBreakoutOk || lowVolumeFakeOk;

        next[stock.code] = {
          ...oldItem,
          prices: [...oldItem.prices, stock.price].slice(-8),
          entryRaw: [...oldItem.entryRaw, entryOk].slice(-8),
          highQualityRaw: [...oldItem.highQualityRaw, highQualityOk].slice(-8),
          noiseRaw: [...oldItem.noiseRaw, noiseOk].slice(-8),
          moneyAttackRaw: [...oldItem.moneyAttackRaw, moneyAttackOk].slice(-8),
          volumeNoRiseRaw: [...oldItem.volumeNoRiseRaw, volumeNoRiseOk].slice(-8),
          lowVolumeFakeRaw: [...oldItem.lowVolumeFakeRaw, lowVolumeFakeOk].slice(-8),
          moneyOutRaw: [...oldItem.moneyOutRaw, moneyOutOk].slice(-8),
          validBreakoutRaw: [...oldItem.validBreakoutRaw, validBreakoutOk].slice(-8),
          invalidBreakoutRaw: [...oldItem.invalidBreakoutRaw, invalidBreakoutOk].slice(-8),
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

  function filterList(list: Stock[]) {
    let arr = [...list];

    if (tab === "top50") {
      if (settings.topFilter === "主攻續航") arr = arr.filter((stock) => lastNAllTrue(signalMap[stock.code]?.moneyAttackRaw, settings.attackConfirmTimes));
      if (settings.topFilter === "主攻剛轉強") arr = arr.filter((stock) => lastNAnyTrue(signalMap[stock.code]?.moneyAttackRaw, 5) && !lastNAllTrue(signalMap[stock.code]?.moneyAttackRaw, settings.attackConfirmTimes));
      if (settings.topFilter === "主攻失效") arr = arr.filter((stock) => attackFailedList.some((item) => item.code === stock.code));
      if (settings.topFilter === "成交金額") arr = arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
      if (settings.topFilter === "爆量不漲") arr = arr.filter((stock) => rawVolumeNoRise(stock, top50));
      if (settings.topFilter === "量增價弱") arr = arr.filter((stock) => rawMoneyOut(stock, top50));
      if (settings.topFilter === "低量假強") arr = arr.filter((stock) => rawLowVolumeFake(stock, top50, settings));
      if (settings.topFilter === "高品質") arr = arr.filter((stock) => lastNAllTrue(signalMap[stock.code]?.highQualityRaw, settings.confirmTimes));
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

    if (sortKey === "flow") {
      return arr.sort((a, b) => {
        const ah = signalMap[a.code];
        const bh = signalMap[b.code];

        const aScore =
          stableCount(ah?.moneyAttackRaw) * 30 +
          amountRankPercent(a, top50) +
          volumeRankPercent(a, top50) +
          rawEntryScore(a, top50, mainIndustries, settings);

        const bScore =
          stableCount(bh?.moneyAttackRaw) * 30 +
          amountRankPercent(b, top50) +
          volumeRankPercent(b, top50) +
          rawEntryScore(b, top50, mainIndustries, settings);

        return bScore - aScore;
      });
    }

    if (sortKey === "money") return arr.sort((a, b) => estimatedAmount(b) - estimatedAmount(a));
    if (sortKey === "volume") return arr.sort((a, b) => b.volume - a.volume);
    if (sortKey === "entry") return arr.sort((a, b) => rawEntryScore(b, top50, mainIndustries, settings) - rawEntryScore(a, top50, mainIndustries, settings));
    if (sortKey === "industry") {
      return arr.sort((a, b) => {
        const ia = industryFlowRanking.findIndex((item) => item.industry === a.industry);
        const ib = industryFlowRanking.findIndex((item) => item.industry === b.industry);
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
      if (moreView === "attackContinuation") return sortList(attackContinuationList);
      if (moreView === "attackNew") return sortList(attackNewList);
      if (moreView === "attackFailed") return sortList(attackFailedList);
      if (moreView === "moneyAmount") return sortList(moneyAmountList);
      if (moreView === "volumeNoRise") return sortList(volumeNoRiseList);
      if (moreView === "lowVolumeFake") return sortList(lowVolumeFakeList);
      if (moreView === "highQuality") return sortList(highQualityList);
    }

    return [];
  }, [
    tab,
    moreView,
    top50,
    favoriteStocks,
    attackContinuationList,
    attackNewList,
    attackFailedList,
    moneyAmountList,
    volumeNoRiseList,
    lowVolumeFakeList,
    highQualityList,
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
    industryStatus: "",
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
      ...cardProps,
      industryStatus: industryStatusMap[stock.industry] || "觀察中",
    };
  }

  if (selectedStock) {
    const history = signalMap[selectedStock.code];
    const moneyQuality = stockMoneyQuality(selectedStock, history, top50, mainIndustries, settings);
    const decision = stableDecision(selectedStock, history, top50, mainIndustries, settings);
    const cont = rawContinuation(selectedStock, top50, mainIndustries, settings);
    const score = rawEntryScore(selectedStock, top50, mainIndustries, settings);
    const prevPrice = previousPriceMap[selectedStock.code];
    const direction = priceDirections[selectedStock.code];
    const industryStatus = industryStatusMap[selectedStock.industry] || "觀察中";

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
              <div className="text-xs font-bold text-slate-400">主力資金一句話</div>
              <div className="mt-1 text-3xl font-black">{moneyQuality}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                {stockMoneySentence(selectedStock, history, top50, mainIndustries, settings, industryStatus)}
              </div>
            </div>

            <section className={`mt-4 rounded-2xl bg-black/30 p-4 ${flowTone(industryStatus)}`}>
              <div className="text-xs font-bold text-slate-400">所屬產業資金狀態</div>
              <div className="mt-1 text-2xl font-black">{industryStatus}</div>
              <div className="mt-2 text-sm font-bold text-slate-300">
                產業：{selectedStock.industry}
                <br />
                主流：{mainIndustries.includes(selectedStock.industry) ? "是" : "否"}
              </div>
            </section>

            <section className="mt-4 rounded-2xl bg-yellow-950/30 p-4">
              <div className="text-lg font-black text-yellow-100">資金與主攻續航</div>
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

            <div className={`mt-4 rounded-2xl bg-black/30 p-4 ${decisionTone(decision)}`}>
              <div className="text-xs font-bold text-slate-400">降噪後結論</div>
              <div className="mt-1 text-2xl font-black">{decision}</div>
            </div>

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
              <div className="text-sm font-bold text-slate-400">台股產業資金續航強弱版</div>
              <h1 className="mt-1 text-3xl font-black tracking-tight">資金續航雷達</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                看資金有沒有留下來，找出續航產業與核心主攻股。
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
              續航統計
            </button>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
          <div className="text-xs font-bold text-yellow-300">現在該看哪裡</div>
          <div className="mt-1 text-xl font-black text-yellow-100">
            {topFlowIndustry ? `${topFlowIndustry.light}｜${topFlowIndustry.industry}｜${topFlowIndustry.status}` : "尚未形成"}
          </div>
          <div className="mt-2 text-sm font-bold text-slate-300">{homeSentence}</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <DetailRow label="盤中型態" value={marketStructure} />
            <DetailRow label="最強續航產業" value={topFlowIndustry?.industry || "--"} />
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard title="資金續航產業" value={industryContinuationList.length} sub="綠燈主流" tone="text-emerald-300" onClick={() => goMore("industryContinuation")} />
          <MiniCard title="資金剛轉入" value={industryNewMoneyList.length} sub="黃燈觀察" tone="text-yellow-300" onClick={() => goMore("industryNewMoney")} />
          <MiniCard title="資金分歧" value={industryDivergenceList.length} sub="只挑高品質" tone="text-orange-300" onClick={() => goMore("industryDivergence")} />
          <MiniCard title="資金退潮" value={industryOutList.length} sub="紅燈不追" tone="text-red-300" onClick={() => goMore("industryOut")} />
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3">
          <ActionCard title="主攻續航個股" sub="連續主攻確認" badge={attackContinuationList.length} tone="text-emerald-300" onClick={() => goMore("attackContinuation")} />
          <ActionCard title="主攻剛轉強" sub="先看下一次" badge={attackNewList.length} tone="text-yellow-300" onClick={() => goMore("attackNew")} />
          <ActionCard title="主攻失效" sub="小心換手" badge={attackFailedList.length} tone="text-red-300" onClick={() => goMore("attackFailed")} />
          <ActionCard title="成交金額排行" sub="資金核心排名" badge={moneyAmountList.length} tone="text-yellow-300" onClick={() => goMore("moneyAmount")} />
          <ActionCard title="爆量不漲" sub="換手疑慮" badge={volumeNoRiseList.length} tone="text-orange-300" onClick={() => goMore("volumeNoRise")} />
          <ActionCard title="低量假強" sub="漲但沒量" badge={lowVolumeFakeList.length} tone="text-orange-300" onClick={() => goMore("lowVolumeFake")} />
        </section>

        <section className="mt-4 rounded-3xl border border-slate-700 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">搜尋與排序</h2>
              <p className="text-xs font-bold text-slate-500">這版主要看產業續航、主攻連續次數。</p>
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
                  ["flow", "續航"],
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
                  {["全部", "主攻續航", "主攻剛轉強", "主攻失效", "成交金額", "爆量不漲", "量增價弱", "低量假強", "高品質", "主流產業"].map((filter) => (
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
            <h2 className="text-xl font-black">資金續航雷達</h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <ActionCard title="資金續航產業" sub="綠燈主流" badge={industryContinuationList.length} tone="text-emerald-300" onClick={() => setMoreView("industryContinuation")} />
              <ActionCard title="資金剛轉入產業" sub="黃燈觀察" badge={industryNewMoneyList.length} tone="text-yellow-300" onClick={() => setMoreView("industryNewMoney")} />
              <ActionCard title="資金分歧產業" sub="只挑高品質" badge={industryDivergenceList.length} tone="text-orange-300" onClick={() => setMoreView("industryDivergence")} />
              <ActionCard title="資金退潮產業" sub="紅燈不追" badge={industryOutList.length} tone="text-red-300" onClick={() => setMoreView("industryOut")} />
              <ActionCard title="主攻續航個股" sub="核心主攻股" badge={attackContinuationList.length} tone="text-emerald-300" onClick={() => setMoreView("attackContinuation")} />
              <ActionCard title="主攻失效個股" sub="小心換手" badge={attackFailedList.length} tone="text-red-300" onClick={() => setMoreView("attackFailed")} />
              <ActionCard title="成交金額排行" sub="資金核心排名" badge={moneyAmountList.length} tone="text-yellow-300" onClick={() => setMoreView("moneyAmount")} />
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
              {tab === "more" && moreView === "industryContinuation" && "🟢 資金續航產業"}
              {tab === "more" && moreView === "industryNewMoney" && "🟡 資金剛轉入產業"}
              {tab === "more" && moreView === "industryDivergence" && "🟠 資金分歧產業"}
              {tab === "more" && moreView === "industryOut" && "🔴 資金退潮產業"}
              {tab === "more" && moreView === "attackContinuation" && "🟢 主攻續航個股"}
              {tab === "more" && moreView === "attackNew" && "🟡 主攻剛轉強"}
              {tab === "more" && moreView === "attackFailed" && "🔴 主攻失效"}
              {tab === "more" && moreView === "moneyAmount" && "💰 成交金額排行"}
              {tab === "more" && moreView === "volumeNoRise" && "🟠 爆量不漲"}
              {tab === "more" && moreView === "lowVolumeFake" && "🟠 低量假強"}
              {tab === "more" && moreView === "highQuality" && "🟢 高品質訊號"}
              {tab === "more" && moreView === "settings" && "⚙️ 設定"}
              {tab === "more" && moreView === "data" && "📡 續航統計"}
            </h2>

            <p className="mt-1 text-sm font-bold text-slate-500">
              資金主流：{industryFlowRanking.slice(0, 3).map((item) => item.industry).join("、") || "--"}｜型態：{marketStructure}
            </p>
          </div>

          {tab === "home" && (
            <div className="space-y-4">
              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">產業資金續航強弱排行</h3>
                <div className="mt-3 space-y-3">
                  {industryFlowRanking.slice(0, 3).map((item, index) => (
                    <IndustryFlowCard key={item.industry} item={item} rank={index + 1} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-emerald-500/40 bg-emerald-950/20 p-5">
                <h3 className="text-xl font-black">主攻續航個股 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {attackContinuationList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有連續主攻續航股。
                    </div>
                  )}
                  {attackContinuationList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-yellow-500/40 bg-yellow-950/20 p-5">
                <h3 className="text-xl font-black">主攻剛轉強 5 檔</h3>
                <div className="mt-3 space-y-3">
                  {attackNewList.slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有主攻剛轉強。
                    </div>
                  )}
                  {attackNewList.slice(0, 5).map((stock, index) => (
                    <StockCard key={stock.code} stock={stock} rank={index + 1} {...stockCardPropsFor(stock)} />
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-red-500/40 bg-red-950/20 p-5">
                <h3 className="text-xl font-black">主攻失效 / 不要追</h3>
                <div className="mt-3 space-y-3">
                  {[...attackFailedList, ...volumeNoRiseList, ...lowVolumeFakeList].slice(0, 5).length === 0 && (
                    <div className="rounded-2xl bg-black/30 p-4 text-sm font-bold text-slate-400">
                      目前沒有明顯主攻失效。
                    </div>
                  )}
                  {[...attackFailedList, ...volumeNoRiseList, ...lowVolumeFakeList].slice(0, 5).map((stock, index) => (
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

          {tab === "more" && ["industryContinuation", "industryNewMoney", "industryDivergence", "industryOut"].includes(moreView) && (
            <div className="space-y-3">
              {(moreView === "industryContinuation"
                ? industryContinuationList
                : moreView === "industryNewMoney"
                  ? industryNewMoneyList
                  : moreView === "industryDivergence"
                    ? industryDivergenceList
                    : industryOutList
              ).map((item, index) => (
                <IndustryFlowCard key={item.industry} item={item} rank={index + 1} />
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
                重置所有資金續航紀錄
              </button>
            </div>
          )}

          {tab === "more" && moreView === "data" && (
            <div className="rounded-3xl border border-blue-500/50 bg-blue-950/20 p-5">
              <div className="text-xl font-black">續航統計</div>

              <div className="mt-3 space-y-2 text-sm font-bold text-slate-300">
                <div>API是否成功：{error ? "失敗" : lastSuccessAt ? "成功" : "尚未成功"}</div>
                <div>資料筆數：{stocks.length}</div>
                <div>50強筆數：{top50.length}</div>
                <div>最新資料時間：{apiDataTime || "讀取中"}</div>
                <div>最後嘗試更新：{lastAttemptAt || "--"}</div>
                <div>最後成功更新：{lastSuccessAt || "尚未成功"}</div>
                <div>資料來源：{source || "讀取中"}</div>
                <div>50強總成交金額估算：{formatAmount(totalEstimatedAmount)}</div>
                <div>資金續航產業數：{industryContinuationList.length}</div>
                <div>資金剛轉入產業數：{industryNewMoneyList.length}</div>
                <div>資金分歧產業數：{industryDivergenceList.length}</div>
                <div>資金退潮產業數：{industryOutList.length}</div>
                <div>主攻續航股數：{attackContinuationList.length}</div>
                <div>主攻剛轉強股數：{attackNewList.length}</div>
                <div>主攻失效股數：{attackFailedList.length}</div>
                <div>爆量不漲股數：{volumeNoRiseList.length}</div>
                <div>低量假強股數：{lowVolumeFakeList.length}</div>
                <div>今日最強續航產業：{topFlowIndustry?.industry || "--"}</div>
                <div>盤中型態：{marketStructure}</div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button onClick={() => loadStocks()} className="rounded-2xl bg-cyan-500/20 py-3 text-sm font-black text-cyan-200">
                  立即更新
                </button>
                <button onClick={resetSignals} className="rounded-2xl bg-red-500/20 py-3 text-sm font-black text-red-200">
                  重置續航紀錄
                </button>
              </div>
            </div>
          )}

          {tab !== "home" &&
            tab !== "tomorrow" &&
            !(tab === "more" && ["settings", "data", "industryContinuation", "industryNewMoney", "industryDivergence", "industryOut", "menu"].includes(moreView)) && (
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
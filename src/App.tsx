import { useEffect, useMemo, useState } from "react";

type Stock = {
  code: string;
  name: string;
  price: number;
  openPrice: number;
  previousClose: number;
  openPremiumPercent: number | null;
  changePercent: number;
  volume: number;
  industry: string;
  turnoverRate: number | null;
  volumeRatio: number | null;
  floatMarketCapYi: number | null;
};

type TabKey = "top50" | "observe" | "watch" | "industry" | "alert";
type SortKey = "change" | "volume" | "score" | "openPremium";
type FilterKey =
  | "all"
  | "strong"
  | "breakout"
  | "alert"
  | "lowVolume"
  | "openStrong"
  | "mainContinue"
  | "safeWatch"
  | "tomorrowWatch";

const defaultWatchCodes = ["2330", "3042", "3714", "3481", "2356", "6168", "6405"];

const industryMap: Record<string, string> = {
  "1101": "水泥",
  "1102": "水泥",
  "1216": "食品",
  "1227": "食品",
  "1301": "塑化",
  "1303": "塑化",
  "6505": "塑化",
  "1717": "化工",
  "1722": "化工",
  "4722": "化工",
  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",
  "2201": "汽車",
  "2207": "汽車",
  "2227": "汽車",
  "2301": "電腦週邊",
  "2356": "電腦週邊",
  "2357": "電腦週邊",
  "2382": "電腦週邊",
  "3231": "電腦週邊",
  "6669": "電腦週邊",
  "2303": "半導體",
  "2330": "半導體",
  "2379": "半導體",
  "2408": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3711": "半導體",
  "2308": "電子零組件",
  "2327": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",
  "2313": "PCB",
  "3042": "PCB",
  "2367": "PCB",
  "4958": "PCB",
  "2317": "電子代工",
  "2354": "電子代工",
  "4938": "電子代工",
  "2409": "面板",
  "3481": "面板",
  "3008": "光電",
  "3406": "光電",
  "3714": "光電",
  "6168": "光電",
  "6278": "光電",
  "6405": "光電",
  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",
  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2886": "金融",
  "2891": "金融",
  "2892": "金融",
  "5871": "金融",
  "5876": "金融",
  "2911": "百貨",
  "2912": "百貨",
  "5903": "百貨",
  "9904": "消費",
  "9907": "消費",
  "9914": "消費",
  "9926": "消費",
  "1707": "生技",
  "1760": "生技",
  "1783": "生技",
  "8374": "電機機械",
};

function num(value: any) {
  const n = Number(String(value ?? "0").replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

function nullableNum(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function getIndustry(code: string) {
  const cleanCode = String(code).trim().replace(/\D/g, "").slice(0, 4);
  return industryMap[cleanCode] || "其他";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function priceText(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return value.toFixed(value >= 100 ? 0 : 2);
}

function percentText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "資料不足";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function changeText(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function numberText(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "資料不足";
  return `${value.toFixed(2)}${suffix}`;
}

function changeBadgeClass(value: number, size: "sm" | "lg" = "sm") {
  const base =
    size === "lg"
      ? "rounded-xl px-3 py-2 text-lg font-black text-white"
      : "rounded-lg px-2 py-1 text-sm font-black text-white";

  if (value > 0) return `${base} bg-red-500`;
  if (value < 0) return `${base} bg-green-500`;
  return `${base} bg-slate-600`;
}

function changeTextClass(value: number) {
  if (value > 0) return "font-black text-red-400";
  if (value < 0) return "font-black text-green-400";
  return "font-black text-slate-300";
}

function volumeLots(volume: number) {
  return Math.round(volume / 1000);
}

function normalizeStock(item: any): Stock {
  const code = String(item.Code ?? item.code ?? "").trim();
  const name = String(item.Name ?? item.name ?? "").trim();

  const price = num(
    item.ClosingPrice ??
      item.Close ??
      item.close ??
      item.price ??
      item.LastPrice ??
      item.lastPrice
  );

  const openPrice = num(
    item.OpeningPrice ??
      item.OpenPrice ??
      item.open ??
      item.Open ??
      item.openPrice
  );

  const change = num(item.Change ?? item.change ?? item.PriceChange);

  let previousClose = num(
    item.PreviousClose ??
      item.previousClose ??
      item.YesterdayClose ??
      item.yesterdayClose ??
      item.ReferencePrice
  );

  if (previousClose <= 0 && price > 0) {
    previousClose = price - change;
  }

  let changePercent = num(item.ChangePercent ?? item.changePercent);

  if ((!Number.isFinite(changePercent) || changePercent === 0) && previousClose > 0) {
    changePercent = Number((((price - previousClose) / previousClose) * 100).toFixed(2));
  }

  let openPremiumPercent: number | null = null;

  if (openPrice > 0 && previousClose > 0) {
    openPremiumPercent = Number((((openPrice - previousClose) / previousClose) * 100).toFixed(2));
  }

  return {
    code,
    name,
    price,
    openPrice,
    previousClose,
    openPremiumPercent,
    changePercent,
    volume: num(item.TradeVolume ?? item.volume ?? item.Volume),
    industry: item.industry || getIndustry(code),
    turnoverRate: nullableNum(item.turnoverRate),
    volumeRatio: nullableNum(item.volumeRatio),
    floatMarketCapYi: nullableNum(item.floatMarketCapYi),
  };
}

function isTradingTime() {
  const now = new Date();
  const day = now.getDay();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  return day >= 1 && day <= 5 && totalMinutes >= 9 * 60 && totalMinutes <= 13 * 60 + 30;
}

function getRefreshSeconds() {
  return isTradingTime() ? 10 : 60;
}

function getMarketStatus() {
  const now = new Date();
  const day = now.getDay();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const preOpenStart = 8 * 60 + 30;
  const marketOpen = 9 * 60;
  const marketClose = 13 * 60 + 30;

  if (!isWeekday) {
    return {
      title: "⚠️ 非交易日",
      text: "目前可能是最近一次交易資料，請注意資料日期。",
      color: "border-yellow-900 bg-yellow-950/50 text-yellow-200",
    };
  }

  if (totalMinutes < preOpenStart) {
    return {
      title: "⚠️ 開盤前",
      text: "目前可能是昨日或最近一次交易資料。",
      color: "border-yellow-900 bg-yellow-950/50 text-yellow-200",
    };
  }

  if (totalMinutes >= preOpenStart && totalMinutes < marketOpen) {
    return {
      title: "⏳ 開盤前準備",
      text: "接近開盤，資料可能尚未完整更新。",
      color: "border-orange-900 bg-orange-950/50 text-orange-200",
    };
  }

  if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
    return {
      title: "🟢 盤中即時模式",
      text: "目前為台股盤中時間，自動更新改為每 10 秒。",
      color: "border-green-500 bg-green-950/60 text-green-100",
    };
  }

  return {
    title: "⚠️ 收盤後",
    text: "目前可能是今日收盤或最近一次交易資料，適合做復盤觀察。",
    color: "border-slate-700 bg-slate-900 text-slate-300",
  };
}

function getSyncStatus(
  lastSuccessAt: string,
  apiUpdatedAtTaiwan: string,
  dataSource: string,
  lastFailReason: string
) {
  if (lastFailReason) {
    return {
      title: "🔴 同步異常",
      text: `最近一次更新失敗：${lastFailReason}`,
      color: "border-red-500 bg-red-950/60 text-red-100",
    };
  }

  if (!lastSuccessAt) {
    return {
      title: "⚠️ 尚未同步成功",
      text: "請按立即更新，確認 API 是否有回傳資料。",
      color: "border-yellow-500 bg-yellow-950/60 text-yellow-100",
    };
  }

  if (apiUpdatedAtTaiwan && dataSource) {
    return {
      title: "✅ API 有同步",
      text: "API資料時間有顯示，代表前端有收到 API 回傳。",
      color:
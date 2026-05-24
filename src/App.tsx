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

type RiskLevel = "low" | "medium" | "high";
type BuyPointLevel = "watch" | "pullback" | "avoid" | "weak";

type TabKey =
  | "top50"
  | "watch"
  | "observe"
  | "tomorrow"
  | "industry"
  | "breakout"
  | "alert";

type SortKey = "change" | "volume" | "score" | "openPremium";

type FilterKey =
  | "all"
  | "strong"
  | "breakout"
  | "alert"
  | "lowVolume"
  | "openStrong"
  | "highOpenContinue"
  | "mainContinue"
  | "chipActive"
  | "safeWatch"
  | "tomorrowWatch";

type ModeKey = "open" | "normal" | "strong910" | "tomorrow";

const defaultWatchCodes = ["2330", "3042", "3714", "3481", "2356", "6168", "6405"];

const industryMap: Record<string, string> = {
  "2911": "百貨",
  "3042": "PCB",
  "3711": "半導體",
  "3714": "光電",
  "6168": "光電",
  "8374": "電機機械",
  "2356": "電腦週邊",
  "3481": "面板",
  "4722": "化工",
  "6405": "光電",
  "6278": "光電",

  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "2379": "半導體",
  "3661": "半導體",
  "2408": "半導體",

  "2317": "電子代工",
  "4938": "電子代工",
  "2354": "電子代工",
  "2382": "電腦週邊",
  "2357": "電腦週邊",
  "3231": "電腦週邊",
  "2301": "電腦週邊",
  "6669": "電腦週邊",
  "3017": "電腦週邊",

  "2308": "電子零組件",
  "2327": "電子零組件",
  "3037": "電子零組件",
  "8046": "電子零組件",
  "2313": "PCB",
  "2367": "PCB",
  "4958": "PCB",

  "3008": "光電",
  "2409": "面板",
  "3406": "光電",

  "2881": "金融",
  "2882": "金融",
  "2884": "金融",
  "2886": "金融",
  "2891": "金融",
  "2892": "金融",
  "5871": "金融",
  "5876": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",

  "1301": "塑化",
  "1303": "塑化",
  "6505": "塑化",
  "1717": "化工",
  "1722": "化工",

  "2002": "鋼鐵",
  "2014": "鋼鐵",
  "2027": "鋼鐵",

  "1101": "水泥",
  "1102": "水泥",

  "2201": "汽車",
  "2207": "汽車",
  "2227": "汽車",

  "1216": "食品",
  "1227": "食品",

  "1707": "生技",
  "1760": "生技",
  "1783": "生技",

  "2912": "百貨",
  "5903": "百貨",
  "9904": "消費",
  "9907": "消費",
  "9914": "消費",
  "9926": "消費",
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
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function numberText(value: number | null, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "資料不足";
  return `${value.toFixed(2)}${suffix}`;
}

function hasChipLine(stock: Stock) {
  return (
    stock.turnoverRate !== null ||
    stock.volumeRatio !== null ||
    stock.floatMarketCapYi !== null
  );
}

function chipLineText(stock: Stock) {
  const parts: string[] = [];

  if (stock.turnoverRate !== null) parts.push(`換手 ${numberText(stock.turnoverRate, "%")}`);
  if (stock.volumeRatio !== null) parts.push(`量比 ${numberText(stock.volumeRatio)}`);
  if (stock.floatMarketCapYi !== null) parts.push(`流通 ${numberText(stock.floatMarketCapYi, "億")}`);

  return parts.join("｜");
}

function isNineTenWindow() {
  const now = new Date();
  const day = now.getDay();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const start = 9 * 60;
  const end = 9 * 60 + 15;

  return isWeekday && totalMinutes >= start && totalMinutes <= end;
}

function isAfterCloseReviewWindow() {
  const now = new Date();
  const day = now.getDay();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const start = 13 * 60 + 30;
  const end = 23 * 60 + 59;

  return isWeekday && totalMinutes >= start && totalMinutes <= end;
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
      title: "✅ 今日盤中資料",
      text: "目前為台股盤中時間，資料較接近即時。",
      color: "border-green-900 bg-green-950/50 text-green-200",
    };
  }

  return {
    title: "⚠️ 收盤後",
    text: "目前可能是今日收盤或最近一次交易資料，適合做復盤觀察。",
    color: "border-slate-700 bg-slate-900 text-slate-300",
  };
}

function getStockLinks(code: string) {
  const cleanCode = String(code).trim().replace(/\D/g, "").slice(0, 4);

  return {
    kline: `https://tw.tradingview.com/chart/?symbol=TWSE:${cleanCode}`,
    yahoo: `https://tw.stock.yahoo.com/quote/${cleanCode}.TW`,
  };
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

function volumeLots(volume: number) {
  return Math.round(volume / 1000);
}

function isHighOpenContinue(stock: Stock) {
  return (
    stock.openPremiumPercent !== null &&
    stock.openPremiumPercent >= 3 &&
    stock.changePercent >= 5
  );
}

function isMainContinue(stock: Stock, strongIndustryNames: string[]) {
  return isHighOpenContinue(stock) && strongIndustryNames.includes(stock.industry);
}

function isChipActive(stock: Stock) {
  return (
    stock.turnoverRate !== null &&
    stock.volumeRatio !== null &&
    stock.floatMarketCapYi !== null &&
    stock.turnoverRate >= 3 &&
    stock.turnoverRate <= 10 &&
    stock.volumeRatio > 1 &&
    stock.floatMarketCapYi < 5
  );
}

function stockScore(stock: Stock) {
  let score = 50;

  if (stock.changePercent >= 9.8) score += 35;
  else if (stock.changePercent >= 7) score += 25;
  else if (stock.changePercent >= 5) score += 15;
  else if (stock.changePercent >= 3) score += 8;
  else if (stock.changePercent < 0) score -= 20;

  if (volumeLots(stock.volume) >= 10000) score += 10;
  else if (volumeLots(stock.volume) >= 3000) score += 6;

  if (stock.openPremiumPercent !== null) {
    if (stock.openPremiumPercent >= 5) score += 8;
    else if (stock.openPremiumPercent >= 3) score += 5;
    else if (stock.openPremiumPercent <= -3) score -= 5;
  }

  if (isHighOpenContinue(stock)) score += 8;
  if (isLowVolumeStrongStock(stock)) score += 4;
  if (isChipActive(stock)) score += 10;

  return Math.max(0, Math.min(99, score));
}

function isSafeWatch(stock: Stock) {
  const openPremium = stock.openPremiumPercent ?? 0;
  const lots = volumeLots(stock.volume);

  return (
    stock.changePercent >= 0 &&
    stock.changePercent < 7 &&
    stockScore(stock) < 90 &&
    openPremium < 5 &&
    lots >= 300
  );
}

function isTomorrowWatchStock(stock: Stock, strongIndustryNames: string[]) {
  const openPremium = stock.openPremiumPercent ?? 0;
  const score = stockScore(stock);

  const notOverheated =
    stock.changePercent >= 0 &&
    stock.changePercent < 7 &&
    score < 90 &&
    openPremium < 5;

  const hasReason =
    strongIndustryNames.includes(stock.industry) ||
    isSafeWatch(stock) ||
    isMainContinue(stock, strongIndustryNames) ||
    isChipActive(stock);

  return notOverheated && hasReason;
}

function getBuyPoint(stock: Stock) {
  const score = stockScore(stock);
  const openPremium = stock.openPremiumPercent ?? 0;

  if (stock.changePercent < 0) {
    return {
      level: "weak" as BuyPointLevel,
      title: "⚪ 不建議",
      text: "目前股價轉弱，先不要急著進場，等重新站回強勢再觀察。",
      reason: "漲幅為負，代表今日目前不是強勢股。",
    };
  }

  if (stock.changePercent >= 9 || score >= 90) {
    return {
      level: "avoid" as BuyPointLevel,
      title: "🔴 避免追高",
      text: "目前已經偏熱，短線容易震盪或拉回，不建議盲目追價。",
      reason: "漲幅接近高檔，或強度分數已達過熱區。",
    };
  }

  if (stock.changePercent >= 5 || openPremium >= 5) {
    return {
      level: "pullback" as BuyPointLevel,
      title: "🟡 等拉回",
      text: "動能不錯，但已經有漲幅，建議等拉回、量縮或重新轉強。",
      reason: "漲幅超過 5%，或開盤溢價偏高，追高風險增加。",
    };
  }

  return {
    level: "watch" as BuyPointLevel,
    title: "🟢 可觀察",
    text: "目前沒有明顯過熱，可以列入觀察，但仍要搭配大盤與產業強度。",
    reason: "漲幅未過熱，強度未過高，較適合等轉強或拉回觀察。",
  };
}

function stockStatus(stock: Stock) {
  if (stock.changePercent >= 9.8) return "強勢";
  if (stock.changePercent >= 5) return "突破";
  if (isSafeWatch(stock)) return "安全觀察";
  if (stock.changePercent >= 0) return "觀察";
  return "轉弱";
}

function isAlertStock(stock: Stock) {
  return (
    stock.changePercent >= 7 ||
    stockScore(stock) >= 85 ||
    volumeLots(stock.volume) >= 10000 ||
    isChipActive(stock)
  );
}

function isWatchAlertStock(stock: Stock) {
  return (
    stock.changePercent >= 5 ||
    stockScore(stock) >= 85 ||
    isHighOpenContinue(stock) ||
    stock.changePercent >= 9.8
  );
}

function isLowVolumeStrongStock(stock: Stock) {
  return stock.changePercent >= 5 && volumeLots(stock.volume) < 10000;
}

function getRisk(stock: Stock) {
  const openPremium = stock.openPremiumPercent ?? 0;
  const lots = volumeLots(stock.volume);
  const score = stockScore(stock);

  if (stock.changePercent >= 9 || score >= 90 || openPremium >= 8) {
    return {
      level: "high" as RiskLevel,
      title: "🔴 過熱，避免追高",
      text: "漲幅、強度或開盤溢價已偏高，短線容易震盪，建議不要盲目追價。",
    };
  }

  if (stock.changePercent >= 5 || openPremium >= 5 || lots >= 10000 || score >= 80) {
    return {
      level: "medium" as RiskLevel,
      title: "🟡 偏熱，觀察拉回",
      text: "動能不錯，但已有一定漲幅或量能放大，適合觀察拉回或轉強點。",
    };
  }

  return {
    level: "low" as RiskLevel,
    title: "🟢 低風險觀察",
    text: "目前尚未明顯過熱，可先列入觀察，但仍要搭配大盤與產業強度。",
  };
}

function getIndustryRole(stock: Stock, groupStocks: Stock[]) {
  if (groupStocks.length === 0) return "";

  const leader = [...groupStocks].sort((a, b) => b.changePercent - a.changePercent)[0];

  if (stock.code === leader.code) return "龍頭";
  if (stock.changePercent >= 5) return "跟漲";
  if (isSafeWatch(stock)) return "安全";
  return "觀察";
}

function getObserveTags(stock: Stock, strongIndustryNames: string[]) {
  const tags: string[] = [];

  if (isMainContinue(stock, strongIndustryNames)) tags.push("主流續強");
  else if (isHighOpenContinue(stock)) tags.push("高開續強");

  if (isChipActive(stock)) tags.push("籌碼活躍");
  if (isSafeWatch(stock)) tags.push("安全觀察");
  if (isLowVolumeStrongStock(stock)) tags.push("低量強漲");
  if (isAlertStock(stock)) tags.push("警報股");
  if (isWatchAlertStock(stock)) tags.push("自選警報");
  if (isTomorrowWatchStock(stock, strongIndustryNames)) tags.push("明日觀察");
  if (stock.changePercent >= 5) tags.push("突破");
  if (strongIndustryNames.includes(stock.industry)) tags.push("主流產業");

  return Array.from(new Set(tags));
}

function getAlertTags(stock: Stock, strongIndustryNames: string[]) {
  const tags: string[] = [];

  if (stock.changePercent >= 9.8) tags.push("漲停附近");
  else if (stock.changePercent >= 7) tags.push("急漲");

  if (stock.changePercent >= 5) tags.push("突破");

  if (isMainContinue(stock, strongIndustryNames)) {
    tags.push("主流續強");
  } else if (isHighOpenContinue(stock)) {
    tags.push("高開續強");
  } else if (stock.openPremiumPercent !== null) {
    if (stock.openPremiumPercent >= 5) tags.push("高開");
    else if (stock.openPremiumPercent >= 3) tags.push("開盤強");
  }

  if (isChipActive(stock)) tags.push("籌碼活躍");
  if (isSafeWatch(stock)) tags.push("安全觀察");
  if (isWatchAlertStock(stock)) tags.push("自選警報");
  if (isTomorrowWatchStock(stock, strongIndustryNames)) tags.push("明日觀察");

  if (volumeLots(stock.volume) >= 10000) tags.push("爆量");
  else if (volumeLots(stock.volume) >= 3000) tags.push("放量");

  if (isLowVolumeStrongStock(stock)) tags.push("低量強漲");
  if (stockScore(stock) >= 85) tags.push("強度高");
  if (strongIndustryNames.includes(stock.industry)) tags.push("主流產業");

  return Array.from(new Set(tags)).slice(0, 8);
}

function sortStocks(list: Stock[], sortKey: SortKey) {
  const copied = [...list];

  if (sortKey === "volume") return copied.sort((a, b) => b.volume - a.volume);
  if (sortKey === "score") return copied.sort((a, b) => stockScore(b) - stockScore(a));

  if (sortKey === "openPremium") {
    return copied.sort((a, b) => {
      const aValue = a.openPremiumPercent ?? -999;
      const bValue = b.openPremiumPercent ?? -999;
      return bValue - aValue;
    });
  }

  return copied.sort((a, b) => b.changePercent - a.changePercent);
}

function filterByQuick(
  list: Stock[],
  filterKey: FilterKey,
  strongIndustryNames: string[] = []
) {
  if (filterKey === "strong") return list.filter((s) => s.changePercent >= 9.8);
  if (filterKey === "breakout") return list.filter((s) => s.changePercent >= 5);
  if (filterKey === "alert") return list.filter(isAlertStock);
  if (filterKey === "lowVolume") return list.filter((s) => s.volume > 0 && s.volume < 300000);
  if (filterKey === "openStrong") return list.filter((s) => s.openPremiumPercent !== null && s.openPremiumPercent >= 3);
  if (filterKey === "highOpenContinue") return list.filter(isHighOpenContinue);
  if (filterKey === "mainContinue") return list.filter((s) => isMainContinue(s, strongIndustryNames));
  if (filterKey === "chipActive") return list.filter(isChipActive);
  if (filterKey === "safeWatch") return list.filter(isSafeWatch);
  if (filterKey === "tomorrowWatch") return list.filter((s) => isTomorrowWatchStock(s, strongIndustryNames));

  return list;
}

function loadSavedWatchCodes() {
  try {
    const saved = localStorage.getItem("watchCodes");
    if (!saved) return defaultWatchCodes;

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return defaultWatchCodes;

    const codes = parsed
      .map((code) => String(code).trim())
      .filter((code) => /^\d{4}$/.test(code));

    return codes.length > 0 ? codes : defaultWatchCodes;
  } catch {
    return defaultWatchCodes;
  }
}

function buildIndustryGroups(stocks: Stock[], sortKey: SortKey) {
  const map: Record<string, Stock[]> = {};

  stocks.forEach((stock) => {
    map[stock.industry] = map[stock.industry] || [];
    map[stock.industry].push(stock);
  });

  return Object.entries(map)
    .map(([industry, groupStocks]) => {
      const avgChange =
        groupStocks.reduce((sum, stock) => sum + stock.changePercent, 0) /
        groupStocks.length;

      const strength = Math.round(groupStocks.length * avgChange * 10);

      return {
        industry,
        total: groupStocks.length,
        avgChange: Number(avgChange.toFixed(2)),
        strength,
        stocks: sortStocks(groupStocks, sortKey),
      };
    })
    .sort((a, b) => b.strength - a.strength);
}

function getDataCheckStatus(stocks: Stock[], watchListStocks: Stock[], lastSuccessAt: string) {
  const hasRanking = stocks.length > 0;
  const hasWatchList = watchListStocks.length > 0;
  const hasPrice = stocks.some((stock) => stock.price > 0);
  const hasVolume = stocks.some((stock) => stock.volume > 0);
  const hasUpdated = Boolean(lastSuccessAt);

  const okCount = [hasRanking, hasWatchList, hasPrice, hasVolume, hasUpdated].filter(Boolean).length;
  const isGood = okCount >= 4;

  return {
    isGood,
    okCount,
    title: isGood ? "✅ 資料檢查正常" : "⚠️ 資料可能異常",
    text: isGood
      ? "漲幅排行、自選股、股價與成交量都有取得。"
      : "部分資料可能沒有成功取得，請按立即更新或稍後再試。",
  };
}

function buildObserveStocks(stocks: Stock[], strongIndustryNames: string[]) {
  const map = new Map<string, Stock>();

  stocks.forEach((stock) => {
    const shouldObserve =
      isMainContinue(stock, strongIndustryNames) ||
      isHighOpenContinue(stock) ||
      isLowVolumeStrongStock(stock) ||
      isChipActive(stock) ||
      isSafeWatch(stock) ||
      isAlertStock(stock) ||
      isTomorrowWatchStock(stock, strongIndustryNames);

    if (shouldObserve) map.set(stock.code, stock);
  });

  return sortStocks(Array.from(map.values()), "score");
}

function getTradeAdvice(stock: Stock) {
  const advice: string[] = [];
  const risk = getRisk(stock);
  const buyPoint = getBuyPoint(stock);

  advice.push(`買點提醒：${buyPoint.title}`);

  if (risk.level === "high") {
    advice.push("🔴 風險偏高：目前已過熱，避免追高，先等拉回或量縮整理");
  } else if (risk.level === "medium") {
    advice.push("🟡 偏熱觀察：動能不錯，但不要急追，可觀察拉回轉強");
  } else {
    advice.push("🟢 低風險觀察：目前未明顯過熱，可列入追蹤");
  }

  if (isSafeWatch(stock)) advice.push("✅ 安全觀察：漲幅未過熱、強度未過高，較適合等轉強或拉回觀察");
  if (isChipActive(stock)) advice.push("✅ 籌碼活躍：換手率 3～10%、量比 > 1、流通市值 < 5 億");

  if (isHighOpenContinue(stock)) {
    advice.push("🚀 高開續強：開盤溢價率超過 3%，目前漲幅也超過 5%");
  } else if (stock.openPremiumPercent !== null) {
    if (stock.openPremiumPercent >= 5) advice.push("🚀 開盤高溢價：開盤就強，但也要小心追高風險");
    else if (stock.openPremiumPercent >= 3) advice.push("✅ 開盤偏強：開盤溢價率超過 3%，早盤買盤較積極");
    else if (stock.openPremiumPercent <= -3) advice.push("⚠️ 開盤偏弱：開盤溢價率低於 -3%，先觀察是否轉強");
  } else {
    advice.push("ℹ️ 開盤溢價率：目前資料不足，可能 API 未提供開盤價或昨收價");
  }

  if (stock.changePercent >= 9.8) {
    advice.push("🔥 強勢追蹤：漲幅接近漲停，屬於今日強勢股");
    advice.push("⚠️ 注意風險：漲幅已高，避免盲目追高");
  } else if (stock.changePercent >= 7) advice.push("🚨 警報股：漲幅超過 7%，短線動能強");
  else if (stock.changePercent >= 5) advice.push("⚡ 突破股：漲幅超過 5%，可列入觀察");
  else if (stock.changePercent >= 0) advice.push("🟡 觀察股：目前沒有明顯轉弱");
  else advice.push("🔴 轉弱股：目前漲幅為負，先保守觀察");

  if (isLowVolumeStrongStock(stock)) advice.push("🚨 低量強漲：漲幅超過 5%，但成交量低於 10,000 張");
  if (volumeLots(stock.volume) < 300) advice.push("⚠️ 成交量偏低：流動性較差，進出要小心");
  if (stockScore(stock) >= 85) advice.push("✅ 強度高：符合警報條件，可優先追蹤");
  if (isWatchAlertStock(stock)) advice.push("🚨 自選警報：這檔符合自選強勢提醒條件");

  return advice;
}

function getAlertReasons(stock: Stock, strongIndustryNames: string[]) {
  const reasons: string[] = [];
  const risk = getRisk(stock);
  const buyPoint = getBuyPoint(stock);

  reasons.push(`買點提醒：${buyPoint.title}`);
  reasons.push(`買點原因：${buyPoint.reason}`);
  reasons.push(`風險燈號：${risk.title}`);

  if (isTomorrowWatchStock(stock, strongIndustryNames)) {
    reasons.push("明日觀察：主流產業或安全觀察，且漲幅與強度未過熱");
  }

  if (isWatchAlertStock(stock)) reasons.push("自選警報：漲幅 ≥ 5%、強度 ≥ 85、或高開續強");
  if (isSafeWatch(stock)) reasons.push("安全觀察：漲幅 < 7%，強度 < 90，開盤溢價 < 5%，成交量不太低");
  if (isChipActive(stock)) reasons.push("籌碼活躍：換手率 3～10%，量比 > 1，流通市值 < 5 億");

  if (isMainContinue(stock, strongIndustryNames)) {
    reasons.push("主流續強：高開續強，且屬於今日最強主流前 5 名產業");
  } else if (isHighOpenContinue(stock)) {
    reasons.push("高開續強：開盤溢價率 ≥ 3%，目前漲幅 ≥ 5%");
  } else if (stock.openPremiumPercent !== null) {
    if (stock.openPremiumPercent >= 5) reasons.push("開盤溢價率超過 5%");
    else if (stock.openPremiumPercent >= 3) reasons.push("開盤溢價率超過 3%");
  }

  if (stock.changePercent >= 9.8) reasons.push("漲幅接近漲停");
  else if (stock.changePercent >= 7) reasons.push("漲幅超過 7%");
  else if (stock.changePercent >= 5) reasons.push("漲幅超過 5%，屬於突破股");

  if (isLowVolumeStrongStock(stock)) reasons.push("低量強漲：漲幅超過 5%，成交量低於 10,000 張");
  if (volumeLots(stock.volume) >= 10000) reasons.push("成交量超過 1 萬張");
  else if (volumeLots(stock.volume) >= 3000) reasons.push("成交量放大");

  if (stockScore(stock) >= 85) reasons.push("強度分數達警報區");
  if (strongIndustryNames.includes(stock.industry)) reasons.push("屬於今日強勢產業");

  if (reasons.length === 0) reasons.push("目前屬於一般觀察");

  return reasons;
}
function MiniLine() {
  return (
    <div className="mt-1 h-6 w-16">
      <svg viewBox="0 0 100 36" className="h-full w-full">
        <polyline
          points="4,29 18,27 32,19 46,19 58,17 70,24 82,12 96,14"
          fill="none"
          stroke="#ef4444"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function AlertTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className={
            tag === "明日觀察"
              ? "rounded-full bg-indigo-400 px-2 py-0.5 text-xs font-black text-black"
              : tag === "漲停附近" || tag === "急漲"
                ? "rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white"
                : tag === "自選警報"
                  ? "rounded-full bg-red-400 px-2 py-0.5 text-xs font-black text-black"
                  : tag === "安全觀察"
                    ? "rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-black"
                    : tag === "籌碼活躍"
                      ? "rounded-full bg-cyan-400 px-2 py-0.5 text-xs font-black text-black"
                      : tag === "主流續強"
                        ? "rounded-full bg-green-500 px-2 py-0.5 text-xs font-black text-black"
                        : tag === "高開續強"
                          ? "rounded-full bg-lime-500 px-2 py-0.5 text-xs font-black text-black"
                          : tag === "低量強漲" || tag === "高開" || tag === "開盤強"
                            ? "rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-black text-black"
                            : tag === "主流產業"
                              ? "rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white"
                              : tag === "強度高"
                                ? "rounded-full bg-purple-500 px-2 py-0.5 text-xs font-black text-white"
                                : "rounded-full bg-slate-700 px-2 py-0.5 text-xs font-black text-slate-100"
          }
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function NoticeBox({
  title,
  text,
  stocks,
  tone,
  onSelectStock,
}: {
  title: string;
  text: string;
  stocks: Stock[];
  tone: "green" | "yellow" | "cyan" | "emerald" | "red" | "indigo";
  onSelectStock: (stock: Stock) => void;
}) {
  if (stocks.length === 0) return null;

  const boxClass =
    tone === "indigo"
      ? "rounded-2xl border border-indigo-500 bg-indigo-950/70 p-3 text-indigo-100"
      : tone === "red"
        ? "rounded-2xl border border-red-500 bg-red-950/70 p-3 text-red-100"
        : tone === "emerald"
          ? "rounded-2xl border border-emerald-400 bg-emerald-950/70 p-3 text-emerald-100"
          : tone === "cyan"
            ? "rounded-2xl border border-cyan-400 bg-cyan-950/70 p-3 text-cyan-100"
            : tone === "green"
              ? "rounded-2xl border border-green-500 bg-green-950/70 p-3 text-green-100"
              : "rounded-2xl border border-yellow-500 bg-yellow-950/70 p-3 text-yellow-100";

  return (
    <div className={boxClass}>
      <div className="text-sm font-black">{title}</div>
      <div className="mt-1 text-xs font-bold">{text}</div>

      <div className="mt-3 space-y-2">
        {stocks.slice(0, 3).map((stock) => (
          <button
            key={stock.code}
            onClick={() => onSelectStock(stock)}
            className="flex w-full items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-left active:scale-[0.99]"
          >
            <div>
              <div className="font-black text-white">
                {stock.name}
                <span className="ml-2 text-xs text-slate-400">{stock.code}</span>
              </div>

              <div className="mt-1 text-xs font-bold opacity-90">
                {stock.industry}｜強度 {stockScore(stock)}｜成交量{" "}
                {volumeLots(stock.volume).toLocaleString()} 張
              </div>
            </div>

            <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </div>
          </button>
        ))}
      </div>

      {stocks.length > 3 && (
        <div className="mt-2 text-xs font-bold opacity-90">
          還有 {stocks.length - 3} 檔，可切換清單查看。
        </div>
      )}
    </div>
  );
}

function AlertCenter({
  watchAlertStocks,
  tomorrowWatchStocks,
  chipActiveStocks,
  mainContinueStocks,
  lowVolumeStrongStocks,
  safeWatchStocks,
  onSelectStock,
  onOpenTomorrow,
}: {
  watchAlertStocks: Stock[];
  tomorrowWatchStocks: Stock[];
  chipActiveStocks: Stock[];
  mainContinueStocks: Stock[];
  lowVolumeStrongStocks: Stock[];
  safeWatchStocks: Stock[];
  onSelectStock: (stock: Stock) => void;
  onOpenTomorrow: () => void;
}) {
  const [open, setOpen] = useState(false);

  const alertCount =
    watchAlertStocks.length +
    tomorrowWatchStocks.length +
    chipActiveStocks.length +
    mainContinueStocks.length +
    lowVolumeStrongStocks.length +
    safeWatchStocks.length;

  if (alertCount === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-slate-700 bg-slate-950 p-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <div className="text-sm font-black text-white">🔔 提醒中心</div>
          <div className="mt-1 text-xs font-bold text-slate-400">
            目前共有 {alertCount} 個提醒，點我{open ? "收起" : "展開"}。
          </div>
        </div>

        <div className="rounded-xl bg-red-500 px-3 py-1 text-sm font-black text-white">
          {alertCount}
        </div>
      </button>

      {!open && tomorrowWatchStocks.length > 0 && (
        <button
          onClick={onOpenTomorrow}
          className="mt-3 w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-black text-white"
        >
          📌 直接查看明日觀察清單
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-3">
          <NoticeBox
            title="🚨 自選股警報"
            text={`自選股中有 ${watchAlertStocks.length} 檔符合強勢提醒條件。`}
            stocks={watchAlertStocks}
            tone="red"
            onSelectStock={onSelectStock}
          />

          <NoticeBox
            title="📌 明日觀察"
            text={`有 ${tomorrowWatchStocks.length} 檔適合列入隔日觀察。`}
            stocks={tomorrowWatchStocks}
            tone="indigo"
            onSelectStock={onSelectStock}
          />

          <NoticeBox
            title="💎 籌碼活躍"
            text="換手率 3～10%，量比 > 1，流通市值 < 5 億。"
            stocks={chipActiveStocks}
            tone="cyan"
            onSelectStock={onSelectStock}
          />

          <NoticeBox
            title="🚀 主流續強"
            text="高開續強，而且屬於今日最強主流前 5 名產業。"
            stocks={mainContinueStocks}
            tone="green"
            onSelectStock={onSelectStock}
          />

          <NoticeBox
            title="🚨 低量強漲"
            text="漲幅 ≥ 5%，成交量低於 10,000 張。"
            stocks={lowVolumeStrongStocks}
            tone="yellow"
            onSelectStock={onSelectStock}
          />

          <NoticeBox
            title="🟢 安全觀察"
            text="漲幅未過熱、強度未過高，較適合等轉強或拉回觀察。"
            stocks={safeWatchStocks.slice(0, 5)}
            tone="emerald"
            onSelectStock={onSelectStock}
          />
        </div>
      )}
    </div>
  );
}

function ReviewBox({
  topIndustries,
  stocks,
  watchListStocks,
  onSelectStock,
}: {
  topIndustries: {
    industry: string;
    total: number;
    avgChange: number;
    strength: number;
    stocks: Stock[];
  }[];
  stocks: Stock[];
  watchListStocks: Stock[];
  onSelectStock: (stock: Stock) => void;
}) {
  if (!isAfterCloseReviewWindow()) return null;

  const topStock = [...stocks].sort((a, b) => b.changePercent - a.changePercent)[0];
  const bestWatch = [...watchListStocks].sort((a, b) => b.changePercent - a.changePercent)[0];
  const weakWatch = [...watchListStocks].sort((a, b) => a.changePercent - b.changePercent)[0];

  return (
    <div className="mb-3 rounded-2xl border border-indigo-500 bg-indigo-950/70 p-3 text-indigo-100">
      <div className="text-sm font-black">🌙 收盤後復盤提醒</div>
      <div className="mt-1 text-xs font-bold">
        整理今日最強產業、最強個股與自選股強弱，作為明天觀察方向。
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/30 p-3">
          <div className="text-xs font-bold text-indigo-200">今日最強產業</div>
          <div className="mt-1 text-lg font-black">
            {topIndustries[0]?.industry || "資料不足"}
          </div>
          <div className="mt-1 text-xs font-bold text-indigo-200">
            {topIndustries[0]
              ? `${topIndustries[0].total} 檔｜平均 +${topIndustries[0].avgChange}%`
              : "尚無產業資料"}
          </div>
        </div>

        <button
          onClick={() => topStock && onSelectStock(topStock)}
          className="rounded-xl bg-black/30 p-3 text-left"
        >
          <div className="text-xs font-bold text-indigo-200">今日最強個股</div>
          <div className="mt-1 text-lg font-black">
            {topStock ? topStock.name : "資料不足"}
          </div>
          <div className="mt-1 text-xs font-bold text-red-300">
            {topStock
              ? `+${topStock.changePercent.toFixed(2)}%｜${topStock.code}`
              : "尚無個股資料"}
          </div>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => bestWatch && onSelectStock(bestWatch)}
          className="rounded-xl bg-black/30 p-3 text-left"
        >
          <div className="text-xs font-bold text-indigo-200">自選最強</div>
          <div className="mt-1 text-base font-black">
            {bestWatch ? bestWatch.name : "資料不足"}
          </div>
          <div className="mt-1 text-xs font-bold text-red-300">
            {bestWatch
              ? `${bestWatch.changePercent >= 0 ? "+" : ""}${bestWatch.changePercent.toFixed(2)}%`
              : "尚無自選資料"}
          </div>
        </button>

        <button
          onClick={() => weakWatch && onSelectStock(weakWatch)}
          className="rounded-xl bg-black/30 p-3 text-left"
        >
          <div className="text-xs font-bold text-indigo-200">自選最弱</div>
          <div className="mt-1 text-base font-black">
            {weakWatch ? weakWatch.name : "資料不足"}
          </div>
          <div className="mt-1 text-xs font-bold text-slate-300">
            {weakWatch
              ? `${weakWatch.changePercent >= 0 ? "+" : ""}${weakWatch.changePercent.toFixed(2)}%`
              : "尚無自選資料"}
          </div>
        </button>
      </div>
    </div>
  );
}

function ObserveSummary({
  stock,
  strongIndustryNames,
}: {
  stock: Stock;
  strongIndustryNames: string[];
}) {
  const tags = getObserveTags(stock, strongIndustryNames);

  if (tags.length === 0) return null;

  return (
    <div className="mt-5 rounded-2xl border border-green-900 bg-green-950/40 p-4">
      <div className="mb-2 text-lg font-black text-green-100">今日觀察標籤</div>
      <AlertTags tags={tags} />
    </div>
  );
}

function BuyPointBox({ stock }: { stock: Stock }) {
  const buyPoint = getBuyPoint(stock);

  return (
    <div
      className={
        buyPoint.level === "avoid"
          ? "mt-5 rounded-2xl border border-red-900 bg-red-950/50 p-4 text-red-100"
          : buyPoint.level === "pullback"
            ? "mt-5 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-4 text-yellow-100"
            : buyPoint.level === "watch"
              ? "mt-5 rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-emerald-100"
              : "mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200"
      }
    >
      <div className="text-lg font-black">買點提醒</div>
      <div className="mt-2 text-2xl font-black">{buyPoint.title}</div>
      <div className="mt-2 text-sm font-bold">{buyPoint.text}</div>
      <div className="mt-3 rounded-xl bg-black/30 px-3 py-2 text-xs font-bold">
        原因：{buyPoint.reason}
      </div>
    </div>
  );
}

function ChipBox({ stock }: { stock: Stock }) {
  return (
    <div className="mt-5 rounded-2xl border border-cyan-900 bg-cyan-950/40 p-4">
      <div className="mb-3 text-lg font-black text-cyan-100">籌碼條件</div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
        <div className="rounded-xl bg-black/30 px-2 py-2">
          換手率
          <div className="mt-1 text-sm text-cyan-100">
            {numberText(stock.turnoverRate, "%")}
          </div>
        </div>

        <div className="rounded-xl bg-black/30 px-2 py-2">
          量比
          <div className="mt-1 text-sm text-cyan-100">
            {numberText(stock.volumeRatio)}
          </div>
        </div>

        <div className="rounded-xl bg-black/30 px-2 py-2">
          流通市值
          <div className="mt-1 text-sm text-cyan-100">
            {numberText(stock.floatMarketCapYi, "億")}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskBox({ stock }: { stock: Stock }) {
  const risk = getRisk(stock);

  return (
    <div
      className={
        risk.level === "high"
          ? "mt-5 rounded-2xl border border-red-900 bg-red-950/50 p-4 text-red-100"
          : risk.level === "medium"
            ? "mt-5 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-4 text-yellow-100"
            : "mt-5 rounded-2xl border border-green-900 bg-green-950/40 p-4 text-green-100"
      }
    >
      <div className="text-lg font-black">風險燈號</div>
      <div className="mt-2 text-2xl font-black">{risk.title}</div>
      <div className="mt-2 text-sm font-bold">{risk.text}</div>
    </div>
  );
}

function StockRow({
  stock,
  rank,
  onClick,
  compact = false,
  badge = "",
  alertTags = [],
  onRemove,
}: {
  stock: Stock;
  rank: number;
  onClick: () => void;
  compact?: boolean;
  badge?: string;
  alertTags?: string[];
  onRemove?: () => void;
}) {
  const status = stockStatus(stock);

  return (
    <div className="mb-2 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-black p-3">
      <button onClick={onClick} className="w-full text-left active:scale-[0.99]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-6 text-xl font-black text-red-500">{rank}</div>

            <div className="min-w-0">
              <div className="truncate text-lg font-black text-white">
                {stock.name}
                <span className="ml-2 text-xs text-slate-400">{stock.code}</span>
              </div>

              <div
                className={
                  compact
                    ? "mt-1 text-xl font-black text-white"
                    : "mt-1 text-2xl font-black text-white"
                }
              >
                {priceText(stock.price)}
              </div>

              <div className="mt-1 text-xs font-bold text-slate-500">
                {stock.industry}｜成交量 {volumeLots(stock.volume).toLocaleString()} 張
              </div>

              <AlertTags tags={alertTags} />
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </div>

            <MiniLine />

            <div
              className={
                status === "強勢"
                  ? "text-xs font-bold text-green-400"
                  : status === "突破"
                    ? "text-xs font-bold text-yellow-400"
                    : status === "安全觀察"
                      ? "text-xs font-bold text-emerald-400"
                      : status === "轉弱"
                        ? "text-xs font-bold text-slate-400"
                        : "text-xs font-bold text-orange-300"
              }
            >
              {status}
            </div>

            {badge && (
              <div
                className={
                  badge === "龍頭"
                    ? "mt-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white"
                    : badge === "跟漲"
                      ? "mt-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white"
                      : badge === "安全"
                        ? "mt-1 rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-black text-black"
                        : "mt-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs font-black text-slate-200"
                }
              >
                {badge}
              </div>
            )}
          </div>
        </div>
      </button>

      {onRemove && (
        <button
          onClick={onRemove}
          className="mt-3 w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-black text-slate-200"
        >
          從自選刪除
        </button>
      )}
    </div>
  );
}
function StockDetail({
  stock,
  onBack,
  isWatch,
  onToggleWatch,
  sameIndustryStocks,
  alertReasons,
  onSelectStock,
  strongIndustryNames,
}: {
  stock: Stock;
  onBack: () => void;
  isWatch: boolean;
  onToggleWatch: () => void;
  sameIndustryStocks: Stock[];
  alertReasons: string[];
  onSelectStock: (stock: Stock) => void;
  strongIndustryNames: string[];
}) {
  const status = stockStatus(stock);
  const links = getStockLinks(stock.code);
  const tradeAdvice = getTradeAdvice(stock);

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div
        className="mx-auto max-w-md px-4 pb-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 56px)" }}
      >
        <div
          className="sticky z-50 mb-4 flex items-center justify-between rounded-2xl bg-black/90 px-1 pb-3 backdrop-blur"
          style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
        >
          <button
            onClick={onBack}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
          >
            ← 返回
          </button>

          <button
            onClick={onToggleWatch}
            className={
              isWatch
                ? "rounded-xl bg-slate-800 px-4 py-2 text-sm font-black text-slate-200"
                : "rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white"
            }
          >
            {isWatch ? "移除自選" : "加入自選"}
          </button>
        </div>

        <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-black p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-black">{stock.name}</div>
              <div className="mt-1 text-slate-400">
                {stock.code}｜{stock.industry}
              </div>
            </div>

            <div className="rounded-xl bg-red-500 px-3 py-2 text-lg font-black">
              {stock.changePercent >= 0 ? "+" : ""}
              {stock.changePercent.toFixed(2)}%
            </div>
          </div>

          <div className="mt-6">
            <div className="text-sm font-bold text-slate-500">即時價</div>
            <div className="text-6xl font-black">{priceText(stock.price)}</div>
          </div>

          <div className="mt-3">
            <AlertTags tags={getAlertTags(stock, strongIndustryNames)} />
          </div>

          <BuyPointBox stock={stock} />
          <ObserveSummary stock={stock} strongIndustryNames={strongIndustryNames} />
          <RiskBox stock={stock} />
          <ChipBox stock={stock} />

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">成交量</div>
              <div className="mt-1 text-2xl font-black">
                {volumeLots(stock.volume).toLocaleString()} 張
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">強度</div>
              <div className="mt-1 text-2xl font-black text-red-400">
                {stockScore(stock)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">開盤溢價率</div>
              <div className="mt-1 text-2xl font-black">
                {percentText(stock.openPremiumPercent)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">狀態</div>
              <div
                className={
                  status === "強勢"
                    ? "mt-1 text-2xl font-black text-green-400"
                    : status === "突破"
                      ? "mt-1 text-2xl font-black text-yellow-400"
                      : status === "安全觀察"
                        ? "mt-1 text-2xl font-black text-emerald-400"
                        : status === "轉弱"
                          ? "mt-1 text-2xl font-black text-slate-400"
                          : "mt-1 text-2xl font-black text-orange-300"
                }
              >
                {status}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <a
              href={links.kline}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-slate-800 px-4 py-3 text-center text-sm font-black text-white"
            >
              看 K 線
            </a>

            <a
              href={links.yahoo}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl bg-red-500 px-4 py-3 text-center text-sm font-black text-white"
            >
              Yahoo 股價
            </a>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">操作提醒</div>
            <div className="space-y-2">
              {tradeAdvice.map((item) => (
                <div
                  key={item}
                  className="rounded-xl bg-black/40 px-3 py-2 text-sm font-bold text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">警報原因</div>
            <div className="space-y-2">
              {alertReasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-xl bg-black/40 px-3 py-2 text-sm font-bold text-slate-200"
                >
                  ✅ {reason}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-3 text-lg font-black">
              同產業強勢股｜{stock.industry}
            </div>

            {sameIndustryStocks.length === 0 ? (
              <div className="text-sm text-slate-400">
                目前沒有其他同產業強勢股
              </div>
            ) : (
              sameIndustryStocks.map((item, index) => (
                <button
                  key={item.code}
                  onClick={() => onSelectStock(item)}
                  className="mb-2 flex w-full items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-left active:scale-[0.99]"
                >
                  <div>
                    <div className="font-black">
                      {index + 1}. {item.name}{" "}
                      <span className="text-xs text-slate-400">{item.code}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      即時價 {priceText(item.price)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-black text-red-400">
                      {item.changePercent >= 0 ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      點我查看
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [watchListStocks, setWatchListStocks] = useState<Stock[]>([]);
  const [watchCodes, setWatchCodes] = useState<string[]>(defaultWatchCodes);
  const [newWatchCode, setNewWatchCode] = useState("");
  const [watchMessage, setWatchMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastSuccessAt, setLastSuccessAt] = useState("");
  const [lastFailAt, setLastFailAt] = useState("");
  const [lastFailReason, setLastFailReason] = useState("");
  const [nextRefresh, setNextRefresh] = useState(60);
  const [tab, setTab] = useState<TabKey>("top50");
  const [expandedIndustry, setExpandedIndustry] = useState<string>("");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("change");
  const [filterKey, setFilterKey] = useState<FilterKey>("all");
  const [mode, setMode] = useState<ModeKey>("normal");
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function loadStocks(codes = watchCodes, manual = false) {
    try {
      if (manual) setRefreshing(true);
      if (stocks.length === 0) setLoading(true);

      setError("");
      setLastFailReason("");

      const watchParam = codes.join(",");
      const res = await fetch(
        "/api/stocks?watch=" + encodeURIComponent(watchParam) + "&t=" + Date.now(),
        { cache: "no-store" }
      );

      if (!res.ok) throw new Error("台股 API 連線失敗");

      const data = await res.json();

      const rankedRaw = Array.isArray(data)
        ? data
        : Array.isArray(data.rankedStocks)
          ? data.rankedStocks
          : [];

      const watchRaw = Array.isArray(data.watchList) ? data.watchList : [];

      const rankedList: Stock[] = rankedRaw
        .map(normalizeStock)
        .filter((stock: Stock) => stock.code && stock.name && stock.price > 0)
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
        .slice(0, 50);

      const watchList: Stock[] = watchRaw
        .map(normalizeStock)
        .filter((stock: Stock) => stock.code && stock.name && stock.price > 0);

      if (rankedList.length === 0) {
        throw new Error("API 有回應，但沒有取得有效股票資料");
      }

      setStocks(rankedList);
      setWatchListStocks(watchList);
      setLastSuccessAt(formatTime(new Date()));
      setNextRefresh(60);
    } catch (err: any) {
      const message = err?.message || "資料載入失敗";
      setError(message);
      setLastFailAt(formatTime(new Date()));
      setLastFailReason(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function saveWatchCodes(codes: string[]) {
    const cleanCodes = Array.from(
      new Set(
        codes
          .map((code) => String(code).trim().replace(/\D/g, "").slice(0, 4))
          .filter((code) => /^\d{4}$/.test(code))
      )
    );

    setWatchCodes(cleanCodes);
    localStorage.setItem("watchCodes", JSON.stringify(cleanCodes));
    loadStocks(cleanCodes, true);
  }

  function addWatchCode() {
    const code = newWatchCode.trim().replace(/\D/g, "").slice(0, 4);

    if (!/^\d{4}$/.test(code)) {
      setWatchMessage("請輸入 4 碼股票代號");
      return;
    }

    if (watchCodes.includes(code)) {
      setWatchMessage(`${code} 已經在自選股`);
      setNewWatchCode("");
      return;
    }

    saveWatchCodes([...watchCodes, code]);
    setNewWatchCode("");
    setWatchMessage(`${code} 已加入自選`);
    setTab("watch");
  }

  function removeWatchCode(code: string) {
    saveWatchCodes(watchCodes.filter((item) => item !== code));
    setWatchMessage(`${code} 已從自選刪除`);
  }

  function toggleSelectedStockWatch(stock: Stock) {
    if (watchCodes.includes(stock.code)) {
      removeWatchCode(stock.code);
    } else {
      saveWatchCodes([...watchCodes, stock.code]);
      setWatchMessage(`${stock.code} 已加入自選`);
    }
  }

  function applyOpenMode() {
    setMode("open");
    setTab("alert");
    setFilterKey("alert");
    setSortKey("score");
    setSearchText("");
  }

  function applyNineTenMode() {
    setMode("open");
    setTab("top50");
    setFilterKey("breakout");
    setSortKey("score");
    setSearchText("");
    setShowAdvanced(true);
  }

  function applyStrong910Mode() {
    setMode("strong910");
    setTab("observe");
    setFilterKey("mainContinue");
    setSortKey("openPremium");
    setSearchText("");
    setShowAdvanced(true);
  }

  function applyTomorrowMode() {
    setMode("tomorrow");
    setTab("tomorrow");
    setFilterKey("tomorrowWatch");
    setSortKey("score");
    setSearchText("");
    setShowAdvanced(true);
  }

  function applyNormalMode() {
    setMode("normal");
    setTab("top50");
    setFilterKey("all");
    setSortKey("change");
    setSearchText("");
  }

  useEffect(() => {
    const savedCodes = loadSavedWatchCodes();
    setWatchCodes(savedCodes);
    loadStocks(savedCodes);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setNextRefresh((prev) => {
        if (prev <= 1) {
          loadStocks(watchCodes);
          return 60;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [watchCodes]);

  const marketStatus = getMarketStatus();
  const dataCheck = getDataCheckStatus(stocks, watchListStocks, lastSuccessAt);
  const sortedStocks = useMemo(() => sortStocks(stocks, sortKey), [stocks, sortKey]);
  const sortedWatchListStocks = useMemo(() => sortStocks(watchListStocks, sortKey), [watchListStocks, sortKey]);
  const industryGroups = useMemo(() => buildIndustryGroups(sortedStocks, sortKey), [sortedStocks, sortKey]);
  const mainIndustryGroups = useMemo(() => industryGroups.filter((group) => group.industry !== "其他"), [industryGroups]);
  const topIndustries = mainIndustryGroups.slice(0, 5);
  const topIndustryNames = topIndustries.map((group) => group.industry);

  const observeStocks = useMemo(() => buildObserveStocks(stocks, topIndustryNames), [stocks, topIndustryNames]);

  const tomorrowWatchStocks = useMemo(() => {
    const map = new Map<string, Stock>();

    stocks.forEach((stock) => {
      if (isTomorrowWatchStock(stock, topIndustryNames)) {
        map.set(stock.code, stock);
      }
    });

    watchListStocks.forEach((stock) => {
      const openPremium = stock.openPremiumPercent ?? 0;
      const score = stockScore(stock);
      const isUsable =
        stock.changePercent >= 0 &&
        stock.changePercent < 7 &&
        score < 90 &&
        openPremium < 5;

      if (isUsable) map.set(stock.code, stock);
    });

    return sortStocks(Array.from(map.values()), "score");
  }, [stocks, watchListStocks, topIndustryNames]);

  const mainContinueStocks = useMemo(() => {
    return sortStocks(stocks.filter((stock) => isMainContinue(stock, topIndustryNames)), "openPremium");
  }, [stocks, topIndustryNames]);

  const lowVolumeStrongStocks = useMemo(() => {
    return sortStocks(stocks.filter(isLowVolumeStrongStock), "score");
  }, [stocks]);

  const chipActiveStocks = useMemo(() => {
    return sortStocks(stocks.filter(isChipActive), "score");
  }, [stocks]);

  const safeWatchStocks = useMemo(() => {
    return sortStocks(stocks.filter(isSafeWatch), "score");
  }, [stocks]);

  const watchAlertStocks = useMemo(() => {
    return sortStocks(watchListStocks.filter(isWatchAlertStock), "score");
  }, [watchListStocks]);

  const alertStocks = sortStocks(stocks.filter(isAlertStock), sortKey);
  const breakoutStocks = sortStocks(stocks.filter((stock) => stock.changePercent >= 5), sortKey);

  const tabStocks = useMemo(() => {
    if (tab === "top50") return sortedStocks;
    if (tab === "watch") return sortedWatchListStocks;
    if (tab === "observe") return sortStocks(observeStocks, sortKey);
    if (tab === "tomorrow") return tomorrowWatchStocks;
    if (tab === "breakout") return breakoutStocks;
    if (tab === "alert") return alertStocks;
    return sortedStocks;
  }, [tab, sortedStocks, sortedWatchListStocks, observeStocks, tomorrowWatchStocks, breakoutStocks, alertStocks, sortKey]);

  const filteredTabStocks = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    const filtered = filterByQuick(tabStocks, filterKey, topIndustryNames);

    if (!keyword) return filtered;

    return filtered.filter((stock) => {
      return (
        stock.code.toLowerCase().includes(keyword) ||
        stock.name.toLowerCase().includes(keyword) ||
        stock.industry.toLowerCase().includes(keyword)
      );
    });
  }, [tabStocks, searchText, filterKey, topIndustryNames]);

  const filteredIndustryGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return mainIndustryGroups
      .map((group) => {
        const filteredStocks = filterByQuick(group.stocks, filterKey, topIndustryNames);
        const matchIndustry = group.industry.toLowerCase().includes(keyword);

        if (!keyword) {
          return {
            ...group,
            stocks: filteredStocks,
            total: filteredStocks.length,
          };
        }

        const searchedStocks = filteredStocks.filter((stock) => {
          return (
            stock.code.toLowerCase().includes(keyword) ||
            stock.name.toLowerCase().includes(keyword) ||
            stock.industry.toLowerCase().includes(keyword)
          );
        });

        return {
          ...group,
          stocks: matchIndustry ? filteredStocks : searchedStocks,
          total: matchIndustry ? filteredStocks.length : searchedStocks.length,
        };
      })
      .filter((group) => group.stocks.length > 0);
  }, [mainIndustryGroups, searchText, filterKey, topIndustryNames]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "top50", label: "50強", icon: "📊" },
    { key: "observe", label: "觀察", icon: "👁️" },
    { key: "watch", label: "自選", icon: "☆" },
    { key: "industry", label: "產業", icon: "▮" },
    { key: "alert", label: "警報", icon: "🔔" },
  ];

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: "change", label: "漲幅" },
    { key: "volume", label: "成交量" },
    { key: "score", label: "強度" },
    { key: "openPremium", label: "開盤溢價" },
  ];

  const filterButtons: { key: FilterKey; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "strong", label: "強勢" },
    { key: "breakout", label: "突破" },
    { key: "alert", label: "警報" },
    { key: "lowVolume", label: "低量" },
    { key: "openStrong", label: "開盤強" },
    { key: "highOpenContinue", label: "高開續強" },
    { key: "mainContinue", label: "主流續強" },
    { key: "chipActive", label: "籌碼活躍" },
    { key: "safeWatch", label: "安全觀察" },
    { key: "tomorrowWatch", label: "明日觀察" },
  ];

  if (selectedStock) {
    const sameIndustryStocks = sortStocks(
      stocks.filter(
        (stock) =>
          stock.industry === selectedStock.industry &&
          stock.code !== selectedStock.code
      ),
      sortKey
    ).slice(0, 5);

    return (
      <StockDetail
        stock={selectedStock}
        onBack={() => setSelectedStock(null)}
        isWatch={watchCodes.includes(selectedStock.code)}
        onToggleWatch={() => toggleSelectedStockWatch(selectedStock)}
        sameIndustryStocks={sameIndustryStocks}
        alertReasons={getAlertReasons(selectedStock, topIndustryNames)}
        onSelectStock={setSelectedStock}
        strongIndustryNames={topIndustryNames}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div
        className="mx-auto max-w-md px-3 pb-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <div className={`mb-3 rounded-2xl border p-3 ${marketStatus.color}`}>
          <div className="text-sm font-black">{marketStatus.title}</div>
          <div className="mt-1 text-xs font-bold">{marketStatus.text}</div>
        </div>

        {isNineTenWindow() && (
          <div className="mb-3 rounded-2xl border border-orange-500 bg-orange-950/70 p-3 text-orange-100">
            <div className="text-sm font-black">⏰ 9:10 開盤快篩時間</div>
            <div className="mt-1 text-xs font-bold">
              建議先看「9:10快篩」與「9:10最強」。
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={applyNineTenMode}
                className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white"
              >
                開啟 9:10快篩
              </button>

              <button
                onClick={applyStrong910Mode}
                className="rounded-xl bg-green-500 px-3 py-2 text-xs font-black text-black"
              >
                開啟 9:10最強
              </button>
            </div>
          </div>
        )}

        <ReviewBox
          topIndustries={topIndustries}
          stocks={stocks}
          watchListStocks={watchListStocks}
          onSelectStock={setSelectedStock}
        />

        <AlertCenter
          watchAlertStocks={watchAlertStocks}
          tomorrowWatchStocks={tomorrowWatchStocks}
          chipActiveStocks={chipActiveStocks}
          mainContinueStocks={mainContinueStocks}
          lowVolumeStrongStocks={lowVolumeStrongStocks}
          safeWatchStocks={safeWatchStocks}
          onSelectStock={setSelectedStock}
          onOpenTomorrow={applyTomorrowMode}
        />

        <header className="mb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black tracking-wide">台股即時雷達</h1>
              <div className="mt-1 text-xs font-bold text-slate-400">
                最後成功更新：{lastSuccessAt || "尚未成功"}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                自動更新倒數：{nextRefresh}s
              </div>
            </div>

            <button
              onClick={() => loadStocks(watchCodes, true)}
              disabled={refreshing}
              className={
                refreshing
                  ? "rounded-xl bg-slate-700 px-4 py-3 text-sm font-black text-slate-300"
                  : "rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white"
              }
            >
              {refreshing ? "更新中" : "立即更新"}
            </button>
          </div>
        </header>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            onClick={applyTomorrowMode}
            className={
              mode === "tomorrow"
                ? "rounded-xl bg-indigo-500 px-3 py-2 text-sm font-black text-white"
                : "rounded-xl bg-indigo-950 px-3 py-2 text-sm font-black text-indigo-100"
            }
          >
            📌 明日觀察
          </button>

          <button
            onClick={applyNormalMode}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-slate-300"
          >
            回到盤中模式
          </button>
        </div>

        <div
          className={
            dataCheck.isGood
              ? "mb-3 rounded-2xl border border-green-900 bg-green-950/40 p-3 text-green-100"
              : "mb-3 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-3 text-yellow-100"
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black">{dataCheck.title}</div>
              <div className="mt-1 text-xs font-bold">{dataCheck.text}</div>
            </div>

            <div className="text-right text-xs font-black">
              {dataCheck.okCount}/5
            </div>
          </div>

          {lastFailReason && (
            <div className="mt-2 rounded-xl bg-black/30 px-3 py-2 text-xs font-bold">
              最近一次更新失敗：{lastFailAt}｜{lastFailReason}
            </div>
          )}
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <button
            onClick={applyOpenMode}
            className={
              mode === "open" && tab === "alert"
                ? "rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
            }
          >
            開盤模式
          </button>

          <button
            onClick={applyNineTenMode}
            className={
              mode === "open" && tab === "top50" && filterKey === "breakout"
                ? "rounded-xl bg-orange-500 px-3 py-2 text-sm font-black text-white"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
            }
          >
            9:10快篩
          </button>

          <button
            onClick={applyStrong910Mode}
            className={
              mode === "strong910"
                ? "rounded-xl bg-green-500 px-3 py-2 text-sm font-black text-black"
                : "rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
            }
          >
            9:10最強
          </button>
        </div>

        {tab === "watch" && (
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-2 text-sm font-black text-white">自選股管理</div>

            <div className="flex gap-2">
              <input
                value={newWatchCode}
                onChange={(event) => setNewWatchCode(event.target.value)}
                inputMode="numeric"
                maxLength={4}
                placeholder="輸入股票代號，例如 2330"
                className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
              />

              <button
                onClick={addWatchCode}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white"
              >
                加入
              </button>
            </div>

            {watchMessage && (
              <div className="mt-2 text-xs font-bold text-emerald-300">
                {watchMessage}
              </div>
            )}

            <div className="mt-2 text-xs font-bold text-slate-500">
              自選股會存在手機瀏覽器，下次打開仍會保留。
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="flex gap-2">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="搜尋代號 / 名稱 / 產業"
              className="min-w-0 flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
            />

            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="rounded-xl bg-slate-800 px-3 text-xs font-black text-slate-300"
              >
                清除
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mb-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-black text-slate-200"
        >
          {showAdvanced ? "收起進階篩選 ▲" : "展開進階篩選 ▼"}
        </button>

        {showAdvanced && (
          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="mb-2 text-xs font-black text-slate-400">排序方式</div>

            <div className="mb-3 flex gap-2 overflow-x-auto">
              {sortButtons.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSortKey(item.key)}
                  className={
                    sortKey === item.key
                      ? "whitespace-nowrap rounded-xl bg-red-500 px-3 py-2 text-xs font-black text-white"
                      : "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300"
                  }
                >
                  {item.label}排序
                </button>
              ))}
            </div>

            <div className="mb-2 text-xs font-black text-slate-400">快速篩選</div>

            <div className="grid grid-cols-4 gap-2">
              {filterButtons.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilterKey(item.key)}
                  className={
                    filterKey === item.key
                      ? "rounded-xl bg-orange-500 px-2 py-2 text-xs font-black text-white"
                      : "rounded-xl bg-slate-900 px-2 py-2 text-xs font-bold text-slate-300"
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {filterKey === "tomorrowWatch" && (
          <div className="mb-3 rounded-2xl border border-indigo-900 bg-indigo-950/40 p-3 text-sm font-bold text-indigo-100">
            明日觀察：排除過熱股，優先看主流產業、安全觀察、籌碼活躍。
          </div>
        )}

        {loading && (
          <div className="mb-3 rounded-2xl bg-slate-900 p-3 text-center">
            資料載入中...
          </div>
        )}

        {error && stocks.length === 0 && (
          <div className="mb-3 rounded-2xl bg-red-950 p-3 text-sm font-bold text-red-200">
            錯誤：{error}
          </div>
        )}

        <div className="mb-3 flex gap-2 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setMode("normal");
                setTab(item.key);
                setFilterKey("all");
              }}
              className={
                tab === item.key
                  ? "whitespace-nowrap rounded-xl bg-red-500 px-3 py-2 text-sm font-black text-white"
                  : "whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-slate-300"
              }
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "industry" ? (
          <section>
            <h2 className="mb-3 text-lg font-black">
              產業排行 TOP 10
              {(searchText || filterKey !== "all") && (
                <span className="ml-2 text-xs text-slate-400">
                  / 結果 {filteredIndustryGroups.length} 類
                </span>
              )}
            </h2>

            {filteredIndustryGroups.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                目前沒有符合條件的產業或股票
              </div>
            ) : (
              filteredIndustryGroups.slice(0, 10).map((group, index) => {
                const isOpen =
                  expandedIndustry === group.industry ||
                  Boolean(searchText) ||
                  filterKey !== "all";

                return (
                  <div
                    key={group.industry}
                    className="mb-2 rounded-2xl border border-slate-800 bg-slate-900 p-3"
                  >
                    <button
                      onClick={() =>
                        setExpandedIndustry(
                          isOpen && !searchText && filterKey === "all"
                            ? ""
                            : group.industry
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-2xl font-black text-white">
                            {index + 1}. {group.industry}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            平均 +{group.avgChange}%｜強度 {group.strength}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-2xl font-black text-red-400">
                            {group.total}
                          </div>
                          <div className="text-xs text-slate-400">
                            檔 {isOpen ? "▲" : "▼"}
                          </div>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-3 rounded-2xl bg-black/40 p-2">
                        {group.stocks.map((stock, stockIndex) => (
                          <StockRow
                            key={stock.code}
                            stock={stock}
                            rank={stockIndex + 1}
                            compact
                            badge={getIndustryRole(stock, group.stocks)}
                            alertTags={getAlertTags(stock, topIndustryNames)}
                            onClick={() => setSelectedStock(stock)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        ) : (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-black">
                {tab === "top50" && "漲幅排行 TOP 50"}
                {tab === "watch" && "自選股"}
                {tab === "observe" && "今日觀察清單"}
                {tab === "tomorrow" && "📌 明日觀察清單"}
                {tab === "breakout" && "突破股"}
                {tab === "alert" && "警報股"}
              </h2>

              <span className="text-xs font-bold text-slate-400">
                {tab === "top50"
                  ? `${filteredTabStocks.length} / 50`
                  : `${filteredTabStocks.length} 檔`}
              </span>
            </div>

            {filteredTabStocks.length === 0 ? (
              <div className="rounded-2xl bg-slate-900 p-4 text-slate-400">
                目前沒有符合條件的股票
              </div>
            ) : (
              filteredTabStocks.slice(0, 50).map((stock, index) => (
                <StockRow
                  key={stock.code}
                  stock={stock}
                  rank={index + 1}
                  compact={tab !== "top50"}
                  alertTags={
                    tab === "observe" || tab === "tomorrow"
                      ? getObserveTags(stock, topIndustryNames)
                      : getAlertTags(stock, topIndustryNames)
                  }
                  onClick={() => setSelectedStock(stock)}
                  onRemove={
                    tab === "watch"
                      ? () => removeWatchCode(stock.code)
                      : undefined
                  }
                />
              ))
            )}
          </section>
        )}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black/95 px-2 pt-2 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSelectedStock(null);
                setMode("normal");
                setTab(item.key);
                setFilterKey("all");
              }}
              className={
                tab === item.key
                  ? "rounded-xl px-1 py-2 text-xs font-black text-red-500"
                  : "rounded-xl px-1 py-2 text-xs font-bold text-slate-400"
              }
            >
              <div className="text-xl">{item.icon}</div>
              <div>{item.label}</div>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
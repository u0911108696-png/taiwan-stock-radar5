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
};

type TabKey = "top50" | "watch" | "industry" | "breakout" | "alert";
type SortKey = "change" | "volume" | "score" | "openPremium";
type FilterKey =
  | "all"
  | "strong"
  | "breakout"
  | "alert"
  | "lowVolume"
  | "openStrong"
  | "highOpenContinue"
  | "mainContinue";
type ModeKey = "open" | "normal" | "strong910";

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
    text: "目前可能是今日收盤或最近一次交易資料。",
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
    industry: getIndustry(code),
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

  return Math.max(0, Math.min(99, score));
}

function stockStatus(stock: Stock) {
  if (stock.changePercent >= 9.8) return "強勢";
  if (stock.changePercent >= 5) return "突破";
  if (stock.changePercent >= 0) return "觀察";
  return "轉弱";
}

function isAlertStock(stock: Stock) {
  return (
    stock.changePercent >= 7 ||
    stockScore(stock) >= 85 ||
    volumeLots(stock.volume) >= 10000
  );
}

function isLowVolumeStrongStock(stock: Stock) {
  return stock.changePercent >= 5 && volumeLots(stock.volume) < 10000;
}

function getIndustryRole(stock: Stock, groupStocks: Stock[]) {
  if (groupStocks.length === 0) return "";

  const leader = [...groupStocks].sort((a, b) => b.changePercent - a.changePercent)[0];

  if (stock.code === leader.code) return "龍頭";
  if (stock.changePercent >= 5) return "跟漲";
  return "觀察";
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

  if (volumeLots(stock.volume) >= 10000) tags.push("爆量");
  else if (volumeLots(stock.volume) >= 3000) tags.push("放量");

  if (isLowVolumeStrongStock(stock)) tags.push("低量強漲");
  if (stockScore(stock) >= 85) tags.push("強度高");
  if (strongIndustryNames.includes(stock.industry)) tags.push("主流產業");

  return Array.from(new Set(tags)).slice(0, 5);
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

  if (filterKey === "openStrong") {
    return list.filter((s) => {
      return s.openPremiumPercent !== null && s.openPremiumPercent >= 3;
    });
  }

  if (filterKey === "highOpenContinue") {
    return list.filter(isHighOpenContinue);
  }

  if (filterKey === "mainContinue") {
    return list.filter((s) => isMainContinue(s, strongIndustryNames));
  }

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

function getDataCheckStatus(
  stocks: Stock[],
  watchListStocks: Stock[],
  lastSuccessAt: string
) {
  const hasRanking = stocks.length > 0;
  const hasWatchList = watchListStocks.length > 0;
  const hasPrice = stocks.some((stock) => stock.price > 0);
  const hasVolume = stocks.some((stock) => stock.volume > 0);
  const hasUpdated = Boolean(lastSuccessAt);

  const okCount = [
    hasRanking,
    hasWatchList,
    hasPrice,
    hasVolume,
    hasUpdated,
  ].filter(Boolean).length;

  const isGood = okCount >= 4;

  return {
    isGood,
    okCount,
    title: isGood ? "✅ 資料檢查正常" : "⚠️ 資料可能異常",
    text: isGood
      ? "漲幅排行、自選股、股價與成交量都有取得。"
      : "部分資料可能沒有成功取得，請按立即更新或稍後再試。",
    items: [
      { label: "漲幅排行", ok: hasRanking, value: `${stocks.length} 檔` },
      { label: "自選股", ok: hasWatchList, value: `${watchListStocks.length} 檔` },
      { label: "股票價格", ok: hasPrice, value: hasPrice ? "有取得" : "未取得" },
      { label: "成交量", ok: hasVolume, value: hasVolume ? "有取得" : "未取得" },
      { label: "最後成功更新", ok: hasUpdated, value: lastSuccessAt || "尚未成功" },
    ],
  };
}
function getTradeAdvice(stock: Stock) {
  const advice: string[] = [];

  if (isMainContinue(stock, [])) {
    advice.push("🚀 主流續強：高開續強，且屬於今日最強主流產業");
  } else if (isHighOpenContinue(stock)) {
    advice.push("🚀 高開續強：開盤溢價率超過 3%，目前漲幅也超過 5%");
  } else if (stock.openPremiumPercent !== null) {
    if (stock.openPremiumPercent >= 5) {
      advice.push("🚀 開盤高溢價：開盤就強，但也要小心追高風險");
    } else if (stock.openPremiumPercent >= 3) {
      advice.push("✅ 開盤偏強：開盤溢價率超過 3%，早盤買盤較積極");
    } else if (stock.openPremiumPercent <= -3) {
      advice.push("⚠️ 開盤偏弱：開盤溢價率低於 -3%，先觀察是否轉強");
    }
  } else {
    advice.push("ℹ️ 開盤溢價率：目前資料不足，可能 API 未提供開盤價或昨收價");
  }

  if (stock.changePercent >= 9.8) {
    advice.push("🔥 強勢追蹤：漲幅接近漲停，屬於今日強勢股");
    advice.push("⚠️ 注意風險：漲幅已高，避免盲目追高");
  } else if (stock.changePercent >= 7) {
    advice.push("🚨 警報股：漲幅超過 7%，短線動能強");
  } else if (stock.changePercent >= 5) {
    advice.push("⚡ 突破股：漲幅超過 5%，可列入觀察");
  } else if (stock.changePercent >= 0) {
    advice.push("🟡 觀察股：目前沒有明顯轉弱");
  } else {
    advice.push("🔴 轉弱股：目前漲幅為負，先保守觀察");
  }

  if (isLowVolumeStrongStock(stock)) {
    advice.push("🚨 低量強漲：漲幅超過 5%，但成交量低於 10,000 張");
  }

  if (volumeLots(stock.volume) < 300) {
    advice.push("⚠️ 成交量偏低：流動性較差，進出要小心");
  }

  if (stockScore(stock) >= 85) {
    advice.push("✅ 強度高：符合警報條件，可優先追蹤");
  }

  return advice;
}

function getAlertReasons(stock: Stock, strongIndustryNames: string[]) {
  const reasons: string[] = [];

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

  if (isLowVolumeStrongStock(stock)) {
    reasons.push("低量強漲：漲幅超過 5%，成交量低於 10,000 張");
  }

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
            tag === "漲停附近" || tag === "急漲"
              ? "rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white"
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

function MainContinueNotice({
  stocks,
  onClose,
  onSelectStock,
}: {
  stocks: Stock[];
  onClose: () => void;
  onSelectStock: (stock: Stock) => void;
}) {
  if (stocks.length === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-green-500 bg-green-950/80 p-3 text-green-100 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black">🚀 主流續強提醒</div>
          <div className="mt-1 text-xs font-bold">
            高開續強，而且屬於今日最強主流前 5 名產業。可點股票查看個股資料。
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg bg-black/40 px-2 py-1 text-xs font-black text-green-100"
        >
          關閉
        </button>
      </div>

      <div className="space-y-2">
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
              <div className="mt-1 text-xs font-bold text-green-100">
                主流產業：{stock.industry}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-300">
                開盤溢價 {percentText(stock.openPremiumPercent)}
              </div>
            </div>

            <div className="text-right">
              <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
                +{stock.changePercent.toFixed(2)}%
              </div>
              <div className="mt-1 text-xs font-bold text-green-100">
                點我查看
              </div>
            </div>
          </button>
        ))}
      </div>

      {stocks.length > 3 && (
        <div className="mt-2 text-xs font-bold text-green-200">
          還有 {stocks.length - 3} 檔主流續強，可到「9:10最強」或「主流續強」查看。
        </div>
      )}
    </div>
  );
}

function LowVolumeStrongNotice({
  stocks,
  onClose,
  onSelectStock,
}: {
  stocks: Stock[];
  onClose: () => void;
  onSelectStock: (stock: Stock) => void;
}) {
  if (stocks.length === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-yellow-500 bg-yellow-950/80 p-3 text-yellow-100 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black">🚨 低量強漲提醒</div>
          <div className="mt-1 text-xs font-bold">
            漲幅 ≥ 5%，成交量低於 10,000 張。可點股票查看個股資料。
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg bg-black/40 px-2 py-1 text-xs font-black text-yellow-100"
        >
          關閉
        </button>
      </div>

      <div className="space-y-2">
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
              <div className="mt-1 text-xs font-bold text-yellow-100">
                {stock.industry}｜成交量 {volumeLots(stock.volume).toLocaleString()} 張
              </div>
            </div>

            <div className="text-right">
              <div className="rounded-lg bg-red-500 px-2 py-1 text-sm font-black text-white">
                +{stock.changePercent.toFixed(2)}%
              </div>
              <div className="mt-1 text-xs font-bold text-yellow-100">
                點我查看
              </div>
            </div>
          </button>
        ))}
      </div>

      {stocks.length > 3 && (
        <div className="mt-2 text-xs font-bold text-yellow-200">
          還有 {stocks.length - 3} 檔符合條件，可到「突破」或「9:10快篩」查看。
        </div>
      )}
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
}: {
  stock: Stock;
  rank: number;
  onClick: () => void;
  compact?: boolean;
  badge?: string;
  alertTags?: string[];
}) {
  const status = stockStatus(stock);

  return (
    <button
      onClick={onClick}
      className="mb-2 w-full rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-black p-3 text-left active:scale-[0.99]"
    >
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
                    : "mt-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs font-black text-slate-200"
              }
            >
              {badge}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
function StockDetail({
  stock,
  onBack,
  isWatch,
  onToggleWatch,
  sameIndustryStocks,
  alertReasons,
  dataCheck,
  lastSuccessAt,
  lastFailReason,
  lastFailAt,
  onSelectStock,
}: {
  stock: Stock;
  onBack: () => void;
  isWatch: boolean;
  onToggleWatch: () => void;
  sameIndustryStocks: Stock[];
  alertReasons: string[];
  dataCheck: any;
  lastSuccessAt: string;
  lastFailReason: string;
  lastFailAt: string;
  onSelectStock: (stock: Stock) => void;
}) {
  const status = stockStatus(stock);
  const links = getStockLinks(stock.code);
  const tradeAdvice = getTradeAdvice(stock);

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
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

        <div
          className={
            dataCheck.isGood
              ? "mb-4 rounded-2xl border border-green-900 bg-green-950/40 p-3 text-green-100"
              : "mb-4 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-3 text-yellow-100"
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-black">
                {dataCheck.isGood ? "✅ 個股資料狀態正常" : "⚠️ 個股資料可能異常"}
              </div>
              <div className="mt-1 text-xs font-bold">
                使用最後成功更新資料：{lastSuccessAt || "尚未成功"}
              </div>
            </div>

            <div className="text-xs font-black">{dataCheck.okCount}/5</div>
          </div>

          {lastFailReason && (
            <div className="mt-2 rounded-xl bg-black/30 px-3 py-2 text-xs font-bold text-yellow-100">
              ⚠️ 最近一次更新失敗，仍顯示上一次成功資料。
              <br />
              失敗時間：{lastFailAt}｜原因：{lastFailReason}
            </div>
          )}
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
            <AlertTags tags={getAlertTags(stock, [])} />
          </div>

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
              <div className="text-sm text-slate-400">狀態</div>
              <div
                className={
                  status === "強勢"
                    ? "mt-1 text-2xl font-black text-green-400"
                    : status === "突破"
                      ? "mt-1 text-2xl font-black text-yellow-400"
                      : status === "轉弱"
                        ? "mt-1 text-2xl font-black text-slate-400"
                        : "mt-1 text-2xl font-black text-orange-300"
                }
              >
                {status}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">自選</div>
              <div className="mt-1 text-2xl font-black">
                {isWatch ? "已加入" : "未加入"}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">開盤溢價率</div>
              <div
                className={
                  stock.openPremiumPercent === null
                    ? "mt-1 text-xl font-black text-slate-400"
                    : stock.openPremiumPercent >= 3
                      ? "mt-1 text-2xl font-black text-red-400"
                      : stock.openPremiumPercent < 0
                        ? "mt-1 text-2xl font-black text-green-400"
                        : "mt-1 text-2xl font-black text-white"
                }
              >
                {percentText(stock.openPremiumPercent)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900 p-4">
              <div className="text-sm text-slate-400">開盤價 / 昨收</div>
              <div className="mt-1 text-xl font-black">
                {priceText(stock.openPrice)}
              </div>
              <div className="mt-1 text-xs font-bold text-slate-500">
                昨收 {priceText(stock.previousClose)}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-900 p-4">
            <div className="mb-2 text-lg font-black">開盤溢價率說明</div>
            <div className="text-sm font-bold text-slate-300">
              公式：（開盤價 - 昨收價）÷ 昨收價 × 100%
            </div>
            <div className="mt-2 text-xs font-bold text-slate-500">
              可用來判斷開盤是否高開、低開，以及早盤追高風險。
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
                      +{item.changePercent.toFixed(2)}%
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
  const [dismissedLowVolumeCodes, setDismissedLowVolumeCodes] = useState<string[]>([]);
  const [dismissedMainContinueCodes, setDismissedMainContinueCodes] = useState<string[]>([]);

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
        .filter((stock: Stock) => {
          return stock.code && stock.name && Number.isFinite(stock.price) && stock.price > 0;
        })
        .sort((a: Stock, b: Stock) => b.changePercent - a.changePercent)
        .slice(0, 50);

      const watchList: Stock[] = watchRaw
        .map(normalizeStock)
        .filter((stock: Stock) => {
          return stock.code && stock.name && Number.isFinite(stock.price) && stock.price > 0;
        });

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
          .map((code) => String(code).trim())
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
      setError("請輸入 4 碼股票代號，例如 2330");
      return;
    }

    if (watchCodes.includes(code)) {
      setError(code + " 已經在自選名單");
      return;
    }

    setNewWatchCode("");
    setError("");
    saveWatchCodes([...watchCodes, code]);
  }

  function removeWatchCode(code: string) {
    const nextCodes = watchCodes.filter((item) => item !== code);
    saveWatchCodes(nextCodes.length > 0 ? nextCodes : defaultWatchCodes);
  }

  function toggleSelectedStockWatch(stock: Stock) {
    if (watchCodes.includes(stock.code)) {
      removeWatchCode(stock.code);
    } else {
      saveWatchCodes([...watchCodes, stock.code]);
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
    setTab("top50");
    setFilterKey("mainContinue");
    setSortKey("openPremium");
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

  function filterStocksBySearch(list: Stock[]) {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) return list;

    return list.filter((stock) => {
      return (
        stock.code.toLowerCase().includes(keyword) ||
        stock.name.toLowerCase().includes(keyword) ||
        stock.industry.toLowerCase().includes(keyword)
      );
    });
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

  const mainContinueStocks = useMemo(() => {
    return sortStocks(
      stocks.filter((stock) => {
        return isMainContinue(stock, topIndustryNames) && !dismissedMainContinueCodes.includes(stock.code);
      }),
      "openPremium"
    );
  }, [stocks, topIndustryNames, dismissedMainContinueCodes]);

  const lowVolumeStrongStocks = useMemo(() => {
    return sortStocks(
      stocks.filter((stock) => {
        return isLowVolumeStrongStock(stock) && !dismissedLowVolumeCodes.includes(stock.code);
      }),
      "score"
    );
  }, [stocks, dismissedLowVolumeCodes]);

  const alertStocks = sortStocks(stocks.filter(isAlertStock), sortKey);
  const breakoutStocks = sortStocks(stocks.filter((stock) => stock.changePercent >= 5), sortKey);

  const tabStocks = useMemo(() => {
    if (tab === "top50") return sortedStocks;
    if (tab === "watch") return sortedWatchListStocks;
    if (tab === "breakout") return breakoutStocks;
    if (tab === "alert") return alertStocks;
    return sortedStocks;
  }, [tab, sortedStocks, sortedWatchListStocks, breakoutStocks, alertStocks]);

  const filteredTabStocks = useMemo(() => {
    return filterStocksBySearch(filterByQuick(tabStocks, filterKey, topIndustryNames));
  }, [tabStocks, searchText, filterKey, topIndustryNames]);

  const filteredIndustryGroups = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    const groups = mainIndustryGroups.map((group) => {
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
    });

    return groups.filter((group) => {
      if (keyword && group.industry.toLowerCase().includes(keyword)) return true;
      return group.stocks.length > 0;
    });
  }, [mainIndustryGroups, searchText, filterKey, topIndustryNames]);

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "top50", label: "50強", icon: "📊" },
    { key: "watch", label: "自選", icon: "☆" },
    { key: "industry", label: "產業", icon: "▮" },
    { key: "breakout", label: "突破", icon: "⚡" },
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
  ];

  if (selectedStock) {
    const sameIndustryStocks = sortStocks(
      stocks.filter((stock) => stock.industry === selectedStock.industry && stock.code !== selectedStock.code),
      sortKey
    ).slice(0, 5);

    const alertReasons = getAlertReasons(selectedStock, topIndustryNames);

    return (
      <StockDetail
        stock={selectedStock}
        onBack={() => setSelectedStock(null)}
        isWatch={watchCodes.includes(selectedStock.code)}
        onToggleWatch={() => toggleSelectedStockWatch(selectedStock)}
        sameIndustryStocks={sameIndustryStocks}
        alertReasons={alertReasons}
        dataCheck={dataCheck}
        lastSuccessAt={lastSuccessAt}
        lastFailReason={lastFailReason}
        lastFailAt={lastFailAt}
        onSelectStock={setSelectedStock}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <div className="mx-auto max-w-md px-3 py-4">
        <div className={`mb-3 rounded-2xl border p-3 ${marketStatus.color}`}>
          <div className="text-sm font-black">{marketStatus.title}</div>
          <div className="mt-1 text-xs font-bold">{marketStatus.text}</div>
        </div>

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

        <MainContinueNotice
          stocks={mainContinueStocks}
          onClose={() => {
            setDismissedMainContinueCodes(mainContinueStocks.map((stock) => stock.code));
          }}
          onSelectStock={setSelectedStock}
        />

        <LowVolumeStrongNotice
          stocks={lowVolumeStrongStocks}
          onClose={() => {
            setDismissedLowVolumeCodes(lowVolumeStrongStocks.map((stock) => stock.code));
          }}
          onSelectStock={setSelectedStock}
        />

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

        <button
          onClick={applyNormalMode}
          className="mb-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-black text-slate-300"
        >
          回到盤中模式
        </button>

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

        {mode === "strong910" && (
          <div className="mb-3 rounded-2xl border border-green-900 bg-green-950/40 p-3 text-sm font-bold text-green-100">
            9:10 最強清單：主流續強 + 開盤溢價排序。
          </div>
        )}

        {filterKey === "mainContinue" && (
          <div className="mb-3 rounded-2xl border border-green-900 bg-green-950/40 p-3 text-sm font-bold text-green-100">
            主流續強：高開續強，且屬於今日最強主流前 5 名產業。
          </div>
        )}

        {filterKey === "openStrong" && (
          <div className="mb-3 rounded-2xl border border-yellow-900 bg-yellow-950/50 p-3 text-sm font-bold text-yellow-100">
            開盤強：只顯示開盤溢價率 ≥ 3% 的股票。
          </div>
        )}

        {filterKey === "highOpenContinue" && (
          <div className="mb-3 rounded-2xl border border-lime-900 bg-lime-950/40 p-3 text-sm font-bold text-lime-100">
            高開續強：只顯示開盤溢價率 ≥ 3%，且目前漲幅 ≥ 5% 的股票。
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
                          isOpen && !searchText && filterKey === "all" ? "" : group.industry
                        )
                      }
                      className="w-full text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-xl font-black text-red-400">{index + 1}</div>

                          <div>
                            <div className="text-2xl font-black text-white">
                              {group.industry}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              平均 +{group.avgChange}%｜強度 {group.strength}
                            </div>
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
                {tab === "breakout" && "突破股"}
                {tab === "alert" && "警報股"}
              </h2>

              <span className="text-xs font-bold text-slate-400">
                {tab === "top50" ? `${filteredTabStocks.length} / 50` : `${filteredTabStocks.length} 檔`}
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
                  alertTags={getAlertTags(stock, topIndustryNames)}
                  onClick={() => setSelectedStock(stock)}
                />
              ))
            )}
          </section>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-800 bg-black/95 px-2 py-2 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {tabs.map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setSelectedStock(null);
                setMode("normal");
                setTab(item.key);
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
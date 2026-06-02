function taiwanNowText() {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === null) return fallback;
  const text = String(value).replace(/,/g, "").trim();
  if (text === "" || text === "-" || text === "--") return fallback;
  const num = Number(text);
  return Number.isFinite(num) ? num : fallback;
}

const codeToChineseName = {
  "2330": "台積電",
  "2303": "聯電",
  "2317": "鴻海",
  "2454": "聯發科",
  "2344": "華邦電",
  "2408": "南亞科",
  "2337": "旺宏",
  "3481": "群創",
  "2409": "友達",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2324": "仁寶",
  "2356": "英業達",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",
  "2308": "台達電",
  "2301": "光寶科",
  "8299": "群聯",
  "3042": "晶技",
  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
  "2618": "長榮航",
  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
  "3017": "奇鋐",
  "3324": "雙鴻",
  "3653": "健策",
};

const industryMap = {
  "2330": "半導體",
  "2303": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "3035": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "2379": "半導體",
  "6415": "半導體",
  "6770": "半導體",
  "3711": "半導體",
  "8299": "半導體",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",

  "3481": "面板",
  "2409": "面板",

  "3042": "其他",

  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2376": "AI伺服器",

  "2317": "電子代工",
  "2324": "電子代工",
  "2356": "電子代工",

  "2357": "電腦週邊",
  "2377": "電腦週邊",

  "2308": "電源能源",
  "2301": "電源能源",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",

  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",
};

const watchCodes = [
  "2330", "2303", "2317", "2454",
  "2344", "2408", "2337",
  "3481", "2409",
  "2382", "3231", "6669", "2324", "2356", "2357", "2376", "2377",
  "2308", "2301",
  "8299", "3042",
  "2603", "2609", "2615", "2618",
  "1519", "1503", "1514", "1513",
  "3017", "3324", "3653",
];

function makeExChList(codes) {
  const list = [];

  codes.forEach((code) => {
    list.push(`tse_${code}.tw`);
    list.push(`otc_${code}.tw`);
  });

  return list;
}

function twseDateTime(row) {
  const dateText = String(row.d || "").replace(/\//g, "-");
  const timeText = String(row.t || "").trim();

  if (!dateText || !timeText) return taiwanNowText();

  const parts = dateText.split("-");
  if (parts.length !== 3) return taiwanNowText();

  const yyyy = parts[0].padStart(4, "0");
  const mm = parts[1].padStart(2, "0");
  const dd = parts[2].padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${timeText}`;
}

function normalizeTwseRow(row) {
  const code = String(row.c || "").trim();

  const price =
    toNumber(row.z) ||
    toNumber(row.a?.split("_")?.[0]) ||
    toNumber(row.b?.split("_")?.[0]) ||
    toNumber(row.o) ||
    toNumber(row.y);

  const previousClose = toNumber(row.y);
  const openPrice = toNumber(row.o) || price;
  const highPrice = toNumber(row.h) || price;
  const lowPrice = toNumber(row.l) || previousClose || price;

  const changePercent =
    previousClose > 0 && price > 0
      ? ((price - previousClose) / previousClose) * 100
      : 0;

  const openPremiumPercent =
    previousClose > 0 && openPrice > 0
      ? ((openPrice - previousClose) / previousClose) * 100
      : null;

  const volume = toNumber(row.v) * 1000 || toNumber(row.tv) * 1000 || 0;

  return {
    code,
    name: codeToChineseName[code] || row.n || code,
    price,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    industry: industryMap[code] || "其他",
    highPrice,
    lowPrice,
    updatedAt: twseDateTime(row),
  };
}

async function fetchTwseBatch(codes) {
  const exChList = makeExChList(codes);
  const chunks = [];

  for (let i = 0; i < exChList.length; i += 80) {
    chunks.push(exChList.slice(i, i + 80));
  }

  const allRows = [];

  for (const chunk of chunks) {
    const exCh = chunk.join("|");
    const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${encodeURIComponent(exCh)}&json=1&delay=0&_=${Date.now()}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://mis.twse.com.tw/stock/index.jsp",
        "Accept": "application/json,text/plain,*/*",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`TWSE MIS HTTP ${response.status}`);
    }

    const text = await response.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json.msgArray) ? json.msgArray : [];
    allRows.push(...rows);
  }

  const map = new Map();

  allRows.forEach((row) => {
    const code = String(row.c || "").trim();
    const stock = normalizeTwseRow(row);

    if (!code || !stock.price || stock.price <= 0) return;

    const old = map.get(code);

    if (!old) {
      map.set(code, stock);
      return;
    }

    if (stock.volume >= old.volume || stock.updatedAt >= old.updatedAt) {
      map.set(code, stock);
    }
  });

  return Array.from(map.values());
}

function safeTop50(list) {
  return list
    .filter((stock) => stock.code && stock.price > 0 && Number.isFinite(stock.changePercent))
    .sort((a, b) => {
      if (b.changePercent !== a.changePercent) return b.changePercent - a.changePercent;
      return b.volume - a.volume;
    })
    .slice(0, 50);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");

  try {
    const stocks = await fetchTwseBatch(watchCodes);
    const rankedStocks = safeTop50(stocks);

    if (rankedStocks.length === 0) {
      throw new Error("TWSE MIS 回傳空資料");
    }

    return res.status(200).json({
      ok: true,
      source: "TWSE MIS realtime batch v60",
      updatedAtTaiwan: taiwanNowText(),
      count: rankedStocks.length,
      rankedStocks,
      stocks: rankedStocks,
      data: rankedStocks,
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      source: "realtime v60 failed",
      message: "TWSE MIS 即時批次資料取得失敗",
      error: err?.message || String(err),
      updatedAtTaiwan: taiwanNowText(),
      count: 0,
      rankedStocks: [],
      stocks: [],
      data: [],
    });
  }
}
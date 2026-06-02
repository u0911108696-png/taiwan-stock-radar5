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

function cleanCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 6);
}

const nameToCode = {
  台積電: "2330",
  聯電: "2303",
  鴻海: "2317",
  聯發科: "2454",
  華邦電: "2344",
  南亞科: "2408",
  旺宏: "2337",
  群創: "3481",
  友達: "2409",
  廣達: "2382",
  緯創: "3231",
  緯穎: "6669",
  仁寶: "2324",
  英業達: "2356",
  華碩: "2357",
  技嘉: "2376",
  微星: "2377",
  台達電: "2308",
  光寶科: "2301",
  群聯: "8299",
  晶技: "3042",
  長榮: "2603",
  陽明: "2609",
  萬海: "2615",
  長榮航: "2618",
};

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

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2618": "航空",
};

function guessMarketCandidates(code) {
  return [`tse_${code}.tw`, `otc_${code}.tw`];
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

function normalizeTwseRow(row, code) {
  const price = toNumber(row.z);

  if (!price || price <= 0) {
    throw new Error("TWSE MIS 沒有即時成交價 z");
  }

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

async function fetchTwseRealtime(code) {
  const candidates = guessMarketCandidates(code);
  const exCh = candidates.join("|");
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

  const row = rows.find(
    (item) => String(item.c || "") === code && toNumber(item.z) > 0
  );

  if (!row) {
    throw new Error("TWSE MIS 查無即時成交價");
  }

  return normalizeTwseRow(row, code);
}

async function fetchYahooFallback(code) {
  const symbol = `${code}.TW`;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`);
  }

  const json = await response.json();
  const result = json?.chart?.result?.[0];

  if (!result) {
    throw new Error("Yahoo 查無資料");
  }

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const opens = quote.open || [];
  const timestamps = result.timestamp || [];

  let idx = closes.length - 1;
  while (
    idx >= 0 &&
    (!Number.isFinite(Number(closes[idx])) || Number(closes[idx]) <= 0)
  ) {
    idx -= 1;
  }

  if (idx < 0) {
    throw new Error("Yahoo 沒有有效現價");
  }

  const price = Number(closes[idx]);
  const previousClose = toNumber(
    meta.chartPreviousClose ||
      meta.previousClose ||
      meta.regularMarketPreviousClose
  );
  const openPrice = Number(opens.find((x) => Number(x) > 0)) || price;
  const volume = Number(volumes[idx] || 0);
  const highPrice = Math.max(
    price,
    openPrice,
    previousClose,
    ...highs.filter((x) => Number(x) > 0).map(Number)
  );
  const lowValues = lows.filter((x) => Number(x) > 0).map(Number);
  const lowPrice = lowValues.length
    ? Math.min(price, previousClose || price, ...lowValues)
    : Math.min(price, openPrice || price, previousClose || price);

  const updatedAt = timestamps[idx]
    ? new Date(timestamps[idx] * 1000).toLocaleString("sv-SE", {
        timeZone: "Asia/Taipei",
        hour12: false,
      })
    : taiwanNowText();

  return {
    code,
    name: codeToChineseName[code] || code,
    price,
    changePercent:
      previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent:
      previousClose > 0 ? ((openPrice - previousClose) / previousClose) * 100 : null,
    industry: industryMap[code] || "其他",
    highPrice,
    lowPrice,
    updatedAt,
  };
}

function resolveQuery(q) {
  const raw = String(q || "").trim();

  if (!raw) return "";

  const code = cleanCode(raw);
  if (code) return code;

  const direct = nameToCode[raw];
  if (direct) return direct;

  const found = Object.entries(nameToCode).find(
    ([name]) => name.includes(raw) || raw.includes(name)
  );

  return found ? found[1] : "";
}

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");

  const q = req.query.q || req.query.code || "";
  const code = resolveQuery(q);

  if (!code) {
    return res.status(200).json({
      ok: false,
      source: "search v62",
      message: "請輸入股票代號或名稱",
      updatedAtTaiwan: taiwanNowText(),
    });
  }

  try {
    const stock = await fetchTwseRealtime(code);

    return res.status(200).json({
      ok: true,
      source: "TWSE MIS realtime z-only v62",
      updatedAtTaiwan: taiwanNowText(),
      stock,
    });
  } catch (twseError) {
    try {
      const stock = await fetchYahooFallback(code);

      return res.status(200).json({
        ok: true,
        source: "Yahoo fallback v62",
        twseError: twseError?.message || String(twseError),
        updatedAtTaiwan: taiwanNowText(),
        stock,
      });
    } catch (yahooError) {
      return res.status(200).json({
        ok: false,
        source: "search v62 failed",
        message: "即時資料取得失敗",
        twseError: twseError?.message || String(twseError),
        yahooError: yahooError?.message || String(yahooError),
        updatedAtTaiwan: taiwanNowText(),
      });
    }
  }
}
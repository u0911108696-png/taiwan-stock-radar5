const https = require("https");

const nameToCode = {
  // 半導體 / IC設計 / 晶圓代工
  台積電: "2330",
  聯電: "2303",
  世界: "5347",
  世界先進: "5347",
  聯發科: "2454",
  聯詠: "3034",
  群聯: "8299",
  創意: "3443",
  世芯: "3661",
  "世芯-KY": "3661",
  智原: "3035",
  瑞昱: "2379",
  原相: "3227",
  矽力: "6415",
  "矽力-KY": "6415",
  力旺: "3529",
  信驊: "5274",
  M31: "6643",
  愛普: "6531",
  "愛普*": "6531",
  力積電: "6770",
  日月光: "3711",
  "日月光投控": "3711",
  京元電: "2449",
  矽格: "6257",
  南茂: "8150",
  頎邦: "6147",
  精材: "3374",
  家登: "3680",
  辛耘: "3583",
  弘塑: "3131",
  中砂: "1560",
  漢唐: "2404",
  帆宣: "6196",

  // 記憶體
  華邦電: "2344",
  南亞科: "2408",
  旺宏: "2337",
  晶豪科: "3006",
  威剛: "3260",
  十銓: "4967",
  群聯電: "8299",

  // AI伺服器 / 代工 / 電腦週邊
  鴻海: "2317",
  廣達: "2382",
  緯創: "3231",
  緯穎: "6669",
  仁寶: "2324",
  英業達: "2356",
  和碩: "4938",
  華碩: "2357",
  技嘉: "2376",
  微星: "2377",
  神達: "3706",
  宏碁: "2353",
  華擎: "3515",
  精英: "2331",

  // PCB / ABF / CCL
  台光電: "2383",
  欣興: "3037",
  景碩: "3189",
  南電: "8046",
  金像電: "2368",
  臻鼎: "4958",
  健鼎: "3044",
  華通: "2313",
  燿華: "2367",
  台燿: "6274",
  聯茂: "6213",
  尖點: "8021",
  牧德: "3563",

  // 散熱 / 機殼 / 電源
  奇鋐: "3017",
  雙鴻: "3324",
  健策: "3653",
  建準: "2421",
  力致: "3483",
  高力: "8996",
  勤誠: "8210",
  營邦: "3693",
  迎廣: "6117",
  川湖: "2059",
  台達電: "2308",
  光寶科: "2301",
  康舒: "6282",
  群電: "6412",
  新盛力: "4931",

  // 光通訊 / 網通 / 矽光子
  聯亞: "3081",
  上詮: "3363",
  光聖: "6442",
  波若威: "3163",
  華星光: "4979",
  眾達: "4977",
  眾達KY: "4977",
  "眾達-KY": "4977",
  聯鈞: "3450",
  前鼎: "4908",
  智邦: "2345",
  中磊: "5388",
  啟碁: "6285",
  合勤控: "3704",
  正文: "4906",

  // 面板 / 光學
  群創: "3481",
  友達: "2409",
  彩晶: "6116",
  佳世達: "2352",
  大立光: "3008",
  玉晶光: "3406",
  亞光: "3019",
  先進光: "3362",

  // 重電 / 電機 / 電線電纜
  華城: "1519",
  士電: "1503",
  亞力: "1514",
  中興電: "1513",
  東元: "1504",
  大同: "2371",
  華新: "1605",
  華榮: "1608",
  大亞: "1609",
  億泰: "1616",

  // 金融
  富邦金: "2881",
  國泰金: "2882",
  開發金: "2883",
  玉山金: "2884",
  元大金: "2885",
  兆豐金: "2886",
  台新金: "2887",
  新光金: "2888",
  中信金: "2891",
  第一金: "2892",
  永豐金: "2890",
  合庫金: "5880",

  // 航運
  長榮: "2603",
  陽明: "2609",
  萬海: "2615",
  慧洋: "2637",
  裕民: "2606",
  新興: "2605",
  台航: "2617",
  長榮航: "2618",
  華航: "2610",

  // 鋼鐵 / 原物料
  中鋼: "2002",
  東和鋼鐵: "2006",
  中鴻: "2014",
  燁輝: "2023",
  長榮鋼: "2211",
  豐興: "2015",
  官田鋼: "2017",
  台泥: "1101",
  亞泥: "1102",
  國產: "2504",

  // 塑化
  台塑: "1301",
  南亞: "1303",
  台化: "1326",
  台塑化: "6505",
  華夏: "1305",
  聯成: "1313",
  國喬: "1312",

  // 生技 / 醫療
  藥華藥: "6446",
  保瑞: "6472",
  美時: "1795",
  中裕: "4147",
  智擎: "4162",
  台康生技: "6589",
  生達: "1720",
  杏輝: "1734",
  葡萄王: "1707",

  // 營建 / 資產
  國建: "2501",
  國泰建: "2501",
  華固: "2548",
  長虹: "5534",
  興富發: "2542",
  遠雄: "5522",
  潤泰新: "9945",
  潤泰全: "2915",
  愛山林: "2540",
  京城: "2524",

  // 其他熱門
  統一: "1216",
  統一超: "2912",
  大成鋼: "2027",
  榮剛: "5009",
  材料KY: "4763",
  "材料-KY": "4763",
  長華: "8070",
  長華電材: "8070",
  胡連: "6279",
  貿聯: "3665",
  "貿聯-KY": "3665",
};

const codeToName = {
  "2330": "台積電",
  "2303": "聯電",
  "5347": "世界先進",
  "2454": "聯發科",
  "3034": "聯詠",
  "8299": "群聯",
  "3443": "創意",
  "3661": "世芯-KY",
  "3035": "智原",
  "2379": "瑞昱",
  "3227": "原相",
  "6415": "矽力-KY",
  "3529": "力旺",
  "5274": "信驊",
  "6643": "M31",
  "6531": "愛普",
  "6770": "力積電",
  "3711": "日月光投控",
  "2449": "京元電",
  "6257": "矽格",
  "8150": "南茂",
  "6147": "頎邦",
  "3374": "精材",
  "3680": "家登",
  "3583": "辛耘",
  "3131": "弘塑",
  "1560": "中砂",
  "2404": "漢唐",
  "6196": "帆宣",

  "2344": "華邦電",
  "2408": "南亞科",
  "2337": "旺宏",
  "3006": "晶豪科",
  "3260": "威剛",
  "4967": "十銓",

  "2317": "鴻海",
  "2382": "廣達",
  "3231": "緯創",
  "6669": "緯穎",
  "2324": "仁寶",
  "2356": "英業達",
  "4938": "和碩",
  "2357": "華碩",
  "2376": "技嘉",
  "2377": "微星",
  "3706": "神達",
  "2353": "宏碁",
  "3515": "華擎",
  "2331": "精英",

  "2383": "台光電",
  "3037": "欣興",
  "3189": "景碩",
  "8046": "南電",
  "2368": "金像電",
  "4958": "臻鼎-KY",
  "3044": "健鼎",
  "2313": "華通",
  "2367": "燿華",
  "6274": "台燿",
  "6213": "聯茂",
  "8021": "尖點",
  "3563": "牧德",

  "3017": "奇鋐",
  "3324": "雙鴻",
  "3653": "健策",
  "2421": "建準",
  "3483": "力致",
  "8996": "高力",
  "8210": "勤誠",
  "3693": "營邦",
  "6117": "迎廣",
  "2059": "川湖",
  "2308": "台達電",
  "2301": "光寶科",
  "6282": "康舒",
  "6412": "群電",
  "4931": "新盛力",

  "3081": "聯亞",
  "3363": "上詮",
  "6442": "光聖",
  "3163": "波若威",
  "4979": "華星光",
  "4977": "眾達-KY",
  "3450": "聯鈞",
  "4908": "前鼎",
  "2345": "智邦",
  "5388": "中磊",
  "6285": "啟碁",
  "3704": "合勤控",
  "4906": "正文",

  "3481": "群創",
  "2409": "友達",
  "6116": "彩晶",
  "2352": "佳世達",
  "3008": "大立光",
  "3406": "玉晶光",
  "3019": "亞光",
  "3362": "先進光",

  "1519": "華城",
  "1503": "士電",
  "1514": "亞力",
  "1513": "中興電",
  "1504": "東元",
  "2371": "大同",
  "1605": "華新",
  "1608": "華榮",
  "1609": "大亞",
  "1616": "億泰",

  "2881": "富邦金",
  "2882": "國泰金",
  "2883": "開發金",
  "2884": "玉山金",
  "2885": "元大金",
  "2886": "兆豐金",
  "2887": "台新金",
  "2888": "新光金",
  "2891": "中信金",
  "2892": "第一金",
  "2890": "永豐金",
  "5880": "合庫金",

  "2603": "長榮",
  "2609": "陽明",
  "2615": "萬海",
  "2637": "慧洋-KY",
  "2606": "裕民",
  "2605": "新興",
  "2617": "台航",
  "2618": "長榮航",
  "2610": "華航",

  "2002": "中鋼",
  "2006": "東和鋼鐵",
  "2014": "中鴻",
  "2023": "燁輝",
  "2211": "長榮鋼",
  "2015": "豐興",
  "2017": "官田鋼",
  "1101": "台泥",
  "1102": "亞泥",
  "2504": "國產",

  "1301": "台塑",
  "1303": "南亞",
  "1326": "台化",
  "6505": "台塑化",
  "1305": "華夏",
  "1313": "聯成",
  "1312": "國喬",

  "6446": "藥華藥",
  "6472": "保瑞",
  "1795": "美時",
  "4147": "中裕",
  "4162": "智擎",
  "6589": "台康生技",
  "1720": "生達",
  "1734": "杏輝",
  "1707": "葡萄王",

  "2501": "國建",
  "2548": "華固",
  "5534": "長虹",
  "2542": "興富發",
  "5522": "遠雄",
  "9945": "潤泰新",
  "2915": "潤泰全",
  "2540": "愛山林",
  "2524": "京城",

  "1216": "統一",
  "2912": "統一超",
  "2027": "大成鋼",
  "5009": "榮剛",
  "4763": "材料-KY",
  "8070": "長華",
  "6279": "胡連",
  "3665": "貿聯-KY",
};

const industryMap = {
  "2330": "半導體",
  "2303": "半導體",
  "5347": "半導體",
  "2454": "半導體",
  "3034": "半導體",
  "8299": "半導體",
  "3443": "半導體",
  "3661": "半導體",
  "3035": "半導體",
  "2379": "半導體",
  "3227": "半導體",
  "6415": "半導體",
  "3529": "半導體",
  "5274": "半導體",
  "6643": "半導體",
  "6531": "半導體",
  "6770": "半導體",
  "3711": "半導體",
  "2449": "半導體",
  "6257": "半導體",
  "8150": "半導體",
  "6147": "半導體",
  "3374": "半導體",
  "3680": "半導體設備",
  "3583": "半導體設備",
  "3131": "半導體設備",
  "1560": "半導體材料",
  "2404": "半導體設備",
  "6196": "半導體設備",

  "2344": "記憶體",
  "2408": "記憶體",
  "2337": "記憶體",
  "3006": "記憶體",
  "3260": "記憶體",
  "4967": "記憶體",

  "2317": "電子代工",
  "2382": "AI伺服器",
  "3231": "AI伺服器",
  "6669": "AI伺服器",
  "2324": "電子代工",
  "2356": "電子代工",
  "4938": "電子代工",
  "2357": "電腦週邊",
  "2376": "AI伺服器",
  "2377": "電腦週邊",
  "3706": "AI伺服器",
  "2353": "電腦週邊",
  "3515": "電腦週邊",
  "2331": "電腦週邊",

  "2383": "PCB",
  "3037": "PCB",
  "3189": "PCB",
  "8046": "PCB",
  "2368": "PCB",
  "4958": "PCB",
  "3044": "PCB",
  "2313": "PCB",
  "2367": "PCB",
  "6274": "PCB",
  "6213": "PCB",
  "8021": "PCB",
  "3563": "PCB",

  "3017": "散熱",
  "3324": "散熱",
  "3653": "散熱",
  "2421": "散熱",
  "3483": "散熱",
  "8996": "散熱",
  "8210": "機殼",
  "3693": "機殼",
  "6117": "機殼",
  "2059": "滑軌",
  "2308": "電源能源",
  "2301": "電源能源",
  "6282": "電源能源",
  "6412": "電源能源",
  "4931": "電源能源",

  "3081": "光通訊",
  "3363": "光通訊",
  "6442": "光通訊",
  "3163": "光通訊",
  "4979": "光通訊",
  "4977": "光通訊",
  "3450": "光通訊",
  "4908": "光通訊",
  "2345": "網通",
  "5388": "網通",
  "6285": "網通",
  "3704": "網通",
  "4906": "網通",

  "3481": "面板",
  "2409": "面板",
  "6116": "面板",
  "2352": "面板",
  "3008": "光學",
  "3406": "光學",
  "3019": "光學",
  "3362": "光學",

  "1519": "重電",
  "1503": "重電",
  "1514": "重電",
  "1513": "重電",
  "1504": "電機",
  "2371": "電機",
  "1605": "電線電纜",
  "1608": "電線電纜",
  "1609": "電線電纜",
  "1616": "電線電纜",

  "2881": "金融",
  "2882": "金融",
  "2883": "金融",
  "2884": "金融",
  "2885": "金融",
  "2886": "金融",
  "2887": "金融",
  "2888": "金融",
  "2891": "金融",
  "2892": "金融",
  "2890": "金融",
  "5880": "金融",

  "2603": "航運",
  "2609": "航運",
  "2615": "航運",
  "2637": "航運",
  "2606": "航運",
  "2605": "航運",
  "2617": "航運",
  "2618": "航空",
  "2610": "航空",

  "2002": "鋼鐵",
  "2006": "鋼鐵",
  "2014": "鋼鐵",
  "2023": "鋼鐵",
  "2211": "鋼鐵",
  "2015": "鋼鐵",
  "2017": "鋼鐵",
  "1101": "水泥",
  "1102": "水泥",
  "2504": "水泥",

  "1301": "塑化",
  "1303": "塑化",
  "1326": "塑化",
  "6505": "塑化",
  "1305": "塑化",
  "1313": "塑化",
  "1312": "塑化",

  "6446": "生技",
  "6472": "生技",
  "1795": "生技",
  "4147": "生技",
  "4162": "生技",
  "6589": "生技",
  "1720": "生技",
  "1734": "生技",
  "1707": "生技",

  "2501": "營建",
  "2548": "營建",
  "5534": "營建",
  "2542": "營建",
  "5522": "營建",
  "9945": "資產",
  "2915": "資產",
  "2540": "營建",
  "2524": "營建",

  "1216": "食品",
  "2912": "通路",
  "2027": "鋼鐵",
  "5009": "鋼鐵",
  "4763": "材料",
  "8070": "電子零組件",
  "6279": "汽車零組件",
  "3665": "連接線",
};

function cleanCode(input) {
  return String(input || "").replace(/\D/g, "").slice(0, 6);
}

function resolveCode(q) {
  const keyword = String(q || "").trim();
  const code = cleanCode(keyword);

  if (code.length >= 4) return code;

  if (nameToCode[keyword]) return nameToCode[keyword];

  const found = Object.entries(nameToCode).find(([name]) => {
    return name.includes(keyword) || keyword.includes(name);
  });

  return found ? found[1] : "";
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function taiwanTimeText(timestampMs) {
  const date = timestampMs ? new Date(timestampMs) : new Date();

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json,text/plain,*/*",
        },
        timeout: 8000,
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            if (res.statusCode < 200 || res.statusCode >= 300) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }

            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Yahoo timeout"));
    });

    req.on("error", reject);
  });
}

async function fetchYahoo(symbol) {
  const safeSymbol = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${safeSymbol}?interval=1m&range=1d`;

  const json = await getJson(url);
  const result = json && json.chart && json.chart.result && json.chart.result[0];

  if (!result) {
    throw new Error(`${symbol} no result`);
  }

  return result;
}

function parseYahoo(result, code, market) {
  const meta = result.meta || {};
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];

  const quote =
    result.indicators &&
    result.indicators.quote &&
    result.indicators.quote[0]
      ? result.indicators.quote[0]
      : {};

  const closes = Array.isArray(quote.close) ? quote.close : [];
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];

  let lastIndex = closes.length - 1;

  while (lastIndex >= 0) {
    const value = closes[lastIndex];
    if (value !== null && value !== undefined && Number.isFinite(Number(value))) break;
    lastIndex -= 1;
  }

  if (lastIndex < 0) {
    throw new Error("no valid price");
  }

  const price = safeNumber(closes[lastIndex], safeNumber(meta.regularMarketPrice, 0));

  const firstOpen = opens.find((v) => {
    return v !== null && v !== undefined && Number.isFinite(Number(v));
  });

  const openPrice = safeNumber(firstOpen, safeNumber(meta.regularMarketOpen, price));
  const previousClose = safeNumber(meta.chartPreviousClose, safeNumber(meta.previousClose, price));

  const highValues = highs
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .map(Number);

  const lowValues = lows
    .filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v)))
    .map(Number);

  const highPrice = highValues.length > 0 ? Math.max(...highValues, price) : price;
  const lowPrice = lowValues.length > 0 ? Math.min(...lowValues, price) : price;

  const volume = volumes.reduce((sum, v) => sum + safeNumber(v, 0), 0);

  const changePercent =
    previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

  const openPremiumPercent =
    previousClose > 0 ? ((openPrice - previousClose) / previousClose) * 100 : 0;

  const timestampMs = timestamps[lastIndex] ? timestamps[lastIndex] * 1000 : Date.now();

  return {
    code,
    symbol: `${code}.${market}`,
    name: codeToName[code] || String(meta.shortName || meta.longName || code)
      .replace(".TW", "")
      .replace(".TWO", ""),
    price,
    changePercent,
    volume,
    openPrice,
    previousClose,
    openPremiumPercent,
    highPrice,
    lowPrice,
    industry: industryMap[code] || "其他",
    updatedAt: taiwanTimeText(timestampMs),
    source: "Yahoo Finance Search JS Expanded",
  };
}

module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      res.end();
      return;
    }

    const q = String((req.query && (req.query.q || req.query.code)) || "").trim();
    const code = resolveCode(q);

    if (!code) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          ok: false,
          query: q,
          message: "請輸入股票代號或中文名稱，例如 台積電、華邦電、群創、緯創、廣達、奇鋐、華城。",
        })
      );
      return;
    }

    const symbols = [
      { symbol: `${code}.TW`, market: "TW" },
      { symbol: `${code}.TWO`, market: "TWO" },
    ];

    const errors = [];

    for (const item of symbols) {
      try {
        const result = await fetchYahoo(item.symbol);
        const stock = parseYahoo(result, code, item.market);

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            ok: true,
            stock,
            updatedAt: new Date().toISOString(),
          })
        );
        return;
      } catch (err) {
        errors.push(`${item.symbol}: ${err && err.message ? err.message : String(err)}`);
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: false,
        code,
        message: "查無此股票，請確認代號或中文名稱是否正確。",
        error: errors.join(" | "),
      })
    );
    return;
  } catch (err) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: false,
        message: "查詢功能暫時失敗，請稍後再試。",
        error: err && err.message ? err.message : String(err),
      })
    );
    return;
  }
};
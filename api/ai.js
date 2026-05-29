module.exports = async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          ok: false,
          message: "請用 POST 呼叫 AI 解讀。",
        })
      );
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          ok: false,
          message: "尚未設定 OPENAI_API_KEY。請先到 Vercel Environment Variables 新增 OPENAI_API_KEY。",
        })
      );
      return;
    }

    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const payload = JSON.parse(body || "{}");

    const summary = {
      marketStructure: payload.marketStructure || "",
      topIndustries: payload.topIndustries || [],
      coreStocks: payload.coreStocks || [],
      pullbackStocks: payload.pullbackStocks || [],
      overheatStocks: payload.overheatStocks || [],
      failedStocks: payload.failedStocks || [],
      amountStocks: payload.amountStocks || [],
      time: payload.time || "",
    };

    const prompt = `
你是台股盤中主線解讀助手。
請根據資料，用繁體中文整理盤中主線。

重要規則：
1. 不可以保證會漲。
2. 不可以說一定買、一定賣。
3. 只能做輔助判斷。
4. 重點放在：資金主線、產業強弱、過熱不追、失效避開。
5. 回答要短、清楚、適合手機看。
6. 請用條列式。
7. 最後一定加一句：此為盤中輔助判斷，不是保證獲利。

目前資料：
${JSON.stringify(summary, null, 2)}
`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.2,
        max_output_tokens: 700,
      }),
    });

    const json = await response.json();

    if (!response.ok) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(
        JSON.stringify({
          ok: false,
          message: "AI 解讀失敗。",
          error: json?.error?.message || "OpenAI API error",
        })
      );
      return;
    }

    const text =
      json.output_text ||
      (Array.isArray(json.output)
        ? json.output
            .flatMap((item) => item.content || [])
            .map((content) => content.text || "")
            .join("\n")
        : "");

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: true,
        text: text || "AI 沒有回傳內容，請稍後再試。",
      })
    );
  } catch (err) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        ok: false,
        message: "AI API 暫時失敗。",
        error: err && err.message ? err.message : String(err),
      })
    );
  }
};
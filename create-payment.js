// ── Alipay 当面付 - Vercel Serverless Function ──
// APPID: 2021006112660080

const APP_ID = "2021006112660080";
const ALIPAY_GATEWAY = "https://openapi.alipay.com/gateway.do";

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCeiCAvMhIYQGoneh4efwRcSKc3Y
qWu+ZPvGOUIVH9GUgz2etPUaqIbrZ4MOwtI/nSymOlfSUCdnoToeORocKymVdnkA+FM538opU5J
ahayIujrZID6/8xUJnIPdzTAc5hJczUwc42gVfNkAsvURkqAdDjMSRdBJEHNToOsX6QrPSdNVfoa
QJpx7RZKABIoqPTvdzxGamSjDhWR4os4E1OCGMfrmdL8ndLVL5U3s3AisuQnY6BSUr//tYZKn0MN
JqXivX2lwRExIeGh04jzwDW9g39WbDLaO8yOsflZcdXNGqZduk7D5xNEDeNmmL2USRASJ3J9BUqE
BhlOOLS7sGM1lQIDAQAB
-----END PRIVATE KEY-----`;

const ALIPAY_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2uoHbdUzLI9kg3hZlAhcCDvw2QNZU4q6
fz6rM8NlpB2Aa17UFv9toZpjVMlahZ28rSSS//AQNqqofvOunR19ekFQ0gGNVoe3hPZtpWz9aMQ0
ygbfvfZ0+N8R2eBY1BaiOefaRD9Q9AVRECV1zbD2Oaun6g3vDBTCOAmrEH3e/CCjoDzJCk+Gzmun
3Dx++6wvjrokMRU0dxCi2joWjT9WiJPZo2QG5MFFfnbHKQ4CCjdGsdRpJ+YAdHpr/AxWA56xskYb
znLzTrQaVKaR8ke+Vp4/2hWjThFt9oh+i4jL65HT2nk7nWUtM7EHzOm0OZ6M9kL6RIs4AbsGBX4+
BQYV7QIDAQAB
-----END PUBLIC KEY-----`;

let cachedKey = null;
async function getPrivateKey() {
  if (cachedKey) return cachedKey;
  const pem = PRIVATE_KEY_PEM.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  cachedKey = await crypto.subtle.importKey("pkcs8", binary, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return cachedKey;
}

async function sign(data) {
  const key = await getPrivateKey();
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

function buildQuery(params) {
  const keys = Object.keys(params).filter(k => params[k] != null).sort();
  return keys.map(k => k + "=" + encodeURIComponent(params[k])).join("&");
}

async function callAlipay(method, bizContent) {
  const baseParams = {
    app_id: APP_ID, method, charset: "utf-8", sign_type: "RSA2",
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "+08:00").replace("T", " "),
    version: "1.0", biz_content: JSON.stringify(bizContent)
  };
  const query = buildQuery(baseParams);
  const signature = await sign(query);
  const body = query + "&sign=" + encodeURIComponent(signature);

  const resp = await fetch(ALIPAY_GATEWAY, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const text = await resp.text();
  const jsonStart = text.indexOf("{");
  return jsonStart >= 0 ? JSON.parse(text.slice(jsonStart)) : { error: text };
}

export async function POST(request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  try {
    const url = new URL(request.url);
    const body = await request.json();

    if (url.pathname === "/api/create-payment") {
      const { orderNum, amount, subject } = body;
      const result = await callAlipay("alipay.trade.precreate", {
        out_trade_no: orderNum, total_amount: amount,
        subject: subject || ("小汉堡代跑 #" + orderNum), timeout_express: "30m"
      });
      if (result.alipay_trade_precreate_response?.code === "10000") {
        return Response.json({
          success: true,
          qr_code: result.alipay_trade_precreate_response.qr_code,
          out_trade_no: orderNum
        }, { headers: corsHeaders });
      }
      return Response.json({ success: false, error: result.alipay_trade_precreate_response?.sub_msg || "Unknown error" }, { headers: corsHeaders });
    }

    if (url.pathname === "/api/check-payment") {
      const { orderNum } = body;
      const result = await callAlipay("alipay.trade.query", { out_trade_no: orderNum });
      const resp = result.alipay_trade_query_response;
      if (resp?.code === "10000") {
        const paid = resp.trade_status === "TRADE_SUCCESS" || resp.trade_status === "TRADE_FINISHED";
        return Response.json({ success: true, paid, trade_status: resp.trade_status, total_amount: resp.total_amount }, { headers: corsHeaders });
      }
      return Response.json({ success: true, paid: false }, { headers: corsHeaders });
    }

    return Response.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" }
  });
}

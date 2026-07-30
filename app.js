/* ── Config ── */
var SUPABASE_URL = "";
var SUPABASE_KEY = "";
var ENC_SECRET = "whs91cnm";

/* ── Per-person pricing by gender and tier ── */
var prices = {
  female: { 1: 70, 2: 65, "3+": 60 },
  male:   { 1: 80, 2: 75, "3+": 70 }
};

/* ── Encryption (AES-GCM) ── */
async function deriveKey(password, salt) {
  var enc = new TextEncoder();
  var km = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function encrypt(text) {
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var key = await deriveKey(ENC_SECRET, salt);
  var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(text));
  var c = new Uint8Array(16 + 12 + ct.byteLength);
  c.set(salt, 0); c.set(iv, 16); c.set(new Uint8Array(ct), 28);
  return btoa(String.fromCharCode.apply(null, c));
}

/* ── Order Number: 5-digit global sequential ── */
function generateOrderNumber() {
  var key = "xh_order_seq_global";
  var seq = parseInt(localStorage.getItem(key) || "0", 10);
  var num = ("0000" + seq).slice(-5);
  localStorage.setItem(key, (seq + 1).toString());
  return num;
}



/* ── Supabase ── */
/* ── Payment Worker ── */
var PAY_WORKER = "";  // Fill in after deploying worker

async function createPayment(orderNum, amount) {
  if (!PAY_WORKER) return null;
  try {
    var r = await fetch(PAY_WORKER + "/api/create-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNum: orderNum, amount: amount, subject: "小汉堡代跑 #" + orderNum })
    });
    return await r.json();
  } catch (e) { return null; }
}
async function checkPayment(orderNum) {
  if (!PAY_WORKER) return null;
  try {
    var r = await fetch(PAY_WORKER + "/api/check-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNum: orderNum })
    });
    return await r.json();
  } catch (e) { return null; }
}
var supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  import("https://esm.sh/@supabase/supabase-js@2").then(function(m) {
    supabase = m.createClient(SUPABASE_URL, SUPABASE_KEY);
  });
}

/* ── Storage ── */
function getLocalOrders() {
  try { return JSON.parse(localStorage.getItem("xiaohanbao_orders") || "[]"); }
  catch { return []; }
}
function saveLocalOrders(orders) {
  localStorage.setItem("xiaohanbao_orders", JSON.stringify(orders));
}

/* ── DOM ── */
var form = document.querySelector("#booking-form");
var totalPrice = document.querySelector("#total-price");
var result = document.querySelector("#form-result");
var maleInput = document.querySelector("#male-count");
var femaleInput = document.querySelector("#female-count");

function updatePrice() {
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m === 0 && f === 0) { totalPrice.textContent = "¥0"; var payEl = document.querySelector("#pay-amount"); if (payEl) payEl.textContent = "¥0"; return; }
  var totalN = m + f;
  var tier = totalN >= 3 ? "3+" : Math.max(totalN, 1);
  var total = 0;
  if (m > 0) total += m * prices.male[tier];
  if (f > 0) total += f * prices.female[tier];
  totalPrice.textContent = "¥" + total;
  var payEl = document.querySelector("#pay-amount");
  if (payEl) payEl.textContent = "¥" + total;
}

maleInput.addEventListener("input", updatePrice);
femaleInput.addEventListener("input", updatePrice);

/* ── Submit ── */
form.addEventListener("submit", async function(e) {
  e.preventDefault();

  var school = document.querySelector("#school").value;
  var runType = document.querySelector("#run-type").value === "morning" ? "早操跑" : "阳光跑";
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m === 0 && f === 0) { result.textContent = "请至少选择1人下单"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }  var account = document.querySelector("#account").value.trim();
  var plainPassword = document.querySelector("#password").value;

  var totalN = m + f;
  var tier = totalN >= 3 ? "3+" : Math.max(totalN, 1);
  var mPrice = m > 0 ? prices.male[tier] : 0;
  var fPrice = f > 0 ? prices.female[tier] : 0;
  var total = m * mPrice + f * fPrice;

  var parts = [];
  if (m > 0) parts.push(m + "男");
  if (f > 0) parts.push(f + "女");
  var peopleLabel = parts.join(" + ");

  var orderNum = generateOrderNumber();
  var passwordEncrypted = await encrypt(plainPassword);

  var order = {
    id: Date.now(),
    orderNum: orderNum,
    time: new Date().toLocaleString("zh-CN"),
    school: school,
    maleCount: m,
    femaleCount: f,
    peopleLabel: peopleLabel,
    malePrice: mPrice,
    femalePrice: fPrice,
    runType: runType,
    price: total,  account: account,
    password_encrypted: passwordEncrypted
  };

  if (supabase) {
    try {
      var sbOrder = { id: order.id, order_num: order.orderNum, time: order.time, school: order.school, male_count: order.maleCount, female_count: order.femaleCount, people_label: order.peopleLabel, male_price: order.malePrice, female_price: order.femalePrice, run_type: order.runType, price: order.price, date: order.date, account: order.account, password_encrypted: order.passwordEncrypted };
      await supabase.from("orders").insert(sbOrder);
    } catch (_) {}
  }

  var localOrders = getLocalOrders();
  localOrders.unshift(order);
  saveLocalOrders(localOrders);

  var breakdown = [];
  if (m > 0) breakdown.push(m + "男 × ¥" + mPrice);
  if (f > 0) breakdown.push(f + "女 × ¥" + fPrice);

  result.innerHTML =
    "<strong style='font-size:15px;color:#6f412e'>订单提交成功！编号：#" + orderNum + "</strong><br><br>" +
    "学校：" + school + " · 阳光跑<br>" +
    "人数：" + peopleLabel + "<br>" +
    "单价：" + breakdown.join("，") + "<br>" +
    "总金额：<b>¥" + total + "</b><br><br>" +
    "<span style='color:#c0392b'>📸 请截图保存此页面！</span><br>" +
    "添加客服微信 <b>ATSN112266</b>，备注编号 <b>#" + orderNum + "</b> 确认。";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });

    document.querySelector("#password").value = "";

  // Show payment section + dynamic QR
  var paySection = document.querySelector("#pay");
  var payContent = document.querySelector("#pay-content");
  if (paySection && PAY_WORKER) {
    paySection.style.display = "block";
    payContent.innerHTML = "<p style='color:#9b8f82'>正在生成支付二维码...</p>";
    paySection.scrollIntoView({ behavior: "smooth", block: "nearest" });

    var payResult = await createPayment(orderNum, total);
    if (payResult && payResult.success) {
      var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" + encodeURIComponent(payResult.qr_code);
      payContent.innerHTML =
        "<img src='" + qrUrl + "' style='width:200px;height:200px;border-radius:12px;border:2px solid #e9dfd2' />" +
        "<p style='font-size:11px;color:#9b8f82;margin:12px 0'>支付宝扫码支付 ¥" + total + "</p>" +
        "<p style='font-size:11px;color:#6b5e52' id='pay-status'>⏳ 等待支付中...</p>";

      // Poll for payment
      var pollCount = 0;
      var maxPoll = 60;  // 3 minutes
      var pollInterval = setInterval(async function() {
        pollCount++;
        if (pollCount > maxPoll) { clearInterval(pollInterval); return; }
        var check = await checkPayment(orderNum);
        if (check && check.paid) {
          clearInterval(pollInterval);
          document.querySelector("#pay-status").innerHTML = "<div style=\"font-size:14px;color:#638b35;font-weight:700\">✅ 支付成功！</div><div style=\"font-size:12px;color:#6b5e52;margin-top:8px\">订单编号：<b style=\"color:#6f412e\">#' + orderNum + '</b></div><div style=\"font-size:11px;color:#c0392b;margin-top:6px\">📸 请截图保存此页面<br>添加客服微信 <b>ATSN112266</b> 备注编号确认</div>";

          document.querySelector("#pay-status").style.color = "#638b35";
        }
      }, 3000);
    } else {
      payContent.innerHTML = "<p style='color:#c0392b'>支付二维码生成失败，请使用上方静态收款码支付。</p>";
      // Show static QR fallback
      var fallback = payContent.querySelector("img");
    }
  } else if (paySection) {
    // No worker configured - show static QR
    paySection.style.display = "block";
    payContent.innerHTML =
      "<img src='alipay-qr.jpg' style='width:200px;height:200px;border-radius:12px;border:2px solid #e9dfd2' />" +
      "<p style='font-size:11px;color:#9b8f82;margin:12px 0'>支付宝扫码支付 ¥" + total + "</p>" +
      "<p style='font-size:11px;color:#6b5e52'>支付后请添加客服微信 ATSN112266 确认</p>";
  }
});

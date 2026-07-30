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

function getTier(n) { return n >= 3 ? "3+" : Math.max(n, 1); }

/* ── Supabase ── */
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
var dateInput = document.querySelector("#date");
var maleInput = document.querySelector("#male-count");
var femaleInput = document.querySelector("#female-count");

dateInput.min = new Date().toISOString().split("T")[0];

function updatePrice() {
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m === 0 && f === 0) { totalPrice.textContent = "¥0"; var payEl = document.querySelector("#pay-amount"); if (payEl) payEl.textContent = "¥0"; return; }
  var mTier = getTier(m);
  var fTier = getTier(f);
  var total = (m * prices.male[mTier]) + (f * prices.female[fTier]);
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
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m === 0 && f === 0) { result.textContent = "请至少选择1人下单"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }

  var date = dateInput.value;
  var account = document.querySelector("#account").value.trim();
  var plainPassword = document.querySelector("#password").value;

  var mTier = getTier(m);
  var fTier = getTier(f);
  var mPrice = m > 0 ? prices.male[mTier] : 0;
  var fPrice = f > 0 ? prices.female[fTier] : 0;
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
    runType: "阳光跑",
    price: total,
    date: date,
    account: account,
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
});

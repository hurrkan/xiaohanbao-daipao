/* ── Config ── */
var SUPABASE_URL = "";
var SUPABASE_KEY = "";
var ENC_SECRET = "whs91cnm";

/* ── Pricing ── */
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

/* ── Order Number ── */
function generateOrderNumber() {
  var today = new Date();
  var ds = today.getFullYear().toString() +
    ("0" + (today.getMonth() + 1)).slice(-2) +
    ("0" + today.getDate()).slice(-2);
  var key = "xh_order_seq_" + ds;
  var seq = parseInt(localStorage.getItem(key) || "0", 10) + 1;
  localStorage.setItem(key, seq.toString());
  return "XB" + ds + ("000" + seq).slice(-4);
}

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
var peopleInput = document.querySelector("#people");

dateInput.min = new Date().toISOString().split("T")[0];

function getPeopleTier(n) { return n >= 3 ? "3+" : n; }

function updatePrice() {
  var n = parseInt(peopleInput.value, 10) || 1;
  var tier = getPeopleTier(n);
  var gender = document.querySelector("input[name=gender]:checked").value;
  totalPrice.textContent = "¥" + prices[gender][tier];
  var payEl = document.querySelector("#pay-amount");
  if (payEl) payEl.textContent = "¥" + prices[gender][tier];
}

peopleInput.addEventListener("input", updatePrice);
document.querySelectorAll("input[name=gender]").forEach(function(i) {
  i.addEventListener("change", updatePrice);
});

/* ── Submit ── */
form.addEventListener("submit", async function(e) {
  e.preventDefault();

  var school = document.querySelector("#school").value;
  var genderEl = document.querySelector("input[name=gender]:checked");
  var genderLabel = genderEl.parentElement.querySelector("span").textContent;
  var genderVal = genderEl.value;
  var n = parseInt(peopleInput.value, 10) || 1;
  var label = n >= 3 ? n + "人组团" : n === 2 ? "2人组团" : "单独下单";
  var date = dateInput.value;
  var account = document.querySelector("#account").value.trim();
  var plainPassword = document.querySelector("#password").value;

  var orderNum = generateOrderNumber();
  var passwordEncrypted = await encrypt(plainPassword);

  var order = {
    id: Date.now(),
    orderNum: orderNum,
    time: new Date().toLocaleString("zh-CN"),
    school: school,
    gender: genderLabel,
    people: n,
    peopleLabel: label,
    runType: "阳光跑",
    price: prices[genderVal][getPeopleTier(n)],
    date: date,
    account: account,
    password_encrypted: passwordEncrypted
  };

  if (supabase) {
    try {
      var sbOrder = { id: order.id, order_num: order.orderNum, time: order.time, school: order.school, gender: order.gender, people: order.people, people_label: order.peopleLabel, run_type: order.runType, price: order.price, date: order.date, account: order.account, password_encrypted: order.password_encrypted };
      await supabase.from("orders").insert(sbOrder);
    } catch (_) {}
  }

  var localOrders = getLocalOrders();
  localOrders.unshift(order);
  saveLocalOrders(localOrders);

  // Show result with order number
  result.innerHTML =
    "<strong style='font-size:15px;color:#6f412e'>订单提交成功！编号：" + orderNum + "</strong><br><br>" +
    "学校：" + school + " · 阳光跑 · " + label + "<br>" +
    "金额：<b>¥" + order.price + "</b> / 人<br><br>" +
    "<span style='color:#c0392b'>📸 请截图保存此页面！</span><br>" +
    "添加客服微信 <b>ATSN112266</b>，备注编号 <b>" + orderNum + "</b> 确认。";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });

  document.querySelector("#password").value = "";
});

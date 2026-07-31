var ENC_SECRET = "whs91cnm";
var prices = { female: { 1: 70, 2: 65, "3+": 60 }, male: { 1: 80, 2: 75, "3+": 70 } };
var ORDER_WORKER = "https://long-sun-6b2e.3218908655.workers.dev";

async function deriveKey(pw, salt) {
  var e = new TextEncoder(), km = await crypto.subtle.importKey("raw", e.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(text) {
  var s = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  var k = await deriveKey(ENC_SECRET, s), ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(text));
  var c = new Uint8Array(16 + 12 + ct.byteLength); c.set(s, 0); c.set(iv, 16); c.set(new Uint8Array(ct), 28);
  return btoa(String.fromCharCode.apply(null, c));
}
function generateOrderNumber() {
  var k = "xh_order_seq_global", s = parseInt(localStorage.getItem(k) || "0", 10);
  var n = String(s); while (n.length < 5) n = "0" + n;
  localStorage.setItem(k, (s + 1).toString()); return n;
}
function getLocalOrders() { try { return JSON.parse(localStorage.getItem("xiaohanbao_orders") || "[]"); } catch(e) { return []; } }
function saveLocalOrders(o) { localStorage.setItem("xiaohanbao_orders", JSON.stringify(o)); }

async function syncOrders(orders) {
  try {
    var d = encodeURIComponent(JSON.stringify(orders[0]));
    var r = await fetch(ORDER_WORKER + "/add?d=" + d);
    return await r.json();
  } catch(e) { return null; }
}
async function fetchOrders() {
  try {
    var r = await fetch(ORDER_WORKER + "/get");
    return await r.json();
  } catch(e) { return []; }
}

var form = document.querySelector("#booking-form"), totalPrice = document.querySelector("#total-price");
var result = document.querySelector("#form-result"), maleInput = document.querySelector("#male-count");
var femaleInput = document.querySelector("#female-count"), personFields = document.querySelector("#person-fields");

function buildPersonFields() {
  var m = parseInt(maleInput.value, 10) || 0, f = parseInt(femaleInput.value, 10) || 0, total = m + f;
  if (total === 0) { personFields.innerHTML = ""; return; }
  var html = "", idx = 0;
  for (var i = 0; i < m; i++) { idx++; html += '<div class="person-row"><span class="person-label">男生' + idx + '</span><input class="person-account" placeholder="平台账号" required /><input class="person-password" type="password" placeholder="平台密码" required /></div>'; }
  for (var i = 0; i < f; i++) { idx++; html += '<div class="person-row"><span class="person-label">女生' + idx + '</span><input class="person-account" placeholder="平台账号" required /><input class="person-password" type="password" placeholder="平台密码" required /></div>'; }
  personFields.innerHTML = html;
}
maleInput.addEventListener("input", function() { buildPersonFields(); updatePrice(); });
femaleInput.addEventListener("input", function() { buildPersonFields(); updatePrice(); });

function updatePrice() {
  var m = parseInt(maleInput.value, 10) || 0, f = parseInt(femaleInput.value, 10) || 0;
  if (m + f === 0) { totalPrice.textContent = "¥0"; return; }
  var tn = m + f, tier = tn >= 3 ? "3+" : Math.max(tn, 1), total = 0;
  if (m > 0) total += m * prices.male[tier]; if (f > 0) total += f * prices.female[tier];
  totalPrice.textContent = "¥" + total; var pa = document.querySelector("#pay-amount"); if (pa) pa.textContent = "¥" + total;
}
buildPersonFields();

form.addEventListener("submit", async function(e) {
  e.preventDefault();
  var school = document.querySelector("#school").value;
  var runType = document.querySelector("#run-type").value === "morning" ? "早操跑" : "阳光跑";
  var m = parseInt(maleInput.value, 10) || 0, f = parseInt(femaleInput.value, 10) || 0;
  if (m + f === 0) { result.innerHTML = "请至少选择1人下单"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
  var accounts = document.querySelectorAll("#person-fields .person-account"), passwords = document.querySelectorAll("#person-fields .person-password");
  var persons = [];
  for (var i = 0; i < accounts.length; i++) {
    var acct = accounts[i].value.trim(), pwd = passwords[i].value;
    if (!acct || !pwd) { result.innerHTML = "请填写所有人的账号和密码"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    persons.push({ account: acct, password_encrypted: await encrypt(pwd) });
  }
  var tn = m + f, tier = tn >= 3 ? "3+" : Math.max(tn, 1);
  var mPrice = m > 0 ? prices.male[tier] : 0, fPrice = f > 0 ? prices.female[tier] : 0;
  var total = m * mPrice + f * fPrice, parts = [];
  if (m > 0) parts.push(m + "男"); if (f > 0) parts.push(f + "女");
  var peopleLabel = parts.join(" + "), orderNum = generateOrderNumber();
  var order = { id: Date.now(), orderNum: orderNum, time: new Date().toLocaleString("zh-CN"), school: school, maleCount: m, femaleCount: f, peopleLabel: peopleLabel, malePrice: mPrice, femalePrice: fPrice, runType: runType, price: total, persons: persons };
  var local = getLocalOrders(); local.unshift(order); saveLocalOrders(local);
  syncOrders(local);
  var breakdown = []; if (m > 0) breakdown.push(m + "男 × ¥" + mPrice); if (f > 0) breakdown.push(f + "女 × ¥" + fPrice);
  result.innerHTML = "<strong style='font-size:18px;color:#6f412e'>订单提交成功！编号：#" + orderNum + "</strong><br><br>学校：" + school + " · " + runType + "<br>人数：" + peopleLabel + "<br>单价：" + breakdown.join("，") + "<br>总金额：<b>¥" + total + "</b><br><br><span style='color:#c0392b;font-size:14px'>📸 请截图保存此页面！</span><br>添加客服微信 <b>ATSN112266</b>，备注编号 <b>#" + orderNum + "</b>";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  var payS = document.querySelector("#pay"), payC = document.querySelector("#pay-content");
  if (payS) { payS.style.display = "block"; payC.innerHTML = "<img src='alipay-qr.jpg' style='width:240px;height:240px;border-radius:14px;border:3px solid #e9dfd2' /><p style='font-size:14px;color:#9b8f82;margin:14px 0'>支付宝扫码支付 <b id='pay-amount' style='color:#6f412e'>¥" + total + "</b></p><p style='font-size:13px;color:#6b5e52'>支付后请添加客服微信 <b>ATSN112266</b> 确认</p>"; payS.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  passwords.forEach(function(p) { p.value = ""; });
});

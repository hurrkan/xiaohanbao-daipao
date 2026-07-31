/* ── Config ── */
var ENC_SECRET = "whs91cnm";
var prices = { female: { 1: 70, 2: 65, "3+": 60 }, male: { 1: 80, 2: 75, "3+": 70 } };

async function deriveKey(pw, salt) {
  var e = new TextEncoder();
  var km = await crypto.subtle.importKey("raw", e.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function encrypt(text) {
  var s = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var k = await deriveKey(ENC_SECRET, s);
  var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, k, new TextEncoder().encode(text));
  var c = new Uint8Array(16 + 12 + ct.byteLength);
  c.set(s, 0); c.set(iv, 16); c.set(new Uint8Array(ct), 28);
  return btoa(String.fromCharCode.apply(null, c));
}
function generateOrderNumber() {
  var k = "xh_order_seq_global";
  var s = parseInt(localStorage.getItem(k) || "0", 10);
  var n = ("0000" + s).slice(-5);
  localStorage.setItem(k, (s + 1).toString());
  return n;
}
function getLocalOrders() {
  try { return JSON.parse(localStorage.getItem("xiaohanbao_orders") || "[]"); } catch(e) { return []; }
}
function saveLocalOrders(o) { localStorage.setItem("xiaohanbao_orders", JSON.stringify(o)); }

var form = document.querySelector("#booking-form");
var totalPrice = document.querySelector("#total-price");
var result = document.querySelector("#form-result");
var maleInput = document.querySelector("#male-count");
var femaleInput = document.querySelector("#female-count");
var personFields = document.querySelector("#person-fields");

function buildPersonFields() {
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  var total = m + f;
  if (total === 0) { personFields.innerHTML = ""; return; }
  var html = "", idx = 0;
  for (var i = 0; i < m; i++) {
    idx++;
    html += '<div class="person-row"><span class="person-label">\u7537\u751f' + idx + '</span><input class="person-account" placeholder="\u5e73\u53f0\u8d26\u53f7" required /><input class="person-password" type="password" placeholder="\u5e73\u53f0\u5bc6\u7801" required /></div>';
  }
  for (var i = 0; i < f; i++) {
    idx++;
    html += '<div class="person-row"><span class="person-label">\u5973\u751f' + idx + '</span><input class="person-account" placeholder="\u5e73\u53f0\u8d26\u53f7" required /><input class="person-password" type="password" placeholder="\u5e73\u53f0\u5bc6\u7801" required /></div>';
  }
  personFields.innerHTML = html;
}
maleInput.addEventListener("input", function() { buildPersonFields(); updatePrice(); });
femaleInput.addEventListener("input", function() { buildPersonFields(); updatePrice(); });

function updatePrice() {
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m + f === 0) { totalPrice.textContent = "\u00a50"; return; }
  var tn = m + f;
  var tier = tn >= 3 ? "3+" : Math.max(tn, 1);
  var total = 0;
  if (m > 0) total += m * prices.male[tier];
  if (f > 0) total += f * prices.female[tier];
  totalPrice.textContent = "\u00a5" + total;
  var pa = document.querySelector("#pay-amount");
  if (pa) pa.textContent = "\u00a5" + total;
}
buildPersonFields();

form.addEventListener("submit", async function(e) {
  e.preventDefault();
  var school = document.querySelector("#school").value;
  var runType = document.querySelector("#run-type").value === "morning" ? "\u65e9\u64cd\u8dd1" : "\u9633\u5149\u8dd1";
  var m = parseInt(maleInput.value, 10) || 0;
  var f = parseInt(femaleInput.value, 10) || 0;
  if (m + f === 0) { result.innerHTML = "\u8bf7\u81f3\u5c11\u9009\u62e91\u4eba\u4e0b\u5355"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
  var accounts = document.querySelectorAll("#person-fields .person-account");
  var passwords = document.querySelectorAll("#person-fields .person-password");
  var persons = [];
  for (var i = 0; i < accounts.length; i++) {
    var acct = accounts[i].value.trim();
    var pwd = passwords[i].value;
    if (!acct || !pwd) { result.innerHTML = "\u8bf7\u586b\u5199\u6240\u6709\u4eba\u7684\u8d26\u53f7\u548c\u5bc6\u7801"; result.scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    persons.push({ account: acct, password_encrypted: await encrypt(pwd) });
  }
  var tn = m + f;
  var tier = tn >= 3 ? "3+" : Math.max(tn, 1);
  var mPrice = m > 0 ? prices.male[tier] : 0;
  var fPrice = f > 0 ? prices.female[tier] : 0;
  var total = m * mPrice + f * fPrice;
  var parts = [];
  if (m > 0) parts.push(m + "\u7537");
  if (f > 0) parts.push(f + "\u5973");
  var peopleLabel = parts.join(" + ");
  var orderNum = generateOrderNumber();
  var order = { id: Date.now(), orderNum: orderNum, time: new Date().toLocaleString("zh-CN"), school: school, maleCount: m, femaleCount: f, peopleLabel: peopleLabel, malePrice: mPrice, femalePrice: fPrice, runType: runType, price: total, persons: persons };
  var local = getLocalOrders();
  local.unshift(order);
  saveLocalOrders(local);
  var breakdown = [];
  if (m > 0) breakdown.push(m + "\u7537 \u00d7 \u00a5" + mPrice);
  if (f > 0) breakdown.push(f + "\u5973 \u00d7 \u00a5" + fPrice);
  result.innerHTML = "<strong style='font-size:18px;color:#6f412e'>\u8ba2\u5355\u63d0\u4ea4\u6210\u529f\uff01\u7f16\u53f7\uff1a#" + orderNum + "</strong><br><br>\u5b66\u6821\uff1a" + school + " \u00b7 " + runType + "<br>\u4eba\u6570\uff1a" + peopleLabel + "<br>\u5355\u4ef7\uff1a" + breakdown.join("\uff0c") + "<br>\u603b\u91d1\u989d\uff1a<b>\u00a5" + total + "</b><br><br><span style='color:#c0392b;font-size:14px'>\ud83d\udcf8 \u8bf7\u622a\u56fe\u4fdd\u5b58\u6b64\u9875\u9762\uff01</span><br>\u6dfb\u52a0\u5ba2\u670d\u5fae\u4fe1 <b>ATSN112266</b>\uff0c\u5907\u6ce8\u7f16\u53f7 <b>#" + orderNum + "</b>";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  var payS = document.querySelector("#pay");
  var payC = document.querySelector("#pay-content");
  if (payS) {
    payS.style.display = "block";
    payC.innerHTML = "<img src='alipay-qr.jpg' style='width:240px;height:240px;border-radius:14px;border:3px solid #e9dfd2' /><p style='font-size:14px;color:#9b8f82;margin:14px 0'>\u652f\u4ed8\u5b9d\u626b\u7801\u652f\u4ed8 <b id='pay-amount' style='color:#6f412e'>\u00a5" + total + "</b></p><p style='font-size:13px;color:#6b5e52'>\u652f\u4ed8\u540e\u8bf7\u6dfb\u52a0\u5ba2\u670d\u5fae\u4fe1 <b>ATSN112266</b> \u786e\u8ba4</p>";
    payS.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  passwords.forEach(function(p) { p.value = ""; });
});

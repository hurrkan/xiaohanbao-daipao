var ORDER_WORKER = "https://long-sun-6b2e.3218908655.workers.dev";
var STORAGE_KEY = "xiaohanbao_orders";
var ENC_SECRET = "whs91cnm";
var DEFAULT_PASSWORD = "whs91cnm", PWD_KEY = "xiaohanbao_admin_pwd";

function getStoredPassword() { return localStorage.getItem(PWD_KEY) || DEFAULT_PASSWORD; }
function setStoredPassword(pwd) { localStorage.setItem(PWD_KEY, pwd); }

async function deriveKey(pw, salt) {
  var e = new TextEncoder(), km = await crypto.subtle.importKey("raw", e.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
async function decrypt(combinedB64) {
  try {
    var combined = Uint8Array.from(atob(combinedB64), function(c) { return c.charCodeAt(0); });
    var salt = combined.slice(0, 16), iv = combined.slice(16, 28), ciphertext = combined.slice(28);
    var key = await deriveKey(ENC_SECRET, salt), dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return new TextDecoder().decode(dec);
  } catch(e) { return "[decrypt failed]"; }
}

var STORAGE_URL = "https://long-sun-6b2e.3218908655.workers.dev/api/orders";
async function getServerOrders() { try { var r = await fetch(STORAGE_URL); if (r.ok) return await r.json(); } catch(e) {} return getLocalOrders(); }
function getLocalOrders() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch(e) { return []; } }

async function fetchRemoteOrders() {
  try { var r = await fetch(ORDER_WORKER + "/get"); var d = await r.json(); return Array.isArray(d) ? d : []; }
  catch(e) { return []; }
}

var loginWall = document.querySelector("#login-wall"), adminPanel = document.querySelector("#admin-panel");
var loginForm = document.querySelector("#login-form"), loginPwd = document.querySelector("#login-pwd");
var loginError = document.querySelector("#login-error"), orderCount = document.querySelector("#order-count");
var emptyState = document.querySelector("#empty-state"), tableWrap = document.querySelector("#table-wrap");
var tbody = document.querySelector("#orders-tbody"), pwdModal = document.querySelector("#pwd-modal");
var pwdForm = document.querySelector("#pwd-form"), pwdError = document.querySelector("#pwd-error");

async function renderOrders() {
  var remote = await fetchRemoteOrders();
  var local = getLocalOrders();
  var ids = new Set(remote.map(function(o) { return o.id; }));
  var all = remote.slice();
  local.forEach(function(o) { if (!ids.has(o.id)) all.push(o); });
  all.sort(function(a, b) { return b.id - a.id; });
  orderCount.textContent = all.length + " 条订单";
  if (all.length === 0) { emptyState.style.display = "block"; tableWrap.style.display = "none"; return; }
  emptyState.style.display = "none"; tableWrap.style.display = "block";
  var rows = [];
  for (var i = 0; i < all.length; i++) {
    var o = all[i];
    var personInfo = o.persons ? o.persons.map(function(p, j) { return "<div>#" + (j+1) + ": " + esc(p.account) + "</div>"; }).join("") : esc(o.account || "");
    rows.push("<tr><td>" + esc(o.orderNum) + "</td><td>" + esc(o.time) + "</td><td>" + esc(o.school) + "</td><td>" + esc(o.runType) + "</td><td>" + esc(o.maleCount || 0) + "</td><td>" + esc(o.femaleCount || 0) + "</td><td>¥" + o.price + "</td><td>" + personInfo + "</td><td><button class='btn-delete' data-id='" + o.id + "'>删除</button></td></tr>");
  }
  tbody.innerHTML = rows.join("");
  tbody.querySelectorAll(".btn-delete").forEach(function(b) {
    b.addEventListener("click", function() {
      if (!confirm("确认删除？")) return;
      var id = parseInt(b.dataset.id, 10);
      var local = getLocalOrders().filter(function(o) { return o.id !== id; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      renderOrders();
    });
  });
}
function esc(s) { if (!s) return ""; return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

loginForm.addEventListener("submit", function(e) {
  e.preventDefault();
  if (loginPwd.value === getStoredPassword()) { loginWall.style.display = "none"; adminPanel.style.display = "block"; loginError.textContent = ""; renderOrders(); }
  else { loginError.textContent = "密码错误"; loginPwd.value = ""; loginPwd.focus(); }
});
document.querySelector("#btn-logout").addEventListener("click", function() { adminPanel.style.display = "none"; loginWall.style.display = "flex"; loginPwd.value = ""; });
document.querySelector("#btn-change-pwd").addEventListener("click", function() { pwdModal.style.display = "flex"; document.querySelector("#pwd-old").value = ""; document.querySelector("#pwd-new").value = ""; document.querySelector("#pwd-confirm").value = ""; pwdError.textContent = ""; });
document.querySelector("#btn-modal-cancel").addEventListener("click", function() { pwdModal.style.display = "none"; });
pwdForm.addEventListener("submit", function(e) {
  e.preventDefault();
  var o = document.querySelector("#pwd-old").value, n = document.querySelector("#pwd-new").value, c = document.querySelector("#pwd-confirm").value;
  if (o !== getStoredPassword()) { pwdError.textContent = "当前密码错误"; return; }
  if (n.length < 4) { pwdError.textContent = "新密码至少4位"; return; }
  if (n !== c) { pwdError.textContent = "两次不一致"; return; }
  setStoredPassword(n); pwdModal.style.display = "none"; alert("密码修改成功");
});
pwdModal.addEventListener("click", function(e) { if (e.target === pwdModal) pwdModal.style.display = "none"; });

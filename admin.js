/* ── Config ── */
var SUPABASE_URL = "";   // e.g. "https://xxxxx.supabase.co"
var SUPABASE_KEY = "";   // anon/public key

var ENC_SECRET = "whs91cnm";

/* ── Encryption (AES-GCM) ── */
async function deriveKey(password, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function decrypt(combinedB64) {
  try {
    var combined = Uint8Array.from(atob(combinedB64), function(c) { return c.charCodeAt(0); });
    var salt = combined.slice(0, 16);
    var iv = combined.slice(16, 28);
    var ciphertext = combined.slice(28);
    var key = await deriveKey(ENC_SECRET, salt);
    var dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return new TextDecoder().decode(dec);
  } catch (e) { return "[decrypt failed]"; }
}

/* ── Auth ── */
var DEFAULT_PASSWORD = "whs91cnm";
var PWD_KEY = "xiaohanbao_admin_pwd";

function getStoredPassword() { return localStorage.getItem(PWD_KEY) || DEFAULT_PASSWORD; }
function setStoredPassword(pwd) { localStorage.setItem(PWD_KEY, pwd); }

/* ── Storage ── */
var STORAGE_KEY = "xiaohanbao_orders";
var supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  import("https://esm.sh/@supabase/supabase-js@2").then(function(m) {
    supabase = m.createClient(SUPABASE_URL, SUPABASE_KEY);
  });
}

function getLocalOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

/* ── DOM ── */
var loginWall  = document.querySelector("#login-wall");
var adminPanel = document.querySelector("#admin-panel");
var loginForm  = document.querySelector("#login-form");
var loginPwd   = document.querySelector("#login-pwd");
var loginError = document.querySelector("#login-error");
var orderCount = document.querySelector("#order-count");
var emptyState = document.querySelector("#empty-state");
var tableWrap  = document.querySelector("#table-wrap");
var tbody      = document.querySelector("#orders-tbody");
var pwdModal   = document.querySelector("#pwd-modal");
var pwdForm    = document.querySelector("#pwd-form");
var pwdError   = document.querySelector("#pwd-error");

/* ── Render ── */
async function renderOrders() {
  var orders = [];

  // Try Supabase first
  if (supabase) {
    try {
      var { data, error } = await supabase.from("orders").select("*").order("id", { ascending: false });
      if (!error && data) {
        orders = data.map(function(o) {
          return {
            id: o.id, time: o.time, school: o.school, gender: o.gender,
            people: o.people, peopleLabel: o.people_label, runType: o.run_type,
            price: o.price, date: o.date, account: o.account,
            password_encrypted: o.password_encrypted
          };
        });
      }
    } catch (_) {}
  }

  // Merge with localStorage
  var localOrders = getLocalOrders();
  var localIds = new Set(orders.map(function(o) { return o.id; }));
  localOrders.forEach(function(o) {
    if (!localIds.has(o.id)) orders.push(o);
  });

  orders.sort(function(a, b) { return b.id - a.id; });
  orderCount.textContent = orders.length + " 条订单";

  if (orders.length === 0) {
    emptyState.style.display = "block";
    tableWrap.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  tableWrap.style.display = "block";

  // Decrypt all passwords
  var rows = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    var decryptedPwd = o.password_encrypted ? await decrypt(o.password_encrypted) : "";
    rows.push(
      "<tr>" +
      "<td>" + esc(o.orderNum || "") + "</td><td>" + esc(o.time) + "</td>" +
      "<td>" + esc(o.school) + "</td>" +
      "<td>" + esc(o.runType) + "</td>" +
      "<td>" + esc(o.gender) + "</td>" +
      "<td>" + esc(o.peopleLabel) + "</td>" +
      "<td>¥" + o.price + "</td>" +
      "<td>" + esc(o.date) + "</td>" +
      "<td>" + esc(o.account) + "</td>" +
      "<td>" + esc(decryptedPwd) + "</td>" +
      "<td><button class=\"btn-delete\" data-id=\"" + o.id + "\">删除</button></td>" +
      "</tr>"
    );
  }
  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll(".btn-delete").forEach(function(btn) {
    btn.addEventListener("click", function() {
      if (!confirm("确认删除这条订单？")) return;
      var id = parseInt(btn.dataset.id, 10);
      // Delete from localStorage
      var local = getLocalOrders().filter(function(o) { return o.id !== id; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      // Delete from Supabase if connected
      if (supabase) {
        supabase.from("orders").delete().eq("id", id).then(function() {});
      }
      renderOrders();
    });
  });
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Login ── */
loginForm.addEventListener("submit", function(e) {
  e.preventDefault();
  if (loginPwd.value === getStoredPassword()) {
    loginWall.style.display = "none";
    adminPanel.style.display = "block";
    loginError.textContent = "";
    renderOrders();
  } else {
    loginError.textContent = "密码错误，请重试";
    loginPwd.value = "";
    loginPwd.focus();
  }
});

document.querySelector("#btn-logout").addEventListener("click", function() {
  adminPanel.style.display = "none";
  loginWall.style.display = "flex";
  loginPwd.value = "";
  loginError.textContent = "";
});

/* ── Change Password ── */
document.querySelector("#btn-change-pwd").addEventListener("click", function() {
  pwdModal.style.display = "flex";
  document.querySelector("#pwd-old").value = "";
  document.querySelector("#pwd-new").value = "";
  document.querySelector("#pwd-confirm").value = "";
  pwdError.textContent = "";
});

document.querySelector("#btn-modal-cancel").addEventListener("click", function() {
  pwdModal.style.display = "none";
});

pwdForm.addEventListener("submit", function(e) {
  e.preventDefault();
  var old = document.querySelector("#pwd-old").value;
  var neu = document.querySelector("#pwd-new").value;
  var confirm = document.querySelector("#pwd-confirm").value;
  if (old !== getStoredPassword()) { pwdError.textContent = "当前密码错误"; return; }
  if (neu.length < 4) { pwdError.textContent = "新密码至少 4 位"; return; }
  if (neu !== confirm) { pwdError.textContent = "两次输入的新密码不一致"; return; }
  setStoredPassword(neu);
  pwdModal.style.display = "none";
  alert("密码修改成功！\n\n注意：修改密码后，之前加密的订单密码将无法解密。");
});

pwdModal.addEventListener("click", function(e) {
  if (e.target === pwdModal) pwdModal.style.display = "none";
});

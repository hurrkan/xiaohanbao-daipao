/* ── Config ── */
// Supabase: create a free project at https://supabase.com, then fill these in
const SUPABASE_URL = "";   // e.g. "https://xxxxx.supabase.co"
const SUPABASE_KEY = "";   // anon/public key from Supabase dashboard

const ENC_SECRET = "whs91cnm";

/* ── Pricing ── */
var prices = {
  female: { 1: 70, 2: 65, "3+": 60 },
  male:   { 1: 80, 2: 75, "3+": 70 }
};

/* ── Encryption (AES-GCM) ── */
async function deriveKey(password, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}

async function encrypt(text) {
  var salt = crypto.getRandomValues(new Uint8Array(16));
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var key = await deriveKey(ENC_SECRET, salt);
  var ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(text));
  var combined = new Uint8Array(16 + 12 + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, 16);
  combined.set(new Uint8Array(ciphertext), 28);
  return btoa(String.fromCharCode.apply(null, combined));
}

/* ── Supabase client ── */
var supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  import("https://esm.sh/@supabase/supabase-js@2").then(function(m) {
    supabase = m.createClient(SUPABASE_URL, SUPABASE_KEY);
  });
}

/* ── Storage helpers ── */
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

function getPeopleTier(n) {
  if (n >= 3) return "3+";
  return n;
}

function updatePrice() {
  var n = parseInt(peopleInput.value, 10) || 1;
  var tier = getPeopleTier(n);
  var gender = document.querySelector("input[name=gender]:checked").value;
  totalPrice.textContent = "¥" + prices[gender][tier];
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
  var n = parseInt(peopleInput.value, 10) || 1;
  var label = n >= 3 ? n + "人组团" : n === 2 ? "2人组团" : "单独下单";
  var date = dateInput.value;
  var account = document.querySelector("#account").value.trim();
  var plainPassword = document.querySelector("#password").value;
  var genderVal = genderEl.value;

  // Encrypt password
  var passwordEncrypted = await encrypt(plainPassword);

  var order = {
    id: Date.now(),
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

  // Try Supabase first, fall back to localStorage
  var saved = false;
  if (supabase) {
    try {
      var sbOrder = {
        id: order.id,
        time: order.time,
        school: order.school,
        gender: order.gender,
        people: order.people,
        people_label: order.peopleLabel,
        run_type: order.runType,
        price: order.price,
        date: order.date,
        account: order.account,
        password_encrypted: order.password_encrypted
      };
      var { error } = await supabase.from("orders").insert(sbOrder);
      if (!error) saved = true;
    } catch (_) {}
  }

  // localStorage fallback
  var localOrders = getLocalOrders();
  localOrders.unshift(order);
  saveLocalOrders(localOrders);

  result.textContent = "预约信息已提交：" + school + " · 阳光跑 · " + label + "。请添加客服微信 ATSN112266 确认。";
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Clear sensitive fields
  document.querySelector("#password").value = "";
});

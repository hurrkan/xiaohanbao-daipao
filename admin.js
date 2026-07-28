/* ── Admin Authentication & Order Management ── */

const DEFAULT_PASSWORD = "whs91cnm";
const STORAGE_KEY = "xiaohanbao_orders";
const PWD_KEY = "xiaohanbao_admin_pwd";

/* ── Password helpers ── */
function getStoredPassword() {
  return localStorage.getItem(PWD_KEY) || DEFAULT_PASSWORD;
}

function setStoredPassword(pwd) {
  localStorage.setItem(PWD_KEY, pwd);
}

/* ── Order helpers ── */
function getOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

/* ── DOM refs ── */
const loginWall   = document.querySelector("#login-wall");
const adminPanel  = document.querySelector("#admin-panel");
const loginForm   = document.querySelector("#login-form");
const loginPwd    = document.querySelector("#login-pwd");
const loginError  = document.querySelector("#login-error");
const orderCount  = document.querySelector("#order-count");
const emptyState  = document.querySelector("#empty-state");
const tableWrap   = document.querySelector("#table-wrap");
const tbody       = document.querySelector("#orders-tbody");
const pwdModal    = document.querySelector("#pwd-modal");
const pwdForm     = document.querySelector("#pwd-form");
const pwdError    = document.querySelector("#pwd-error");

/* ── Render orders table ── */
function renderOrders() {
  const orders = getOrders();
  orderCount.textContent = orders.length + " 条订单";

  if (orders.length === 0) {
    emptyState.style.display = "block";
    tableWrap.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  tableWrap.style.display = "block";

  tbody.innerHTML = orders.map((o) => `
    <tr>
      <td>${esc(o.time)}</td>
      <td>${esc(o.school)}</td>
      <td>${esc(o.runType)}</td>
      <td>${esc(o.gender)}</td>
      <td>${esc(o.peopleLabel)}</td>
      <td>¥${o.price}</td>
      <td>${esc(o.date)}</td>
      <td>${esc(o.account)}</td>
      <td>${esc(o.password)}</td>
      <td><button class="btn-delete" data-id="${o.id}">删除</button></td>
    </tr>
  `).join("");

  // Bind delete buttons
  tbody.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("确认删除这条订单？")) return;
      const id = parseInt(btn.dataset.id, 10);
      const orders = getOrders().filter((o) => o.id !== id);
      saveOrders(orders);
      renderOrders();
    });
  });
}

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── Login ── */
loginForm.addEventListener("submit", (e) => {
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

/* ── Logout ── */
document.querySelector("#btn-logout").addEventListener("click", () => {
  adminPanel.style.display = "none";
  loginWall.style.display = "flex";
  loginPwd.value = "";
  loginError.textContent = "";
});

/* ── Change Password Modal ── */
document.querySelector("#btn-change-pwd").addEventListener("click", () => {
  pwdModal.style.display = "flex";
  document.querySelector("#pwd-old").value = "";
  document.querySelector("#pwd-new").value = "";
  document.querySelector("#pwd-confirm").value = "";
  pwdError.textContent = "";
});

document.querySelector("#btn-modal-cancel").addEventListener("click", () => {
  pwdModal.style.display = "none";
});

pwdForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const old = document.querySelector("#pwd-old").value;
  const neu = document.querySelector("#pwd-new").value;
  const confirm = document.querySelector("#pwd-confirm").value;

  if (old !== getStoredPassword()) {
    pwdError.textContent = "当前密码错误";
    return;
  }

  if (neu.length < 4) {
    pwdError.textContent = "新密码至少 4 位";
    return;
  }

  if (neu !== confirm) {
    pwdError.textContent = "两次输入的新密码不一致";
    return;
  }

  setStoredPassword(neu);
  pwdModal.style.display = "none";
  alert("密码修改成功！");
});

// Close modal on overlay click
pwdModal.addEventListener("click", (e) => {
  if (e.target === pwdModal) pwdModal.style.display = "none";
});


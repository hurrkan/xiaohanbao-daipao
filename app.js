const prices = {
  female: { 1: 70, 2: 65, "3+": 60 },
  male:   { 1: 80, 2: 75, "3+": 70 }
};

const form = document.querySelector("#booking-form");
const totalPrice = document.querySelector("#total-price");
const result = document.querySelector("#form-result");
const dateInput = document.querySelector("#date");
const peopleInput = document.querySelector("#people");

dateInput.min = new Date().toISOString().split("T")[0];

function getPeopleTier(n) {
  if (n >= 3) return "3+";
  return n;
}

function updatePrice() {
  const n = parseInt(peopleInput.value, 10) || 1;
  const tier = getPeopleTier(n);
  const gender = document.querySelector("input[name=gender]:checked").value;
  totalPrice.textContent = `¥${prices[gender][tier]}`;
}

peopleInput.addEventListener("input", updatePrice);
document.querySelectorAll("input[name=gender]").forEach((i) =>
  i.addEventListener("change", updatePrice)
);

function getOrders() {
  try { return JSON.parse(localStorage.getItem("xiaohanbao_orders") || "[]"); }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem("xiaohanbao_orders", JSON.stringify(orders));
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const school = document.querySelector("#school").value;
  const genderEl = document.querySelector("input[name=gender]:checked");
  const genderLabel = genderEl.parentElement.querySelector("span").textContent;
  const n = parseInt(peopleInput.value, 10) || 1;
  const label = n >= 3 ? `${n}人组团` : n === 2 ? "2人组团" : "单独下单";
  const date = dateInput.value;
  const account = document.querySelector("#account").value.trim();
  const password = document.querySelector("#password").value;

  const order = {
    id: Date.now(),
    time: new Date().toLocaleString("zh-CN"),
    school,
    gender: genderLabel,
    people: n,
    peopleLabel: label,
    runType: "阳光跑",
    price: prices[genderEl.value][getPeopleTier(n)],
    date,
    account,
    password
  };

  const orders = getOrders();
  orders.unshift(order);
  saveOrders(orders);

  result.textContent = `预约信息已提交：${school} · 阳光跑 · ${label}。请添加客服微信 ATSN112266 确认。`;
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Clear sensitive fields
  document.querySelector("#password").value = "";
});

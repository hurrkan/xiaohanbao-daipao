const prices = {
  sunshine: { female: 60, male: 70 },
  morning: { female: 50, male: 60 }
};

const form = document.querySelector('#booking-form');
const totalPrice = document.querySelector('#total-price');
const result = document.querySelector('#form-result');
const dateInput = document.querySelector('#date');

dateInput.min = new Date().toISOString().split('T')[0];

function updatePrice() {
  const type = document.querySelector('#run-type').value;
  const gender = document.querySelector('input[name="gender"]:checked').value;
  totalPrice.textContent = `¥${prices[type][gender]}`;
}

document.querySelector('#run-type').addEventListener('change', updatePrice);
document.querySelectorAll('input[name="gender"]').forEach((input) => input.addEventListener('change', updatePrice));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const school = document.querySelector('#school').value;
  const type = document.querySelector('#run-type').value === 'sunshine' ? '阳光跑' : '早操跑';
  result.textContent = `预约信息已准备好：${school} · ${type}。请添加客服微信 ATSN112266 确认。`;
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

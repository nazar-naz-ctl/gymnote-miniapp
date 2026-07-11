// Тимчасова заглушка — повноцінний екран зробимо окремим кроком
async function loadBuilderScreen() {
  document.getElementById('screen-builder').innerHTML = `
    <h1 class="title" style="font-size:26px;margin-bottom:14px;">Білдер</h1>
    <div class="card" style="text-align:center;color:#6B6B78;">Скоро тут з'явиться конструктор тренувань 🛠️</div>
  `;
}

export { loadBuilderScreen };
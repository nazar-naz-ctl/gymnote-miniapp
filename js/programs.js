// Тимчасова заглушка — повноцінний екран зробимо окремим кроком
async function loadProgramsScreen() {
  document.getElementById('screen-programs').innerHTML = `
    <h1 class="title" style="font-size:26px;margin-bottom:14px;">Програми</h1>
    <div class="card" style="text-align:center;color:#6B6B78;">Скоро тут з'явиться список програм 🏋️</div>
  `;
}

export { loadProgramsScreen };
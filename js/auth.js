// ============================================================
// auth.js — авторизація через Telegram WebApp + API-клієнт
// ============================================================

const tg = window.Telegram?.WebApp;

// Викликати одразу при завантаженні будь-якої сторінки Mini App
function initTelegramApp() {
  if (!tg) {
    console.error("Telegram.WebApp недоступний — сторінка відкрита поза Telegram");
    return false;
  }
  tg.ready();
  tg.expand(); // розгортає на весь екран
  return true;
}

// Сирий рядок initData — саме його треба передавати на бекенд,
// НЕ парсити і НЕ декодувати самостійно на фронті.
// Бекенд сам розбере його через urllib.parse.parse_qsl.
function getInitData() {
  if (!tg || !tg.initData) {
    console.error("initData порожній. Можливі причини: сторінка відкрита не через кнопку бота, або бот не налаштований як Mini App (BotFather → /newapp)");
    return "";
  }
  return tg.initData;
}

// Базовий helper для всіх запитів до API.
// Автоматично додає X-Init-Data у кожен запит.
// ВАЖЛИВО: більше НЕ використовуємо X-Telegram-User-Id — це був
// небезпечний "бекдор", його треба прибрати і з бекенду теж.
async function apiFetch(path, options = {}) {
  const initData = getInitData();

  const res = await fetch(`https://gymnote.duckdns.org${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Init-Data": initData,
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    // Типові причини 401 (перевіряти в такому порядку):
    // 1. Сторінка відкрита в звичайному браузері, а не через кнопку в боті
    // 2. BOT_TOKEN на сервері не збігається з ботом, у якому налаштований Mini App
    // 3. initData протух (Telegram видає його на короткий час) — просто оновити сторінку
    console.error("401: авторизація не пройшла. Перевір, що відкрито через бота, і що BOT_TOKEN на сервері правильний.");
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

// Приклади використання в інших файлах (journal.js, programs.js тощо):
//
// import { initTelegramApp, apiFetch } from './auth.js';
// initTelegramApp();
// const user = await apiFetch('/api/user');

export { initTelegramApp, getInitData, apiFetch };
# AZS Hours

Проект для анализа и визуализации графиков работы автомобильных заправочных станций (АЗС). 

Приложение предназначено для сбора, хранения и удобного отображения информации о загруженности или режимах работы станций, используя парсинг данных и базу данных Supabase. Интерфейс построен на Vue 3, данные отображаются в виде интерактивных графиков.

## 🚀 Посмотреть в действии

Проект автоматически деплоится на GitHub Pages.
**Демо:** [https://kalimulin.github.io/azs-hours/](https://kalimulin.github.io/azs-hours/)

## 🛠 Технологии

- **Frontend:** Vue 3 (Composition API), Vite, Pinia, Vue Router
- **UI Библиотека:** Naive UI
- **Графики:** Chart.js, vue-chartjs
- **Backend / База данных:** Supabase (@supabase/supabase-js)
- **Парсинг данных:** cheerio

## 📦 Локальный запуск

1. **Клонируйте репозиторий:**
   ```bash
   git clone https://github.com/kalimulin/azs-hours.git
   cd azs-hours
   ```

2. **Установите зависимости:**
   ```bash
   npm install
   ```

3. **Настройте переменные окружения:**
   Скопируйте `.env.example` в `.env` и укажите ваши ключи для Supabase:
   ```bash
   cp .env.example .env
   ```
   Откройте `.env` и добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.

4. **Запустите сервер для разработки:**
   ```bash
   npm run dev
   ```
   Приложение будет доступно по адресу `http://localhost:5173/`

## 🤖 Дополнительные скрипты

- `npm run parse` — запуск скрипта парсинга данных о часах работы АЗС (скрипт находится в `scripts/parse.js`).
- `npm run build` — сборка проекта для продакшена (в папку `dist`).
- `npm run type-check` — проверка типов TypeScript.

## 🔄 Автоматический деплой

Проект использует GitHub Actions для автоматической сборки и публикации в GitHub Pages при каждом пуше в ветку `main` или `master`.

Конфигурация деплоя находится в `.github/workflows/deploy.yml`.
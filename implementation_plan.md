# АЗС-Часы — Веб-приложение мониторинга работы АЗС

Приложение для отслеживания и визуализации работы АЗС Астраханской области. Данные парсятся с сайта [azs.astrobl.ru](https://azs.astrobl.ru/) и хранятся в Supabase. Публичная часть показывает статистику работы по часам и интегральный показатель «АЗС-часы».

## Принятые решения (из интервью)

| Решение | Выбор |
|---|---|
| Архитектура | SPA на Vue 3 + TypeScript (Vite), один проект, два роута (`/` и `/admin`) |
| UI-библиотека | Naive UI |
| Стейт-менеджер | Pinia |
| БД | Supabase (PostgreSQL) |
| Парсинг сайта | Supabase Edge Function (серверный парсинг) |
| Авторизация админки | Supabase Auth (email + пароль) |
| Идентификация АЗС | По номеру АЗС (уникальный на сайте) |
| Категории АЗС | Город/пригород и Районы, с фильтром |
| Переход через полночь | Один интервал: если `end < start` → переход через полночь, часы считаются на дату начала |
| Графики | Chart.js через vue-chartjs |
| Деплой | GitHub Pages (статика) |
| Язык | Русский |

---

## Proposed Changes

### 1. Инициализация проекта

#### [NEW] Проект Vue 3 + TypeScript + Vite

Создание проекта через `npm create vue@latest` с TypeScript, Vue Router, Pinia.

Установка зависимостей:
- `naive-ui` — UI-компоненты
- `@supabase/supabase-js` — клиент Supabase
- `vue-chartjs` + `chart.js` — графики
- `date-fns` — работа с датами
- `vue-router` — роутинг
- `pinia` — стейт-менеджмент

#### [NEW] [`.env.example`](file:///d:/code/azs-hours/.env.example)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

### 2. База данных (Supabase)

#### [NEW] [`supabase/migrations/001_initial_schema.sql`](file:///d:/code/azs-hours/supabase/migrations/001_initial_schema.sql)

Две таблицы:

```sql
-- Справочник АЗС
CREATE TABLE stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_number TEXT UNIQUE NOT NULL,     -- уникальный номер АЗС с сайта
  brand TEXT NOT NULL,                      -- Лукойл, Газпром и т.д.
  address TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'city',    -- 'city' (город/пригород) | 'district' (район)
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  fuel_types TEXT[],                        -- {'92', '95', 'ДТ'}
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Часы работы АЗС по дням
CREATE TABLE work_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_working BOOLEAN NOT NULL DEFAULT false,
  start_time TIME,                          -- например, '08:00'
  end_time TIME,                            -- например, '20:00'
  hours_worked NUMERIC(4,1) GENERATED ALWAYS AS (
    CASE
      WHEN NOT is_working THEN 0
      WHEN start_time IS NULL OR end_time IS NULL THEN 0
      WHEN end_time > start_time THEN
        EXTRACT(EPOCH FROM (end_time - start_time)) / 3600
      ELSE
        EXTRACT(EPOCH FROM ('24:00:00'::INTERVAL - start_time + end_time)) / 3600
    END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(station_id, date)
);
```

> [!NOTE]
> Поле `hours_worked` — вычисляемое (GENERATED). Оно автоматически считает часы работы с учётом перехода через полночь. АЗС-часы за день = `SUM(hours_worked)` по всем АЗС.

**RLS-политики:**
- `stations`: чтение — публичное, запись — только для авторизованных пользователей
- `work_hours`: чтение — публичное, запись — только для авторизованных пользователей

---

### 3. Supabase Edge Function (парсинг)

#### [NEW] [`supabase/functions/parse-azs/index.ts`](file:///d:/code/azs-hours/supabase/functions/parse-azs/index.ts)

Edge Function на Deno, которая:
1. Скачивает HTML с `https://azs.astrobl.ru/`
2. Парсит карточки АЗС (номер, бренд, адрес, координаты, виды топлива, часы работы, категория)
3. Upsert'ит данные в `stations` (по `station_number`)
4. Upsert'ит данные в `work_hours` (по `station_id` + `date`)
5. Возвращает результат: сколько АЗС обработано, сколько добавлено/обновлено

Вызывается из админки кнопкой «Спарсить данные за сегодня».

> [!IMPORTANT]
> Для парсинга HTML на Deno потребуется библиотека `deno-dom` (аналог cheerio для Deno).

---

### 4. Фронтенд — Общая структура

#### [NEW] Структура директорий `src/`

```
src/
├── App.vue
├── main.ts
├── router/
│   └── index.ts              -- Vue Router: /, /admin, /admin/login
├── stores/
│   ├── auth.ts               -- Pinia store для авторизации
│   ├── stations.ts           -- Pinia store для справочника АЗС
│   └── workHours.ts          -- Pinia store для часов работы
├── lib/
│   └── supabase.ts           -- инициализация Supabase клиента
├── types/
│   └── index.ts              -- TypeScript-интерфейсы (Station, WorkHour и т.д.)
├── components/
│   ├── HoursHeatmap.vue      -- таблица-тепловая карта (строки=АЗС, столбцы=часы)
│   ├── AzsHoursChart.vue     -- линейный график АЗС-часов за период
│   ├── DateNavigator.vue     -- datepicker + кнопки ←/→
│   ├── StationForm.vue       -- форма добавления/редактирования АЗС
│   └── WorkHoursForm.vue     -- форма ручного ввода часов работы
├── views/
│   ├── PublicView.vue        -- публичная страница (/)
│   ├── AdminView.vue         -- админка (/admin)
│   └── LoginView.vue         -- страница входа (/admin/login)
└── assets/
    └── main.css
```

---

### 5. Фронтенд — Роутинг

#### [NEW] [`src/router/index.ts`](file:///d:/code/azs-hours/src/router/index.ts)

| Роут | Компонент | Доступ |
|---|---|---|
| `/` | `PublicView` | Публичный |
| `/admin/login` | `LoginView` | Публичный |
| `/admin` | `AdminView` | Только авторизованные (guard) |

Navigation guard на `/admin` проверяет сессию Supabase Auth и редиректит на `/admin/login`.

---

### 6. Фронтенд — Публичная часть (`/`)

#### [NEW] [`src/views/PublicView.vue`](file:///d:/code/azs-hours/src/views/PublicView.vue)

Состоит из:
1. **DateNavigator** — выбор даты (datepicker + ←/→), по умолчанию — сегодня
2. **Фильтр по категории** — «Все», «Город и пригород», «Районы»
3. **Карточка АЗС-часов** — крупная цифра: сумма часов работы всех АЗС за выбранную дату
4. **HoursHeatmap** — таблица:
   - Строки — АЗС (бренд + адрес)
   - Столбцы — часы 0–23
   - Ячейки закрашены зелёным (работала) или серым (не работала)
   - Последний столбец — итого часов по каждой АЗС
5. **AzsHoursChart** — линейный график динамики АЗС-часов за последние 30 дней

#### [NEW] [`src/components/HoursHeatmap.vue`](file:///d:/code/azs-hours/src/components/HoursHeatmap.vue)

Таблица с цветовой индикацией. Для каждого часа (0–23) определяем, попадает ли он в интервал `[start_time, end_time]` (с учётом перехода через полночь).

#### [NEW] [`src/components/AzsHoursChart.vue`](file:///d:/code/azs-hours/src/components/AzsHoursChart.vue)

Линейный график (Chart.js / vue-chartjs). Ось X — даты, ось Y — АЗС-часы. Запрос из `work_hours` с агрегацией `SUM(hours_worked) GROUP BY date`.

#### [NEW] [`src/components/DateNavigator.vue`](file:///d:/code/azs-hours/src/components/DateNavigator.vue)

Компонент: `NDatePicker` + кнопки `NButton` (← →). Эмитит `update:date`.

---

### 7. Фронтенд — Админка (`/admin`)

#### [NEW] [`src/views/LoginView.vue`](file:///d:/code/azs-hours/src/views/LoginView.vue)

Форма входа: email + пароль → `supabase.auth.signInWithPassword()`.

#### [NEW] [`src/views/AdminView.vue`](file:///d:/code/azs-hours/src/views/AdminView.vue)

Состоит из:
1. **Кнопка «Спарсить данные за сегодня»** — вызывает Edge Function `parse-azs`, показывает результат (сколько АЗС обработано)
2. **Справочник АЗС** — таблица `NDataTable` со списком всех АЗС, кнопки «Добавить», «Редактировать», «Удалить»
3. **Ручной ввод часов работы:**
   - Выбор даты (datepicker)
   - Таблица всех АЗС с:
     - Чекбокс «Работала»
     - Поле «Начало» (time picker)
     - Поле «Конец» (time picker)
   - Кнопка «Сохранить» — upsert в `work_hours`

#### [NEW] [`src/components/StationForm.vue`](file:///d:/code/azs-hours/src/components/StationForm.vue)

Модальная форма (NModal) для добавления/редактирования АЗС: номер, бренд, адрес, категория, координаты, виды топлива.

#### [NEW] [`src/components/WorkHoursForm.vue`](file:///d:/code/azs-hours/src/components/WorkHoursForm.vue)

Табличная форма массового ввода/редактирования часов работы за выбранную дату.

---

### 8. Supabase-клиент и типы

#### [NEW] [`src/lib/supabase.ts`](file:///d:/code/azs-hours/src/lib/supabase.ts)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

#### [NEW] [`src/types/index.ts`](file:///d:/code/azs-hours/src/types/index.ts)

```typescript
export interface Station {
  id: string
  station_number: string
  brand: string
  address: string
  category: 'city' | 'district'
  lat: number | null
  lon: number | null
  fuel_types: string[]
  created_at: string
}

export interface WorkHour {
  id: string
  station_id: string
  date: string           // 'YYYY-MM-DD'
  is_working: boolean
  start_time: string | null  // 'HH:MM'
  end_time: string | null    // 'HH:MM'
  hours_worked: number
  created_at: string
}

export interface DailySummary {
  date: string
  total_azs_hours: number
}
```

---

### 9. Pinia-сторы

#### [NEW] [`src/stores/auth.ts`](file:///d:/code/azs-hours/src/stores/auth.ts)

- `signIn(email, password)` — вход
- `signOut()` — выход
- `isAuthenticated` — computed
- Подписка на `onAuthStateChange`

#### [NEW] [`src/stores/stations.ts`](file:///d:/code/azs-hours/src/stores/stations.ts)

- `fetchStations()` — загрузка справочника
- `addStation()` / `updateStation()` / `deleteStation()`
- `parseToday()` — вызов Edge Function

#### [NEW] [`src/stores/workHours.ts`](file:///d:/code/azs-hours/src/stores/workHours.ts)

- `fetchByDate(date)` — загрузка часов работы за дату
- `fetchSummary(startDate, endDate)` — АЗС-часы за период (для графика)
- `upsertWorkHours(date, entries[])` — массовое сохранение

---

## User Review Required

> [!IMPORTANT]
> **Supabase-проект нужно создать заранее**. Перед запуском приложения необходимо:
> 1. Создать проект на [supabase.com](https://supabase.com)
> 2. Скопировать URL и Anon Key в `.env`
> 3. Создать пользователя-администратора через Supabase Dashboard → Authentication
> 4. Применить миграцию SQL (можно через SQL Editor в Dashboard)
> 5. Задеплоить Edge Function через Supabase CLI: `supabase functions deploy parse-azs`

> [!WARNING]
> **GitHub Pages и SPA-роутинг**: GitHub Pages не поддерживает SPA-роутинг из коробки. Нужно будет использовать hash-based роутинг (`createWebHashHistory`) или добавить `404.html` с редиректом. Рекомендую hash-mode для простоты.

## Open Questions

> [!IMPORTANT]
> **HTML-структура сайта**: Мне нужно будет детально проанализировать HTML-разметку azs.astrobl.ru для написания парсера. В текстовом парсинге я не увидел номера АЗС и часы работы — нужно изучить raw HTML. Могу ли я рассчитывать, что структура сайта стабильна и не меняется часто?

---

## Verification Plan

### Автоматические проверки
- `npm run type-check` — TypeScript проверка без ошибок
- `npm run build` — успешная сборка

### Ручная проверка
1. Открыть `/` — публичная страница загружается, показывает datepicker и пустую таблицу (пока нет данных)
2. Открыть `/admin` — редирект на `/admin/login`
3. Войти по email/паролю → попадаем в админку
4. Нажать «Спарсить» → Edge Function парсит сайт, данные появляются в таблице
5. Вручную ввести часы работы за прошлый день → данные сохраняются
6. Вернуться на `/` → таблица показывает данные, график строится

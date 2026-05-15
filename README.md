# Digital Wardrobe

Мобильное Expo-приложение с вкладкой «Шкаф» и FastAPI backend для хранения вещей, каталогов, подкатегорий, draft-обработки изображений и S3-файлов.

## Структура

- `frontend/` — существующий Expo/React Native клиент.
- `backend/` — FastAPI backend с PostgreSQL, Alembic, SQLAlchemy Core, JWT, SQLAdmin и S3 service.
- `docker-compose.yaml` — PostgreSQL, одноразовый сервис миграций и backend.

## Окружение

Создайте `.env` в корне из `.env.example`.

Для Selectel S3 заполните:

- `S3_ENDPOINT_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET_PRIVATE`
- `S3_REGION`

Если S3-переменные оставить пустыми, backend сохранит записи о файлах в БД, но presigned URL не будет выдан.

## Backend

```bash
docker compose up --build
```

Compose поднимает:

- `postgres` с healthcheck и volume;
- `migrations`, который выполняет `alembic upgrade head` и завершается;
- `backend` на `http://localhost:8000`.

Проверка:

```bash
curl http://localhost:8000/health
```

SQLAdmin:

- URL: `http://localhost:8000/admin`
- login/password: `SQLADMIN_USERNAME` / `SQLADMIN_PASSWORD`

## Frontend

```bash
cd frontend
npm start
```

По умолчанию клиент обращается к `http://localhost:8000`. Для другого адреса задайте:

```bash
EXPO_PUBLIC_API_URL=http://localhost:8000
```

Локальный demo-login создается backend автоматически:

- `demo@example.com`
- `demo-password`

Клиент больше не входит в demo-аккаунт автоматически. При первом запуске появится экран входа/регистрации. Access token хранится коротко, refresh token хранится в Expo SecureStore и ротируется через `/auth/refresh`.

После добавления refresh-сессий примените миграции:

```bash
docker compose run --rm migrations
```

Для запуска через Expo Go на телефоне укажите LAN-IP ноутбука:

```powershell
cd frontend
$env:EXPO_PUBLIC_API_URL="http://192.168.1.37:8000"
npx expo start
```

Проверьте с телефона: `http://192.168.1.37:8000/health`.

## Проверка вкладки «Шкаф»

1. Откройте вкладку «Шкаф».
2. Проверьте каталоги и read-only категории.
3. Добавьте вещь через «Выбрать из базового каталога».
4. Добавьте вещь через photo/gallery mock processing flow.
5. В карточке вещи впишите новую подкатегорию и сохраните.
6. Проверьте, что подкатегория появилась в фильтрах.
7. Проверьте поиск, фильтры и сортировку.
8. Проверьте редактирование, архив, восстановление и удаление.

## Ограничения MVP

- Лента и home-контент теперь приходят с backend через `/content/*`, но пока остаются server-owned статическими данными.
- Saved-состояние постов хранится в памяти backend-процесса для dev-сценария, потому что таблицы новостей в БД пока нет.

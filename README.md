# Digital Wardrobe

Мобильное Expo-приложение с вкладкой «Шкаф» и FastAPI backend для хранения вещей, подкатегорий, draft-обработки изображений, S3-файлов и passwordless-авторизации по email-коду.

## Структура

- `frontend/` — существующий Expo/React Native клиент.
- `backend/` — FastAPI backend с PostgreSQL, Alembic, SQLAlchemy Core, JWT, SQLAdmin и S3 service.
- `docker-compose.yaml` — PostgreSQL, одноразовый сервис миграций и backend.

## Окружение

Создайте `.env` в корне из `.env.example`.

Для `ml-vision-service` дополнительно используются:

- `CLASSIFIER_MODEL_PATH=/app/models/wardrobe_classifier.keras`
- `CLASSIFIER_ARTIFACTS_DIR=/app/models/classifier_artifacts`
- `CLASSIFIER_ENABLE_STUB=false`
- `CLASSIFIER_IMG_SIZE=320`
- `CLASSIFIER_TOP_K=3`
- `CLASSIFIER_USE_CUTOUT=true`

Для Selectel S3 заполните:

- `S3_ENDPOINT_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET_PRIVATE`
- `S3_REGION`

Если S3-переменные оставить пустыми, backend сохранит записи о файлах в БД, но presigned URL не будет выдан.

## ML-классификатор

Классификация категории и подкатегории встроена в существующий `ml-vision-service`, новый сервис для этого не создается.

- Файл модели должен лежать в `ml-vision-service/models/wardrobe_classifier.keras`.
- Артефакты должны лежать в `ml-vision-service/models/classifier_artifacts/`.
- `taxonomy.csv` в этой папке является источником правды для связи `target_category` ↔ `target_subcategory`.
- Labels модели русские, а не английские.
- В артефактах встречаются decomposed Unicode-строки (`Майка`, `Дублёнка`, `Головной убор`), поэтому в коде используется `unicodedata.normalize("NFC", value)`.
- `wardrobe_classifier.keras` не стоит коммитить в репозиторий: файл может быть большим, а путь уже защищен через `.gitignore`.

После запуска сервиса можно проверить конфиг и наличие артефактов:

```bash
curl http://localhost:8001/health
```

В ответе должны быть поля `classifier_model_path`, `classifier_artifacts_dir`, `classifier_stub_enabled`, `classifier_top_k`, `classifier_use_cutout`, а также флаги существования модели и `taxonomy.csv`.

## Backend

```bash
docker compose up --build
```

Compose поднимает:

- `postgres` с healthcheck и volume;
- `migrations`, который выполняет `alembic upgrade head` и завершается;
- `backend` на `http://localhost:8000`;
- `ml-vision-service` на `http://localhost:8001`.
- `celery-worker`, который доставляет email-коды и фоновые задачи.

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

Локальный demo-user создается backend автоматически:

- `demo@example.com`

Клиент больше не входит в demo-аккаунт автоматически. При первом запуске появится экран входа/регистрации. Вход и регистрация выполняются только по email-коду: API синхронно создает код, hash, cooldown и `nextResendAt`, а доставка письма выполняется отдельной Celery-задачей. Access token хранится коротко, refresh token хранится в Expo SecureStore и ротируется через `/auth/refresh`.

Для local/dev код можно получить двумя способами:

- посмотреть логи `celery-worker` или `backend`, если SMTP не настроен;
- включить `AUTH_DEV_RETURN_EMAIL_CODE=true`, если нужен возврат `devCode` в API.

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
3. Добавьте вещь через photo/gallery processing flow.
4. В карточке вещи впишите новую подкатегорию и сохраните.
5. Проверьте, что подкатегория появилась в фильтрах.
6. Проверьте поиск, фильтры и сортировку.
7. Проверьте редактирование, архив, восстановление и удаление.

## Проверка E2E photo draft

1. Запустите `docker compose up --build`.
2. Проверьте `http://localhost:8001/health` и убедитесь, что classifier-модель и `taxonomy.csv` найдены.
3. В приложении откройте `Шкаф` → добавление вещи из photo или gallery.
4. Дождитесь экрана подтверждения: top-1 подкатегория должна быть выбрана автоматически, а ниже должен появиться блок `Предложено AI` с top-3.
5. Нажмите suggestion из другой категории и проверьте, что меняются и `categoryId`, и список подкатегорий.
6. Введите собственную подкатегорию вручную и сохраните вещь.
7. После сохранения проверьте, что открывается сначала главная страница шкафа, затем карточка созданной вещи.

## Ограничения MVP

- Saved-состояние постов хранится в памяти backend-процесса для dev-сценария, потому что таблицы новостей в БД пока нет.

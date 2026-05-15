from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_current_user


router = APIRouter(prefix="/content", tags=["content"])

SAVED_BY_USER: dict[str, set[str]] = {}

FEED_POSTS = [
    {
        "id": "post_1",
        "author": "Style Radar",
        "source": "Редакция",
        "title": "Белая рубашка снова в центре капсулы",
        "text": "Белая рубашка остается базой: добавьте прямые джинсы и мягкий тренч, чтобы собрать образ без перегруза.",
        "category": "База",
        "timeAgo": "2 ч",
        "tags": ["office", "classic"],
        "outfitId": None,
        "likes": 128,
    },
    {
        "id": "post_2",
        "author": "Minimal Mood",
        "source": "Подборка",
        "title": "Три спокойных сочетания на каждый день",
        "text": "Футболка, темный деним и белые кеды остаются самым надежным сценарием для мобильного гардероба.",
        "category": "Повседневно",
        "timeAgo": "4 ч",
        "tags": ["casual"],
        "outfitId": None,
        "likes": 256,
    },
    {
        "id": "post_3",
        "author": "Warm Seasons",
        "source": "Гид",
        "title": "Как сделать зимний образ легче визуально",
        "text": "Тонкий свитер, прямое пальто и аккуратный шарф дают нужный объем, но не превращают образ в тяжелый слой.",
        "category": "Сезон",
        "timeAgo": "6 ч",
        "tags": ["warm", "winter"],
        "outfitId": None,
        "likes": 93,
    },
]

HOME_CONTENT = {
    "weather": {
        "temperatureC": 6,
        "feelsLikeC": 3,
        "condition": "Облачно, без осадков",
        "icon": "cloud-outline",
        "city": "Москва",
    },
    "tips": [
        "Если сомневаетесь, соберите образ на нейтральной базе и добавьте один заметный акцент.",
        "Слоистость делает повседневный образ дороже: футболка, рубашка и легкое пальто уже работают как готовый look.",
        "Капсула из 10-12 вещей лучше переживает сезон, если каждая вещь сочетается минимум с тремя другими.",
    ],
    "quickMoments": [
        {"id": "moment_1", "title": "Утренний офис", "subtitle": "Чистая база на будний день"},
        {"id": "moment_2", "title": "После работы", "subtitle": "Пара сменных акцентов и образ становится легче"},
        {"id": "moment_3", "title": "На выходные", "subtitle": "Спокойные фактуры и мягкий деним"},
    ],
}


@router.get("/feed")
async def feed(current_user: dict = Depends(get_current_user)):
    saved = SAVED_BY_USER.setdefault(current_user["id"], set())
    return [{**post, "saved": post["id"] in saved} for post in FEED_POSTS]


@router.post("/feed/{post_id}/saved")
async def toggle_saved(post_id: str, current_user: dict = Depends(get_current_user)):
    saved = SAVED_BY_USER.setdefault(current_user["id"], set())
    if post_id in saved:
        saved.remove(post_id)
        return {"id": post_id, "saved": False}
    saved.add(post_id)
    return {"id": post_id, "saved": True}


@router.get("/home")
async def home(current_user: dict = Depends(get_current_user)):
    return HOME_CONTENT


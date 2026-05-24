from app.modules.weather.service import build_recommendation, condition_text


def test_condition_text_maps_known_code():
    assert condition_text(63) == "Дождь"


def test_build_recommendation_prioritizes_rain():
    assert build_recommendation(22, 63, True) == "Стоит выбрать закрытую обувь и верхний слой"


def test_build_recommendation_handles_heat():
    assert build_recommendation(28, 0, False) == "Сегодня подойдут лёгкие вещи"

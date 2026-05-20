from pathlib import Path
from types import SimpleNamespace

from app.model_paths import ip_adapter_required_files, tryoffdiff_required_files


def _exists_map(paths: dict[str, Path]) -> dict[str, bool]:
    return {key: path.exists() for key, path in paths.items()}


def test_tryoffdiff_required_files_report_missing(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        catalog_tryoffdiff_dir=tmp_path / "tryoffdiff",
        catalog_scheduler_filename="scheduler/scheduler_config_v2.json",
        catalog_model_upper="tryoffdiffv2_upper.pth",
        catalog_model_lower="tryoffdiffv2_lower.pth",
        catalog_model_dress="tryoffdiffv2_dress.pth",
        catalog_vae_dir=tmp_path / "sd-vae-ft-mse",
    )

    exists = _exists_map(tryoffdiff_required_files(settings))

    assert exists["tryoffdiff_dir"] is False
    assert exists["scheduler_config"] is False
    assert exists["model_upper"] is False
    assert exists["model_lower"] is False
    assert exists["model_dress"] is False
    assert exists["vae_dir"] is False
    assert exists["vae_config"] is False


def test_ip_adapter_required_files_report_missing(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        catalog_sd15_dir=tmp_path / "sd15",
        catalog_ip_adapter_dir=tmp_path / "ip-adapter",
        catalog_ip_adapter_weight="ip-adapter-plus_sd15.safetensors",
    )

    exists = _exists_map(ip_adapter_required_files(settings))

    assert exists["sd15_dir"] is False
    assert exists["sd15_model_index"] is False
    assert exists["ip_adapter_dir"] is False
    assert exists["ip_adapter_models_dir"] is False
    assert exists["ip_adapter_image_encoder_config"] is False
    assert exists["ip_adapter_weight"] is False

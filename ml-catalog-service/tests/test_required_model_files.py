from pathlib import Path
from types import SimpleNamespace

from app.model_paths import (
    ip_adapter_required_files,
    provider_file_state,
    tryoffdiff_required_files,
)


def _exists_map(paths: dict[str, Path]) -> dict[str, bool]:
    return {key: path.exists() for key, path in paths.items()}


def test_tryoffdiff_required_files_multi_mode(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        catalog_enable_tryoffdiff=True,
        catalog_tryoffdiff_mode="multi",
        catalog_tryoffdiff_dir=tmp_path / "tryoffdiff",
        catalog_scheduler_filename="scheduler/scheduler_config_v2.json",
        catalog_model_multi="tryoffdiffv2_multi.pth",
        catalog_model_upper="tryoffdiffv2_upper.pth",
        catalog_model_lower="tryoffdiffv2_lower.pth",
        catalog_model_dress="tryoffdiffv2_dress.pth",
        catalog_vae_dir=tmp_path / "sd-vae-ft-mse",
    )

    required = tryoffdiff_required_files(settings)
    exists = _exists_map(required)

    assert "model_multi" in required
    assert "model_upper" not in required
    assert "model_lower" not in required
    assert "model_dress" not in required
    assert exists["tryoffdiff_dir"] is False
    assert exists["scheduler_config"] is False
    assert exists["model_multi"] is False
    assert exists["vae_dir"] is False
    assert exists["vae_config"] is False


def test_tryoffdiff_required_files_separate_mode(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        catalog_enable_tryoffdiff=True,
        catalog_tryoffdiff_mode="separate",
        catalog_tryoffdiff_dir=tmp_path / "tryoffdiff",
        catalog_scheduler_filename="scheduler/scheduler_config_v2.json",
        catalog_model_multi="tryoffdiffv2_multi.pth",
        catalog_model_upper="tryoffdiffv2_upper.pth",
        catalog_model_lower="tryoffdiffv2_lower.pth",
        catalog_model_dress="tryoffdiffv2_dress.pth",
        catalog_vae_dir=tmp_path / "sd-vae-ft-mse",
    )

    required = tryoffdiff_required_files(settings)
    exists = _exists_map(required)

    assert "model_multi" not in required
    assert exists["model_upper"] is False
    assert exists["model_lower"] is False
    assert exists["model_dress"] is False


def test_ip_adapter_required_files_disabled() -> None:
    settings = SimpleNamespace(
        catalog_enable_ip_adapter=False,
        catalog_sd15_dir=Path("/tmp/sd15"),
        catalog_ip_adapter_dir=Path("/tmp/ip-adapter"),
        catalog_ip_adapter_weight="ip-adapter-plus_sd15.safetensors",
    )

    required = ip_adapter_required_files(settings)

    assert required == {}


def test_ip_adapter_required_files_include_siglip_processor(tmp_path: Path) -> None:
    settings = SimpleNamespace(
        catalog_enable_ip_adapter=True,
        catalog_sd15_dir=tmp_path / "sd15",
        catalog_ip_adapter_dir=tmp_path / "ip-adapter",
        catalog_ip_adapter_weight="ip-adapter-plus_sd15.safetensors",
    )

    required = ip_adapter_required_files(settings)

    assert "ip_adapter_image_encoder_preprocessor" in required
    assert required["ip_adapter_image_encoder_preprocessor"].as_posix().endswith(
        "/ip-adapter/models/image_encoder/preprocessor_config.json"
    )


def test_provider_file_state_disabled() -> None:
    state = provider_file_state(enabled=False, required={"x": Path("/tmp/does-not-matter")})

    assert state.enabled is False
    assert state.status == "disabled"
    assert state.missing == {}


def test_provider_file_state_missing() -> None:
    state = provider_file_state(enabled=True, required={"x": Path("/tmp/not-existing-file")})

    assert state.enabled is True
    assert state.status == "missing"
    assert "x" in state.missing

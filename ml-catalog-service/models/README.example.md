# ml-catalog-service model layout (staged workflow)

`ml-catalog-service` runs only with local model files mounted into `/app/models`.
Runtime code must not download model files from the internet.

## Stage 1 (minimal now)

Use TryOffDiff multi only:

```text
ml-catalog-service/models/
  tryoffdiff/
    tryoffdiffv2_multi.pth
    scheduler/
      scheduler_config_v2.json

  sd-vae-ft-mse/
    config.json
    diffusion_pytorch_model.safetensors
    ...
```

Env:

- `CATALOG_ENABLE_TRYOFFDIFF=true`
- `CATALOG_TRYOFFDIFF_MODE=multi`
- `CATALOG_MODEL_MULTI=tryoffdiffv2_multi.pth`
- `CATALOG_ENABLE_IP_ADAPTER=false`
- `CATALOG_TRYOFFDIFF_DIR=/app/models/tryoffdiff`
- `CATALOG_VAE_DIR=/app/models/sd-vae-ft-mse`
- `HF_HUB_OFFLINE=1`
- `TRANSFORMERS_OFFLINE=1`
- `DIFFUSERS_OFFLINE=1`

## Stage 2 (enable product categories with IP-Adapter)

Add local SD1.5 selective fp16 + IP-Adapter files:

```text
ml-catalog-service/models/
  sd15/
    model_index.json
    scheduler/
    tokenizer/
    text_encoder/
      config.json
      model.fp16.safetensors
    unet/
      config.json
      diffusion_pytorch_model.fp16.safetensors
    vae/
      config.json
      diffusion_pytorch_model.fp16.safetensors

  ip-adapter/
    models/
      image_encoder/
        config.json
        model.safetensors
        preprocessor_config.json
      ip-adapter_sd15_light.safetensors
```

Env:

- `CATALOG_ENABLE_IP_ADAPTER=true`
- `CATALOG_IP_BASE_MODEL=sd15`
- `CATALOG_SD15_DIR=/app/models/sd15`
- `CATALOG_IP_ADAPTER_DIR=/app/models/ip-adapter`
- `CATALOG_IP_ADAPTER_WEIGHT=ip-adapter_sd15_light.safetensors`

## Stage 3 (optional TryOffDiff separate mode)

Optionally add separate TryOffDiff checkpoints:

```text
ml-catalog-service/models/
  tryoffdiff/
    tryoffdiffv2_upper.pth
    tryoffdiffv2_lower.pth
    tryoffdiffv2_dress.pth
```

Env:

- `CATALOG_TRYOFFDIFF_MODE=separate`
- `CATALOG_MODEL_UPPER=tryoffdiffv2_upper.pth`
- `CATALOG_MODEL_LOWER=tryoffdiffv2_lower.pth`
- `CATALOG_MODEL_DRESS=tryoffdiffv2_dress.pth`

You can later switch `CATALOG_IP_ADAPTER_WEIGHT` to `ip-adapter-plus_sd15.safetensors` when that file exists locally.

Do not commit model weights to git.

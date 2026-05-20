# ml-catalog-service model layout

`ml-catalog-service` runs only with local model files mounted into `/app/models`.

Expected structure:

```text
ml-catalog-service/models/
  tryoffdiff/
    tryoffdiffv2_upper.pth
    tryoffdiffv2_lower.pth
    tryoffdiffv2_dress.pth
    scheduler/
      scheduler_config_v2.json

  sd-vae-ft-mse/
    config.json
    diffusion_pytorch_model.safetensors
    ...

  sd15/
    model_index.json
    scheduler/
    text_encoder/
    tokenizer/
    unet/
    vae/
    ...

  ip-adapter/
    models/
      image_encoder/
        config.json
        model.safetensors
      ip-adapter_sd15_light.safetensors
      ip-adapter-plus_sd15.safetensors  # optional
```

Runtime env variables:

- `CATALOG_TRYOFFDIFF_DIR=/app/models/tryoffdiff`
- `CATALOG_VAE_DIR=/app/models/sd-vae-ft-mse`
- `CATALOG_SD15_DIR=/app/models/sd15`
- `CATALOG_IP_ADAPTER_DIR=/app/models/ip-adapter`
- `CATALOG_IP_ADAPTER_WEIGHT=ip-adapter_sd15_light.safetensors`
- `HF_HUB_OFFLINE=1`
- `TRANSFORMERS_OFFLINE=1`
- `DIFFUSERS_OFFLINE=1`

Do not commit model weights to git.

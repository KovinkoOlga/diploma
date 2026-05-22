import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { Routes } from "../navigation/routes";

export const WARDROBE_PHOTO_GUIDE_HIDDEN_KEY = "wardrobe_photo_guide_hidden";

export const WARDROBE_PHOTO_MODES = {
  camera: "camera",
  gallery: "gallery",
};

const MODE_CONFIG = {
  [WARDROBE_PHOTO_MODES.camera]: {
    route: Routes.WardrobeAddFromPhoto,
    ctaLabel: "Открыть камеру",
    ctaIcon: "camera-outline",
    launcherTitle: "Открываем камеру",
    launcherDescription: "Сделайте один снимок вещи, и приложение сразу отправит его в текущий сценарий обработки.",
    retryLabel: "Открыть камеру снова",
    sourceType: "photo",
    permissionError: "Разрешите доступ к камере в настройках устройства.",
    defaultError: "Не удалось загрузить изображение",
    requestPermission: () => ImagePicker.requestCameraPermissionsAsync(),
    launchPicker: () =>
      ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      }),
  },
  [WARDROBE_PHOTO_MODES.gallery]: {
    route: Routes.WardrobeAddFromGallery,
    ctaLabel: "Выбрать фото",
    ctaIcon: "image-outline",
    launcherTitle: "Открываем галерею",
    launcherDescription: "Выберите одно фото вещи, и приложение сразу отправит его в текущий сценарий обработки.",
    retryLabel: "Выбрать фото снова",
    sourceType: "gallery",
    permissionError: "Разрешите доступ к галерее в настройках устройства.",
    defaultError: "Не удалось загрузить изображение",
    requestPermission: () => ImagePicker.requestMediaLibraryPermissionsAsync(),
    launchPicker: () =>
      ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      }),
  },
};

export function getWardrobePhotoModeConfig(mode) {
  return MODE_CONFIG[mode] ?? MODE_CONFIG[WARDROBE_PHOTO_MODES.camera];
}

export function resolveWardrobePhotoCatalogId(catalogs = [], preferredCatalogId) {
  if (preferredCatalogId && catalogs.some((catalog) => catalog.id === preferredCatalogId)) {
    return preferredCatalogId;
  }

  return catalogs[0]?.id ?? "main";
}

export async function getWardrobePhotoGuideHidden() {
  try {
    return (await SecureStore.getItemAsync(WARDROBE_PHOTO_GUIDE_HIDDEN_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setWardrobePhotoGuideHidden(hidden) {
  try {
    if (hidden) {
      await SecureStore.setItemAsync(WARDROBE_PHOTO_GUIDE_HIDDEN_KEY, "1");
      return;
    }

    await SecureStore.deleteItemAsync(WARDROBE_PHOTO_GUIDE_HIDDEN_KEY);
  } catch {
    return;
  }
}

export async function openWardrobePhotoFlow({ navigation, mode, catalogId, replace = false }) {
  const hidden = await getWardrobePhotoGuideHidden();
  const config = getWardrobePhotoModeConfig(mode);
  const targetRoute = hidden ? config.route : Routes.WardrobePhotoGuide;
  const params = hidden ? { catalogId } : { mode, catalogId };

  if (replace) {
    navigation.replace(targetRoute, params);
    return;
  }

  navigation.navigate(targetRoute, params);
}

export async function launchWardrobePhotoFlow({ navigation, actions, catalogs, mode, catalogId }) {
  const config = getWardrobePhotoModeConfig(mode);
  const permission = await config.requestPermission();

  if (!permission.granted) {
    throw new Error(config.permissionError);
  }

  const result = await config.launchPicker();
  if (result.canceled || !result.assets?.[0]) {
    return { canceled: true };
  }

  const draft = await actions.uploadDraftImage({
    sourceType: config.sourceType,
    catalogId: resolveWardrobePhotoCatalogId(catalogs, catalogId),
    asset: result.assets[0],
  });

  navigation.replace(Routes.WardrobeProcessingStub, { draftId: draft.id });
  return { canceled: false, draft };
}

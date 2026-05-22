import React from "react";
import WardrobePhotoLauncherScreen from "./WardrobePhotoLauncherScreen";
import { WARDROBE_PHOTO_MODES } from "../../utils/wardrobePhotoFlow";

export default function WardrobeAddFromPhotoScreen(props) {
  return <WardrobePhotoLauncherScreen {...props} mode={WARDROBE_PHOTO_MODES.camera} />;
}

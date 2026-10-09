export const INITIAL_PHOTO_CROP = { zoom: 1, x: 0, y: 0 };
export const PHOTO_SIZE = 600;
export type PhotoCrop = typeof INITIAL_PHOTO_CROP;

export function cropArea(width: number, height: number, crop: PhotoCrop) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new Error("Invalid photo dimensions.");
  const zoom = Math.max(1, Math.min(3, crop.zoom));
  const side = Math.min(width, height) / zoom;
  return {
    x: (width - side) / 2 * (1 + Math.max(-1, Math.min(1, crop.x))),
    y: (height - side) / 2 * (1 + Math.max(-1, Math.min(1, crop.y))),
    side,
  };
}

// Drag distances are fractions of the square preview, independent of screen size.
export function dragPhotoCrop(width: number, height: number, crop: PhotoCrop, dx: number, dy: number): PhotoCrop {
  const { side } = cropArea(width, height, crop);
  return {
    zoom: crop.zoom,
    x: width > side ? Math.max(-1, Math.min(1, crop.x - dx * side * 2 / (width - side))) : 0,
    y: height > side ? Math.max(-1, Math.min(1, crop.y - dy * side * 2 / (height - side))) : 0,
  };
}

export async function exportPhotoCrop(image: HTMLImageElement, crop: PhotoCrop, filename: string): Promise<File> {
  const area = cropArea(image.naturalWidth, image.naturalHeight, crop);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo cropping isn’t available in this browser.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  context.drawImage(image, area.x, area.y, area.side, area.side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Couldn’t save this crop. Please try again.")), "image/jpeg", .9);
  });
  return new File([blob], `${filename.replace(/\.[^.]+$/, "")}-square.jpg`, { type: "image/jpeg" });
}

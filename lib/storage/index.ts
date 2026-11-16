import { CloudinaryStorage } from "./cloudinary";
import { LocalDiskStorage } from "./local";
import type { FileStorage } from "./storage";

let instance: FileStorage | undefined;

/** STORAGE_DRIVER=local (default) or cloudinary. */
export function getStorage(): FileStorage {
  instance ??=
    process.env.STORAGE_DRIVER === "cloudinary" ? new CloudinaryStorage() : new LocalDiskStorage();
  return instance;
}

export const isLocalStorage = () => process.env.STORAGE_DRIVER !== "cloudinary";

export * from "./storage";

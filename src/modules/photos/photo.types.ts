export type ImportedPhoto = {
  galleryId: string;
  filename: string;
  baseName: string;
  thumbPath: string;
  previewPath?: string | null;
  sortOrder: number;
};

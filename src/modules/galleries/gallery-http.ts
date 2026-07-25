import { ZodError } from "zod";
import {
  GalleryNotFoundError,
  GalleryUnavailableError,
  InvalidGalleryTransitionError,
  SelectionClosedError,
  SelectionCountMismatchError,
} from "./gallery.errors";

export function galleryErrorStatus(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (error instanceof GalleryNotFoundError) return 404;
  if (error instanceof GalleryUnavailableError) return 410;
  if (
    error instanceof InvalidGalleryTransitionError ||
    error instanceof SelectionClosedError ||
    error instanceof SelectionCountMismatchError
  ) {
    return 409;
  }
  return 500;
}

export function galleryErrorMessage(error: unknown): string {
  if (galleryErrorStatus(error) === 500) return "Unexpected error";
  return error instanceof Error ? error.message : "Invalid request";
}

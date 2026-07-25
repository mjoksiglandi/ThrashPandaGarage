export class GalleryNotFoundError extends Error {
  constructor(message = "Gallery not found") {
    super(message);
    this.name = "GalleryNotFoundError";
  }
}

export class GalleryUnavailableError extends Error {
  constructor(message = "Gallery unavailable") {
    super(message);
    this.name = "GalleryUnavailableError";
  }
}

export class InvalidGalleryTransitionError extends Error {
  constructor(message = "Invalid gallery transition") {
    super(message);
    this.name = "InvalidGalleryTransitionError";
  }
}

export class SelectionClosedError extends Error {
  constructor(message = "Selection is closed") {
    super(message);
    this.name = "SelectionClosedError";
  }
}

export class SelectionCountMismatchError extends Error {
  constructor(message = "Selection count does not match gallery requirements") {
    super(message);
    this.name = "SelectionCountMismatchError";
  }
}

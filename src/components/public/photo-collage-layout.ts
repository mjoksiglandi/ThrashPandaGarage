export type PhotoItem = {
  title: string;
  image: string;
  alt: string;
  exifText?: string;
  captureDate?: string;
};

export type CollagePhoto = PhotoItem & { originalIndex: number; role: string };
export type SizedPhoto = CollagePhoto & { ratio: number };
export type JustifiedRow = { height: number; photos: SizedPhoto[] };

const roles = ["hero-img", "standard", "supporting", "featured", "standard", "supporting", "statement", "featured"];
const GALLERY_GAP = 18;
const TARGET_HEIGHTS = [300, 340, 280, 320];

function rowHeight(photos: SizedPhoto[], width: number) {
  const ratios = photos.reduce((sum, photo) => sum + photo.ratio, 0);
  return (width - GALLERY_GAP * (photos.length - 1)) / ratios;
}

export function buildJustifiedRows(photos: SizedPhoto[], width: number): JustifiedRow[] {
  if (!width || photos.length === 0) return [];
  const groups: SizedPhoto[][] = [];
  let current: SizedPhoto[] = [];

  for (const photo of photos) {
    current.push(photo);
    const target = TARGET_HEIGHTS[groups.length % TARGET_HEIGHTS.length];
    const estimatedWidth = current.reduce((sum, item) => sum + item.ratio * target, 0) + GALLERY_GAP * (current.length - 1);
    if (estimatedWidth >= width) {
      groups.push(current);
      current = [];
    }
  }
  if (current.length) groups.push(current);

  if (groups.length > 1) {
    const last = groups[groups.length - 1];
    const target = TARGET_HEIGHTS[(groups.length - 1) % TARGET_HEIGHTS.length];
    if (rowHeight(last, width) > target * 1.25) {
      const combined = [...groups[groups.length - 2], ...last];
      let bestSplit = 1;
      let smallestDifference = Number.POSITIVE_INFINITY;
      for (let split = 1; split < combined.length; split += 1) {
        const left = combined.slice(0, split).reduce((sum, item) => sum + item.ratio, 0);
        const right = combined.slice(split).reduce((sum, item) => sum + item.ratio, 0);
        const difference = Math.abs(left - right);
        if (difference < smallestDifference) {
          smallestDifference = difference;
          bestSplit = split;
        }
      }
      groups.splice(groups.length - 2, 2, combined.slice(0, bestSplit), combined.slice(bestSplit));
    }
  }

  return groups.map((group) => ({ photos: group, height: rowHeight(group, width) }));
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildCollage(photos: PhotoItem[], randomize = true): CollagePhoto[] {
  const entries = photos.map((photo, originalIndex) => ({ ...photo, originalIndex }));
  const roleDeck = Array.from({ length: photos.length }, (_, index) => roles[index % roles.length]);
  const orderedEntries = randomize ? shuffle(entries) : entries;
  const orderedRoles = randomize ? shuffle(roleDeck) : roleDeck;
  return orderedEntries.map((photo, index) => ({ ...photo, role: orderedRoles[index] }));
}

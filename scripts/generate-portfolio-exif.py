from __future__ import annotations

import json
import re
from datetime import datetime
from fractions import Fraction
from pathlib import Path

from PIL import ExifTags, Image


SOURCE = Path(r"D:\Lightroom\revelado\web\incoming\to_process")
TARGET = Path(__file__).parents[1] / "src" / "components" / "public" / "portfolio-exif.json"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-") or "image"


def exif_data(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        exif = image.getexif()
        values = {ExifTags.TAGS.get(key, key): value for key, value in exif.items()}
        values.update({ExifTags.TAGS.get(key, key): value for key, value in exif.get_ifd(ExifTags.IFD.Exif).items()})
        return values


def shutter_label(value: object) -> str | None:
    if not value:
        return None
    seconds = float(value)
    if seconds >= 1:
        return f"{seconds:g} s"
    denominator = round(1 / seconds)
    return f"1/{denominator} s"


def number_label(value: object) -> str | None:
    if value is None:
        return None
    number = float(value)
    return f"{number:g}"


def capture_date(value: object) -> str | None:
    if not value:
        return None
    return datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S").date().isoformat()


def main() -> None:
    records: dict[str, dict[str, object | None]] = {}
    sources = sorted(path for path in SOURCE.rglob("*") if path.suffix.lower() in {".jpg", ".jpeg"})
    for index, source in enumerate(sources, start=1):
        filename = f"{index:04d}-{slugify(source.stem)}.webp"
        data = exif_data(source)
        records[filename] = {
            "focalLength": number_label(data.get("FocalLength")),
            "aperture": number_label(data.get("FNumber")),
            "shutterSpeed": shutter_label(data.get("ExposureTime")),
            "iso": data.get("ISOSpeedRatings") or data.get("PhotographicSensitivity"),
            "captureDate": capture_date(data.get("DateTimeOriginal")),
        }
    TARGET.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(records)} EXIF records to {TARGET}")


if __name__ == "__main__":
    main()

"""Extract ZIP press materials into a new directory; never execute file contents."""
import argparse
from pathlib import Path, PurePosixPath
import shutil
import stat
import zipfile


def extract(source: Path, destination: Path):
    # Reject the whole archive before writing anything if an entry is unsafe.
    if destination.exists():
        raise ValueError("Choose a new output directory")
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) > 1000 or sum(e.file_size for e in entries) > 300 * 1024 * 1024:
            raise ValueError("Archive exceeds 1000 entries / 300 MiB")
        paths = set()
        for entry in entries:
            name = entry.filename.replace("\\", "/")
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or ":" in name or "\x00" in name:
                raise ValueError("Unsafe ZIP path")
            if not path.parts or path.parts[0] == "__MACOSX":
                continue
            if stat.S_ISLNK(entry.external_attr >> 16):
                raise ValueError("ZIP symlinks are unsupported")
            if entry.flag_bits & 1:
                raise ValueError("Encrypted ZIP: request an unencrypted copy or handle with an approved local tool")
            normalized = str(path).casefold()
            if normalized in paths:
                raise ValueError("Duplicate ZIP path")
            paths.add(normalized)
        destination.mkdir(parents=True)
        try:
            for entry in entries:
                path = PurePosixPath(entry.filename.replace("\\", "/"))
                if not path.parts or path.parts[0] == "__MACOSX":
                    continue
                target = destination.joinpath(*path.parts)
                if entry.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.open(entry) as source_file, target.open("xb") as output:
                        shutil.copyfileobj(source_file, output)
        except Exception:
            shutil.rmtree(destination)
            raise
    return sorted(str(p.relative_to(destination)) for p in destination.rglob("*") if p.is_file())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    for filename in extract(args.source, args.destination):
        print(filename)

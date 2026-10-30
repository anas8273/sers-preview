"""Extract two fixed regular files only, after the caller verifies the ZIP digest."""
import os
import pathlib
import resource
import stat
import sys
import zipfile


def extract(source, destination):
    destination = pathlib.Path(destination)
    destination.mkdir(mode=0o700)
    limits = {"candidate.json": 16 * 1024, "image.tar.gz": 3 * 1024**3}
    with zipfile.ZipFile(source) as archive:
        entries = archive.infolist()
        if len(entries) != 2 or {entry.filename for entry in entries} != set(limits):
            raise ValueError("Unexpected candidate ZIP entries")
        for entry in entries:
            file_type = stat.S_IFMT(entry.external_attr >> 16)
            if entry.flag_bits & 1 or entry.is_dir() or file_type not in (0, stat.S_IFREG) or entry.file_size <= 0 or entry.file_size > limits[entry.filename]:
                raise ValueError("Invalid candidate ZIP member")
            target = destination / entry.filename
            written = 0
            with archive.open(entry) as reader, open(target, "xb") as writer:
                os.chmod(target, 0o600)
                while block := reader.read(1024 * 1024):
                    written += len(block)
                    if written > limits[entry.filename]:
                        raise ValueError("Candidate ZIP member exceeds bound")
                    writer.write(block)
            if written != entry.file_size:
                raise ValueError("Candidate ZIP size differs")


if __name__ == "__main__":
    try:
        for kind, maximum in [(resource.RLIMIT_AS, 512 * 1024**2), (resource.RLIMIT_CPU, 300)]:
            hard = resource.getrlimit(kind)[1]
            bounded = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
            resource.setrlimit(kind, (bounded, bounded))
        if len(sys.argv) != 3:
            raise ValueError("Expected archive and destination")
        extract(sys.argv[1], sys.argv[2])
    except Exception:
        print("Candidate ZIP extraction refused", file=sys.stderr)
        sys.exit(1)

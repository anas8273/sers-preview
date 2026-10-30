"""Bound Docker save's outer tar without extracting or running its contents."""
import gzip
import hashlib
import json
import pathlib
import re
import resource
import sys
import tarfile


class BoundedReader:
    def __init__(self, reader):
        self.reader = reader
        self.bytes = 0

    def read(self, size=-1):
        if size < 0:
            size = 1024 * 1024
        block = self.reader.read(min(size, 1024 * 1024))
        self.bytes += len(block)
        if self.bytes > 8 * 1024**3:
            raise ValueError("Docker tar exceeds bound")
        return block


def inspect(source, image_id):
    if not re.fullmatch(r"sha256:[a-f0-9]{64}", image_id):
        raise ValueError("Invalid image identity")
    expected = image_id[7:]
    config_names = {expected + ".json", "blobs/sha256/" + expected}
    manifest = None
    configs = {}
    seen = set()
    logical_bytes = 0
    with gzip.open(source, "rb") as compressed:
        reader = BoundedReader(compressed)
        with tarfile.open(fileobj=reader, mode="r|") as archive:
            for entry in archive:
                name = entry.name.rstrip("/")
                pieces = pathlib.PurePosixPath(name).parts
                if not name or name.startswith("/") or "\\" in name or ".." in pieces or "\x00" in name or name in seen or len(seen) >= 100_000 or not (entry.isfile() or entry.isdir()) or entry.issparse() or entry.type == tarfile.GNUTYPE_SPARSE or any(key.startswith("GNU.sparse") for key in entry.pax_headers) or entry.size < 0 or entry.size > 8 * 1024**3 or (entry.isdir() and entry.size != 0):
                    raise ValueError("Invalid Docker tar member")
                logical_bytes += entry.size
                if logical_bytes > 8 * 1024**3:
                    raise ValueError("Docker tar logical size exceeds bound")
                seen.add(name)
                if name == "manifest.json" or name in config_names:
                    if not entry.isfile() or entry.size > 1024 * 1024:
                        raise ValueError("Docker image metadata exceeds bound")
                    data = archive.extractfile(entry).read(1024 * 1024 + 1)
                    if len(data) != entry.size:
                        raise ValueError("Docker image metadata is truncated")
                    if name == "manifest.json":
                        manifest = json.loads(data)
                    else:
                        configs[name] = hashlib.sha256(data).hexdigest()
        while reader.read(1024 * 1024):
            pass
    if not isinstance(manifest, list) or len(manifest) != 1 or not isinstance(manifest[0], dict):
        raise ValueError("Candidate must contain exactly one Docker image")
    image = manifest[0]
    if image.get("Config") not in configs or configs[image["Config"]] != expected or not isinstance(image.get("Layers"), list) or not image["Layers"] or len(image["Layers"]) > 500 or any(not isinstance(layer, str) or layer not in seen for layer in image["Layers"]):
        raise ValueError("Docker image configuration does not match candidate")
    return {"images": 1, "configSha256": expected, "uncompressedBytes": reader.bytes}


if __name__ == "__main__":
    try:
        for kind, maximum in [(resource.RLIMIT_AS, 512 * 1024**2), (resource.RLIMIT_CPU, 300)]:
            hard = resource.getrlimit(kind)[1]
            bounded = maximum if hard == resource.RLIM_INFINITY else min(maximum, hard)
            resource.setrlimit(kind, (bounded, bounded))
        if len(sys.argv) != 3:
            raise ValueError("Expected image archive and identity")
        print(json.dumps(inspect(sys.argv[1], sys.argv[2])))
    except Exception:
        print("Docker image archive verification refused", file=sys.stderr)
        sys.exit(1)

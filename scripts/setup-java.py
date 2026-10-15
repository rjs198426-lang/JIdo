#!/usr/bin/env python3
"""Install a pinned, SHA-256-verified Temurin JDK 21 in the cloud workspace."""
import hashlib
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile
import urllib.request

target = Path('/workspace/.cache/jido-jdk-21')
release = 'https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.12.1%2B1/'
archive = 'OpenJDK21U-jdk_x64_linux_hotspot_21.0.12.1_1.tar.gz'
if not (target / 'bin/javac').is_file():
    if target.exists():
        raise RuntimeError('Existing JDK directory is incomplete; refusing to overwrite it')
    with tempfile.TemporaryDirectory(prefix='jido-jdk-') as directory:
        path = Path(directory) / archive
        print('Downloading official Temurin JDK 21...', flush=True)
        urllib.request.urlretrieve(release + archive, path)
        with urllib.request.urlopen(release + archive + '.sha256.txt', timeout=60) as response:
            expected = response.read().decode().split()[0]
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise RuntimeError('JDK checksum mismatch; refusing installation')
        print('Official JDK SHA-256 verified.', flush=True)
        extracted = Path(directory) / 'extracted'
        with tarfile.open(path) as bundle:
            bundle.extractall(extracted, filter='data')
        root = next(p for p in extracted.iterdir() if (p / 'bin/javac').is_file())
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(root), target)
subprocess.run([str(target / 'bin/javac'), '-version'], check=True)
print('JDK ready at ' + str(target), flush=True)

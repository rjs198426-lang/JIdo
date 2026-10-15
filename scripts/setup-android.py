#!/usr/bin/env python3
"""Install verified Google Android command-line tools in a writable workspace."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

sdk = Path(os.environ.get('ANDROID_HOME', '/workspace/.cache/android-sdk')).resolve()
tools = sdk / 'cmdline-tools' / 'latest'
repository = 'https://dl.google.com/android/repository/'
if not (tools / 'bin/sdkmanager').is_file():
    print('Fetching official Android SDK metadata...', flush=True)
    with urllib.request.urlopen(repository + 'repository2-1.xml', timeout=60) as response:
        root = ET.fromstring(response.read())
    package = next(p for p in root.findall('remotePackage') if p.attrib.get('path') == 'cmdline-tools;latest')
    archive = next(a for a in package.findall('archives/archive') if a.findtext('host-os') == 'linux')
    url = archive.findtext('complete/url')
    checksum = archive.findtext('complete/checksum')
    with tempfile.TemporaryDirectory(prefix='jido-sdk-') as directory:
        path = Path(directory) / 'tools.zip'
        print('Downloading Google Android SDK tools...', flush=True)
        urllib.request.urlretrieve(repository + url, path)
        digest = hashlib.sha1(path.read_bytes()).hexdigest()
        if digest != checksum:
            raise RuntimeError('Android SDK checksum mismatch; refusing installation')
        print('Official archive checksum verified.', flush=True)
        with zipfile.ZipFile(path) as bundle:
            bundle.extractall(Path(directory) / 'extracted')
        tools.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(Path(directory) / 'extracted/cmdline-tools'), tools)
        for executable in (tools / 'bin').iterdir():
            executable.chmod(executable.stat().st_mode | 0o111)

environment = os.environ.copy()
environment['ANDROID_HOME'] = str(sdk)
environment['ANDROID_USER_HOME'] = str(sdk.parent / 'android-user')
# Keep Java's user preferences inside the writable workspace.
environment['JAVA_TOOL_OPTIONS'] = environment.get('JAVA_TOOL_OPTIONS', '') + ' -Djava.util.prefs.userRoot=/workspace/.cache/java-prefs'
manager = [str(tools / 'bin/sdkmanager'), '--sdk_root=' + str(sdk)]
print('Accepting Android SDK licenses for the development toolchain...', flush=True)
subprocess.run(manager + ['--licenses'], input='y\n' * 100, text=True, env=environment, check=True)
print('Installing Android API 36, build tools and platform tools...', flush=True)
subprocess.run(manager + ['platform-tools', 'platforms;android-36', 'build-tools;35.0.0', 'build-tools;36.0.0'], env=environment, check=True)
print('Android SDK ready at ' + str(sdk), flush=True)

#!/usr/bin/env python3
"""Configure Gradle's supported HTTP proxy settings without copying credentials."""
import os
from pathlib import Path
from urllib.parse import urlsplit

directory = Path(os.environ.get('GRADLE_USER_HOME', '/workspace/.cache/gradle'))
directory.mkdir(parents=True, exist_ok=True)
file = directory / 'gradle.properties'
begin, end = '# BEGIN JIDO CLOUD PROXY', '# END JIDO CLOUD PROXY'
original = file.read_text() if file.exists() else ''
if begin in original and end in original:
    before, rest = original.split(begin, 1)
    _, after = rest.split(end, 1)
    original = before.rstrip() + '\n' + after.lstrip('\n')
settings = []
for protocol in ('http', 'https'):
    value = os.environ.get(protocol.upper() + '_PROXY') or os.environ.get(protocol + '_proxy')
    if value:
        proxy = urlsplit(value)
        if proxy.username or proxy.password:
            raise RuntimeError('Authenticated proxies require secure local configuration; credentials were not copied')
        if proxy.hostname:
            settings.extend([f'systemProp.{protocol}.proxyHost={proxy.hostname}', f'systemProp.{protocol}.proxyPort={proxy.port or 80}'])
if settings:
    settings.append('systemProp.http.nonProxyHosts=localhost|127.*|[::1]')
    # Reuse the system's managed CA trust, including the cloud HTTPS proxy CA.
    # Certificate validation stays enabled; no custom verification bypass is used.
    if Path('/etc/ssl/certs/java/cacerts').is_file():
        settings.append('systemProp.javax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts')
    file.write_text(original.rstrip() + '\n' + begin + '\n' + '\n'.join(settings) + '\n' + end + '\n')
    print('Gradle configured to use the existing cloud HTTPS proxy.')

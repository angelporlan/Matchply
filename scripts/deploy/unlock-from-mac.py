#!/usr/bin/env python3
"""Unlock Matchply storage using an existing local key; never print or upload it elsewhere."""
import base64
import json
import os
from pathlib import Path
import stat
import subprocess
import sys

key_path = Path.home() / '.ssh' / 'matchply_storage.key'
identity = Path.home() / '.ssh' / 'matchply_ops_ed25519'
try:
    info = key_path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077 or info.st_uid != os.getuid():
        raise RuntimeError('The storage key must be a private file owned by this user (mode 0600).')
    key = key_path.read_bytes()
    if len(key) != 64:
        raise RuntimeError('The storage key has an invalid length.')
    payload = json.dumps({'key': base64.b64encode(key).decode('ascii')}).encode()
    result = subprocess.run(['ssh', '-T', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
                             '-o', 'ConnectTimeout=10', '-i', str(identity),
                             'matchply-ops@217.76.133.58', 'unlock'], input=payload)
    sys.exit(result.returncode)
except (OSError, RuntimeError) as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)

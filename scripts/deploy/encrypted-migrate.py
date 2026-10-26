#!/usr/bin/env python3
"""One-time Matchply volume migration. Run only after the key and recovery are backed up.

Receives JSON containing a base64-encoded 64-byte key on stdin. Never prints the key,
never deletes old data, and restores old mounts and containers if activation fails.
"""
import base64
import binascii
import fcntl
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import ops

SERVICES = ['nextprof_web_prod', 'nextprof_ai_worker_prod', 'nextprof_research_worker_prod']
DATABASE = 'nextprof_postgres_prod'


def execute(args, *, data=None, timeout=600):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f'{Path(args[0]).name} failed (exit {result.returncode})')
    return result.stdout


def same_tree(source, target):
    result = execute(['rsync', '-acn', '--delete', '--numeric-ids', '--itemize-changes', f'{source}/', f'{target}/'])
    if result.strip():
        raise RuntimeError('Copied storage did not match its source')


def wait_db():
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        status = execute(['docker', 'inspect', '--format', '{{.State.Health.Status}}', DATABASE]).decode().strip()
        if status == 'healthy':
            return
        time.sleep(2)
    raise RuntimeError('Database readiness timeout')


def migrate(key):
    if len(key) != 64:
        raise ValueError('Invalid storage key')
    if ops.SECURE_MARKER.exists() or ops.SECURE_IMAGE.exists() or ops.SECURE_DEVICE.exists():
        raise RuntimeError('Existing encrypted storage requires manual review')
    if os.path.ismount(ops.POSTGRES_DATA) or os.path.ismount(ops.BACKUPS):
        raise RuntimeError('Unexpected existing mount requires manual review')
    if ops.shutil.disk_usage('/var/lib').free < 20 * 1024**3:
        raise RuntimeError('At least 20 GiB free space is required')
    active = ops.current()
    if not active:
        raise RuntimeError('No active managed release')
    ops.healthy(active)
    ops.backup()
    suffix = ops.stamp()
    originals = [(ops.POSTGRES_DATA, ops.POSTGRES_DATA.with_name('_data.pre-encryption-' + suffix)),
                 (ops.BACKUPS, ops.BACKUPS.with_name('matchply.pre-encryption-' + suffix))]
    marker_created = False
    stopped = False
    policies_changed = False
    renamed = []
    try:
        fd = os.open(ops.SECURE_IMAGE, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
        os.close(fd)
        execute(['fallocate', '-l', '16G', str(ops.SECURE_IMAGE)])
        execute(['cryptsetup', 'luksFormat', '--type', 'luks2', '--batch-mode', '--key-file', '-', str(ops.SECURE_IMAGE)], data=key)
        execute(['cryptsetup', 'open', '--test-passphrase', '--key-file', '-', str(ops.SECURE_IMAGE)], data=key)
        execute(['cryptsetup', 'open', '--type', 'luks', '--key-file', '-', str(ops.SECURE_IMAGE), 'matchply_secure'], data=key)
        execute(['mkfs.ext4', '-q', str(ops.SECURE_DEVICE)])
        ops.SECURE_ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
        execute(['mount', str(ops.SECURE_DEVICE), str(ops.SECURE_ROOT)])
        for name in ['postgres', 'backups']:
            (ops.SECURE_ROOT / name).mkdir(mode=0o700)
        # No container may restart against the unmounted plaintext fallback after a reboot.
        policies_changed = True
        execute(['docker', 'update', '--restart=on-failure', DATABASE, *SERVICES])
        stopped = True
        execute(['docker', 'stop', '-t', '300', *SERVICES], timeout=400)
        execute(['docker', 'stop', '-t', '60', DATABASE], timeout=100)
        for source, destination in [(ops.POSTGRES_DATA, ops.SECURE_ROOT / 'postgres'), (ops.BACKUPS, ops.SECURE_ROOT / 'backups')]:
            execute(['rsync', '-aH', '--numeric-ids', f'{source}/', f'{destination}/'])
            same_tree(source, destination)
        ops.SECURE_MARKER.touch(mode=0o600, exist_ok=False)
        marker_created = True
        for path, old in originals:
            if old.exists():
                raise RuntimeError('Backup destination already exists')
            path.rename(old)
            renamed.append((path, old))
            path.mkdir(mode=0o700)
            (path / 'STORAGE_LOCKED').write_text('Unlock Matchply encrypted storage before starting services.\n')
        for source, target in [(ops.SECURE_ROOT / 'postgres', ops.POSTGRES_DATA), (ops.SECURE_ROOT / 'backups', ops.BACKUPS)]:
            execute(['mount', '--bind', str(source), str(target)])
        ops.require_secure_storage()
        execute(['docker', 'start', DATABASE])
        wait_db()
        execute(['docker', 'start', *SERVICES])
        ops.healthy(active)
        ops.backup()
        ops.audit('encrypted_storage_migrated')
        print(json.dumps({'result': 'migrated', 'old_data_retained': True, 'old_backups_retained': True}))
    except Exception:
        # Rollback keeps the original directories intact. Never delete the image or user data.
        if stopped:
            subprocess.run(['docker', 'stop', '-t', '60', *SERVICES, DATABASE], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=300)
        for path, old in reversed(renamed):
            if os.path.ismount(path):
                execute(['umount', str(path)])
            if path.exists():
                sentinel = path / 'STORAGE_LOCKED'
                if sentinel.is_file():
                    sentinel.unlink()
                path.rmdir()
            old.rename(path)
        if marker_created:
            ops.SECURE_MARKER.unlink()
        if os.path.ismount(ops.SECURE_ROOT):
            execute(['umount', str(ops.SECURE_ROOT)])
        if ops.SECURE_DEVICE.exists():
            execute(['cryptsetup', 'close', 'matchply_secure'])
        if policies_changed:
            execute(['docker', 'update', '--restart=always', DATABASE, *SERVICES])
        if stopped:
            execute(['docker', 'start', DATABASE])
            wait_db()
            execute(['docker', 'start', *SERVICES])
            ops.healthy(active)
        raise


def main():
    if os.geteuid() != 0:
        raise RuntimeError('Run as root on the Matchply VPS')
    try:
        payload = json.loads(sys.stdin.buffer.read(4097))
        key = base64.b64decode(payload['key'], validate=True)
    except (KeyError, TypeError, ValueError, binascii.Error) as error:
        raise ValueError('Invalid key payload') from error
    with (ops.ROOT / 'operations.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        migrate(key)


if __name__ == '__main__':
    os.umask(0o077)
    try:
        main()
    except Exception as error:
        print(f'Migration stopped: {type(error).__name__}: {error}', file=sys.stderr)
        sys.exit(1)

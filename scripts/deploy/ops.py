#!/usr/bin/python3
"""Root-owned Matchply operations. SSH gateways expose named operations, never a shell."""
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.request

ROOT = Path('/app/Matchply-operations')
BACKUPS = Path('/var/backups/matchply')
INSTALL = Path('/opt/matchply-ops')
SERVICES = ['web', 'ai_worker', 'research_worker']
CONTAINERS = {s: f'nextprof_{s}_prod' for s in SERVICES}
SHA = re.compile(r'^[a-f0-9]{40}$')
KEY = re.compile(r'^[A-Z][A-Z0-9_]{0,127}$')


def run(args, *, input=None, timeout=300, env=None):
    result = subprocess.run(args, input=input, capture_output=True, timeout=timeout, env=env)
    if result.returncode:
        # Keep exception messages free of command arguments, env values and database errors.
        raise RuntimeError(f'{Path(args[0]).name} failed (exit {result.returncode}); use doctor/logs')
    return result.stdout


def stamp():
    return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')


def save(path, data):
    path = Path(path)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(data)
    temporary.chmod(0o600)
    temporary.replace(path)


def validate_release(payload):
    if not SHA.fullmatch(payload.get('sha', '')):
        raise ValueError('Invalid commit')
    for service in ['web', 'worker']:
        expected = rf'ghcr\.io/angelporlan/matchply-{service}@sha256:[a-f0-9]{{64}}'
        if not re.fullmatch(expected, payload.get(f'{service}_image', '')):
            raise ValueError('Only immutable Matchply image digests are accepted')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9-]{0,100}', payload.get('registry_user', '')):
        raise ValueError('Invalid registry identity')
    if not payload.get('registry_token'):
        raise ValueError('A short-lived registry token is required')


def current():
    link = ROOT / 'current'
    return link.resolve() if link.is_symlink() else None


def metadata(release):
    return json.loads((release / 'release.json').read_text())


def compose(release, *args, timeout=360):
    return run(['docker', 'compose', '-p', 'matchply', '--env-file', str(release / 'compose.env'),
                '-f', str(INSTALL / 'compose.yml'), *args], timeout=timeout)


def point_to(name, release):
    temporary = ROOT / f'.{name}.tmp'
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(release)
    temporary.replace(ROOT / name)


def backup():
    folder = BACKUPS / f'backup-{stamp()}'
    folder.mkdir(mode=0o700, parents=True)
    dump = folder / 'database.dump'
    with dump.open('wb') as output:
        result = subprocess.run(['docker', 'exec', 'nextprof_postgres_prod', 'pg_dump', '-U', 'postgres',
                                 '-d', 'nextprof_db', '-Fc'], stdout=output, stderr=subprocess.PIPE, timeout=300)
    if result.returncode or dump.stat().st_size == 0:
        raise RuntimeError('Backup failed; deployment stopped')
    with dump.open('rb') as source:
        result = subprocess.run(['docker', 'exec', '-i', 'nextprof_postgres_prod', 'pg_restore', '--list'],
                                stdin=source, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=60)
    if result.returncode:
        raise RuntimeError('Backup archive verification failed')
    active = current()
    if active:
        shutil.copy2(active / 'app.env', folder / 'app.env')
        shutil.copy2(active / 'release.json', folder / 'release.json')
    for item in folder.iterdir():
        item.chmod(0o600)
    print(json.dumps({'backup': str(folder), 'bytes': dump.stat().st_size}), flush=True)
    return folder


def retain_releases():
    releases = sorted((ROOT / 'releases').glob('*'), reverse=True)
    successful = [p for p in releases if (p / 'successful').exists()]
    keep = set(successful[:5])
    for name in ['current', 'previous']:
        link = ROOT / name
        if link.is_symlink():
            keep.add(link.resolve())
    # Only remove this application's old successful metadata and exact images.
    kept_images = {metadata(p)[key] for p in keep for key in ['web_image', 'worker_image']}
    for old in successful[5:]:
        if old in keep:
            continue
        old_meta = metadata(old)
        for key in ['web_image', 'worker_image']:
            image = old_meta[key]
            if image not in kept_images and image.startswith('ghcr.io/angelporlan/matchply-'):
                subprocess.run(['docker', 'image', 'rm', image], capture_output=True, timeout=60)
        shutil.rmtree(old)
    # Bootstrap copies are never removed. Retain the most recent 14 deployment backups.
    for old in sorted(BACKUPS.glob('backup-*'), reverse=True)[14:]:
        shutil.rmtree(old)


def healthy(release, *, timeout=180):
    legacy = metadata(release).get('legacy', False)
    route = '/login' if legacy else '/api/health'
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:3000' + route, timeout=5) as response:
                if response.status != 200:
                    raise RuntimeError('HTTP check failed')
                if not legacy and json.load(response).get('ok') is not True:
                    raise RuntimeError('Database readiness failed')
            names = ['web'] if legacy else SERVICES
            states = json.loads(run(['docker', 'inspect', *[CONTAINERS[s] for s in names]]))
            if not all(c['State']['Running'] and not c['State'].get('OOMKilled') for c in states):
                raise RuntimeError('A service is not running')
            if any(c['RestartCount'] > 0 for c in states):
                raise RuntimeError('A service is restarting')
            return
        except Exception:
            time.sleep(3)
    raise RuntimeError('Readiness timeout')


def activate(release):
    legacy = metadata(release).get('legacy', False)
    if legacy:
        compose(release, 'stop', 'ai_worker', 'research_worker')
    compose(release, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', *(['web'] if legacy else SERVICES))
    healthy(release)
    with urllib.request.urlopen('https://matchply.com' + ('/login' if legacy else '/api/health'), timeout=15) as response:
        if response.status != 200:
            raise RuntimeError('Public HTTPS check failed')
        if not legacy and json.load(response).get('ok') is not True:
            raise RuntimeError('Public health check failed')
    if not legacy:
        time.sleep(15)
        healthy(release, timeout=20)


def new_release(payload, source_env):
    release = ROOT / 'releases' / f"{stamp()}-{payload['sha'][:12]}"
    release.mkdir(mode=0o700, parents=True)
    shutil.copyfile(source_env, release / 'app.env')
    (release / 'app.env').chmod(0o600)
    data = {key: payload[key] for key in ['sha', 'web_image', 'worker_image']}
    data.update(created_at=stamp(), legacy=payload.get('legacy', False))
    save(release / 'release.json', json.dumps(data))
    health_path = '/login' if data['legacy'] else '/api/health'
    save(release / 'compose.env', f"WEB_IMAGE={data['web_image']}\nWORKER_IMAGE={data['worker_image']}\nAPP_ENV_FILE={release}/app.env\nHEALTH_PATH={health_path}\n")
    return release


def audit(event, **fields):
    record = {'time': stamp(), 'event': event, **fields}
    with (ROOT / 'operations.jsonl').open('a') as output:
        output.write(json.dumps(record) + '\n')
    print(json.dumps(record), flush=True)


def deploy(payload):
    validate_release(payload)
    if not (ROOT / 'enabled').exists():
        raise RuntimeError('Automatic deployment is not enabled: complete the migration rehearsal first')
    previous = current()
    if previous and metadata(previous)['sha'] == payload['sha'] and all(
            metadata(previous)[k] == payload[k] for k in ['web_image', 'worker_image']):
        healthy(previous)
        print('This exact release is already healthy')
        return
    if shutil.disk_usage(ROOT).free < 3 * 1024**3:
        raise RuntimeError('Less than 3 GiB of free disk space')
    release = new_release(payload, previous / 'app.env' if previous else ROOT / 'app.env')
    with tempfile.TemporaryDirectory(prefix='matchply-registry-') as credentials:
        env = {**os.environ, 'DOCKER_CONFIG': credentials}
        run(['docker', 'login', 'ghcr.io', '-u', payload['registry_user'], '--password-stdin'],
            input=payload['registry_token'].encode(), env=env)
        for image in [payload['web_image'], payload['worker_image']]:
            run(['docker', 'pull', image], env=env, timeout=600)
    compose(release, 'config', '--quiet')
    preflight = json.loads(compose(release, 'run', '--rm', '--no-deps', '-T', 'migrate',
                                  'node', 'scripts/deploy/migration-check.mjs'))
    if any(m['destructive'] for m in preflight['pending']):
        raise RuntimeError('Destructive migrations require a separately reviewed maintenance procedure')
    backup()
    audit('deploy_started', sha=payload['sha'], pending_migrations=len(preflight['pending']))
    # A failed migration never triggers a database restore or advances the release pointer.
    compose(release, 'run', '--rm', '--no-deps', '-T', 'migrate', timeout=300)
    try:
        activate(release)
    except Exception:
        audit('deploy_failed', sha=payload['sha'])
        if previous:
            activate(previous)
            audit('rollback_succeeded', sha=metadata(previous)['sha'])
        raise
    if previous:
        point_to('previous', previous)
    point_to('current', release)
    save(release / 'successful', stamp())
    audit('deploy_succeeded', sha=payload['sha'])
    try:
        retain_releases()
    except Exception:
        audit('retention_failed')


def env_names(text):
    return sorted(set(re.findall(r'^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=', text, re.M)))


def update_env(text, key, value):
    if not KEY.fullmatch(key):
        raise ValueError('Invalid variable name')
    if value is not None and (not isinstance(value, str) or any(c in value for c in '\r\n\x00')):
        raise ValueError('Environment values must be single-line strings')
    pattern = re.compile(r'^\s*(?:export\s+)?' + re.escape(key) + r'\s*=')
    lines = [line for line in text.splitlines() if not pattern.match(line)]
    if value is not None:
        # Compose single-quoted values preserve dollar signs and escaped quotes literally.
        lines.append(key + "='" + value.replace("'", "\\'") + "'")
    return '\n'.join(lines) + '\n'


def env_change(payload):
    active = current()
    if not active:
        raise RuntimeError('No managed release yet')
    changes = payload.get('changes', {})
    if not isinstance(changes, dict) or not changes:
        raise ValueError('Provide changes as a JSON object')
    protected = {'DATABASE_URL', 'POSTGRES_PASSWORD', 'NODE_ENV', 'HOSTNAME', 'PORT', 'PATH', 'NODE_OPTIONS', 'NODE_PATH'}
    if protected.intersection(changes) or any(k.startswith('NEXT_PUBLIC_') for k in changes):
        raise ValueError('Database, execution and build-time variables require a dedicated operation')
    content = (active / 'app.env').read_text()
    for key, value in changes.items():
        content = update_env(content, key, value)
    release = new_release(metadata(active), active / 'app.env')
    save(release / 'app.env', content)
    compose(release, 'config', '--quiet')
    backup()
    try:
        activate(release)
    except Exception:
        activate(active)
        raise
    point_to('previous', active)
    point_to('current', release)
    save(release / 'successful', stamp())
    audit('env_updated', keys=sorted(changes))
    retain_releases()


def status():
    names = [*CONTAINERS.values(), 'nextprof_postgres_prod']
    present = run(['docker', 'ps', '-a', '--format', '{{.Names}}']).decode().splitlines()
    states = json.loads(run(['docker', 'inspect', *[name for name in names if name in present]]))
    report = {c['Name'].lstrip('/'): {'running': c['State']['Running'], 'restarts': c['RestartCount'],
              'health': c['State'].get('Health', {}).get('Status', 'not-configured'), 'image': c['Config']['Image']} for c in states}
    active = current()
    print(json.dumps({'release': metadata(active) if active else None, 'enabled': (ROOT / 'enabled').exists(),
                      'containers': report, 'disk_free_gib': round(shutil.disk_usage(ROOT).free / 1024**3, 1),
                      'latest_backups': [p.name for p in sorted(BACKUPS.glob('backup-*'))[-3:]]}, indent=2))


def doctor():
    status()
    checks = {'load_average': os.getloadavg(), 'queues': {}}
    try:
        context = ssl.create_default_context()
        with socket.create_connection(('matchply.com', 443), timeout=10) as connection:
            with context.wrap_socket(connection, server_hostname='matchply.com') as tls:
                checks['certificate_expires'] = tls.getpeercert()['notAfter']
        active = current()
        if active:
            healthy(active, timeout=10)
            checks['application'] = 'ready'
        else:
            checks['application'] = 'legacy-unmanaged'
    except Exception:
        checks['application'] = 'check-failed'
    for table in ['ai_job', 'job_research_run']:
        exists = run(['docker', 'exec', 'nextprof_postgres_prod', 'psql', '-U', 'postgres', '-d', 'nextprof_db',
                      '-Atc', f"SELECT to_regclass('public.{table}')"]).decode().strip()
        if not exists:
            checks['queues'][table] = 'not-installed'
            continue
        counts = run(['docker', 'exec', 'nextprof_postgres_prod', 'psql', '-U', 'postgres', '-d', 'nextprof_db',
                      '-Atc', f'SELECT status, count(*) FROM {table} GROUP BY status']).decode().strip()
        checks['queues'][table] = counts.splitlines()
    print(json.dumps(checks, indent=2))


def logs(payload):
    service = payload.get('service', 'web')
    if service not in SERVICES:
        raise ValueError('Unknown Matchply service')
    # Whitelist operational fields; do not forward raw application messages or personal data.
    result = subprocess.run(['docker', 'logs', '--tail', str(min(500, max(1, int(payload.get('lines', 100))))),
                             CONTAINERS[service]], capture_output=True, timeout=30)
    for line in (result.stdout + result.stderr).decode(errors='replace').splitlines():
        try:
            item = json.loads(line)
            print(json.dumps({k: item[k] for k in ['timestamp', 'time', 'event', 'level', 'requestId', 'route', 'status', 'durationMs'] if k in item}))
        except (ValueError, TypeError):
            print('[unstructured log omitted; inspect on server if needed]')


def dispatch(operation, payload):
    if operation == 'status':
        status()
    elif operation == 'doctor':
        doctor()
    elif operation == 'logs':
        logs(payload)
    elif operation == 'env-list':
        active = current()
        print(json.dumps({'keys': env_names(((active / 'app.env') if active else ROOT / 'app.env').read_text())}))
    elif operation == 'deploy':
        deploy(payload)
    elif operation == 'backup':
        backup()
    elif operation == 'env-update':
        env_change(payload)
    elif operation == 'restart':
        active = current()
        service = payload.get('service', 'web')
        if not active or service not in SERVICES:
            raise ValueError('Managed release and valid service required')
        compose(active, 'up', '-d', '--no-deps', '--no-build', '--pull', 'never', '--force-recreate', service)
        healthy(active)
        audit('service_recreated', service=service)
    elif operation == 'rollback':
        previous = ROOT / 'previous'
        active = current()
        if not previous.is_symlink() or not active:
            raise RuntimeError('No previous managed release')
        target = previous.resolve()
        backup()
        activate(target)
        point_to('current', target)
        point_to('previous', active)
        audit('manual_rollback', sha=metadata(target)['sha'])
    else:
        raise ValueError('Unsupported operation')


def main():
    os.umask(0o077)
    if len(sys.argv) != 3 or sys.argv[1] not in ['deploy-gateway', 'ops-gateway']:
        raise ValueError('Use the restricted SSH gateway')
    operation = sys.argv[2]
    if sys.argv[1] == 'deploy-gateway' and operation != 'deploy':
        raise ValueError('Deployment key can only deploy')
    payload = json.loads(sys.stdin.buffer.read(65537))
    if not isinstance(payload, dict):
        raise ValueError('JSON object required')
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (ROOT / 'operations.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        dispatch(operation, payload)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Matchply operation failed: {error}', file=sys.stderr)
        sys.exit(1)

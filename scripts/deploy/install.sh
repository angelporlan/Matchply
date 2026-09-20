#!/usr/bin/env bash
# Run as root on the VPS with this directory and two PUBLIC key files.
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run as root' >&2; exit 1; }
deploy_public_key=${1:?Path to CI public key}
ops_public_key=${2:?Path to operator public key}
source_dir=$(cd -- "$(dirname -- "$0")" && pwd)
docker inspect nextprof_web_prod >/dev/null
docker inspect nextprof_postgres_prod >/dev/null
docker network inspect matchply_default >/dev/null
install -d -m 755 /opt/matchply-ops
install -m 755 "$source_dir/ops.py" /opt/matchply-ops/ops.py
install -m 644 "$source_dir/compose.yml" /opt/matchply-ops/compose.yml
install -d -m 700 /app/Matchply-operations /app/Matchply-operations/releases /var/backups/matchply
for kind in deploy ops; do
  account="matchply-$kind"
  id "$account" >/dev/null 2>&1 || useradd --create-home --shell /bin/sh "$account"
  install -d -m 700 -o "$account" -g "$account" "/home/$account/.ssh"
  cat > "/usr/local/bin/matchply-$kind-gateway" <<EOF
#!/bin/sh
exec /usr/bin/sudo -n /opt/matchply-ops/ops.py $kind-gateway "\$SSH_ORIGINAL_COMMAND"
EOF
  chmod 755 "/usr/local/bin/matchply-$kind-gateway"
  key_file=$deploy_public_key
  [[ $kind != ops ]] || key_file=$ops_public_key
  printf 'restrict,command="/usr/local/bin/matchply-%s-gateway" %s\n' "$kind" "$(cat "$key_file")" > "/home/$account/.ssh/authorized_keys"
  chown "$account:$account" "/home/$account/.ssh/authorized_keys"
  chmod 600 "/home/$account/.ssh/authorized_keys"
  printf '%s ALL=(root) NOPASSWD: /opt/matchply-ops/ops.py %s-gateway *\n' "$account" "$kind" > "/etc/sudoers.d/$account"
  chmod 440 "/etc/sudoers.d/$account"
  visudo -cf "/etc/sudoers.d/$account"
done
# Preserve the environment actually used by the existing web container, without printing it.
python3 - <<'PY'
import json, os, subprocess
from pathlib import Path
os.umask(0o077)
root = Path('/app/Matchply-operations')
if not (root/'app.env').exists():
    container = json.loads(subprocess.check_output(['docker','inspect','nextprof_web_prod']))[0]
    lines = []
    for item in container['Config']['Env']:
        key, _, value = item.partition('=')
        if key in {'PATH','NODE_VERSION','YARN_VERSION','HOSTNAME','PORT'}:
            continue
        if any(c in value for c in '\r\n\x00'):
            raise RuntimeError('Multiline value requires manual environment reconciliation')
        lines.append(key+'='+json.dumps(value, ensure_ascii=False).replace('$', '$$'))
    (root/'app.env').write_text('\n'.join(lines)+'\n')
    (root/'app.env').chmod(0o600)
Path('/app/Matchply/.env').chmod(0o600)
PY
echo 'Restricted gateways installed. Deployment remains gated until the rehearsal passes.'

import importlib.util
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent))
spec = importlib.util.spec_from_file_location('encrypted_migrate', Path(__file__).with_name('encrypted-migrate.py'))
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
ops = migration.ops


class MigrationTests(unittest.TestCase):
    def exercise(self, fail_start):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pg, backups = root / 'pg', root / 'backups'
            pg.mkdir(); backups.mkdir()
            (pg / 'synthetic').write_text('synthetic-postgres-data')
            (backups / 'synthetic').write_text('synthetic-backup')
            secure = root / 'secure'; image = root / 'image'; marker = root / 'required'; device = root / 'mapper'
            mounts = set(); calls = []; failure = [fail_start]

            def execute(args, *, data=None, timeout=600):
                calls.append(args)
                if args[0] == 'cryptsetup' and args[1] == 'open': device.touch()
                if args[0] == 'cryptsetup' and args[1] == 'close': device.unlink(missing_ok=True)
                if args[0] == 'mount': mounts.add(Path(args[-1]))
                if args[0] == 'umount': mounts.discard(Path(args[-1]))
                if args[0] == 'rsync' and '-aH' in args:
                    shutil.copytree(args[-2].rstrip('/'), args[-1].rstrip('/'), dirs_exist_ok=True)
                if args[:3] == ['docker', 'start', migration.DATABASE] and failure[0]:
                    failure[0] = False
                    raise RuntimeError('synthetic startup failure')
                return b''

            with patch.multiple(ops, POSTGRES_DATA=pg, BACKUPS=backups, SECURE_ROOT=secure,
                                SECURE_IMAGE=image, SECURE_MARKER=marker, SECURE_DEVICE=device), \
                 patch.object(ops, 'current', return_value=root), patch.object(ops, 'healthy'), \
                 patch.object(ops, 'backup') as backup, patch.object(ops, 'audit'), \
                 patch.object(ops, 'require_secure_storage'), patch.object(ops.shutil, 'disk_usage', return_value=shutil._ntuple_diskusage(100, 1, 99 * 1024**3)), \
                 patch.object(migration, 'execute', side_effect=execute), patch.object(migration, 'wait_db'), \
                 patch.object(migration.subprocess, 'run'), patch.object(migration.os.path, 'ismount', side_effect=lambda p: Path(p) in mounts):
                if fail_start:
                    with self.assertRaisesRegex(RuntimeError, 'synthetic startup failure'):
                        migration.migrate(b'x' * 64)
                    self.assertFalse(marker.exists())
                    self.assertEqual((pg / 'synthetic').read_text(), 'synthetic-postgres-data')
                    self.assertEqual((backups / 'synthetic').read_text(), 'synthetic-backup')
                    self.assertIn(['docker', 'update', '--restart=always', migration.DATABASE, *migration.SERVICES], calls)
                    self.assertEqual(backup.call_count, 1)
                else:
                    migration.migrate(b'x' * 64)
                    self.assertTrue(marker.exists())
                    self.assertEqual(len(list(root.glob('_data.pre-encryption-*'))), 1)
                    self.assertEqual(len(list(root.glob('matchply.pre-encryption-*'))), 1)
                    self.assertEqual((secure / 'postgres' / 'synthetic').read_text(), 'synthetic-postgres-data')
                    self.assertEqual(backup.call_count, 2)
                self.assertTrue(image.exists())
                self.assertFalse(any('x' * 64 in str(command) for command in calls))

    def test_success_retains_originals(self): self.exercise(False)
    def test_failed_activation_restores_originals(self): self.exercise(True)


if __name__ == '__main__': unittest.main()

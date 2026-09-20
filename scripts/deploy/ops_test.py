import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ops', Path(__file__).with_name('ops.py'))
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)


class OperationsTests(unittest.TestCase):
    def payload(self):
        return dict(sha='a' * 40, web_image='ghcr.io/angelporlan/matchply-web@sha256:' + '1' * 64,
                    worker_image='ghcr.io/angelporlan/matchply-worker@sha256:' + '2' * 64,
                    registry_user='angelporlan', registry_token='ephemeral-test-token')

    def test_only_immutable_project_images(self):
        ops.validate_release(self.payload())
        for value in ['ghcr.io/angelporlan/matchply-web:latest', 'evil/image@sha256:' + '1' * 64]:
            with self.assertRaises(ValueError):
                ops.validate_release({**self.payload(), 'web_image': value})

    def test_env_updates_preserve_unrelated_and_literal_dollars(self):
        initial = '# existing\nKEEP=old\nEDIT=first\nEDIT=duplicate\n'
        updated = ops.update_env(initial, 'EDIT', 'https://x/?token=$secret')
        self.assertIn('KEEP=old', updated)
        self.assertIn('EDIT="https://x/?token=$$secret"', updated)
        self.assertEqual(updated.count('EDIT='), 1)
        self.assertNotIn('EDIT=', ops.update_env(updated, 'EDIT', None))
        self.assertEqual(ops.env_names(updated), ['EDIT', 'KEEP'])

    def test_environment_injection_rejected(self):
        for key, value in [('KEY\nOTHER', 'x'), ('KEY', 'a\nOTHER=x'), ('KEY', 'a\x00b')]:
            with self.assertRaises(ValueError):
                ops.update_env('', key, value)

    @unittest.skipUnless(shutil.which('docker'), 'Docker Compose is required for dotenv round-trip')
    def test_environment_values_round_trip_through_compose(self):
        values = ['plain', '$SECRET ${VALUE}', "a'b", 'trailing\\', 'quotes"and\\slashes', 'áé😀# words']
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'compose.yml').write_text('services:\n  test:\n    image: alpine\n    environment:\n      VALUE: ${VALUE}\n')
            for value in values:
                (root / 'vars').write_text(ops.update_env('', 'VALUE', value))
                result = subprocess.run(['docker', 'compose', '--env-file', str(root / 'vars'), '-f',
                                         str(root / 'compose.yml'), 'config', '--environment'], capture_output=True, check=True)
                environment = dict(line.split('=', 1) for line in result.stdout.decode().splitlines() if '=' in line)
                self.assertEqual(environment['VALUE'], value)

    def test_deploy_disabled_before_any_side_effect(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'ROOT', Path(directory)), patch.object(ops, 'run') as command:
            with self.assertRaisesRegex(RuntimeError, 'not enabled'):
                ops.deploy(self.payload())
            command.assert_not_called()

    def test_registry_credentials_never_persist_in_release(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'ROOT', Path(directory)):
            environment = Path(directory) / 'source.env'
            environment.write_text('DATABASE_URL=local-test\n')
            release = ops.new_release(self.payload(), environment)
            content = (release / 'release.json').read_text() + (release / 'compose.env').read_text()
            self.assertNotIn('ephemeral-test-token', content)
            self.assertNotIn('registry_token', content)
            self.assertEqual((release / 'app.env').stat().st_mode & 0o777, 0o600)

    def test_backup_failure_blocks_migration_and_activation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'ROOT', Path(directory)), \
                patch.object(ops, 'run'), patch.object(ops, 'compose', return_value=b'{"pending":[]}') as compose, \
                patch.object(ops, 'backup', side_effect=RuntimeError('backup failed')), patch.object(ops, 'activate') as activate:
            (Path(directory) / 'enabled').touch()
            (Path(directory) / 'app.env').write_text('DATABASE_URL=test\n')
            with self.assertRaisesRegex(RuntimeError, 'backup failed'):
                ops.deploy(self.payload())
            activate.assert_not_called()
            self.assertFalse(any(call.args[-1] == 'migrate' for call in compose.call_args_list))

    def test_destructive_migration_stops_deployment(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'ROOT', Path(directory)), patch.object(ops, 'run'), \
                patch.object(ops, 'compose', return_value=b'{"pending":[{"destructive":true}]}'), \
                patch.object(ops, 'backup') as backup:
            (Path(directory) / 'enabled').touch()
            (Path(directory) / 'app.env').write_text('DATABASE_URL=test\n')
            with self.assertRaisesRegex(RuntimeError, 'Destructive'):
                ops.deploy(self.payload())
            backup.assert_not_called()

    def test_failed_readiness_rolls_back_without_advancing_current(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(ops, 'ROOT', Path(directory)), patch.object(ops, 'run'), \
                patch.object(ops, 'compose', return_value=b'{"pending":[]}'), patch.object(ops, 'backup'), \
                patch.object(ops, 'activate', side_effect=[RuntimeError('unhealthy'), None]) as activate:
            root = Path(directory)
            (root / 'enabled').touch()
            (root / 'app.env').write_text('DATABASE_URL=test\n')
            old = ops.new_release({**self.payload(), 'sha': 'b' * 40}, root / 'app.env')
            ops.point_to('current', old)
            with self.assertRaisesRegex(RuntimeError, 'unhealthy'):
                ops.deploy(self.payload())
            self.assertEqual(activate.call_args_list[-1].args[0], old.resolve())
            self.assertEqual(ops.current(), old.resolve())


if __name__ == '__main__':
    unittest.main()

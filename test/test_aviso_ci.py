import importlib.util
import io
import json
from pathlib import Path
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('aviso', Path(__file__).resolve().parents[1] / 'scripts/aviso_ci.py')
aviso = importlib.util.module_from_spec(spec)
spec.loader.exec_module(aviso)


class Avisos(unittest.TestCase):
    def setUp(self):
        self.pr = dict(number=2, headRefName='agent-b/F-002', headRefOid='a' * 40, isDraft=False, isCrossRepository=False)
        self.run = dict(head_sha='a' * 40, head_repository={'full_name': 'example/project'},
                        event='pull_request', path='.github/workflows/workflow.yml', status='completed',
                        conclusion='success', run_number=1, run_attempt=1)

    def test_only_exact_success(self):
        self.assertTrue(aviso.ready(self.pr, [self.run], 'example/project'))
        for field, value in [('head_sha', 'b'*40), ('conclusion', 'failure'), ('status', 'in_progress'),
                             ('path', '.github/workflows/otro.yml'), ('event', 'push')]:
            bad = {**self.run, field: value}
            self.assertFalse(aviso.ready(self.pr, [bad], 'example/project'))
        self.assertFalse(aviso.ready(self.pr, [], 'example/project'))

    def test_newest_failure_overrides_old_green(self):
        bad = {**self.run, 'run_attempt': 2, 'conclusion': 'failure'}
        self.assertFalse(aviso.ready(self.pr, [self.run, bad], 'example/project'))

    def test_drafts_foreign_and_self_branches(self):
        for field, value in [('isDraft', True), ('isCrossRepository', True), ('headRefName', 'agent-a/F-001')]:
            self.assertFalse(aviso.ready({**self.pr, field: value}, [self.run], 'example/project'))
        self.assertFalse(aviso.ready(self.pr, [self.run], 'otra/cuenta'))

    def test_delivery_cache_and_changed_sha(self):
        with tempfile.TemporaryDirectory() as tmp:
            queries = []
            def query(args, *a, **kw):
                queries.append(args)
                if args[0] == 'git': return 'https://github.com/example/project.git\n'
                if args[1] == 'pr': return json.dumps([self.pr])
                return json.dumps({'workflow_runs': [self.run]})
            with patch.object(aviso.Path, 'home', return_value=Path(tmp)), patch.object(aviso, 'command', side_effect=query):
                event = dict(cwd=tmp, session_id='s1', hook_event_name='SessionStart')
                def invoke():
                    out = io.StringIO()
                    with patch('sys.stdout', out): aviso.main(event)
                    return out.getvalue()
                first = json.loads(invoke()); self.assertIn('PR #2', first['hookSpecificOutput']['additionalContext'])
                self.assertEqual(invoke(), '')
                self.pr['headRefOid'] = self.run['head_sha'] = 'b'*40
                self.assertIn('b'*40, invoke())
                event['session_id'] = 's2'; self.assertIn('PR #2', invoke())
                event['hook_event_name'] = 'UserPromptSubmit'; self.assertEqual(invoke(), '')
                self.assertTrue(all('--method' not in q or q[q.index('--method')+1] == 'GET' for q in queries))

    def test_no_raw_errors(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(aviso.Path, 'home', return_value=Path(tmp)):
            with patch.object(aviso, 'command', side_effect=['https://github.com/example/project.git', ValueError('NO_PUBLICAR')]):
                out = io.StringIO()
                with patch('sys.stdout', out): aviso.main(dict(cwd=tmp))
                self.assertNotIn('NO_PUBLICAR', out.getvalue())
                self.assertIn('No se pudo consultar', out.getvalue())

    def test_malformed_cache_does_not_break_delivery(self):
        for cache in [{'checked': 'invalid', 'seen': []}, {'checked': 0, 'seen': [{}]}, []]:
            with tempfile.TemporaryDirectory() as tmp, patch.object(aviso.Path, 'home', return_value=Path(tmp)):
                key=aviso.hashlib.sha256(b'example/project:s1').hexdigest()
                folder=Path(tmp)/'.cache/agent-workflow';folder.mkdir(parents=True)
                (folder/(key+'.json')).write_text(json.dumps(cache))
                with patch.object(aviso,'command',side_effect=['https://github.com/example/project.git',json.dumps([self.pr]),json.dumps({'workflow_runs':[self.run]})]):
                    out=io.StringIO()
                    with patch('sys.stdout',out):aviso.main(dict(cwd=tmp,session_id='s1'))
                    self.assertIn('PR #2',out.getvalue())
                    self.assertEqual((folder/(key+'.json')).stat().st_mode & 0o777,0o600)

    def test_install_preserves_settings_and_is_idempotent(self):
        install_spec = importlib.util.spec_from_file_location('installer', Path(__file__).resolve().parents[1] / 'scripts/instalar_aviso_ci.py')
        installer = importlib.util.module_from_spec(install_spec)
        install_spec.loader.exec_module(installer)
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / 'repo'; project.mkdir()
            subprocess.run(['git', 'init', str(project)], capture_output=True, check=True)
            settings = project / '.claude/settings.local.json'; settings.parent.mkdir()
            settings.write_text(json.dumps({'permissions': {'allow': ['Read']}, 'hooks': {'UserPromptSubmit': [{'hooks': [{'command':'echo existente'}]}]}}))
            with patch.object(installer.Path, 'home', return_value=Path(tmp)), patch('sys.stdout', io.StringIO()):
                installer.install(project); installer.install(project)
            result = json.loads(settings.read_text())
            self.assertEqual(result['permissions'], {'allow': ['Read']})
            self.assertEqual(len(result['hooks']['UserPromptSubmit']), 2)
            self.assertEqual(len(result['hooks']['SessionStart']), 1)
            self.assertTrue((Path(tmp)/'.local/share/agent-workflow/aviso_ci.py').exists())

    def test_install_rejects_symlink_without_modifying_target(self):
        loader=importlib.util.spec_from_file_location('installer',Path(__file__).resolve().parents[1]/'scripts/instalar_aviso_ci.py')
        installer=importlib.util.module_from_spec(loader);loader.loader.exec_module(installer)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); project=root/'repo';project.mkdir()
            subprocess.run(['git','init',str(project)],capture_output=True,check=True)
            private=root/'private';private.mkdir();settings=private/'settings.local.json';settings.write_text('{}')
            (project/'.claude').symlink_to(private,target_is_directory=True)
            with patch.object(installer.Path,'home',return_value=root):
                with self.assertRaises(ValueError):installer.install(project)
            self.assertEqual(settings.read_text(),'{}')
            self.assertFalse((root/'.local/share/agent-workflow/aviso_ci.py').exists())


if __name__ == '__main__':
    unittest.main()

import importlib.util
import json
from pathlib import Path
import unittest

P = Path(__file__).resolve().parents[1] / 'site' / 'engine.py'

class EngineTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(P.exists(), 'Python tracing engine must be implemented')
        spec = importlib.util.spec_from_file_location('engine', P)
        self.engine = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.engine)
        self.steps = []

    def run_code(self, code, inputs=''):
        return self.engine.run_lesson(code, inputs, lambda line, values: self.steps.append((line, json.loads(values))))

    def test_loop_reenters_and_reports_previous_assignment(self):
        result = self.run_code('total = 0\nfor number in range(1, 4):\n    total += number\nprint(total)')
        self.assertEqual(result['output'], '6\n')
        self.assertEqual([n for n,v in self.steps], [1,2,3,2,3,2,3,2,4])
        self.assertEqual(self.steps[-1][1]['total'], '6')
        self.assertEqual(result['variables']['number'], '3')

    def test_input_and_branch_only_visit_taken_lines(self):
        result = self.run_code('n = int(input("number: "))\nif n > 3:\n    print("yes")\nelse:\n    print("no")', '4')
        self.assertEqual(result['output'], 'number: yes\n')
        self.assertEqual([n for n,v in self.steps], [1,2,3])

    def test_missing_input_and_syntax_error_are_visible(self):
        self.assertIn('EOFError', self.run_code('input()')['error'])
        self.assertIn('SyntaxError', self.run_code('if :')['error'])

    def test_infinite_loop_is_bounded(self):
        self.assertIn('실행 단계 제한', self.run_code('while True:\n    pass')['error'])

    def test_output_flood_is_bounded(self):
        r = self.run_code('print("x" * 30000)')
        self.assertLessEqual(len(r['output']), 20000)
        self.assertIn('출력 제한', r['error'])

    def test_variables_are_fresh_between_runs(self):
        self.run_code('secret = 42')
        self.assertIn('NameError', self.run_code('print(secret)')['error'])

    def test_variable_display_does_not_call_student_repr(self):
        r = self.run_code('class Thing:\n    def __repr__(self):\n        print("side effect")\n        return "thing"\nx = Thing()\ny = [x]\nprint("done")')
        self.assertEqual(r['output'], 'done\n')
        self.assertEqual(r['variables']['x'], '<Thing>')

    def test_final_blank_input_line_is_preserved(self):
        r = self.run_code('a = input()\nb = input()\nprint(repr(b))', 'a\n')
        self.assertEqual(r['error'], '')
        self.assertEqual(r['output'], "''\n")

    def test_live_input_prompts_before_read_and_echoes_unicode_and_blank(self):
        chunks, seen = [], []
        answers = iter(['영성', ''])
        def read():
            seen.append(''.join(chunks))
            return next(answers)
        r = self.engine.run_lesson('name = input("이름: ")\nextra = input("추가: ")\nprint(name, repr(extra))', '', lambda *a: None, chunks.append, read)
        self.assertEqual(seen, ['이름: ', '이름: 영성\n추가: '])
        self.assertEqual(r['output'], "이름: 영성\n추가: \n영성 ''\n")
        self.assertEqual(r['error'], '')

    def test_live_input_updates_variable_at_next_step(self):
        r = self.engine.run_lesson('x = input("값: ")\nprint(x)', '', lambda line, values: self.steps.append((line, json.loads(values))), None, lambda: '  hi  ')
        self.assertEqual(self.steps[1], (2, {'x': "'  hi  '"}))
        self.assertEqual(r['output'], '값:   hi  \n  hi  \n')

    def test_long_live_input_is_not_rejected_by_echo_limit(self):
        r = self.engine.run_lesson('x = input()\nn = len(x)', '', lambda *a: None, None, lambda: 'a' * 20000)
        self.assertEqual(r['error'], '')
        self.assertEqual(r['variables']['n'], '20000')
        self.assertLess(len(r['output']), 1200)
        r = self.engine.run_lesson('print("a" * 19999)\nx = input()\nn = len(x)', '', lambda *a: None, None, lambda: 'hello')
        self.assertEqual(r['error'], '')
        self.assertEqual(r['variables']['n'], '5')

    def test_browser_print_input_separates_interaction_from_program_output(self):
        interactions, chunks = [], []
        r = self.engine.run_lesson('print(input("이름"))', '', lambda *a: None, chunks.append, lambda: '문영성', lambda kind, text: interactions.append((kind, text)))
        self.assertEqual(r['error'], '')
        self.assertEqual(r['output'], '문영성\n')
        self.assertEqual(''.join(chunks), '문영성\n')
        self.assertEqual(interactions, [('prompt', '이름'), ('input', '문영성')])

    def test_browser_bare_input_produces_no_program_output(self):
        events = []
        def read():
            self.assertEqual(events, [('prompt', '이름')])
            return '문영성'
        r = self.engine.run_lesson('name = input("이름")', '', lambda *a: None, None, read, lambda *event: events.append(event))
        self.assertEqual(r['output'], '')
        self.assertEqual(r['variables']['name'], "'문영성'")

    def test_browser_repeated_input_keeps_print_output_order(self):
        answers = iter(['', '7'])
        r = self.engine.run_lesson('print("시작")\na = input("첫 번째")\nb = input("두 번째")\nprint(repr(a), int(b) + 1)', '', lambda *a: None, None, lambda: next(answers), lambda *a: None)
        self.assertEqual(r['error'], '')
        self.assertEqual(r['output'], "시작\n'' 8\n")

if __name__ == '__main__':
    unittest.main()

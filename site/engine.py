"""Actual CPython line tracing, shared by browser Pyodide and native tests."""
import builtins
import contextlib
import json
import sys
import traceback


def run_lesson(code, inputs, on_step, on_output=None, on_input=None, on_interaction=None):
    output = []
    length = 0
    events = 0
    namespace = {'__name__': '__main__'}
    lines = iter(inputs.replace('\r\n', '\n').split('\n') if inputs else [])

    def safe_repr(value, depth=0):
        # Never invoke student-defined __repr__ while displaying debugger state.
        kind = type(value)
        if kind in (str, int, float, bool, type(None)):
            return repr(value)[:300]
        if depth >= 3:
            return '…'
        if kind in (list, tuple):
            left, right = ('[', ']') if kind is list else ('(', ')')
            parts = [safe_repr(v, depth + 1) for v in value[:8]]
            if len(value) > 8:
                parts.append('…')
            return (left + ', '.join(parts) + right)[:300]
        if kind is dict:
            parts = []
            for i, (k, v) in enumerate(value.items()):
                if i == 8:
                    parts.append('…')
                    break
                parts.append(safe_repr(k, depth + 1) + ': ' + safe_repr(v, depth + 1))
            return ('{' + ', '.join(parts) + '}')[:300]
        return '<' + kind.__name__ + '>'

    def snapshot(values):
        result = {}
        for key, value in list(values.items())[:60]:
            if key.startswith('__'):
                continue
            try:
                result[key] = safe_repr(value)
            except Exception:
                result[key] = '<표시할 수 없는 값>'
        return result

    class Output:
        def write(self, text):
            nonlocal length
            text = str(text)
            if length + len(text) > 20000:
                raise RuntimeError('출력 제한(20,000자)에 도달했습니다.')
            output.append(text)
            length += len(text)
            if on_output:
                on_output(text)
            return len(text)

        def flush(self):
            pass

    sink = Output()

    def lesson_input(prompt=''):
        if on_interaction is not None:
            on_interaction('prompt', str(prompt))
        else:
            sink.write(prompt)
        if on_input is not None:
            value = str(on_input())
            echo = value if len(value) <= 1000 else value[:1000] + '… [입력 표시 생략]'
            # Echo is presentation, not program output: do not reject valid input
            # merely because earlier prints consumed the display budget.
            if on_interaction is not None:
                on_interaction('input', echo)
            else:
                sink.write((echo + '\n')[:max(0, 20000 - length)])
            return value
        try:
            return next(lines)
        except StopIteration:
            raise EOFError('입력값이 부족합니다. 입력값 칸에 한 줄씩 준비해 주세요.') from None

    namespace['__builtins__'] = dict(vars(builtins), input=lesson_input)

    def trace(frame, event, arg):
        nonlocal events
        if frame.f_code.co_filename == 'lesson.py' and event == 'line':
            events += 1
            if events > 20000:
                raise RuntimeError('실행 단계 제한(20,000회)에 도달했습니다.')
            on_step(frame.f_lineno, json.dumps(snapshot(frame.f_locals), ensure_ascii=False))
        return trace

    error = ''
    old_trace = sys.gettrace()
    try:
        compiled = compile(code, 'lesson.py', 'exec')
        with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
            sys.settrace(trace)
            exec(compiled, namespace)
    except BaseException:
        error = traceback.format_exc(limit=5)
    finally:
        sys.settrace(old_trace)
    return {'output': ''.join(output), 'variables': snapshot(namespace), 'error': error}

"""Сравнивает две истории .twee: имена, теги и тексты пассажей.
Позиции и размеры на карте не сравниваются.
python3 twee_compare.py a.twee b.twee"""
import json
import re
import sys

HEADER = re.compile(r'^:: (.*?)(?: \[(.*?)\])?(?: (\{.*\}))?\s*$')


def parse(path):
    passages, name, lines = {}, None, []

    def flush():
        if name is not None:
            text = '\n'.join(lines).rstrip()
            passages[name[0]] = (sorted(name[1].split()) if name[1] else [], text)

    for line in open(path, encoding='utf-8').read().split('\n'):
        m = HEADER.match(line)
        if m:
            flush()
            name, lines = (m.group(1).replace('\\[', '[').replace('\\]', ']'), m.group(2)), []
        else:
            lines.append(line)
    flush()
    return passages


a, b = parse(sys.argv[1]), parse(sys.argv[2])
problems = []
for key in sorted(set(a) | set(b)):
    if key == 'StoryData':
        da, db = json.loads(a[key][1]), json.loads(b[key][1])
        for k in ('ifid', 'format', 'format-version', 'start', 'tag-colors'):
            if da.get(k) != db.get(k):
                problems.append(f'StoryData.{k}: {da.get(k)} != {db.get(k)}')
        continue
    if key not in a or key not in b:
        problems.append(f'пассаж только в одном файле: {key}')
    elif a[key] != b[key]:
        problems.append(f'различается: {key}')
print(f'пассажей: {len(a)} / {len(b)}')
print('\n'.join(problems) if problems else 'ПОТЕРЬ НЕТ')
sys.exit(1 if problems else 0)

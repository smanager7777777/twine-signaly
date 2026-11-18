# СИГНАЛЫ: копирует сетевой модуль терминала из клона signaly-app в движок.
# python3 signaly/tools/sync-net-module.py ../signaly-app
import sys
src = open(sys.argv[1] + '/src/terminal/sg-term-net.js', encoding='utf-8').read()
assert '`' not in src and '${' not in src, 'в модуле не должно быть обратных кавычек и «${»'
path = 'src/util/signaly/signaly-net-module.ts'
head = open(path, encoding='utf-8').read().split('export const signalyNetModule')[0]
open(path, 'w', encoding='utf-8').write(head + 'export const signalyNetModule = String.raw`' + src.rstrip('\n') + '`;\n')
print('ok', path)

# СИГНАЛЫ: распознавание QR для окна «Сеть» терминала (сессия 32).
# Chrome в Windows не умеет BarcodeDetector, поэтому в движок вставлена jsQR (Apache-2.0).
# python3 signaly/tools/make-jsqr.py <jsQR.min.js>
#   jsQR.min.js: npx terser node_modules/jsqr/dist/jsQR.js -c -m (jsqr 1.4.0 из npm)
import json, sys
src = open(sys.argv[1], encoding='utf-8').read().strip()
head = ('// «Twine СИГНАЛЫ»: jsQR 1.4.0 (https://github.com/cozmo/jsQR, лицензия Apache-2.0,\n'
        '// © 2017 Cosmo Wolfe) — распознавание QR «СЕТЬ» камерой ноутбука (сессия 32).\n'
        '// Файл собирается скриптом signaly/tools/make-jsqr.py, руками не править.\n'
        '/* eslint-disable */\n')
open('src/util/signaly/signaly-jsqr.ts', 'w', encoding='utf-8').write(head + 'export const signalyJsQR = ' + json.dumps(src, ensure_ascii=True) + ';\n')
print('ok', len(src))

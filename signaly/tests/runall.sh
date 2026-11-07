#!/bin/bash
# Все проверки подряд (сессия 27). Итог — /tmp/run/summary.txt
# Старые шаблоны: for c in a8b24b6~2 64321cf 5e0afed 30462fa 60c483a fa0a506 b6203c6 2e57ad0 b633a9d 8b80f1a c6bc328 4b9ae32;
#   do git show $c:signaly/template/27_03_2025.twee > /tmp/run/t-${c/~/_}.twee; done
cd /home/claude/twine-signaly
PW=/opt/npm-tools/node_modules/playwright
SH=/opt/npm-tools/node_modules/sharp
T=signaly/template/27_03_2025.twee
M=/tmp/run/media
rm -rf $M; mkdir -p $M /tmp/run/logs /tmp/run/shots
python3 signaly/tests/make_placeholder_media.py signaly/template/media-list.txt $M >/dev/null
[ -f /tmp/run/package/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2 ] || (cd /tmp/run && npm pack dseg >/dev/null 2>&1 && tar xzf dseg-*.tgz)
cp /tmp/run/package/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2 $M/media/fonts/DSEG7Classic-Regular.woff2
S=/tmp/run/summary.txt; : > $S
res() { # имя лог
  local ok=$(grep -c '^OK' $2); local fail=$(grep -c '^FAIL' $2); local tail=$(tail -2 $2 | tr '\n' ' ')
  echo "$1: OK=$ok FAIL=$fail | $tail" >> $S
}
node signaly/tests/publish-twee.mjs $T $M/game.html > /dev/null
game() { local name=$1; shift; timeout 900 node signaly/tests/$name.mjs "$@" > /tmp/run/logs/$name.log 2>&1; res $name /tmp/run/logs/$name.log; }
game template-play $M/game.html $PW /tmp/run/shots
game blocks-play $T $M $PW
# Шаг 7.2: музыка шаблона ушла из StoryInit — «стало» для звуков наборов — шаблон сессии 26.
game sounds-play /tmp/run/t-c6bc328.twee /tmp/run/t-4b9ae32.twee $M $PW
game timers-play $T $M $PW
game logic-play $T $M $PW
game actions-play /tmp/run/t-64321cf.twee $T $M $PW
game keys-play /tmp/run/t-5e0afed.twee $T $M $PW
game codes-play /tmp/run/t-30462fa.twee $T $M $PW
game events-play $T $M $PW
game ticker-play $T $M $PW
game screens-play $T $M $PW
game access-play $T $M $PW
game articles-play $T $M $PW
game first-play $T $M $PW ""
game list-play $T $M $PW ""
game hack-play $T $M $PW ""
game camera-play $T $M $PW $SH "" ""
game step54-play $T $M $PW $SH "" ""
game step6-play $T $M $PW ""
game step6b-play $T $M $PW ""
game step25-play $T $M $PW ""
game music-play $T $M $PW /tmp/run/shots
game radio-play $T $M $PW /tmp/run/shots
game air-play $T $M $PW /tmp/run/shots
echo "--- программа" >> $S
el() { local name=$1 tw=$2
  for try in 1 2; do
    TWEE=$tw MEDIA=$M SHOT=/tmp/run/shots/$name.png OUT=/tmp/run/out timeout 900 xvfb-run -a -s "-screen 0 1600x1000x24" node signaly/tests/$name.mjs $PW > /tmp/run/logs/$name.log 2>&1
    grep -q "ВСЁ ХОРОШО\|^\([0-9]*\)/\1 " /tmp/run/logs/$name.log && break
    tail -3 /tmp/run/logs/$name.log | grep -q "проверок пройдено" && ! grep -q "^FAIL" /tmp/run/logs/$name.log && break
  done
  res "$name (попыток $try)" /tmp/run/logs/$name.log
}
mkdir -p /tmp/run/out
el electron-smoke /tmp/run/t-a8b24b6_2.twee
el electron-logic $T
el electron-actions /tmp/run/t-64321cf.twee
el electron-keys /tmp/run/t-5e0afed.twee
el electron-codes /tmp/run/t-30462fa.twee
el electron-events /tmp/run/t-60c483a.twee
el electron-ticker $T
el electron-screens $T
el electron-access $T
el electron-articles $T
el electron-first $T
el electron-list $T
el electron-hack /tmp/run/t-fa0a506.twee
el electron-camera /tmp/run/t-b6203c6.twee
el electron-step54 /tmp/run/t-2e57ad0.twee
el electron-step6 /tmp/run/t-b633a9d.twee
el electron-step6b /tmp/run/t-8b80f1a.twee
el electron-step25 $T
el electron-music /tmp/run/t-4b9ae32.twee
el electron-radio /tmp/run/t-4b9ae32.twee
el electron-air $T
echo DONE >> $S

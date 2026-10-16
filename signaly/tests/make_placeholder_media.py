"""Создаёт пустышки медиафайлов из media-list.txt (для проверки путей).
python3 make_placeholder_media.py <media-list.txt> <папка игры>"""
import os
import subprocess
import sys

from PIL import Image

listing, root = sys.argv[1], sys.argv[2]
for rel in open(listing, encoding='utf-8').read().split():
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ext = rel.rsplit('.', 1)[-1].lower()
    if ext in ('png', 'jpg'):
        Image.new('RGB', (64, 64), (0, 120, 0)).save(path)
    elif ext in ('wav', 'mp3'):
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '0.3', path], check=True)
    elif ext == 'mp4':
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=green:s=64x64:d=0.5', '-c:v', 'libvpx-vp9', path], check=True)
    else:
        open(path, 'wb').write(b'\0' * 16)
print('готово:', root)

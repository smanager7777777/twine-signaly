// Пробная история шага 7.1 «Музыка» для автора: шаблон (оформление, движок) + каталог
// на файлах музыки шаблона + экраны «Пульт», «Альбомы», «Комната», «Находка».
// Своё имя и IFID, чтобы импорт не задел историю 27,03,2025.
// node signaly/demo/make-music-demo.mjs signaly/template/27_03_2025.twee signaly/demo/music-demo.twee
import fs from 'fs';

const [from, to] = process.argv.slice(2);
const template = fs.readFileSync(from, 'utf8').replace(/\r\n/g, '\n');
const text = template
	.replace(/:: StoryTitle\n[^\n]*\n/, ':: StoryTitle\nПроба музыки\n')
	.replace(/"ifid": "[^"]*"/, '"ifid": "5E1A7A26-7C1D-4F3B-9E57-26A0B7C0D126"')
	.replace(/"start": "[^"]*"/, '"start": "Пульт"')
	.replace(/\s*$/, '\n') +
	`
:: Музыка [sg-music] {"position":"100,1500","size":"100,100"}
/* СИГНАЛЫ: музыка — правьте в окне «Музыка» (вкладка «История»). Папки и треки идут
   по порядку; трек относится к папке выше. Условие трека — внутри <<sg-track>>…<</sg-track>>. */
<<sg-music volume 30 spin 0.8 auto>>
<<sg-folder "Классика" section ambient>>
<<sg-track "Gaal" "media/audio/musics/classic/gaal.mp3">><</sg-track>>
<<sg-track "Malloc" "media/audio/musics/classic/MALLOC.mp3">><</sg-track>>
<<sg-track "People" "media/audio/musics/classic/PEOPLE.mp3">><</sg-track>>
<<sg-folder "Новая" section ambient>>
<<sg-track "Gaal Pirate" "media/audio/musics/new/Gaal_Pirate.mp3">><</sg-track>>
<<sg-track "Human Pirate" "media/audio/musics/new/Human_Pirate.mp3">><</sg-track>>
<<sg-track "Maloc Pirate" "media/audio/musics/new/Maloc_Pirate.mp3">><</sg-track>>
<<sg-folder "Третья" section ambient>>
<<sg-track "Beyond reach" "media/audio/musics/третья/Beyond_reach.mp3">><</sg-track>>
<<sg-track "Fight" "media/audio/musics/третья/fight.mp3">><</sg-track>>
<<sg-track "Weapon" "media/audio/musics/третья/WEAPON.mp3" start 50>>$plate is 1<</sg-track>>
<<sg-folder "Пластинки" section radio>>
<<sg-track "Regentropfen" "media/audio/radioRegentropfen.wav" pre "media/audio/radiovinyl.wav" wait 8 tail 2 start 10>><</sg-track>>
<<sg-track "Schubert, серенада" "media/audio/radioSchubert_serenade.wav" pre "media/audio/radiovinyl.wav" wait 8 tail 2>><</sg-track>>
<<sg-track "Raindrop" "media/audio/radioraindrop.wav" pre "media/audio/radiovinyl.wav" wait 8 tail 2>><</sg-track>>

:: Пульт {"position":"250,1500","size":"100,100"}
<<sg-screen-music play ambient>>\\
<<sg-volume step 5 size 40 place screen corner tr x 40 y 40>>\\
ПРОБА МУЗЫКИ (шаг 7.1)
Громкость — окошко справа вверху, кнопки «−» и «+». На паузе окошко показывает 00.
<span class="amber"><<link "АТМ">><<sg-mus toggle ambient>><</link>> <<link "РАД">><<sg-mus toggle radio>><</link>></span>
<span class="amber"><<link "ПАУЗА">><<sg-mus pause>><</link>> <<link "ДАЛЬШЕ">><<sg-mus resume>><</link>> <<link "СТОП">><<sg-mus stop>><</link>> <<link "СЛЕДУЮЩИЙ">><<sg-mus next>><</link>> <<link "АВТО вкл/выкл">><<sg-mus auto toggle>><</link>></span>
<span class="amber"><<link "A">><<sg-mus volume 10>><</link>> <<link "B">><<sg-mus volume 20>><</link>> <<link "C">><<sg-mus volume 30>><</link>> <<link "D">><<sg-mus volume 50>><</link>> <<link "E">><<sg-mus volume 99>><</link>></span>

[[Альбомы]]
[[Комната]] — через 5 секунд музыка сменится
[[Находка]] — новый трек в каталоге по условию

:: Альбомы {"position":"400,1500","size":"100,100"}
АЛЬБОМЫ
<<link "Классика">><<sg-mus play folder "Классика">><</link>>
<<link "Новая">><<sg-mus play folder "Новая">><</link>>
<<link "Третья">><<sg-mus play folder "Третья">><</link>>
<<link "Пластинка: Regentropfen (с иглой)">><<sg-mus play track "Пластинки/Regentropfen">><</link>>
<<sg-volume step 1 size 30>>

[[Назад|Пульт]]

:: Комната {"position":"550,1500","size":"100,100"}
<<sg-screen-music delay 5 now fade fade 3 play folder "Пластинки" after 1 rise 2>>\\
КОМНАТА
Побудьте здесь 5 секунд: текущая музыка затихнет, и вступит пластинка.
Уйдёте раньше — ничего не сменится.

[[Назад|Пульт]]

:: Находка {"position":"700,1500","size":"100,100"}
НАХОДКА
<<link "Найти пластинку «Weapon»">><<set $plate to 1>><</link>> — трек появится в папке «Третья». При первом включении громкость станет 50.
<<link "Включить Weapon">><<sg-mus play track "Третья/Weapon">><</link>>

[[Назад|Пульт]]
`;

fs.writeFileSync(to, text);
console.log(to);

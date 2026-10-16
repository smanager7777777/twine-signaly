import {app} from 'electron';
import {join} from 'path';
import {initApp} from './init-app';
import {loadAppPrefs} from './app-prefs';
import {initHardwareAcceleration} from './hardware-acceleration';

// «Twine СИГНАЛЫ»: своё имя программы — значит, свои настройки
// (%APPDATA%\Twine СИГНАЛЫ) отдельно от обычного Twine. Должно стоять до
// первого обращения к app.getPath('userData').

app.setName('Twine СИГНАЛЫ');
app.setPath('userData', join(app.getPath('appData'), 'Twine СИГНАЛЫ'));

// We need to load prefs here *and block* because disabling hardware
// acceleration has to happen before the app is ready.
// @see https://github.com/electron/electron/issues/21370

loadAppPrefs();
initHardwareAcceleration();

// Continue initialization that needs to happen after Electron is ready.

app.whenReady().then(initApp);
app.on('window-all-closed', () => app.quit());

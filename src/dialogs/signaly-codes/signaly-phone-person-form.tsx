// «Twine СИГНАЛЫ»: поля телефона у сотрудника в окне «Коды» (сессия 33, этап Т3-1, ответ
// Т3-5 А: сотрудник терминала и персонаж приложения — одна запись, П-59 А3). Данные — JSON
// аккаунта приложения в слове phone '…' (11_APP_IN_STORY.md); номер — номер сотрудника.

import * as React from 'react';
import {AppGame} from '../../util/signaly/signaly-app';
import {appModules, moduleOff, newAccount, voiceModes} from '../../util/signaly/signaly-app-model';
import {CheckField, ChoiceField, TextField} from '../signaly-appearance/signaly-appearance-fields';
import {AppRefsContext, paletteOptions, usePhoneL} from '../signaly-app/signaly-app-fields';
import {randomDigits} from '../../util/signaly/signaly-app-model';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Режим голоса и функция «Голос» вместе (setVoiceMode редактора приложения). */
export function withVoiceMode(data: AppGame, mode: string): AppGame {
	const modules: string[] = Array.isArray(data.modules) ? data.modules.filter((m: string) => m !== 'voice') : [];

	return {...data, voiceMode: mode, modules: mode === 'off' ? modules : [...modules, 'voice']};
}

export function voiceModeOf(data: AppGame) {
	const modules: string[] = Array.isArray(data.modules) ? data.modules : [];

	return voiceModes.includes(data.voiceMode) && data.voiceMode !== 'off'
		? data.voiceMode
		: modules.includes('voice')
		? 'button'
		: 'off';
}

export const PhonePersonForm: React.FC<{
	data: AppGame | undefined;
	num: string;
	usedCodes: Set<string>;
	onChange: (data: AppGame | undefined) => void;
}> = ({data, num, onChange, usedCodes}) => {
	const l = usePhoneL();
	const refs = React.useContext(AppRefsContext);

	if (!data) {
		return (
			<>
				<h3>{l('person.title')}</h3>
				<CheckField hint={l('person.onHint')} label={l('person.on')} onChange={on => on && onChange(newAccount(usedCodes))} value={false} />
			</>
		);
	}

	const set = (patch: AppGame) => onChange({...data, ...patch});
	const modules: string[] = Array.isArray(data.modules) ? data.modules : [];
	const modChapter: AppGame = data.modChapter && typeof data.modChapter === 'object' ? data.modChapter : {};
	const modState: AppGame = data.modState && typeof data.modState === 'object' ? data.modState : {};
	const colors: AppGame = data.colors && typeof data.colors === 'object' && !Array.isArray(data.colors) ? data.colors : {};
	const voice = voiceModeOf(data);
	const setColor = (n: string, patch: AppGame) => {
		const c = {...(colors[n] ?? {}), ...patch};
		const next = {...colors, [n]: c};

		if (!c.def && !c.choose && !c.any && !c.pin) {
			delete next[n];
		}
		set({colors: next});
	};
	const chapterOptions = refs.chapters.map(c => ({label: l('person.fromChapter', {n: c.n}), value: String(c.n)}));

	return (
		<>
			<h3>{l('person.title')}</h3>
			<CheckField
				hint={l('person.onHint')}
				label={l('person.on')}
				onChange={on => !on && window.confirm(l('person.confirmOff')) && onChange(undefined)}
				value
			/>
			<TextField label={l('person.name')} onChange={name => set({name})} value={String(data.name ?? '')} />
			<TextField label={l('person.profession')} onChange={profession => set({profession})} value={String(data.profession ?? '')} />
			<TextField hint={l('person.loginHint')} label={l('person.login')} onChange={login => set({login})} value={String(data.login ?? '')} />
			<button className="signaly-button" onClick={() => set({login: randomDigits(6, usedCodes)})} type="button">
				{l('person.random')}
			</button>
			<div className="signaly-field-hint">{l('person.numHint', {num})}</div>
			<h5 className="signaly-block-subtitle">{l('person.modules')}</h5>
			<div className="signaly-field-hint">{l('person.modulesHint')}</div>
			<table className="signaly-phone-table">
				<tbody>
					{appModules.map(m => (
						<tr key={m}>
							<td>
								<CheckField
									label={l(`modules.${m}`)}
									onChange={on => {
										if (m === 'voice') {
											onChange(withVoiceMode(data, on ? (voice === 'off' ? 'button' : voice) : 'off'));
										} else {
											set({modules: on ? [...modules.filter(x => x !== m), m] : modules.filter(x => x !== m)});
										}
									}}
									value={modules.includes(m)}
								/>
							</td>
							<td>
								<ChoiceField
									label={l('person.moduleChapter', {name: l(`modules.${m}`)})}
									onChange={v => set({modChapter: {...modChapter, [m]: Number(v)}})}
									options={chapterOptions}
									value={String(modChapter[m] || 1)}
								/>
							</td>
							<td>
								<ChoiceField
									label={l('person.moduleOff', {name: l(`modules.${m}`)})}
									onChange={v => set({modState: {...modState, [m]: v}})}
									options={moduleOff.map(v => ({label: l(`person.off.${v}`), value: v}))}
									value={String(modState[m] || 'hidden')}
								/>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			<ChoiceField
				hint={l(`person.voiceHint.${voice}`)}
				label={l('person.voice')}
				onChange={v => onChange(withVoiceMode(data, v))}
				options={voiceModes.map(v => ({label: l(`voiceModes.${v}`), value: v}))}
				value={voice}
			/>
			<h5 className="signaly-block-subtitle">{l('person.colors')}</h5>
			<div className="signaly-field-hint">{l('person.colorsHint')}</div>
			<table className="signaly-phone-table">
				<tbody>
					{refs.chapters.map(c => {
						const n = String(c.n);
						const cfg = colors[n] ?? {};

						return (
							<tr key={n}>
								<td>{`${c.n}. ${c.name}`}</td>
								<td>
									<ChoiceField
										label={l('person.colorDef', {n: c.n})}
										onChange={def => setColor(n, {def})}
										options={paletteOptions(refs.palette, l('person.colorAsChapter'))}
										value={String(cfg.def ?? '')}
									/>
								</td>
								<td>
									<CheckField label={l('person.colorChoose')} onChange={choose => setColor(n, {choose})} value={!!cfg.choose} />
									<CheckField label={l('person.colorAny')} onChange={any => setColor(n, {any})} value={!!cfg.any} />
								</td>
								<td>
									<ChoiceField
										label={l('person.colorPin', {n: c.n})}
										onChange={pin => setColor(n, {pin})}
										options={paletteOptions(refs.palette, l('person.colorPinNone'))}
										value={String(cfg.pin ?? '')}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			{Array.isArray(data.items) && data.items.length > 0 && <div className="signaly-field-hint">{l('person.items', {n: data.items.length})}</div>}
		</>
	);
};

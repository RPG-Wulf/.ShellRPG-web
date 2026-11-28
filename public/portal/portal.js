'use strict';
const byId = id => document.getElementById(id);
const labels = {google: 'Google', facebook: 'Facebook', github: 'GitHub'};
const creation = byId('create');
const message = byId('message');
const draftName = '__oauth_pending__';

async function api(path, data) {
  const options = data === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data),
  };
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.message || 'Die Verbindung ist gerade nicht verfügbar.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function selectCharacter(character) {
  try {
    await api('/api/control/takeover', {reason: 'character-portal'});
    await api('/api/character/select', {character_id: character.character_id});
    location.assign('/world/');
  } catch (error) { message.textContent = error.message; }
}

function renderCharacters(entries, limit) {
  const real = entries.filter(entry => entry.character_name !== draftName);
  byId('slots').textContent = real.length + ' / ' + limit;
  message.textContent = real.length ? 'Wähle eine Figur für die Welt.' : 'Lege deinen ersten Charakter an.';
  byId('characters').replaceChildren(...real.map(character => {
    const item = document.createElement('li');
    const details = document.createElement('div');
    const name = document.createElement('strong');
    const context = document.createElement('small');
    name.textContent = character.character_name;
    context.textContent = character.race_name + ' · ' + character.class_name + ' · Stufe ' + character.level;
    details.append(name, context);
    const start = document.createElement('button');
    start.type = 'button';
    start.textContent = 'Spielen';
    start.onclick = () => selectCharacter(character);
    item.append(details, start);
    return item;
  }));
  creation.hidden = real.length >= limit;
  byId('logout').hidden = false;
}

function signInLinks(providers, linking) {
  return providers.map(provider => {
    const link = document.createElement('a');
    link.href = '/auth/' + provider + '/start' + (linking ? '?connect=1' : '');
    link.textContent = 'Mit ' + labels[provider] + (linking ? ' verbinden' : ' anmelden');
    return link;
  });
}

async function show() {
  const {providers, character_limit: limit} = await api('/auth/providers');
  const authorized = await api('/api/characters').catch(error => {
    if (error.status !== 401) throw error;
    return null;
  });
  if (authorized) {
    const linked = new Set(authorized.linked_auth_providers || []);
    byId('providers').replaceChildren(...signInLinks(providers.filter(provider => !linked.has(provider)), true));
    renderCharacters(authorized.entries, limit);
    if (new URLSearchParams(location.search).get('anmeldung') === 'fehlgeschlagen') {
      message.textContent = 'Die Verknüpfung ist fehlgeschlagen. Die bisherigen Charaktere bleiben verfügbar.';
    }
    return;
  }
  creation.hidden = true;
  byId('logout').hidden = true;
  const failed = new URLSearchParams(location.search).get('anmeldung') === 'fehlgeschlagen';
  message.textContent = failed ? 'Die Anmeldung ist fehlgeschlagen. Versuche es erneut.' :
    providers.length ? 'Melde dich an, um deine Charaktere zu speichern.' : 'Für diese Adresse ist noch kein Anmeldeanbieter eingerichtet.';
  byId('providers').replaceChildren(...signInLinks(providers, false));
}

creation.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(creation));
  fields.character_name = fields.character_name.trim();
  if (!/^[\p{L}\p{M}][\p{L}\p{M}\p{N} '-]{1,31}$/u.test(fields.character_name)) {
    message.textContent = 'Der Name braucht 2 bis 32 Zeichen und beginnt mit einem Buchstaben.';
    return;
  }
  const submit = creation.querySelector('button');
  submit.disabled = true;
  try {
    await api('/api/control/takeover', {reason: 'character-portal'});
    await api('/api/character/create', {...fields, language: 'de'});
    creation.reset();
    await show();
  } catch (error) { message.textContent = error.message; }
  finally { submit.disabled = false; }
});
show().catch(error => { message.textContent = error.message; });

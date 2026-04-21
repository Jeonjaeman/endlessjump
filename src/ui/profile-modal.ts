import { getLocalProfile, saveLocalProfile, updateProfile, type LocalProfile } from '../services/auth';

const COUNTRY_FLAGS: [string, string][] = [
  ['KR', '\u{1F1F0}\u{1F1F7}'], ['US', '\u{1F1FA}\u{1F1F8}'], ['JP', '\u{1F1EF}\u{1F1F5}'],
  ['CN', '\u{1F1E8}\u{1F1F3}'], ['GB', '\u{1F1EC}\u{1F1E7}'], ['DE', '\u{1F1E9}\u{1F1EA}'],
  ['FR', '\u{1F1EB}\u{1F1F7}'], ['BR', '\u{1F1E7}\u{1F1F7}'], ['IN', '\u{1F1EE}\u{1F1F3}'],
  ['TH', '\u{1F1F9}\u{1F1ED}'], ['VN', '\u{1F1FB}\u{1F1F3}'], ['RU', '\u{1F1F7}\u{1F1FA}'],
  ['ES', '\u{1F1EA}\u{1F1F8}'], ['IT', '\u{1F1EE}\u{1F1F9}'], ['AU', '\u{1F1E6}\u{1F1FA}'],
  ['CA', '\u{1F1E8}\u{1F1E6}'], ['MX', '\u{1F1F2}\u{1F1FD}'], ['PH', '\u{1F1F5}\u{1F1ED}'],
  ['ID', '\u{1F1EE}\u{1F1E9}'], ['TW', '\u{1F1F9}\u{1F1FC}'],
];

export function getFlagEmoji(countryCode: string): string {
  const entry = COUNTRY_FLAGS.find(([code]) => code === countryCode);
  return entry ? entry[1] : '\u{1F3F3}\u{FE0F}';
}

let modalElement: HTMLDivElement | null = null;
let resolveCallback: ((profile: LocalProfile | null) => void) | null = null;

export function showProfileModal(): Promise<LocalProfile | null> {
  return new Promise((resolve) => {
    resolveCallback = resolve;
    const profile = getLocalProfile();
    createModal(profile);
  });
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (text !== undefined) e.textContent = text;
  return e;
}

function createModal(profile: LocalProfile): void {
  if (modalElement) modalElement.remove();

  modalElement = el('div', `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.7);display:flex;align-items:center;
    justify-content:center;z-index:9999;font-family:sans-serif;
  `);

  const box = el('div', `
    background:#2a2a3e;border-radius:16px;padding:24px;
    width:min(320px,90vw);color:#fff;text-align:center;
  `);

  const title = el('h2', 'margin:0 0 16px;font-size:20px;', '프로필 설정');
  box.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 12;
  input.value = profile.nickname;
  input.placeholder = '닉네임 (최대 12자)';
  input.style.cssText = `
    width:100%;padding:10px;border:2px solid #555;border-radius:8px;
    background:#1a1a2e;color:#fff;font-size:16px;box-sizing:border-box;
    margin-bottom:16px;outline:none;
  `;
  box.appendChild(input);

  const label = el('p', 'margin:0 0 8px;font-size:14px;color:#aaa;', '국가 선택');
  box.appendChild(label);

  const flagsDiv = el('div', `
    display:flex;flex-wrap:wrap;gap:8px;justify-content:center;
    max-height:120px;overflow-y:auto;margin-bottom:16px;
  `);

  let selectedCode = profile.country_code;

  for (const [code, flag] of COUNTRY_FLAGS) {
    const btn = el('button', `
      font-size:24px;padding:4px 8px;border-radius:6px;cursor:pointer;
      border:2px solid ${code === selectedCode ? '#FF6B35' : 'transparent'};
      background:${code === selectedCode ? 'rgba(255,107,53,0.2)' : 'transparent'};
    `, flag);
    btn.addEventListener('click', () => {
      selectedCode = code;
      flagsDiv.querySelectorAll('button').forEach(b => {
        b.style.border = '2px solid transparent';
        b.style.background = 'transparent';
      });
      btn.style.border = '2px solid #FF6B35';
      btn.style.background = 'rgba(255,107,53,0.2)';
    });
    flagsDiv.appendChild(btn);
  }
  box.appendChild(flagsDiv);

  const saveBtn = el('button', `
    width:100%;padding:12px;background:#FF6B35;
    border:none;border-radius:8px;color:#fff;font-size:16px;font-weight:bold;
    cursor:pointer;
  `, '저장');
  saveBtn.addEventListener('click', () => {
    const nickname = input.value.trim() || 'Bunny';
    const newProfile: LocalProfile = { nickname, country_code: selectedCode };
    saveLocalProfile(newProfile);
    updateProfile(newProfile);
    closeModal(newProfile);
  });
  box.appendChild(saveBtn);

  modalElement.appendChild(box);
  document.body.appendChild(modalElement);

  modalElement.addEventListener('click', (e) => {
    if (e.target === modalElement) closeModal(null);
  });
}

function closeModal(result: LocalProfile | null): void {
  if (modalElement) {
    modalElement.remove();
    modalElement = null;
  }
  if (resolveCallback) {
    resolveCallback(result);
    resolveCallback = null;
  }
}

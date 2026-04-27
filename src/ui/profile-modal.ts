import { getLocalProfile, saveLocalProfile, updateProfile, getSupabaseUserId, type LocalProfile } from '../services/auth';
import { getSupabase } from '../services/supabase';

const COUNTRY_FLAGS: [string, string, string][] = [
  ['KR', '\u{1F1F0}\u{1F1F7}', '한국'], ['US', '\u{1F1FA}\u{1F1F8}', '미국'], ['JP', '\u{1F1EF}\u{1F1F5}', '일본'],
  ['CN', '\u{1F1E8}\u{1F1F3}', '중국'], ['GB', '\u{1F1EC}\u{1F1E7}', '영국'], ['DE', '\u{1F1E9}\u{1F1EA}', '독일'],
  ['FR', '\u{1F1EB}\u{1F1F7}', '프랑스'], ['BR', '\u{1F1E7}\u{1F1F7}', '브라질'], ['IN', '\u{1F1EE}\u{1F1F3}', '인도'],
  ['TH', '\u{1F1F9}\u{1F1ED}', '태국'], ['VN', '\u{1F1FB}\u{1F1F3}', '베트남'], ['RU', '\u{1F1F7}\u{1F1FA}', '러시아'],
  ['ES', '\u{1F1EA}\u{1F1F8}', '스페인'], ['IT', '\u{1F1EE}\u{1F1F9}', '이탈리아'], ['AU', '\u{1F1E6}\u{1F1FA}', '호주'],
  ['CA', '\u{1F1E8}\u{1F1E6}', '캐나다'], ['MX', '\u{1F1F2}\u{1F1FD}', '멕시코'], ['PH', '\u{1F1F5}\u{1F1ED}', '필리핀'],
  ['ID', '\u{1F1EE}\u{1F1E9}', '인도네시아'], ['TW', '\u{1F1F9}\u{1F1FC}', '대만'],
];

export function getFlagEmoji(countryCode: string): string {
  const entry = COUNTRY_FLAGS.find(([code]) => code === countryCode);
  return entry ? entry[1] : '\u{1F3F3}\u{FE0F}'; // [code, flag, name]
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
    display:flex;flex-wrap:wrap;gap:6px;justify-content:center;
    max-height:180px;overflow-y:auto;margin-bottom:16px;
    padding:4px;
  `);

  let selectedCode = profile.country_code;

  for (const [code, flag, name] of COUNTRY_FLAGS) {
    const btn = el('button', `
      display:flex;align-items:center;gap:4px;
      font-size:14px;padding:6px 10px;border-radius:8px;cursor:pointer;
      border:2px solid ${code === selectedCode ? '#FF6B35' : 'rgba(255,255,255,0.15)'};
      background:${code === selectedCode ? 'rgba(255,107,53,0.25)' : 'rgba(255,255,255,0.05)'};
      color:#fff;
    `);
    const flagSpan = el('span', 'font-size:22px;', flag);
    const nameSpan = el('span', 'font-size:12px;', name);
    btn.appendChild(flagSpan);
    btn.appendChild(nameSpan);
    btn.addEventListener('click', () => {
      selectedCode = code;
      flagsDiv.querySelectorAll('button').forEach(b => {
        b.style.border = '2px solid rgba(255,255,255,0.15)';
        b.style.background = 'rgba(255,255,255,0.05)';
      });
      btn.style.border = '2px solid #FF6B35';
      btn.style.background = 'rgba(255,107,53,0.25)';
    });
    flagsDiv.appendChild(btn);
  }
  box.appendChild(flagsDiv);

  const errorMsg = el('p', `
    margin:0 0 10px;font-size:13px;color:#FF6B6B;min-height:18px;
  `, '');
  box.appendChild(errorMsg);

  const saveBtn = el('button', `
    width:100%;padding:12px;background:#FF6B35;
    border:none;border-radius:8px;color:#fff;font-size:16px;font-weight:bold;
    cursor:pointer;
  `, '저장');
  saveBtn.addEventListener('click', async () => {
    const nickname = input.value.trim() || 'Bunny';
    errorMsg.textContent = '';

    const sb = getSupabase();
    if (sb) {
      const myId = getSupabaseUserId();
      const { data } = await sb.from('profiles')
        .select('id')
        .eq('nickname', nickname)
        .neq('id', myId ?? '')
        .limit(1);
      if (data && data.length > 0) {
        errorMsg.textContent = '이미 사용 중인 닉네임입니다.';
        return;
      }
    }

    const newProfile: LocalProfile = { nickname, country_code: selectedCode };
    saveLocalProfile(newProfile);
    await updateProfile(newProfile);
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

/**
 * 프로필 모달 제거됨 — Google 계정 정보로 자동 프로필 생성
 * getFlagEmoji()만 유지 (ranking-screen.ts에서 사용)
 */

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
  return entry ? entry[1] : '\u{1F3F3}\u{FE0F}';
}

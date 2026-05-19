/**
 * 角色声纹光球 —— 抽象头像,不用真人照片(暗合「语音」气质 + 规避合规风险)。
 * size: 球直径(px);live: 是否带呼吸光环。
 */
export default function CharacterOrb({ character, size = 84, live = false }) {
  return (
    <span
      className={`char-orb ${live ? 'is-live' : ''}`}
      style={{ width: size, height: size, '--orb-accent': character.accent }}
      aria-hidden="true"
    >
      <span className="char-orb__core" />
      <span className="char-orb__initial" style={{ fontSize: size * 0.4 }}>
        {character.name[0]}
      </span>
    </span>
  );
}

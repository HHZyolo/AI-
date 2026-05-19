/**
 * 三个 AI 角色 —— PRD 7.1 / 7.2 / 7.3
 * 落地页 Characters 区与 H5 产品页共用。
 */
export const CHARACTERS = [
  {
    id: 'genki',
    name: '元气妹妹',
    age: '22 岁',
    persona: '刚毕业 · 阳光爱撒娇',
    call: '叫你「哥哥」',
    voice: '元气甜嗓',
    quote: '“哥哥这把太强啦!那个三杀我都看呆了呀～”',
    traits: ['短句口语', '夸人不停', '输了哄你'],
    accent: 'var(--accent)',
  },
  {
    id: 'sister',
    name: '温柔御姐',
    age: '26 岁',
    persona: '成熟稳重 · 能聊深有点撩',
    call: '偶尔唤你「弟弟」',
    voice: '低磁御姐音',
    quote: '“别急,这局先放放。今天到底怎么了,跟我说说。”',
    traits: ['磁性慢语', '深夜树洞', '懂分寸的暧昧'],
    accent: 'var(--violet)',
  },
  {
    id: 'junior',
    name: '高冷学妹',
    age: '20 岁',
    persona: '反差萌 · 表面毒舌心里软',
    call: '直接喊你名字',
    voice: '清冷少女音',
    quote: '“就这?……算了,下把我陪你,别再送了。”',
    traits: ['毒舌互怼', '嘴硬心软', '偶尔真心'],
    accent: 'var(--hud)',
  },
];

export const getCharacter = (id) =>
  CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];

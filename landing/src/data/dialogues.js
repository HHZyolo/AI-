/**
 * 模拟对话脚本 —— 纯前端演示通话页交互(不接后端 AI)。
 * speaker: 'ai' | 'user';每句带停顿 delay(ms,出现前的等待)。
 */
export const DIALOGUES = {
  genki: [
    { speaker: 'ai', text: '哥哥来啦~今晚想打几把呀?', delay: 600 },
    { speaker: 'user', text: '随便打打吧,今天有点累。', delay: 2600 },
    { speaker: 'ai', text: '那不冲分,陪哥哥轻松玩!我帮你报点呀。', delay: 2400 },
    { speaker: 'user', text: '行,选个图。', delay: 2200 },
    { speaker: 'ai', text: '升天怎么样~你架 A 点,我盯 B,稳住!', delay: 2400 },
    { speaker: 'ai', text: '哥哥刚那枪太帅了吧!我都看呆了呀~', delay: 3000 },
  ],
  sister: [
    { speaker: 'ai', text: '回来啦。今天怎么样,还顺利吗?', delay: 700 },
    { speaker: 'user', text: '一般吧,工作上有点烦心事。', delay: 2800 },
    { speaker: 'ai', text: '嗯…先别急着开局,跟我说说,我听着。', delay: 2600 },
    { speaker: 'user', text: '也没什么,就是有点累。', delay: 2400 },
    { speaker: 'ai', text: '那这局慢慢来,赢不赢都没关系,有我陪你。', delay: 2800 },
  ],
  junior: [
    { speaker: 'ai', text: '哦,你来了。今天又是来送的?', delay: 700 },
    { speaker: 'user', text: '说话这么冲干嘛。', delay: 2400 },
    { speaker: 'ai', text: '……行吧,这把我陪你,别乱走位就行。', delay: 2400 },
    { speaker: 'user', text: '知道了知道了。', delay: 2000 },
    { speaker: 'ai', text: '哼,这枪还行。算你今天有点用。', delay: 2800 },
  ],
};

export const getDialogue = (id) => DIALOGUES[id] || DIALOGUES.genki;

export const notesCopy = {
  en: {
    title: 'Notes', intro: 'Writing on ideas, methods, and open questions.',
    empty: 'There are no published notes in English yet.', back: 'All notes',
    synthetic: 'Synthetic demonstration', toc: 'In this note', related: 'Related reading',
    fallback: 'This note is available in its original language. A translation is unavailable.',
    source: 'Open the original', other: 'Read in Chinese',
    tombstone: 'This note is no longer available.', withdrawn: 'This page has been withdrawn.',
    narrow: 'Equations, tables, and code can scroll horizontally when needed.'
  },
  zh: {
    title: '笔记', intro: '记录想法、方法与尚未解决的问题。',
    empty: '目前还没有已发布的中文笔记。', back: '全部笔记',
    synthetic: '合成演示样例', toc: '本文目录', related: '相关阅读',
    fallback: '这篇笔记目前只有原文，译文尚未发布。',
    source: '打开原文', other: '阅读英文版',
    tombstone: '这篇笔记已停止公开。', withdrawn: '此页面已撤回。',
    narrow: '公式、表格和代码在较窄的屏幕上可横向滚动。'
  }
} as const;

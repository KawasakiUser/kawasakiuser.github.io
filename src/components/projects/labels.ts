import type { Locale } from '../../lib/types';

const labels = {
  en: {
    projects: 'Projects', archive: 'Archive', overview: 'Page family', indexHome: 'Back to index',
    synthetic: 'Synthetic engineering fixture', projectContext: 'Long-term projects, their goals and progress.',
    archiveContext: 'Completed works and their publication history.',
    emptyProjects: 'There are no current projects in this language.',
    emptyArchive: 'There are no works available in this language.',
    type: 'Primary type', lifecycle: 'Lifecycle', goal: 'Goal', timeline: 'Milestones', works: 'Related works',
    notes: 'Related notes', relatedProjects: 'Related projects', workDate: 'Work date', work: 'Work',
    versionHistory: 'Version history', resources: 'Resources', currentVersion: 'Current version',
    tombstone: 'This page is no longer available', tombstoneDetail: 'This address previously held a public record.',
    withdrawn: 'Work withdrawn', withdrawnDetail: 'This work has been withdrawn. This notice preserves its former public address.',
    fallback: 'A translation is unavailable. This page displays the published source in',
    source: 'Published source', translation: 'Read this page in',
    types: { venture: 'Venture', research: 'Research', engineering: 'Engineering', creative: 'Creative', other: 'Other' },
    lifecycles: { planned: 'Planned', active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived' }
  },
  zh: {
    projects: '项目', archive: '成果档案', overview: '所属栏目', indexHome: '返回目录',
    synthetic: '工程验证用合成样例', projectContext: '长期项目及其目标与进展。',
    archiveContext: '已完成的成果及其发布历史。',
    emptyProjects: '当前语言暂无可展示的项目。',
    emptyArchive: '当前语言暂无可展示的成果。',
    type: '主要类型', lifecycle: '项目状态', goal: '目标', timeline: '里程碑', works: '相关成果',
    notes: '相关笔记', relatedProjects: '相关项目', workDate: '成果日期', work: '成果',
    versionHistory: '版本历史', resources: '资源', currentVersion: '当前版本',
    tombstone: '此页面已不可用', tombstoneDetail: '此地址曾有公开记录。',
    withdrawn: '成果已撤回', withdrawnDetail: '此成果已撤回。此提示保留原公开地址。',
    fallback: '此页暂无译文，以下展示已发布的原文。原文语言为',
    source: '查看已发布的原文', translation: '切换此页面的语言',
    types: { venture: '创业', research: '研究', engineering: '工程', creative: '创作', other: '其他' },
    lifecycles: { planned: '计划中', active: '进行中', paused: '已暂停', completed: '已完成', archived: '已归档' }
  }
};

export const paLabels = (locale: Locale) => labels[locale];
export const languageName = { en: 'English', zh: '中文' };

export function projectTerm(locale: Locale, axis: 'types' | 'lifecycles', value?: string): string {
  const terms: Readonly<Record<string, string>> = paLabels(locale)[axis];
  const key = value?.toLowerCase() ?? '';
  const term = Object.hasOwn(terms, key) ? terms[key] : undefined;
  if (!term) throw new Error('Unrecognized Project ' + axis + ': ' + value);
  return term;
}

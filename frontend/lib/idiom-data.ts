export interface Idiom {
  id: string
  text: string
  pinyin: string
  meaning: string
  sentiment: 'positive' | 'negative' | 'neutral'
  sentimentScore: number
  dynasty: string
  historicalFigure?: string
  tags: string[]
  connections: string[]
  centrality: number
  density: number
}

export interface GraphNode {
  id: string
  idiom: Idiom
  x: number
  y: number
  vx: number
  vy: number
}

export interface GraphEdge {
  source: string
  target: string
  strength: number
}

// Sample idiom data
export const sampleIdioms: Idiom[] = [
  {
    id: '1',
    text: '画龙点睛',
    pinyin: 'huà lóng diǎn jīng',
    meaning: '比喻写文章或讲话时，在关键处用几句话点明实质，使内容更加生动有力',
    sentiment: 'positive',
    sentimentScore: 0.85,
    dynasty: '南北朝',
    historicalFigure: '张僧繇',
    tags: ['艺术', '精妙', '点题'],
    connections: ['2', '3', '5'],
    centrality: 0.92,
    density: 0.78,
  },
  {
    id: '2',
    text: '栩栩如生',
    pinyin: 'xǔ xǔ rú shēng',
    meaning: '形容画作、雕塑等艺术作品或描写非常逼真，就像活的一样',
    sentiment: 'positive',
    sentimentScore: 0.9,
    dynasty: '战国',
    historicalFigure: '庄子',
    tags: ['艺术', '逼真', '生动'],
    connections: ['1', '4'],
    centrality: 0.85,
    density: 0.65,
  },
  {
    id: '3',
    text: '锦上添花',
    pinyin: 'jǐn shàng tiān huā',
    meaning: '比喻好上加好，美上加美',
    sentiment: 'positive',
    sentimentScore: 0.88,
    dynasty: '宋代',
    historicalFigure: '黄庭坚',
    tags: ['美好', '增添', '完善'],
    connections: ['1', '6'],
    centrality: 0.75,
    density: 0.55,
  },
  {
    id: '4',
    text: '惟妙惟肖',
    pinyin: 'wéi miào wéi xiào',
    meaning: '形容描写或模仿得非常逼真',
    sentiment: 'positive',
    sentimentScore: 0.87,
    dynasty: '清代',
    historicalFigure: '蒲松龄',
    tags: ['逼真', '模仿', '精妙'],
    connections: ['2', '5'],
    centrality: 0.72,
    density: 0.58,
  },
  {
    id: '5',
    text: '妙笔生花',
    pinyin: 'miào bǐ shēng huā',
    meaning: '比喻杰出的写作才能',
    sentiment: 'positive',
    sentimentScore: 0.92,
    dynasty: '唐代',
    historicalFigure: '李白',
    tags: ['写作', '才华', '文学'],
    connections: ['1', '4', '7'],
    centrality: 0.88,
    density: 0.72,
  },
  {
    id: '6',
    text: '雪中送炭',
    pinyin: 'xuě zhōng sòng tàn',
    meaning: '比喻在别人急需时给予物质上或精神上的帮助',
    sentiment: 'positive',
    sentimentScore: 0.95,
    dynasty: '宋代',
    historicalFigure: '范成大',
    tags: ['帮助', '及时', '善良'],
    connections: ['3', '8'],
    centrality: 0.68,
    density: 0.45,
  },
  {
    id: '7',
    text: '才高八斗',
    pinyin: 'cái gāo bā dǒu',
    meaning: '比喻人极有才华',
    sentiment: 'positive',
    sentimentScore: 0.89,
    dynasty: '南北朝',
    historicalFigure: '谢灵运',
    tags: ['才华', '赞美', '文学'],
    connections: ['5', '9'],
    centrality: 0.76,
    density: 0.52,
  },
  {
    id: '8',
    text: '患难与共',
    pinyin: 'huàn nàn yǔ gòng',
    meaning: '共同承担危险和困难，形容彼此之间关系密切，利害一致',
    sentiment: 'positive',
    sentimentScore: 0.91,
    dynasty: '汉代',
    tags: ['友情', '共患难', '忠诚'],
    connections: ['6', '10'],
    centrality: 0.64,
    density: 0.48,
  },
  {
    id: '9',
    text: '学富五车',
    pinyin: 'xué fù wǔ chē',
    meaning: '形容读书多，学识丰富',
    sentiment: 'positive',
    sentimentScore: 0.86,
    dynasty: '战国',
    historicalFigure: '庄子',
    tags: ['学识', '博学', '智慧'],
    connections: ['7', '11'],
    centrality: 0.7,
    density: 0.55,
  },
  {
    id: '10',
    text: '同舟共济',
    pinyin: 'tóng zhōu gòng jì',
    meaning: '坐一条船，共同渡河。比喻团结互助，同心协力，战胜困难',
    sentiment: 'positive',
    sentimentScore: 0.93,
    dynasty: '春秋',
    historicalFigure: '孙武',
    tags: ['团结', '合作', '克难'],
    connections: ['8', '12'],
    centrality: 0.82,
    density: 0.68,
  },
  {
    id: '11',
    text: '博古通今',
    pinyin: 'bó gǔ tōng jīn',
    meaning: '对古代的事知道得很多，并且通晓现代的事情',
    sentiment: 'positive',
    sentimentScore: 0.84,
    dynasty: '清代',
    tags: ['博学', '知识', '历史'],
    connections: ['9', '13'],
    centrality: 0.66,
    density: 0.42,
  },
  {
    id: '12',
    text: '众志成城',
    pinyin: 'zhòng zhì chéng chéng',
    meaning: '万众一心，像坚固的城墙一样不可摧毁',
    sentiment: 'positive',
    sentimentScore: 0.94,
    dynasty: '春秋',
    tags: ['团结', '力量', '坚固'],
    connections: ['10', '14'],
    centrality: 0.79,
    density: 0.62,
  },
  {
    id: '13',
    text: '纸上谈兵',
    pinyin: 'zhǐ shàng tán bīng',
    meaning: '在纸面上谈论打仗。比喻空谈理论，不能解决实际问题',
    sentiment: 'negative',
    sentimentScore: -0.72,
    dynasty: '战国',
    historicalFigure: '赵括',
    tags: ['空谈', '理论', '实践'],
    connections: ['11', '15'],
    centrality: 0.74,
    density: 0.56,
  },
  {
    id: '14',
    text: '同心协力',
    pinyin: 'tóng xīn xié lì',
    meaning: '心往一处想，劲往一处使',
    sentiment: 'positive',
    sentimentScore: 0.91,
    dynasty: '汉代',
    tags: ['团结', '合作', '齐心'],
    connections: ['12', '10'],
    centrality: 0.71,
    density: 0.54,
  },
  {
    id: '15',
    text: '坐井观天',
    pinyin: 'zuò jǐng guān tiān',
    meaning: '坐在井底看天。比喻眼界小，见识少',
    sentiment: 'negative',
    sentimentScore: -0.68,
    dynasty: '唐代',
    historicalFigure: '韩愈',
    tags: ['狭隘', '见识', '局限'],
    connections: ['13', '16'],
    centrality: 0.62,
    density: 0.38,
  },
  {
    id: '16',
    text: '井底之蛙',
    pinyin: 'jǐng dǐ zhī wā',
    meaning: '井底的蛙只能看到井口那么大的一块天。比喻见识狭窄的人',
    sentiment: 'negative',
    sentimentScore: -0.7,
    dynasty: '战国',
    historicalFigure: '庄子',
    tags: ['狭隘', '见识', '讽刺'],
    connections: ['15'],
    centrality: 0.58,
    density: 0.32,
  },
]

export const dynastyColors: Record<string, string> = {
  '春秋': '#3B82F6',
  '战国': '#8B5CF6',
  '汉代': '#EF4444',
  '南北朝': '#10B981',
  '唐代': '#F59E0B',
  '宋代': '#EC4899',
  '清代': '#06B6D4',
}

export const sentimentColors: Record<string, string> = {
  positive: '#10B981',
  '褒义': '#10B981',
  negative: '#EF4444',
  '贬义': '#EF4444',
  neutral: '#6B7280',
  '中性': '#6B7280',
}

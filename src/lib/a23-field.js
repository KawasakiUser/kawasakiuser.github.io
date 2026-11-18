// A23 four-language motion corpus copied unchanged from the canonical read-only source.
// Original prototype SHA256: eca1ca01566a6bb2ebf470f99d3271776da9590b5f7cb2148a57cf087cdfd575
// Changes below are strictly runtime lifecycle, sizing and accessibility adaptations.
const sets=[
 {lang:'en',font:'Times New Roman',words:[
 'Theory','Systems','Strategy','Projects','Creation','Archive','Research','Cosmology','Quantum Mechanics','General Relativity','Quantum Gravity','Mathematical Physics','Complex Systems','Intelligence','Robotics','Education','Writing','Books','Notes','Documentation','Planning','Direction','Execution','Structure','Method','Continuity','Discipline','Memory','Future','Field','Form','Motion','Light','Space','Time','Matter','Energy','Path','Trail','Summit','Horizon','Wilderness','Landscape','Journey','Camera','Image','Film','Craft','Making','Handwork','Wine','Table','Taste','Season','Weather','Courage','Endurance','Adventure','Presence','Attention','Balance','Precision','Patience','Work','Study','Build','Think','Record','Return','Begin','Become'
 ]},
 {lang:'zh',font:'Songti SC, SimSun',words:[
 '理论','系统','战略','项目','创造','归档','研究','宇宙学','量子力学','广义相对论','量子引力','数学物理','复杂系统','智能','机器人','教育','写作','书籍','笔记','文档','规划','方向','执行','结构','方法','延续','纪律','记忆','未来','场','形式','运动','光','空间','时间','物质','能量','道路','山径','山巅','地平线','荒野','山河','旅途','摄像','影像','电影','手作','制作','手艺','美酒','餐桌','味道','四季','天气','勇气','耐力','冒险','当下','专注','平衡','精确','耐心','工作','学习','构造','思考','记录','归来','开始','成为'
 ]},
 {lang:'jp',font:'Yu Mincho, Hiragino Mincho ProN, Noto Serif JP',words:[
 '理論','システム','戦略','プロジェクト','創作','記録','研究','宇宙論','量子力学','一般相対性理論','量子重力','数理物理','複雑系','知能','ロボット','教育','執筆','本','ノート','文書','計画','方向','実行','構造','方法','継続','規律','記憶','未来','場','形','運動','光','空間','時間','物質','エネルギー','道','山道','頂','地平線','荒野','風景','旅','撮影','映像','映画','ものづくり','手仕事','工芸','ワイン','食卓','味','季節','天気','勇気','持久力','冒険','今','集中','均衡','精密さ','忍耐','仕事','学び','構築','思考','記録する','帰る','始める','なる'
 ]},
 {lang:'ru',font:'Times New Roman, PT Serif',words:[
 'Теория','Системы','Стратегия','Проекты','Создание','Архив','Исследование','Космология','Квантовая механика','Общая теория относительности','Квантовая гравитация','Математическая физика','Сложные системы','Интеллект','Робототехника','Образование','Письмо','Книги','Заметки','Документы','Планирование','Направление','Исполнение','Структура','Метод','Продолжение','Дисциплина','Память','Будущее','Поле','Форма','Движение','Свет','Пространство','Время','Материя','Энергия','Путь','Тропа','Вершина','Горизонт','Дикая природа','Пейзаж','Путешествие','Камера','Образ','Кино','Ремесло','Созидание','Ручная работа','Вино','Стол','Вкус','Время года','Погода','Мужество','Выносливость','Приключение','Присутствие','Внимание','Равновесие','Точность','Терпение','Работа','Учёба','Строить','Думать','Записывать','Возвращаться','Начинать','Становиться'
 ]}
];
const extra=[
 ['en',['Vision','Reason','Knowledge','Practice','Principle','Action','Decision','Order','Change','Growth','Learning','Teaching','Culture','Aesthetics','Sound','Taste','Rest','Morning','Night','Water','Stone','Forest','Sky','Distance','Home','Belonging']],
 ['zh',['愿景','理性','知识','实践','原则','行动','决策','秩序','变化','成长','学习','教学','文化','审美','声音','味道','休息','清晨','夜晚','水','石','森林','天空','距离','家','归属']],
 ['jp',['構想','理性','知識','実践','原理','行動','決断','秩序','変化','成長','学び','教えること','文化','美意識','音','味','休息','朝','夜','水','石','森','空','距離','家','帰属']],
 ['ru',['Видение','Разум','Знание','Практика','Принцип','Действие','Решение','Порядок','Изменение','Рост','Учёба','Обучение','Культура','Эстетика','Звук','Вкус','Отдых','Утро','Ночь','Вода','Камень','Лес','Небо','Расстояние','Дом','Принадлежность']]
];
for(const [lang,words] of extra){const target=sets.find(x=>x.lang===lang);if(target)target.words.push(...words)}

const colors=['#111','#111','#243b53','#b18422','#111','#a32626'];
function mountA23(root) {
  const canvas=root.querySelector('[data-a23-field]');
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const ctx=canvas.getContext('2d');
  if (!ctx) return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const forced=window.matchMedia('(forced-colors: active)');
  let seed=37, streams=[], frame=0, running=false, inView=true, width=1, height=1;
  const rand=()=>{seed=(seed*9301+49297)%233280;return seed/233280};
  function setup() {
    const rect=root.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width)), h=Math.max(1,Math.round(rect.height));
    width=w; height=h; seed=37;
    const dpr=Math.min(window.devicePixelRatio||1,1.5);
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    canvas.style.width=w+'px'; canvas.style.height=h+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const mobile=w<800;
    const count=mobile?46:Math.min(150,Math.max(86,Math.floor(w/12)));
    streams=[];
    for(let i=0;i<count;i++){
      const set=sets[i%sets.length], vertical=i%3===0, words=[];
      const n=vertical?14+Math.floor(rand()*10):6+Math.floor(rand()*7);
      for(let j=0;j<n;j++)words.push(set.words[(j+i)%set.words.length]);
      streams.push({x:rand()*w,y:rand()*h,vertical,words,font:set.font,size:(mobile?10:8)+rand()*(mobile?16:44),speed:(.08+rand()*.22)*(i%3===0?1.8:1),dir:rand()>.5?1:-1,opacity:.12+rand()*.26,color:colors[Math.floor(rand()*colors.length)],gap:(mobile?22:34)+rand()*42});
    }
  }
  function draw(t) {
    frame=0;
    if (!running) return;
    ctx.clearRect(0,0,width,height);
    ctx.textBaseline='middle';
    for(const s of streams){
      ctx.save();ctx.globalAlpha=s.opacity;ctx.fillStyle=s.color;
      ctx.font=s.size+'px '+s.font;
      if(s.vertical){
        let yy=s.y;
        for(const word of s.words){
          for(const ch of Array.from(word)){ctx.fillText(ch,s.x,yy);yy+=s.size*1.12+s.gap*.08}
          yy+=s.gap*.38;
        }
      }else{
        let xx=s.x;
        for(const word of s.words){ctx.fillText(word,xx,s.y);xx+=ctx.measureText(word).width+s.gap}
      }
      ctx.restore();
      if(s.vertical)s.y+=s.speed*s.dir;
      else {s.x+=s.speed*s.dir;s.y+=Math.sin(t/2600+s.x)*0.05}
      if(s.y>height*1.35)s.y=-height*.35;
      if(s.y<-height*.35)s.y=height*1.35;
      if(s.x>width*1.35)s.x=-width*.35;
      if(s.x<-width*.35)s.x=width*1.35;
    }
    if(running)frame=window.requestAnimationFrame(draw);
  }
  function stop() {
    running=false;
    if(frame){window.cancelAnimationFrame(frame);frame=0}
    ctx.clearRect(0,0,width,height);
  }
  function sync() {
    if(document.hidden||reduced.matches||forced.matches||!inView||!root.isConnected){stop();return}
    if(running)return;
    setup();running=true;frame=window.requestAnimationFrame(draw);
  }
  function resize() {
    if(!running)return;
    const rect=root.getBoundingClientRect();
    if(Math.round(rect.width)!==width||Math.round(rect.height)!==height)setup();
  }
  const io=typeof IntersectionObserver!=='undefined'
    ? new IntersectionObserver(entries=>{inView=entries.some(e=>e.isIntersecting);sync()},{threshold:0}) : null;
  if(io){inView=false;io.observe(root)}
  const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
  if(ro)ro.observe(root);
  else window.addEventListener('resize',resize,{passive:true});
  reduced.addEventListener('change',sync);
  forced.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  const dispose=()=>{
    stop();io?.disconnect();ro?.disconnect();
    if(!ro)window.removeEventListener('resize',resize);
    reduced.removeEventListener('change',sync);
    forced.removeEventListener('change',sync);
    document.removeEventListener('visibilitychange',sync);
    document.removeEventListener('astro:before-swap',dispose);
  };
  document.addEventListener('astro:before-swap',dispose);
  sync();
}
document.querySelectorAll('[data-a23-cover]').forEach(mountA23);

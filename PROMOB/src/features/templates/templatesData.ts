import type { ProjectTemplate } from './templateTypes';

const wallBack=(depth:number,itemDepth:number)=>-depth/2+itemDepth/2+40;

export const PROJECT_TEMPLATES:ProjectTemplate[]=[
  {
    id:'closet-evidence-linear',
    name:'Closet Evidence linear',
    category:'closet',
    description:'Closet Evidence alto padrão com 4 módulos, fundo e portas de vidro, LED e lateral 9577.',
    tags:['closet','evidence','9577','vidro','led'],
    recommendedFor:['quarto','closet','alto padrão','arquiteto'],
    technicalNotes:['Base/topo com 9566 + 9567','Laterais com 9577 + 9573','Módulos centrais com 9572','Vidro 4mm com BA11','Conectores 95P, 115P e 120P'],
    objects:[{type:'closet',name:'Closet Evidence linear',x:0,y:0,z:wallBack(2800,520),rotation:0,visible:true,locked:false,data:{w:2600,d:520,h:2400,modules:4,shelves:3,sideType:'9577 externo',backGlass:true,doors:true,led:true}}]
  },
  {
    id:'closet-evidence-open',
    name:'Closet Evidence aberto',
    category:'closet',
    description:'Modelo aberto sem portas, com vidro embutido 9571, fundo em vidro e LED.',
    tags:['closet','evidence','9571','aberto','led'],
    recommendedFor:['quarto','closet aberto','orçamento rápido'],
    technicalNotes:['Laterais com 9571 + 9573','Sem portas de vidro','Fundo em vidro','Módulos centrais com 9572'],
    objects:[{type:'closet',name:'Closet Evidence aberto',x:0,y:0,z:wallBack(2800,520),rotation:0,visible:true,locked:false,data:{w:2400,d:520,h:2400,modules:4,shelves:4,sideType:'9571 embutido',backGlass:true,doors:false,led:true}}]
  },
  {
    id:'cristaleira-simples-1036',
    name:'Cristaleira simples 1036',
    category:'cristaleira',
    description:'Cristaleira padrão com 2 portas, MDF 18mm e vidro reflecta bronze.',
    tags:['cristaleira','1036','mdf','reflecta bronze'],
    recommendedFor:['cozinha','sala','móveis planejados'],
    technicalNotes:['Gera perfis 1036','Gera vidro e MDF','Gera BA02, cantoneiras e mão de obra','Gera plano de corte MDF'],
    objects:[{type:'cristaleira',name:'Cristaleira simples 1036',x:0,y:0,z:wallBack(2800,450),rotation:0,visible:true,locked:false,data:{h:2200,w:1000,d:450,mdf:18,shelves:4,doors:2,margin:45,profile:'',glass:'reflecta_bronze',hinge:'curva'}}]
  },
  {
    id:'cristaleira-premium-lateral-vidro',
    name:'Cristaleira premium vidro lateral',
    category:'cristaleira',
    description:'Cristaleira maior para venda premium; laterais de vidro ainda são nota técnica provisória.',
    tags:['cristaleira','premium','vidro lateral','reflecta bronze'],
    recommendedFor:['showroom','arquiteto','produto premium'],
    technicalNotes:['Template provisório: laterais visuais de vidro ainda não têm objeto próprio','Usa estrutura base de cristaleira','Gera plano de corte MDF'],
    objects:[{type:'cristaleira',name:'Cristaleira premium vidro lateral',x:0,y:0,z:wallBack(2800,450),rotation:0,visible:true,locked:false,data:{h:2300,w:1200,d:450,mdf:18,shelves:4,doors:2,margin:48,profile:'',glass:'reflecta_bronze',hinge:'curva'}}]
  },
  {
    id:'bancada-area-molhada',
    name:'Bancada com área molhada',
    category:'bancada',
    description:'Bancada com área seca, área molhada, cuba e torneira.',
    tags:['bancada','área molhada','cozinha'],
    recommendedFor:['cozinha','ambiente demonstração'],
    technicalNotes:['Mantém cálculo mesmo com custo da pedra pendente','Separa área seca e área molhada visualmente'],
    objects:[{type:'countertop',name:'Bancada com área molhada',x:0,y:0,z:wallBack(2800,600),rotation:0,visible:true,locked:false,data:{w:2400,d:600,thick:20,fromFloor:900,wetW:800,depthFromWall:40,sink:true,faucet:true}}]
  },
  {
    id:'ambiente-cozinha-padrao',
    name:'Ambiente cozinha padrão',
    category:'ambiente',
    description:'Cena pronta de cozinha com bancada, janela e cristaleira 1036.',
    tags:['ambiente','cozinha','demonstração'],
    defaultEnvironment:{w:3600,d:3000,h:2700,floor:'porcelanato claro',back:true,left:true,right:true},
    recommendedFor:['demonstração comercial','cozinha','primeiro contato'],
    technicalNotes:['Substitui ambiente se usuário escolher essa opção','Inclui objetos editáveis','Gera lista técnica e plano MDF'],
    objects:[
      {type:'countertop',name:'Bancada com área molhada',x:-350,y:0,z:wallBack(3000,600),rotation:0,visible:true,locked:false,data:{w:2400,d:600,thick:20,fromFloor:900,wetW:800,depthFromWall:40,sink:true,faucet:true}},
      {type:'window',name:'Janela cozinha',x:650,y:0,z:-1500+35,rotation:0,visible:true,locked:false,data:{w:1200,h:900,fromFloor:1100,glass:true,frame:true,opening:'correr'}},
      {type:'cristaleira',name:'Cristaleira simples 1036',x:1050,y:0,z:wallBack(3000,450),rotation:0,visible:true,locked:false,data:{h:2200,w:1000,d:450,mdf:18,shelves:4,doors:2,margin:45,profile:'',glass:'reflecta_bronze',hinge:'curva'}}
    ]
  },
  {
    id:'ambiente-quarto-com-closet',
    name:'Ambiente quarto com closet',
    category:'ambiente',
    description:'Cena pronta de quarto com closet Evidence linear e janela.',
    tags:['ambiente','quarto','closet'],
    defaultEnvironment:{w:3800,d:3200,h:2700,floor:'madeira clara',back:true,left:true,right:false},
    recommendedFor:['closet residencial','arquiteto','demonstração premium'],
    technicalNotes:['Closet encostado na parede de fundo','Janela na lateral visual','Gera lista técnica do closet'],
    objects:[
      {type:'closet',name:'Closet Evidence linear',x:0,y:0,z:wallBack(3200,520),rotation:0,visible:true,locked:false,data:{w:2600,d:520,h:2400,modules:4,shelves:3,sideType:'9577 externo',backGlass:true,doors:true,led:true}},
      {type:'window',name:'Janela quarto',x:-900,y:0,z:-1600+35,rotation:0,visible:true,locked:false,data:{w:1000,h:900,fromFloor:1000,glass:true,frame:true,opening:'fixa'}}
    ]
  },
  {
    id:'adega-iluminada',
    name:'Adega iluminada',
    category:'adega',
    description:'Template provisório de adega usando estrutura de cristaleira, vidro escuro e proposta de LED.',
    tags:['adega','led','vitrine','arquiteto'],
    recommendedFor:['vitrine','arquitetos','produto premium'],
    technicalNotes:['Template provisório usando estrutura de cristaleira','Objeto específico de adega pode ser criado depois','Usar vidro fumê/reflecta e alumínio preto na proposta'],
    objects:[{type:'cristaleira',name:'Adega iluminada',x:0,y:0,z:wallBack(2800,450),rotation:0,visible:true,locked:false,data:{h:2200,w:900,d:450,mdf:18,shelves:5,doors:2,margin:50,profile:'',glass:'fume',hinge:'curva'}}]
  }
];

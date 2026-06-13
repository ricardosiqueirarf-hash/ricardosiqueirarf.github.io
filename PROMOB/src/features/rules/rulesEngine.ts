export type RuleSeverity='info'|'warning'|'error';

export type RuleMessage={
  severity:RuleSeverity;
  code:string;
  title:string;
  message:string;
  target?:string;
};

export type CatalogItem={
  codigo:string;
  nome:string;
  categoria:string;
  unidade:string;
  custo_fallback?:number;
  produtos_compativeis?:string[];
};

export type ClosetEvidenceInput={
  type:'closet_evidence';
  width:number;
  depth:number;
  height:number;
  modules:number;
  shelves:number;
  sideType:'9577 externo'|'9571 embutido'|string;
  backGlass:boolean;
  doors:boolean;
  led:boolean;
  glassThickness?:4|6|number;
  catalog:CatalogItem[];
};

export type DoorInput={
  type:'porta_aluminio';
  height:number;
  width:number;
  doors:number;
  hinge:'curva'|'reta'|string;
  mdfThickness:number;
  discountMdf:boolean;
  discountHeight:number;
  discountWidth:number;
  gapPerDoor:number;
  profileCode:string;
  catalog:CatalogItem[];
};

export type RuleInput=ClosetEvidenceInput|DoorInput;

export type RuleOutput={
  valid:boolean;
  messages:RuleMessage[];
  requiredItems:string[];
  measurements:Record<string,number|string|boolean>;
};

function hasCatalog(catalog:CatalogItem[],code:string){return catalog.some(i=>i.codigo.toLowerCase()===code.toLowerCase())}
function msg(severity:RuleSeverity,code:string,title:string,message:string,target?:string):RuleMessage{return{severity,code,title,message,target}}

export function validateClosetEvidence(input:ClosetEvidenceInput):RuleOutput{
  const messages:RuleMessage[]=[];
  const modules=Math.max(1,input.modules||1);
  const moduleWidth=input.width/modules;
  const lateral=input.sideType.includes('9571')?'9571':'9577';
  const glassBaguette=(input.glassThickness||4)===4?'BA11':'BA17';
  const requiredItems=['9566','9567',lateral,'9572','9573',glassBaguette,'95P','115P','120P'];

  if(input.width<=0||input.depth<=0||input.height<=0){messages.push(msg('error','INVALID_MEASURE','Medidas inválidas','Largura, altura e profundidade precisam ser maiores que zero.','closet'))}
  if(moduleWidth>800){messages.push(msg('warning','MODULE_TOO_WIDE','Módulo largo demais',`O módulo ficou com ${moduleWidth.toFixed(0)} mm. Avalie dividir em mais módulos para segurança e estabilidade.`,'modules'))}
  if(input.height>2800){messages.push(msg('warning','HEIGHT_HIGH','Altura alta','Altura acima de 2800 mm pode exigir validação técnica e reforço.','height'))}
  if(input.sideType.includes('9571')&&input.sideType.includes('9577')){messages.push(msg('error','SIDE_TYPE_CONFLICT','Tipo lateral conflitante','Escolha vidro embutido 9571 ou vidro externo 9577, não ambos.','sideType'))}
  if(input.glassThickness&&input.glassThickness!==4&&input.glassThickness!==6){messages.push(msg('warning','GLASS_THICKNESS_UNMAPPED','Espessura sem regra completa','A regra automática cobre vidro 4 mm com BA11 e 6 mm com BA17.','glassThickness'))}
  requiredItems.forEach(code=>{if(!hasCatalog(input.catalog,code)){messages.push(msg('warning','CATALOG_ITEM_MISSING','Item fora do catálogo',`O item ${code} é obrigatório para esta composição, mas não foi encontrado no catálogo MOBIL.`,code))}});
  if(input.led&&!hasCatalog(input.catalog,'DIFUSOR_02R')&&!hasCatalog(input.catalog,'DIFUSOR_02F')){messages.push(msg('warning','LED_DIFFUSER_MISSING','Difusor LED ausente','LED ligado, mas nenhum difusor 02R/02F foi encontrado no catálogo.','led'))}

  return{
    valid:!messages.some(m=>m.severity==='error'),
    messages,
    requiredItems,
    measurements:{
      moduleWidth,
      lateralProfile:lateral,
      glassBaguette,
      baseTopProfiles:'9566 + 9567',
      centralModuleProfile:'9572',
      crossProfile:'9573',
      assemblySequence:'módulo lateral > travessas/fundo > módulo central > lateral > topo > base > portas'
    }
  };
}

export function validateDoor(input:DoorInput):RuleOutput{
  const messages:RuleMessage[]=[];
  const baseWidth=input.width-(input.discountMdf?input.mdfThickness*2:0);
  const baseHeight=input.height-(input.discountMdf?input.mdfThickness*2:0);
  const finalWidth=((baseWidth-input.discountWidth)/Math.max(1,input.doors))-(input.doors>1?input.gapPerDoor:0);
  const finalHeight=baseHeight-input.discountHeight;
  const requiredItems=[input.profileCode,'BA02'];

  if(finalWidth<=0||finalHeight<=0){messages.push(msg('error','INVALID_DOOR_SIZE','Porta inválida','Os descontos geraram largura ou altura final menor ou igual a zero.','door'))}
  if(input.hinge==='reta'&&!input.discountMdf){messages.push(msg('warning','STRAIGHT_HINGE_WITHOUT_MDF_DISCOUNT','Dobradiça reta sem desconto de MDF','Para porta por dentro do vão, normalmente o MDF deve ser descontado.','hinge'))}
  if(finalWidth>700){messages.push(msg('warning','DOOR_TOO_WIDE','Porta muito larga',`Cada porta ficou com ${finalWidth.toFixed(0)} mm. Avalie dividir em mais portas.`, 'doors'))}
  requiredItems.forEach(code=>{if(!hasCatalog(input.catalog,code)){messages.push(msg('warning','CATALOG_ITEM_MISSING','Item fora do catálogo',`O item ${code} é obrigatório para esta porta, mas não foi encontrado no catálogo MOBIL.`,code))}});

  return{
    valid:!messages.some(m=>m.severity==='error'),
    messages,
    requiredItems,
    measurements:{baseWidth,baseHeight,finalWidth,finalHeight,discountMdf:input.discountMdf,hinge:input.hinge}
  };
}

export function validateProjectObject(input:RuleInput):RuleOutput{
  if(input.type==='closet_evidence')return validateClosetEvidence(input);
  return validateDoor(input);
}

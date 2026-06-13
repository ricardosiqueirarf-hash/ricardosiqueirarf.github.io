import type { ApplyTemplateOptions, ApplyTemplateResult, ProjectTemplate, TemplateEnvironment } from './templateTypes';

function idFor(type:string){return `${type}-${Date.now()}-${Math.round(Math.random()*999999)}`}
function cloneObject(obj:any,idx:number,center:boolean){return{...obj,id:idFor(obj.type),x:center?0:(obj.x||0),y:obj.y||0,z:obj.z||0,rotation:obj.rotation||0,visible:obj.visible!==false,locked:Boolean(obj.locked),data:{...(obj.data||{})},name:obj.name||`Objeto ${idx+1}`}}

export function applyTemplate(template:ProjectTemplate,current:{environment:TemplateEnvironment;objects:any[]},options:ApplyTemplateOptions):ApplyTemplateResult{
  const created=template.objects.map((obj,idx)=>cloneObject(obj,idx,options.centerObjects));
  const objects=options.clearObjects?created:[...(current.objects||[]),...created];
  const environment=options.replaceEnvironment&&template.defaultEnvironment?{...template.defaultEnvironment}:current.environment;
  return{environment,objects,selectedObjectId:created[0]?.id||null};
}

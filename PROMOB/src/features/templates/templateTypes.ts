export type TemplateCategory='ambiente'|'closet'|'cristaleira'|'porta'|'adega'|'bancada'|'divisoria';

export type TemplateEnvironment={
  w:number;
  d:number;
  h:number;
  floor:string;
  back:boolean;
  left:boolean;
  right:boolean;
};

export type TemplateObject={
  type:'window'|'countertop'|'closet'|'cristaleira'|'porta'|'divisoria';
  name:string;
  x:number;
  y:number;
  z:number;
  rotation:number;
  visible:boolean;
  locked:boolean;
  data:any;
};

export type ProjectTemplate={
  id:string;
  name:string;
  category:TemplateCategory;
  description:string;
  tags:string[];
  preview?:string;
  defaultEnvironment?:TemplateEnvironment;
  objects:TemplateObject[];
  recommendedFor:string[];
  technicalNotes:string[];
};

export type ApplyTemplateOptions={
  replaceEnvironment:boolean;
  clearObjects:boolean;
  centerObjects:boolean;
};

export type ApplyTemplateResult={
  environment?:TemplateEnvironment;
  objects:any[];
  selectedObjectId:string|null;
};

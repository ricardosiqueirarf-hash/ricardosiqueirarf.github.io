export const plataformaMobil = true;

export type PapelMobil = 'loja' | 'fabrica';

export type EntidadeMobil = {
  id: string;
  nome: string;
  status: string;
};

export type ProdutoMobil = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  unidade: string;
  custo: number;
  precoBase: number | null;
  ativo: boolean;
};

export type ModeloMobil = {
  id: string;
  nome: string;
  categoria: string;
  objetos: unknown[];
  parametrosPadrao: Record<string, unknown>;
  ativo: boolean;
};

export type BibliotecaFabricaMobil = {
  fabrica: EntidadeMobil | null;
  produtos: ProdutoMobil[];
  modelos: ModeloMobil[];
};

export type BibliotecaLojaMobil = {
  loja: EntidadeMobil | null;
  fabricaEscolhida: EntidadeMobil | null;
  produtosImportados: ProdutoMobil[];
  modelosImportados: ModeloMobil[];
};

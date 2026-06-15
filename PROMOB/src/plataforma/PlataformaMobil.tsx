import type { BibliotecaFabricaMobil, BibliotecaLojaMobil, PapelMobil } from './tipos';

type Props = {
  papel: PapelMobil;
  bibliotecaFabrica: BibliotecaFabricaMobil;
  bibliotecaLoja: BibliotecaLojaMobil;
};

export function PlataformaMobil({ papel, bibliotecaFabrica, bibliotecaLoja }: Props) {
  if (papel === 'fabrica') {
    return (
      <div className="platformPanel">
        <div className="platformHero">
          <span>MOBIL Fábrica</span>
          <h2>Biblioteca técnica e comercial</h2>
          <p>A fábrica cria produtos, modelos, custos, parâmetros e regras que depois serão usados pelas lojas.</p>
        </div>

        <div className="platformGrid">
          <PlatformMetric label="Produtos" value={bibliotecaFabrica.produtos.length} />
          <PlatformMetric label="Modelos" value={bibliotecaFabrica.modelos.length} />
          <PlatformMetric label="Fábrica" value={bibliotecaFabrica.fabrica?.nome || 'Não definida'} />
        </div>
      </div>
    );
  }

  return (
    <div className="platformPanel">
      <div className="platformHero">
        <span>MOBIL Loja</span>
        <h2>Biblioteca importada da fábrica</h2>
        <p>A loja escolhe uma fábrica, importa os modelos publicados e adapta o projeto para o cliente final.</p>
      </div>

      <div className="platformGrid">
        <PlatformMetric label="Fábrica escolhida" value={bibliotecaLoja.fabricaEscolhida?.nome || 'Nenhuma'} />
        <PlatformMetric label="Produtos importados" value={bibliotecaLoja.produtosImportados.length} />
        <PlatformMetric label="Modelos importados" value={bibliotecaLoja.modelosImportados.length} />
      </div>
    </div>
  );
}

function PlatformMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="platformMetric">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

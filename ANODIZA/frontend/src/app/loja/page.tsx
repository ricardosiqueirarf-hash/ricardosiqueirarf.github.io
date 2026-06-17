import { apiGet } from "@/lib/api";

type LojaIndex = { titulo: string; cards: { label: string; valor: number }[] };

async function getLojaIndex(): Promise<LojaIndex> {
  try {
    return await apiGet<LojaIndex>("/api/loja/index");
  } catch {
    return {
      titulo: "Painel da Loja",
      cards: [
        { label: "Orcamentos", valor: 0 },
        { label: "Aprovados", valor: 0 },
        { label: "Em producao", valor: 0 },
      ],
    };
  }
}

export default async function LojaPage() {
  const data = await getLojaIndex();

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">A</div><div><strong>ANODIZA</strong><p>Loja</p></div></div>
        <p>Rotas iniciais: login, cadastro e loja.</p>
      </aside>
      <section className="main">
        <h1>{data.titulo}</h1>
        <p>Inicio do index_loja em estrutura nova.</p>
        <div className="grid">
          {data.cards.map((card) => (
            <div className="metric" key={card.label}>
              <p>{card.label}</p>
              <strong>{card.valor}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="card">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <strong>ANODIZA</strong>
            <p>Sistema para lojas</p>
          </div>
        </div>
        <h1>Bem-vindo</h1>
        <p>Escolha uma rota inicial do MVP.</p>
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          <Link href="/login"><button>Entrar</button></Link>
          <Link href="/cadastro"><button>Criar cadastro</button></Link>
          <Link href="/loja"><button>Abrir loja</button></Link>
        </div>
      </section>
    </main>
  );
}

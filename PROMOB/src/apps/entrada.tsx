import React from 'react';
import { createRoot } from 'react-dom/client';
import './split.css';

function EntradaMobil() {
  return (
    <main className="entryShell">
      <section className="entryHero">
        <span>MOBIL</span>
        <h1>Escolha qual sistema você quer abrir</h1>
        <p>
          A fábrica cria a biblioteca técnica. A loja importa essa biblioteca e usa os modelos para projetar e vender.
        </p>
      </section>

      <section className="entryGrid">
        <a className="entryCard factory" href="fabrica.html">
          <span>MOBIL Fábrica</span>
          <h2>Configurar produtos, módulos e templates</h2>
          <p>
            Cadastre modelos 3D, custos, margem mínima, parâmetros técnicos e regras que as lojas vão usar.
          </p>
          <b>Abrir configurador da fábrica →</b>
        </a>

        <a className="entryCard store" href="loja.html">
          <span>MOBIL Loja</span>
          <h2>Importar fábrica e projetar para o cliente</h2>
          <p>
            Escolha uma fábrica, importe os modelos publicados e adapte medidas, acabamentos e preço comercial.
          </p>
          <b>Abrir configurador da loja →</b>
        </a>
      </section>

      <section className="entryFlow">
        <div><b>01</b><span>Fábrica cria biblioteca</span></div>
        <div><b>02</b><span>Loja importa fábrica</span></div>
        <div><b>03</b><span>Loja projeta em 3D</span></div>
        <div><b>04</b><span>Pedido volta para produção</span></div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<EntradaMobil />);

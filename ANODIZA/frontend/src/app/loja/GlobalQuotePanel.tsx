"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { apiGet, apiPost } from "@/lib/api";

type OrcamentoResumo = { id: string; nome_orcamento: string; cliente_nome: string; numero_pedido: string };
type ProdutoGlobal = { produto_chave: string; nome: string; classe: string; descricao: string; ativo: boolean };
type Material = {
  id: string;
  categoria: "perfil" | "vidro" | "puxador" | "insumo" | "trilho" | "componente" | "sistema" | "outro";
  nome: string;
  unidade: string;
  preco_unitario: number;
  custo_unitario?: number;
  ativo: boolean;
  configuracao?: { tipologias?: string[]; agregados?: Record<string, string[]>; puxadores_ids?: string[]; [key: string]: unknown };
};
type PortaGiroForm = {
  quantidade: string;
  largura: string;
  altura: string;
  perfil_id: string;
  vidro_id: string;
  puxador_id: string;
  medida_puxador: string;
  lado_puxador: "direito" | "esquerdo";
  altura_puxador: string;
  dobradicas: string;
  valor_adicional: string;
  observacao_venda: string;
  observacao_producao: string;
  acessorio: string;
};
type Calculo = {
  valor_unitario: number;
  valor_total: number;
  custo_total: number;
  margem: number;
  margem_percentual: number;
  dobradicas_alturas: number[];
  linhas: Array<{ nome: string; material: string; quantidade: number; unidade: string; valor_unitario: number; total: number }>;
};

const formInicial: PortaGiroForm = {
  quantidade: "1",
  largura: "800",
  altura: "2000",
  perfil_id: "",
  vidro_id: "",
  puxador_id: "sem_puxador",
  medida_puxador: "0",
  lado_puxador: "direito",
  altura_puxador: "1000",
  dobradicas: "2",
  valor_adicional: "0",
  observacao_venda: "",
  observacao_producao: "",
  acessorio: "",
};

function dinheiro(valor: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(valor || 0));
}

function numero(valor: string) {
  const n = Number(String(valor || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function inteiro(valor: string, fallback = 0) {
  const n = parseInt(String(valor || ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function alturasDobradicas(alturaMm: number, quantidade: number) {
  if (!alturaMm || quantidade <= 0) return [];
  const primeira = 100;
  const ultima = Math.max(100, alturaMm - 100);
  if (quantidade === 1) return [primeira];
  const passo = (ultima - primeira) / (quantidade - 1);
  return Array.from({ length: quantidade }, (_, i) => Math.round((primeira + passo * i) * 100) / 100);
}

function idsAgregados(material: Material | undefined, categoria: string) {
  if (!material) return [];
  const config = material.configuracao || {};
  const agregados = config.agregados || {};
  return ((agregados[categoria] || (categoria === "puxador" ? config.puxadores_ids : []) || []) as string[]).map(String);
}

function Door3D({ form, puxador, compact = false }: { form: PortaGiroForm; puxador?: Material; compact?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const largura = numero(form.largura);
  const altura = numero(form.altura);
  const dobradicas = useMemo(() => alturasDobradicas(altura, inteiro(form.dobradicas, 0)), [altura, form.dobradicas]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || largura <= 0 || altura <= 0) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf6f8fb);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);

    const ratio = largura / altura;
    const doorHeight = compact ? 3.35 : 4.4;
    const doorWidth = Math.max(1.15, Math.min(2.65, doorHeight * ratio));
    const doorDepth = 0.07;
    const hingeSide: "esquerdo" | "direito" = form.lado_puxador === "direito" ? "esquerdo" : "direito";
    const hingeSign = hingeSide === "esquerdo" ? 1 : -1;

    const world = new THREE.Group();
    scene.add(world);

    const pivot = new THREE.Group();
    world.add(pivot);

    const door = new THREE.Group();
    door.position.x = hingeSide === "esquerdo" ? doorWidth / 2 : -doorWidth / 2;
    pivot.add(door);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1079ba, metalness: 0.62, roughness: 0.28 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, transmission: 0.22, transparent: true, opacity: 0.58, roughness: 0.05, metalness: 0.02 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0x083a5c, metalness: 0.72, roughness: 0.2 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.9, roughness: 0.18 });
    const hingeMat = new THREE.MeshStandardMaterial({ color: 0x0d5d8c, metalness: 0.78, roughness: 0.2 });

    const addBox = (name: string, size: [number, number, number], pos: [number, number, number], mat: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
      mesh.name = name;
      mesh.position.set(...pos);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      door.add(mesh);
      return mesh;
    };

    addBox("vidro", [doorWidth - 0.26, doorHeight - 0.26, doorDepth * 0.72], [0, 0, 0], glassMat);
    addBox("perfil-esquerdo", [0.12, doorHeight, 0.11], [-doorWidth / 2 + 0.06, 0, 0.02], frameMat);
    addBox("perfil-direito", [0.12, doorHeight, 0.11], [doorWidth / 2 - 0.06, 0, 0.02], frameMat);
    addBox("perfil-superior", [doorWidth, 0.12, 0.11], [0, doorHeight / 2 - 0.06, 0.02], frameMat);
    addBox("perfil-inferior", [doorWidth, 0.12, 0.11], [0, -doorHeight / 2 + 0.06, 0.02], frameMat);
    addBox("friso-interno", [doorWidth - 0.42, 0.035, 0.085], [0, doorHeight * 0.28, 0.05], edgeMat);

    if (puxador) {
      const handleMm = numero(form.medida_puxador);
      const handleLength = puxador.unidade === "metro_linear" && handleMm > 0 ? Math.max(0.28, Math.min(doorHeight * 0.9, (handleMm / altura) * doorHeight)) : doorHeight * 0.42;
      const handleHeightMm = numero(form.altura_puxador) || altura / 2;
      const handleCenterY = Math.max(-doorHeight / 2 + handleLength / 2 + 0.1, Math.min(doorHeight / 2 - handleLength / 2 - 0.1, -doorHeight / 2 + (handleHeightMm / altura) * doorHeight));
      const handleX = form.lado_puxador === "esquerdo" ? -doorWidth / 2 + 0.2 : doorWidth / 2 - 0.2;
      addBox("puxador", [0.065, handleLength, 0.08], [handleX, handleCenterY, 0.16], handleMat);
    }

    dobradicas.forEach((alturaDobradica, index) => {
      const y = -doorHeight / 2 + (alturaDobradica / altura) * doorHeight;
      const x = hingeSide === "esquerdo" ? -doorWidth / 2 + 0.035 : doorWidth / 2 - 0.035;
      const hinge = addBox(`dobradica-${index + 1}`, [0.12, 0.18, 0.13], [x, y, 0.17], hingeMat);
      hinge.rotation.y = hingeSide === "esquerdo" ? -0.08 : 0.08;
    });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 8), new THREE.ShadowMaterial({ opacity: 0.14 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -doorHeight / 2 - 0.05;
    floor.position.z = 0.35;
    floor.receiveShadow = true;
    scene.add(floor);

    const ambient = new THREE.AmbientLight(0xffffff, 1.45);
    scene.add(ambient);
    const mainLight = new THREE.DirectionalLight(0xffffff, 2.4);
    mainLight.position.set(2.5, 4.5, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);
    const goldLight = new THREE.PointLight(0xd4af37, 1.2, 7);
    goldLight.position.set(-2.5, 1.5, 3.2);
    scene.add(goldLight);

    const centerX = hingeSide === "esquerdo" ? doorWidth / 2 : -doorWidth / 2;
    camera.position.set(centerX, 0.1, compact ? 6.2 : 6.8);
    camera.lookAt(centerX, 0, 0);

    const resize = () => {
      const width = mount.clientWidth || 320;
      const height = compact ? 280 : Math.min(560, Math.max(360, Math.round(width * 0.82)));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    let frame = 0;
    const startedAt = performance.now();
    const animate = () => {
      const t = (performance.now() - startedAt) / 1000;
      const baseOpen = compact ? 0.34 : 0.46;
      pivot.rotation.y = hingeSign * (baseOpen + Math.sin(t * 0.85) * 0.08);
      world.rotation.x = -0.06;
      world.rotation.y += 0.0009;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) material.forEach((mat) => mat.dispose());
          else material.dispose();
        }
      });
      mount.innerHTML = "";
    };
  }, [largura, altura, form.dobradicas, form.lado_puxador, form.altura_puxador, form.medida_puxador, puxador?.id, puxador?.unidade, compact, dobradicas]);

  if (largura <= 0 || altura <= 0) {
    return <div className="global-door-3d"><div className="global-door-3d-empty">Informe largura e altura</div></div>;
  }

  return (
    <div className={compact ? "global-door-3d global-door-3d-compact" : "global-door-3d"}>
      <div ref={mountRef} className="global-door-3d-canvas" />
      <div className="global-door-3d-caption">
        <span>{largura} × {altura} mm</span>
        <span>{dobradicas.length ? `Dobradiças: ${dobradicas.join(", ")} mm` : "Dobradiças: -"}</span>
      </div>
    </div>
  );
}

export default function GlobalQuotePanel({ empresaSlug, orcamento, onClose, onSaved }: { empresaSlug: string; orcamento: OrcamentoResumo; onClose: () => void; onSaved: () => void }) {
  const [etapa, setEtapa] = useState<"classes" | "porta_giro">("classes");
  const [produtos, setProdutos] = useState<ProdutoGlobal[]>([]);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [form, setForm] = useState<PortaGiroForm>(formInicial);
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [mensagem, setMensagem] = useState("");

  const produtoPortaGiro = produtos.find((produto) => produto.produto_chave === "porta_giro");
  const perfis = materiais.filter((m) => m.categoria === "perfil" && m.ativo && ((m.configuracao?.tipologias || []).length === 0 || (m.configuracao?.tipologias || []).includes("giro")));
  const vidros = materiais.filter((m) => m.categoria === "vidro" && m.ativo);
  const perfilSelecionado = materiais.find((m) => m.id === form.perfil_id);
  const puxadoresPermitidosIds = idsAgregados(perfilSelecionado, "puxador");
  const puxadores = materiais.filter((m) => m.categoria === "puxador" && m.ativo && (!puxadoresPermitidosIds.length || puxadoresPermitidosIds.includes(String(m.id))));
  const puxadorSelecionado = materiais.find((m) => m.id === form.puxador_id);
  const puxadorPrecisaMedida = Boolean(puxadorSelecionado && puxadorSelecionado.unidade !== "unidade");
  const alturasPreview = useMemo(() => alturasDobradicas(numero(form.altura), inteiro(form.dobradicas, 0)), [form.altura, form.dobradicas]);

  async function carregar() {
    const [globais, mats] = await Promise.all([
      apiGet<ProdutoGlobal[]>(`/api/loja/produtos-globais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
      apiGet<Material[]>(`/api/loja/materiais?empresa_slug=${encodeURIComponent(empresaSlug)}`),
    ]);
    setProdutos(globais || []);
    setMateriais(mats || []);
  }

  useEffect(() => { carregar().catch((error) => setMensagem(error instanceof Error ? error.message : "Erro ao carregar produtos globais")); }, [empresaSlug]);

  function atualizar(campo: keyof PortaGiroForm, valor: string) {
    const proximo = { ...form, [campo]: valor } as PortaGiroForm;
    if (campo === "perfil_id") proximo.puxador_id = "sem_puxador";
    if (campo === "puxador_id") {
      const proxPuxador = materiais.find((m) => m.id === valor);
      if (!proxPuxador || proxPuxador.unidade === "unidade") proximo.medida_puxador = "0";
    }
    setForm(proximo);
    setCalculo(null);
  }

  function payload() {
    return {
      empresa_slug: empresaSlug,
      orcamento_id: orcamento.id,
      quantidade: inteiro(form.quantidade, 1),
      largura: numero(form.largura),
      altura: numero(form.altura),
      perfil_id: form.perfil_id,
      vidro_id: form.vidro_id,
      puxador_id: form.puxador_id || "sem_puxador",
      medida_puxador: numero(form.medida_puxador),
      lado_puxador: form.lado_puxador,
      altura_puxador: numero(form.altura_puxador),
      dobradicas: inteiro(form.dobradicas, 2),
      valor_adicional: numero(form.valor_adicional),
      observacao_venda: form.observacao_venda,
      observacao_producao: form.observacao_producao,
      acessorio: form.acessorio,
    };
  }

  async function alternarAtivo(ativo: boolean) {
    await apiPost("/api/loja/produtos-globais/alternar", { empresa_slug: empresaSlug, produto_chave: "porta_giro", ativo });
    await carregar();
  }

  async function calcular() {
    setMensagem("");
    try {
      const resultado = await apiPost<Calculo>("/api/loja/produtos-globais/porta-giro/calcular", payload());
      setCalculo(resultado);
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao calcular porta");
    }
  }

  async function adicionar() {
    setMensagem("");
    try {
      await apiPost("/api/loja/produtos-globais/porta-giro/adicionar-orcamento", payload());
      await onSaved();
      onClose();
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : "Erro ao adicionar porta ao orçamento");
    }
  }

  return (
    <section className="card" style={{ maxWidth: "none", marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><h1>Orçamento</h1><p>{orcamento.cliente_nome} • #{orcamento.numero_pedido} • {orcamento.nome_orcamento}</p></div>
        <button type="button" onClick={onClose}>Fechar</button>
      </div>
      {mensagem && <p>{mensagem}</p>}

      {etapa === "classes" && (
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <div><h2>Escolha a classe do orçamento</h2><p>Produtos globais padrão do ANODIZA. A empresa pode ativar ou desativar cada produto.</p></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <article className="metric" style={{ minHeight: 260 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><strong>Porta de Giro</strong><span>{produtoPortaGiro?.ativo === false ? "Desativado" : "Ativo"}</span></div>
              <p>Altura, largura, perfil, vidro, puxador, lado do puxador e dobradiças automáticas.</p>
              <div style={{ margin: "16px auto", maxWidth: 260 }}><Door3D form={formInicial} compact /></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" disabled={produtoPortaGiro?.ativo === false} onClick={() => setEtapa("porta_giro")}>Abrir orçamento</button>
                <button type="button" onClick={() => alternarAtivo(!(produtoPortaGiro?.ativo === false))}>{produtoPortaGiro?.ativo === false ? "Ativar" : "Desativar"}</button>
              </div>
            </article>
            <article className="metric" style={{ opacity: .6 }}><strong>Portas deslizantes</strong><p>Disponível em breve.</p></article>
            <article className="metric" style={{ opacity: .6 }}><strong>Estruturas 3D</strong><p>Disponível em breve.</p></article>
          </div>
        </div>
      )}

      {etapa === "porta_giro" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 480px) 1fr", gap: 18, alignItems: "start", marginTop: 18 }}>
          <form onSubmit={(e) => { e.preventDefault(); calcular(); }}>
            <h2>Porta de Giro</h2>
            <label>Quantidade<input type="number" min="1" value={form.quantidade} onChange={(e) => atualizar("quantidade", e.target.value)} /></label>
            <label>Largura (mm)<input type="number" min="1" value={form.largura} onChange={(e) => atualizar("largura", e.target.value)} /></label>
            <label>Altura (mm)<input type="number" min="201" value={form.altura} onChange={(e) => atualizar("altura", e.target.value)} /></label>
            <label>Perfil<select value={form.perfil_id} onChange={(e) => atualizar("perfil_id", e.target.value)}><option value="">Selecione</option>{perfis.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/m</option>)}</select></label>
            <label>Vidro<select value={form.vidro_id} onChange={(e) => atualizar("vidro_id", e.target.value)}><option value="">Selecione</option>{vidros.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/m²</option>)}</select></label>
            <label>Puxador<select value={form.puxador_id} onChange={(e) => atualizar("puxador_id", e.target.value)}><option value="sem_puxador">Sem puxador</option>{puxadores.map((m) => <option key={m.id} value={m.id}>{m.nome} • {dinheiro(m.preco_unitario)}/{m.unidade === "metro_linear" ? "m" : "un"}</option>)}</select></label>
            {puxadorPrecisaMedida && <label>Tamanho do puxador (mm)<input type="number" min="1" value={form.medida_puxador} onChange={(e) => atualizar("medida_puxador", e.target.value)} /></label>}
            <label>Lado do puxador<select value={form.lado_puxador} onChange={(e) => atualizar("lado_puxador", e.target.value as "direito" | "esquerdo")}><option value="direito">Direito</option><option value="esquerdo">Esquerdo</option></select></label>
            <label>Altura do puxador (mm)<input type="number" min="0" value={form.altura_puxador} onChange={(e) => atualizar("altura_puxador", e.target.value)} /></label>
            <label>Quantidade de dobradiças<input type="number" min="2" max="12" value={form.dobradicas} onChange={(e) => atualizar("dobradicas", e.target.value)} /></label>
            <p>Alturas: {alturasPreview.length ? alturasPreview.join(", ") : "-"} mm</p>
            <label>Valor adicional (R$)<input type="number" min="0" step="0.01" value={form.valor_adicional} onChange={(e) => atualizar("valor_adicional", e.target.value)} /></label>
            <label>Acessório<textarea rows={2} value={form.acessorio} onChange={(e) => atualizar("acessorio", e.target.value)} /></label>
            <label>Observação de venda<textarea rows={2} value={form.observacao_venda} onChange={(e) => atualizar("observacao_venda", e.target.value)} /></label>
            <label>Observação de produção<textarea rows={2} value={form.observacao_producao} onChange={(e) => atualizar("observacao_producao", e.target.value)} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="submit">Calcular</button><button type="button" onClick={adicionar}>Adicionar ao orçamento</button><button type="button" onClick={() => setEtapa("classes")}>Voltar</button></div>
          </form>
          <div className="metric">
            <Door3D form={form} puxador={puxadorSelecionado} />
            {calculo && <div style={{ display: "grid", gap: 8, marginTop: 14 }}><strong>Total: {dinheiro(calculo.valor_total)}</strong><p>Unitário: {dinheiro(calculo.valor_unitario)} • Custo: {dinheiro(calculo.custo_total)} • Margem: {dinheiro(calculo.margem)} ({calculo.margem_percentual.toFixed(1).replace(".", ",")}%)</p>{calculo.linhas.map((linha, i) => <p key={i}>{linha.nome} — {linha.material}: {linha.quantidade} {linha.unidade} × {dinheiro(linha.valor_unitario)} = {dinheiro(linha.total)}</p>)}</div>}
          </div>
        </div>
      )}
    </section>
  );
}

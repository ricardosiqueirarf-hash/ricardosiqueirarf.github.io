function calcularPrecoPortaCorrer() {
    const quantidadePortas = +document.getElementById("quantidade")?.value || 1;
    const valorAdicional = +document.getElementById("valor_adicional")?.value || 0;
    const total = calcularPrecoBasePorta() + calcularValorSistemaETrilhos() + valorAdicional;
    return total * quantidadePortas;
}

window.calcularPrecoPortaCorrer = calcularPrecoPortaCorrer;

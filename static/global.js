const pages = [
  "login.html",
  "painel.html",
  "buscar.html",
  "financeiro.html"
];

pages.forEach(p => {
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.href = p;
  document.head.appendChild(link);
});

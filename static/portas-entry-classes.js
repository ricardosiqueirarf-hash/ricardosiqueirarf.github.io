// Se portas.html abrir sem tipologia, envia para a tela de classes.
(function () {
  const params = new URLSearchParams(window.location.search);
  const uuid = params.get('orcamento_uuid');
  const tipo = params.get('tipologia');
  if (!uuid || tipo) return;
  const token = params.get('token');
  let url = 'classes.html?orcamento_uuid=' + encodeURIComponent(uuid);
  if (token) url += '&token=' + encodeURIComponent(token);
  window.location.href = url;
})();

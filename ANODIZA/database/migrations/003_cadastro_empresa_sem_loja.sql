-- Cadastro do Anodiza deve criar apenas empresa e usuario owner.
-- O conceito de loja nao participa do cadastro; clientes serao cadastrados em fluxo proprio.

create or replace function public.cadastro_empresa(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_empresa_nome text := trim(payload->>'empresa_nome');
  v_nome text := trim(payload->>'nome');
  v_email text := lower(trim(payload->>'email'));
  v_senha text := payload->>'senha';
  v_base_slug text;
  v_empresa_slug text;
  v_counter int := 1;
  v_empresa public.empresas%rowtype;
  v_usuario public.usuarios%rowtype;
  v_permissoes jsonb := '{"painel":true,"orcamentos":true,"clientes":true,"usuarios":true,"ajustes":true,"produtos":true,"materiais":true}'::jsonb;
begin
  if coalesce(v_empresa_nome, '') = ''
     or coalesce(v_nome, '') = ''
     or coalesce(v_email, '') = ''
     or coalesce(v_senha, '') = '' then
    raise exception 'Preencha todos os campos';
  end if;

  if length(v_senha) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres';
  end if;

  v_base_slug := public.slugify_text(v_empresa_nome);

  if coalesce(v_base_slug, '') = '' then
    v_base_slug := 'empresa';
  end if;

  v_empresa_slug := v_base_slug;

  while exists (
    select 1
    from public.empresas
    where slug = v_empresa_slug
  ) loop
    v_counter := v_counter + 1;
    v_empresa_slug := v_base_slug || '-' || v_counter::text;
  end loop;

  insert into public.empresas (nome, slug)
  values (v_empresa_nome, v_empresa_slug)
  returning * into v_empresa;

  insert into public.usuarios (
    empresa_id,
    loja_id,
    nome,
    email,
    senha_hash,
    perfil,
    permissoes
  )
  values (
    v_empresa.id,
    null,
    v_nome,
    v_email,
    crypt(v_senha, gen_salt('bf')),
    'owner',
    v_permissoes
  )
  returning * into v_usuario;

  return jsonb_build_object(
    'empresa_slug', v_empresa.slug,
    'usuario', jsonb_build_object(
      'id', v_usuario.id,
      'empresa_id', v_usuario.empresa_id,
      'loja_id', v_usuario.loja_id,
      'nome', v_usuario.nome,
      'email', v_usuario.email,
      'perfil', v_usuario.perfil,
      'permissoes', v_usuario.permissoes
    )
  );
end;
$function$;

# 12 — Deploy em produção

**Rótulos:** infra · segurança · **Depende de:** todos (10 passando)

## Objetivo

Colocar no ar para o primo usar, com o banco de produção idêntico ao testado.

## Passos

1. **Supabase:** criar o projeto (região São Paulo). `npx supabase link` + `npx supabase db push` para aplicar as migrações.
2. **Auth:** Site URL e Redirect URLs exatas (`https://<dominio>/auth/callback`); senha mínima 8; Confirm email ligado.
3. **Vercel:** importar `luisinnn/oficina-os`; variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`. Nunca a chave secret.
4. **Backup:** criar segredos do ticket 11 no GitHub e rodar o workflow uma vez manualmente.
5. **Verificação:** rodar a lista manual do ticket 10 em produção com duas contas de teste; depois apagar essas contas.
6. **Entrega:** criar a conta do primo, onboarding com o nome da oficina, colar o link de pré-cadastro no WhatsApp Business e no Google.
7. **A partir daqui:** proteger a `main` (exigir CI verde) e trabalhar com branch + pull request.

## Critérios de aceite

- [ ] Fluxo completo em produção no celular: nova OS → orçamento → WhatsApp → aprovação → status até entregue.
- [ ] Pré-cadastro em produção chega ao painel.
- [ ] Lista manual de segurança 100% ok.
- [ ] Backup gerado e restaurado localmente uma vez.
- [ ] README com o endereço de produção e o passo a passo de deploy.

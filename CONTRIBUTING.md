# Como contribuir

Obrigado pelo interesse em melhorar o dominio.cheap.

## Antes de começar

- Procure uma issue existente antes de criar outra.
- Para mudanças grandes, abra uma issue primeiro e descreva a proposta.
- Não inclua tokens, dados pessoais ou outras credenciais em issues, commits ou
  pull requests.
- Siga o [Código de Conduta](CODE_OF_CONDUCT.md).

## Ambiente local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

O token da Vercel é opcional. A aplicação deve continuar utilizável quando ele
não estiver configurado.

## Enviando uma mudança

1. Crie uma branch curta e descritiva a partir de `main`.
2. Faça mudanças focadas em um único problema.
3. Execute as verificações locais:

   ```bash
   npm run lint
   npm run build
   ```

4. Atualize a documentação quando o comportamento ou a configuração mudar.
5. Abra uma pull request explicando o problema, a solução e como ela foi
   verificada.

Ao alterar integrações ou snapshots de preços, informe a fonte, a moeda e a
data da coleta. Não contorne autenticação, limites ou termos de uma fonte.

## Padrões de código

- Use TypeScript estrito e preserve os tipos de retorno.
- Trate falhas de serviços externos sem derrubar toda a comparação.
- Mantenha segredos somente no servidor e fora do repositório.
- Textos da interface devem permanecer em português do Brasil.

Ao contribuir, você concorda que sua contribuição será distribuída sob a
[licença MIT](LICENSE) do projeto.

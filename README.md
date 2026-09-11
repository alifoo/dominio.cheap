# dominio.cheap

Compare preços de registro, renovação e transferência de domínios em uma só
tela, com valores convertidos para reais.

## O que o projeto faz

- Consulta disponibilidade por RDAP e DNS.
- Reúne cotações ao vivo e catálogos públicos de diferentes registradores.
- Sugere extensões com menor preço-base enquanto o nome é digitado, removendo
  domínios premium ou indisponíveis quando essa informação está disponível.
- Converte preços em dólar e euro para real.
- Mostra separadamente registro, renovação e transferência.
- Continua funcionando sem credenciais, usando apenas as fontes públicas
  disponíveis.

## Rodando localmente

Requisitos:

- [Node.js](https://nodejs.org/) 22 ou mais recente
- npm 10 ou mais recente

```bash
git clone <url-do-seu-fork>
cd dominio
npm ci
cp .env.example .env.local
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Variáveis de ambiente

`VERCEL_TOKEN` é opcional. Quando definido, permite consultar ao vivo os preços
do Vercel Domains. Crie um token em
[vercel.com/account/tokens](https://vercel.com/account/tokens) e mantenha-o
somente no `.env.local`.

Nunca faça commit de tokens. Os arquivos `.env*` são ignorados, com exceção do
`.env.example`, que contém apenas nomes de variáveis.

## Comandos

```bash
npm run dev    # servidor de desenvolvimento
npm run lint   # análise estática
npm run build  # build de produção
npm start      # executa o build de produção
```

## Usando com agents via MCP

O app também funciona como um servidor
[Model Context Protocol](https://modelcontextprotocol.io/) remoto usando
Streamable HTTP. O endpoint local é:

```text
http://localhost:3000/api/mcp
```

Depois do deploy, troque a origem pela URL pública do projeto. Em clientes MCP
que aceitam servidores remotos, a configuração segue este formato:

```json
{
  "mcpServers": {
    "dominio-cheap": {
      "url": "https://seu-dominio.example/api/mcp"
    }
  }
}
```

O servidor oferece a ferramenta `search_domain`, que recebe um domínio ou URL
e devolve disponibilidade, preços de registro, renovação e transferência,
links de compra e a cotação de câmbio usada. A resposta inclui texto para o
modelo e dados estruturados para automações.

## Rate limiting

As rotas públicas têm limites por endereço IP e por instância:

- busca completa: 20 requisições por minuto;
- sugestões: 10 requisições por minuto;
- câmbio e transporte MCP: 60 requisições por minuto.

Respostas limitadas usam status `429`, `Retry-After` e os cabeçalhos
`RateLimit-*`. O limitador em memória é uma proteção básica para instalações
simples. Em produção distribuída, configure também rate limiting no proxy ou
na plataforma de deploy.

## Fontes de dados

As integrações ficam em `lib/`. O projeto consulta RDAP, Google Public DNS,
AwesomeAPI, Banco Central do Brasil e fontes públicas dos registradores. Os
arquivos em `data/` são snapshots usados quando uma fonte não responde.

Preços, promoções, câmbio e disponibilidade podem mudar sem aviso. O resultado
é informativo: confirme as condições finais, impostos e taxas no registrador
antes de comprar. Este projeto não é afiliado nem endossado pelas empresas
citadas; marcas pertencem aos seus respectivos titulares.

## Contribuindo

Leia o [guia de contribuição](CONTRIBUTING.md) e o
[Código de Conduta](CODE_OF_CONDUCT.md) antes de abrir uma pull request.
Vulnerabilidades devem seguir a [política de segurança](SECURITY.md).

Mantido por [alifoo](https://www.linkedin.com/in/alisson-ayres/).

## Licença

Distribuído sob a [licença MIT](LICENSE).

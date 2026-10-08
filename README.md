# SEELE MOD MESA — 3.1.1

Requer **API de MOD 4**. Roda em todo app que aceita a API 4 — da v0.13.0 à linha 0.15 —, e é a MESA do **Servidor 0.15**, a linha legada que o launcher oferece a partir da 0.16. O app 0.16 roda só a API 6 e não carrega este pacote: a MESA dele é outra versão. O cliente executa em Worker, sem DOM, e declara o que quer ver; o SEELE monta.

A MESA é uma mesa de RPG por canal de texto. A porta é a entrada **Mesa** na navegação do servidor; ela abre a página da mesa, imersiva, com cinco abas:

- **Tabuleiro** — a cena que está na mesa, com o mapa sob a grade, paredes e peças. Arrastar uma peça a move no servidor, que decide se quem arrastou podia. O mestre cria e escolhe cenas, envia o mapa, põe peças, pinta paredes, ajusta a grade e escolhe a trilha da cena e a da mesa. Qualquer pessoa rola dados pela fórmula.
- **Fichas** — o mestre cria fichas, escolhe de quem cada uma é e põe a peça dela na mesa. A ficha aberta fere, cura, marca condição, edita a ficha inteira, gasta espaços de magia, prepara e conjura verbetes, cria e usa ações e envia retrato.
- **Compêndio**, **Iniciativa** e **Registro** — verbetes (o mestre cria, edita e publica), a ordem de turnos e os últimos acontecimentos.

A trilha toca pelos arquivos do pacote (`som/*.wav`, 30 s cada, declarados em `arquivos`), pelo tocador do SEELE, enquanto a página da mesa está aberta. O que toca é o que o servidor diz (`music`): a trilha da cena entra quando ela é mostrada, ou quando muda com ela na mesa.

Quem cria a campanha é quem administra o servidor; o mestre pode ser outra pessoa. Fichas de terceiros, notas do mestre, cenas não reveladas, peças e entradas de iniciativa ocultas e retratos não publicados continuam filtrados pelo servidor.

## O que a 3.1.1 conserta

Sem mudar o formato dos dados nem quem pode fazer o quê:

- **A mesa abre numa campanha de verdade.** Na 3.1.0, depois de uma cena com algumas peças, umas fichas, uns verbetes e umas vinte rolagens, a página da mesa deixava de aparecer e a tela dizia «mensagem-grande». Agora ela mostra a aba aberta e, quando uma lista é longa demais, mostra o começo e diz quantos ficaram de fora.
- **Cada canal de texto tem a sua mesa.** Na 3.1.0 a mesa era sempre a do primeiro canal do servidor, qualquer que fosse o aberto. As campanhas que existem estão no primeiro canal e continuam lá; nos outros canais a mesa começa vazia.
- **Quem joga recebe ficha e move a própria peça.** O mestre escolhe de quem é cada ficha e põe a peça dela na cena; quem é dona da ficha arrasta a peça, quando o mestre permite.
- **Gravar a ficha não desfaz o que aconteceu enquanto ela era editada.** O dano, os espaços gastos e as magias que mudaram nesse meio-tempo ficam.
- **Rolar, mover e enviar mapa não falham porque outra pessoa agiu um instante antes.** Antes aparecia «conflict», e o envio de um mapa parava no meio.
- **A trilha que o mestre escolhe é a que toca**, também numa cena marcada como silêncio, e trocar a trilha da cena que está na mesa troca o que toca.
- **Cenas grandes cabem na tela.** Uma grade de 60 colunas não deixa mais as últimas fora do alcance.
- E menores: abrir outra ficha não leva o que foi digitado na anterior; quem joga não recebe o botão de iniciativa que só o mestre pode usar; o nome das trilhas aparece em português; uma porta recusada pelo SEELE é dita; e, nos apps anteriores à 0.15.1, que não têm `console` para MODs, um erro já tratado não vira outro («console is not defined»).

## Limites

Do servidor deste MOD: 16 fichas, 16 cenas, 48 peças e 128 paredes por cena, grade de 4 a 60 casas por lado, 32 participantes de iniciativa, 100 verbetes, 24 ações por ficha e 40 eventos no registro. Mapas e retratos aceitam até 10 MiB, enviados em fragmentos. A campanha inteira de um canal tem de caber em 190.000 caracteres serializados; o SEELE dá 256 KiB de chave e valor ao MOD inteiro, somadas todas as campanhas.

Do SEELE: cada montagem de tela cabe em 12 KiB. A página monta só a aba aberta e, quando ela não cabe, corta as listas mais longas e diz o que ficou de fora; numa cena muito cheia a grade e os nomes das peças saem antes, e a cena diz isso.

## Migração e dados existentes

Mantenha o ID `seele/mesa` e o armazenamento de dados do servidor. O formato dos dados não mudou desde a 1.2. Não apague bancos, perfis, campanhas ou arquivos para trocar o pacote. O Worker não tem DOM, CSS, armazenamento da janela nem Tauri, e o produto encerra Worker, temporizadores, superfícies e contribuições na saída.

## Desenvolvimento e validação

```sh
npm ci
npm run build
npm run check
npm test
npx playwright install chromium
SEELE_RAIZ=/caminho/do/SEELE npm run test:ui
npm run preview
cargo run --manifest-path ferramentas/quickjs-check/Cargo.toml
```

Edite `ferramentas/interface.js` e `ferramentas/mesa.js`; o build reproduz `cliente/main.js`, autocontido e sem dependências de execução. O handler está em `servidor/main.js`.

O laboratório (`preview`, `test:ui`) usa um Worker real e extrai prelúdio, renderer e validação de tema do SEELE em `apps/seele-app/ui`. Sem `SEELE_RAIZ`, ele procura o SEELE em `../../SEELE` a partir de `ferramentas/`, o que só acerta num checkout ao lado do SEELE (não numa árvore de trabalho do git). `SEELE_UI` aponta direto para a pasta `ui`. Ele oferece identidades simuladas e dados temporários, servido apenas em loopback; não é backend de produção. Use `MOD_PORT` para mudar a porta.

Os testes cobrem o cliente final sem DOM, consultas sem sobreposição, falhas, troca de canal, o teto de 12 KiB por montagem, a revisão e o rascunho, regras e privacidade do servidor. O teste em Chromium usa o pacote de distribuição, Worker real e renderer do SEELE; verifica saída e reconexão. QuickJS exercita o motor de servidor. Nada disso substitui a homologação em duas janelas do app conectadas ao servidor nativo.

## Preparar o pacote

```sh
npm run build
npm run package -- /caminho/absoluto/novo/pacote
```

O destino precisa ser novo. O pacote contém `mod.json`, `cliente/main.js`, `servidor/main.js` e os arquivos que o manifesto declara em `arquivos` (a trilha). Instale os mesmos bytes no host e nos clientes pelo fluxo de MODs do SEELE, habilite no servidor de teste e reconecte para conferir o novo conjunto. Não use a raiz Git com ferramentas e dependências como pacote.

Antes da distribuição, valide instalação, hash, aceite, consulta, saída, reconexão e preservação de dados no SEELE nativo. Publicar uma nova versão requer avaliação do novo commit, atualização do catálogo e assinatura pelo indexador; mudar o código local não atualiza instalações existentes.

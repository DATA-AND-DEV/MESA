# SEELE MOD MESA — 4.0.0

Requer a **API de MOD 6**, a única do app 0.16 (Servidor 1.0). Os apps da linha anterior, da v0.13.0 à v0.15.1, rodam a API 4 e usam a **MESA 3.1.x**. A versão está em `mod.json`; o `package.json` não é a fonte dela.

A MESA é uma mesa de RPG por canal de texto. O cliente roda no executor de MODs do SEELE (QuickJS, sem DOM) e declara o que quer ver; o SEELE monta.

## Onde a mesa mora

- **A página da mesa** abre pela entrada **Mesa** na navegação do servidor, pelo botão no cabeçalho do canal que tem mesa (que mostra a rodada e quem está na vez), ou pela ação **MESA** da sala de voz amarrada a uma mesa. Ela tem cinco abas:
  - **Tabuleiro** — a cena que está na mesa, com o mapa como fundo da tela, paredes e peças. Arrastar uma peça a move no servidor, que decide se quem arrastou podia; um arraste cancelado devolve a peça. Qualquer pessoa rola dados pela fórmula. Quem mestra escolhe, cria, ajusta, tira da mesa e apaga cenas (mapa ou ilustração), envia a imagem, põe, esconde e tira peças, pinta paredes, escolhe a trilha da cena e a da mesa, e configura a mesa.
  - **Fichas** — quem mestra cria fichas; cada pessoa abre as suas.
  - **Compêndio**, **Iniciativa** e **Registro** — os verbetes (quem mestra cria, edita, publica e apaga), a ordem de turnos (a entrada de uma ficha é rolada pelo servidor, d20 mais a Destreza; quem mestra também põe uma à mão, oculta ou não) e os últimos acontecimentos.
- **A ficha em jogo** abre numa folha ao lado da página: vida e PV temporários, condição, descanso, testes de perícia, atributo e resistência com vantagem ou desvantagem, ações com fórmula e usos, magias preparadas e conjuradas pelos espaços, o retrato e, para quem mestra, o dono da ficha, a peça na mesa, a iniciativa, publicar o retrato e apagar a ficha.
- **A edição** é em diálogos com formulário: a ficha inteira (os textos longos chegam em partes), a ação, o verbete, a cena, a peça, a iniciativa à mão, a criação da mesa e as configurações. A validação é declarada e o SEELE impede o envio fora dela; a recusa do servidor volta ao campo dela. Na ficha, o que outra pessoa mudou enquanto o diálogo estava aberto — o dano do mestre, um espaço de magia gasto — não é desfeito ao gravar.
- **O palco da chamada**: quem mestra amarra a mesa a uma sala de voz nas configurações. Quem está nessa sala vê, no palco da chamada, o tabuleiro, quem está na vez, os dados e a trilha, e abre a ficha numa folha por cima dele. A metade de servidor sabe a sala pela presença de quem pede, e nunca pela janela.

Nada abre sozinho, e nada pergunta de tempos em tempos: a metade de servidor avisa cada revisão nova, e a janela atualiza só as partes que mudaram.

A trilha toca pelos arquivos do pacote (`som/*.wav`, 30 s cada, declarados em `arquivos`), em laço. Para quem está na sala amarrada, ela toca no palco (que continua soando com a vista da grade à frente); fora dela, na página. No celular ela começa desligada, com o TOCAR do SEELE. Se o SEELE recusar ou pausar a trilha, a mesa diz o motivo.

Quem cria a mesa é quem administra o servidor; o mestre pode ser outra pessoa. Fichas de terceiros, notas do mestre, cenas não reveladas, peças e entradas de iniciativa ocultas e retratos não publicados continuam filtrados pelo servidor. No celular, a mesa é para jogar: criar e ajustar cena, pintar parede, pôr peça, enviar imagem e configurar a mesa ficam no computador, e a mesa diz isso no lugar deles.

## Limites

Do servidor deste MOD: 16 fichas, 16 cenas, 48 peças e 128 paredes por cena, grade de 4 a 60 casas por lado, 32 participantes de iniciativa, 100 verbetes, 24 ações por ficha e 40 eventos no registro; apagar abre espaço. Mapas e retratos aceitam até 10 MiB e vão inteiros pelo volume do SEELE. O SEELE dá 256 KiB de chave e valor ao MOD inteiro, somadas todas as campanhas de todos os canais; a MESA confere essa conta antes de gravar e diz quando o espaço acabou.

Do SEELE: cada mensagem cabe em 12 KiB. A página e a ficha montam em partes, e cada parte que não cabe corta as listas mais longas e diz o que ficou de fora; numa cena muito cheia os nomes das peças e depois a grade saem antes, e a cena diz isso.

## Migração e dados existentes

Mantenha o ID `seele/mesa` e o armazenamento de dados do servidor. O formato das campanhas não mudou: uma campanha da 3.1 abre na 4.0 sem migração, e as imagens enviadas pela 3.1 continuam sendo lidas até serem enviadas de novo. A sala da chamada é nova e começa vazia. Não apague bancos, perfis, campanhas ou arquivos para trocar o pacote.

## Desenvolvimento e validação

```sh
npm ci
npm run build
npm run check
npm test
npx playwright install chromium
SEELE_RAIZ=/caminho/do/SEELE npm run test:ui
SEELE_RAIZ=/caminho/do/SEELE npm run preview
SEELE_RAIZ=/caminho/do/SEELE cargo run --manifest-path ferramentas/quickjs-check/Cargo.toml
```

Edite `ferramentas/interface.js` e `ferramentas/mesa.js`; o build reproduz `cliente/main.js`, autocontido e sem dependências de execução. O handler está em `servidor/main.js`.

`npm test` roda a metade de servidor e a de janela num laboratório gerado do contrato congelado da API 6 (`test/contrato/api-v6.json`, conferido pelo hash): só as formas, figuras, superfícies, pontos, modos e eventos que o contrato tem, com o teto de 12 KiB por mensagem, o de 8 pedidos em voo e os orçamentos de cada perfil. O laboratório do navegador (`preview`, `test:ui`) usa o prelúdio de `crates/seele-motor/src/preludio.rs` e o renderer de `apps/seele-app/ui` de um checkout do SEELE 0.16 em `SEELE_RAIZ` (`SEELE_UI` aponta direto para a pasta `ui`); ele oferece identidades simuladas e dados temporários, servido apenas em loopback, e não é backend de produção. Use `MOD_PORT` para mudar a porta. O exercício em QuickJS sobe as duas metades no motor do SEELE, com o mesmo prelúdio e o mesmo teto de memória, e precisa do `SEELE_RAIZ` na compilação.

Nada disso substitui a homologação em duas janelas do app conectadas ao servidor nativo.

## Preparar o pacote

```sh
npm run build
npm run package -- /caminho/absoluto/novo/pacote
```

O destino precisa ser novo. O pacote contém `mod.json`, `cliente/main.js`, `servidor/main.js` e os arquivos que o manifesto declara em `arquivos` (a trilha). Instale os mesmos bytes no host e nos clientes pelo fluxo de MODs do SEELE, habilite no servidor de teste e reconecte para conferir o novo conjunto. Não use a raiz Git com ferramentas e dependências como pacote.

Antes da distribuição, valide instalação, hash, aceite, consulta, saída, reconexão e preservação de dados no SEELE nativo. Publicar uma nova versão requer avaliação do novo commit, atualização do catálogo e assinatura pelo indexador; mudar o código local não atualiza instalações existentes.

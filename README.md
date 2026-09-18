> **Este repositório saiu de dentro do SEELE em 2026-09-17.** A Mesa morava em
> `mods/mesa/` no repositório do produto, e não era o lugar dela: pelo
> `docs/como-se-faz-um-mod.md` do SEELE, todo MOD tem repositório próprio e
> chega a quem usa pelo indexador, não pelo binário do produto. O que ficou no
> SEELE foi a **ponte** — pedido autenticado e resposta privada, sem regra de
> RPG em Rust —, que é do produto pelo ADR 0045.
>
> Publicação, assinatura e catálogo são um fluxo separado. O indexador confere
> o repositório declarado em `mod.json`; os comandos abaixo só desenvolvem e
> testam o pacote local, sem publicar ou modificar a instalação de ninguém.
>
> As ferramentas em `ferramentas/` esperam o SEELE ao lado, em `../SEELE`.
> `mesa-preview.cjs` lê a casca de lá para o CSS e as fontes; aponte para outro
> lugar com `SEELE_UI=/caminho/para/apps/seele-app/ui`.

# Mesa 1.2 — personagens, ações e ambientação

MOD de RPG para SEELE. Requer **API de MOD 2 / protocolo 6**. A ponte pertence
ao SEELE; a interface e as regras da Mesa pertencem a este repositório.

## Novidades da etapa 1.2

- **Retratos próprios** na ficha, nas peças vinculadas e na iniciativa vinculada.
  Importação PNG/JPEG/WebP com recorte central quadrado de 256 px, até 64 KiB.
  O responsável pode enviar se o GM permitir editar fichas; só o GM publica.
  Substituir uma imagem volta a deixá-la privada até nova publicação.
- **Ações por personagem**: ação, ação bônus, reação e livre. Até 24 por ficha,
  com descrição, fórmula opcional, usos limitados e recuperação manual ou por
  descanso longo. O servidor rola e consome o uso uma única vez por pedido.
  Não decide acerto, aplica dano a alvos nem impõe a economia de turno.
- **Ambientação local**, com três trilhas sintetizadas originais: Exploração,
  Mistério e Combate. O GM seleciona, pausa, retoma e para para a mesa. Cada
  participante precisa ativar o próprio som e controla seu volume ou silêncio.
- **Trilha por cena**: manter a atual, silêncio ou uma das três trilhas. Só é
  aplicada ao revelar a cena; ocultar a cena ativa interrompe a música.
- Carregamento dos estilos compatível com a CSP do SEELE, sem `unsafe-inline`,
  usando folhas CSSOM e fallback para WebViews sem folhas adotadas.

### YouTube: integração pendente, não simulada

O Mesa não carrega vídeos ou músicas do YouTube nesta versão. A configuração
`apps/seele-app/tauri.conf.json` do SEELE restringe scripts a fontes locais/MODs
e não autoriza frames externos. A [API oficial de incorporação do YouTube](https://developers.google.com/youtube/iframe_api_reference)
usa um script remoto e um player em iframe. Integrá-la exige uma decisão e
validação no aplicativo anfitrião, fora da alteração isolada deste MOD.
Não foi relaxada a CSP, criado proxy nem extraído áudio do YouTube.

As trilhas desta versão são padrões musicais sintetizados, não uma biblioteca
de gravações e não um importador de MP3. Web Audio não faz requisições externas.
A sincronização usa o relógio e o estado do servidor, com precisão aproximada
(consulta a cada 2 s, não sincronia de amostra). O som para ao fechar a Mesa,
descarregar o MOD ou após 7 s sem resposta confirmada; pode haver notas curtas
já agendadas. Retomar acompanha a posição compartilhada, sem reiniciar a trilha.

## Base da etapa 1.1

- **Jogar**, separado da edição da ficha: atributos, 18 perícias e resistências.
- Proficiências e especializações cadastradas manualmente, com bônus por nível
  e cálculo no servidor. Vantagem/desvantagem escolhem maior/menor de dois d20.
- Ajuste situacional explícito; o resultado e o bônus aparecem no registro
  público. Mesmo com a edição bloqueada pelo GM, o dono pode rolar sua ficha.
- Dano consome PV temporários antes dos normais; cura não ultrapassa o máximo;
  novos PV temporários conservam o maior valor, sem somar.
- Até 12 condições/efeitos por ficha, privados ao GM e ao responsável.
- Participantes podem entrar ou sair da iniciativa sem reiniciar um encontro
  em andamento. A remoção do participante ativo passa ao próximo.
- Fichas anteriores continuam válidas: proficiências ausentes valem zero e
  condições ausentes valem uma lista vazia. As notas antigas são preservadas.

## O que funciona

- Uma campanha por canal, com setup de D&D 5e (2014) ou sistema livre.
- Um administrador cria a campanha e nomeia o GM. O GM transfere a condução,
  atribui fichas e decide se jogadores editam suas fichas e movem suas peças.
- Fichas com atributos, modificadores, nível, classe livre, ancestralidade,
  antecedentes, PV, CA, inventário, notas, perícias anotadas e espaços de magia.
- Mapas vazios editáveis com grade, obstáculos e peças; importar PNG/JPEG/WebP.
  Imagens são convertidas no cliente (até 1600 px e 256 KiB). Grade cobre a
  imagem inteira; ajuste linhas e colunas para alinhar mapas importados.
- Cenas ilustradas com descrição e notas privadas do GM. Prévia e revelação.
- Iniciativa ordenada, turnos e rodadas; participantes ocultos para o GM.
- Rolagens públicas calculadas no servidor, sem interpretação de código.
- Compêndio editável de magias, habilidades, itens, regras e condições. Preparar
  magias na ficha, consumir espaços e recuperar PV/espaços em descanso longo.
- Persistência no servidor, revisão otimista e recibos para não duplicar ações.
- Respostas filtradas por pessoa. Cenas não reveladas, notas do GM, fichas de
  terceiros e peças ocultas não chegam ao jogador.

## Executar e conferir

Na raiz de **SEELE-MOD-MESA**:

```sh
npm test
npm run check
npm run preview
```

O laboratório abre em `http://127.0.0.1:4318`. Usa o mesmo cliente e a mesma lógica
de servidor do MOD, com transporte local de desenvolvimento e estado temporário.
Escolha a identidade no topo antes de abrir MESA. Serve para conferir GM/jogador
em janelas separadas; não é um servidor de produção nem substitui o teste QUIC.

Para preparar uma instalação, use uma pasta **nova**:

```sh
node ferramentas/mesa-package.mjs /caminho/absoluto/config/mods/seele/mesa
```

Instale os mesmos três arquivos no host e em cada cliente. Habilite `seele/mesa`
no servidor (comando Tauri `habilitar_mod`), reconecte e aceite o conjunto de
MODs. O botão MESA aparece após o cliente conferir o hash exigido pelo servidor.
Ele fica na coluna de salas e canais, abaixo das listas, na seção **MODS**,
com um ícone de dado e a indicação **RPG**. Em janelas estreitas, abra a gaveta
de canais do SEELE para encontrá-lo. Não há mais botão flutuante sobre o chat.
Em cascas antigas sem essa coluna, o acesso fica no fluxo normal da página.
Ao fechar o Mesa, o foco do teclado retorna ao botão. A integração usa a
estrutura atual da coluna (`#tela-sessao .painel-canais .canais-rolagem`);
mudanças nessa estrutura precisam de validação de compatibilidade.
Para hospedar o pacote em um servidor nativo de desenvolvimento, execute no
repositório **SEELE** (o segundo caminho deve ser uma pasta nova):

```sh
cargo run -p seele-server --example servidor-com-mod -- \
  /caminho/absoluto/config/mods/seele/mesa /caminho/absoluto/mundo-de-teste
```

Para o teste de interface, instale apenas as dependências de desenvolvimento:

```sh
npm ci
npx playwright install chromium
npm run test:ui
```

O teste abre seu próprio laboratório em uma porta livre e o encerra ao terminar.
As dependências de teste não fazem parte do pacote distribuído; continuam sendo
somente `mod.json`, `cliente/main.js` e `servidor/main.js`, sem build.
Use o pacote gerado pelo empacotador no exemplo nativo, não a raiz Git com
dependências e ferramentas: o servidor calcula o hash de todos os arquivos.

A publicação e o download automático pelo indexador não fazem parte desta
instalação local. Não modifique uma instalação habilitada: alterações de código
mudam o hash e exigem reabilitar/reconectar para um novo aceite.

## Limites explícitos

16 fichas, 16 cenas, 48 peças e 128 obstáculos por cena, 32 participantes de
iniciativa, 100 entradas de compêndio, 40 eventos recentes. O quintal de dados da
API possui 256 KiB **para o MOD inteiro**, compartilhado pelas campanhas. Imagens
ficam na pasta de dados, até 256 KiB por cena e 64 KiB por retrato. Imagens
publicadas podem ter sido guardadas por quem as viu; torná-las privadas não
revoga cópias já recebidas. Não há editor de imagem, fog of
war, iluminação dinâmica, colisão ou automação completa das regras de D&D.
Valores de ficha, escolhas de proficiência, progressão e recursos de classe
são cadastrados manualmente. Os cálculos de proficiência seguem 5e inclusive no
modo livre; para outros sistemas use as rolagens genéricas. Condições são
anotações, sem efeitos automáticos. Resistência/vulnerabilidade a dano, morte,
concentração e alvos continuam sob decisão do GM.
Descanso longo restaura PV, espaços cadastrados e ações marcadas com essa
recuperação. Uso de magia registra e
consome o espaço; resolução de efeito/alvos e dano cabe à mesa.

Dados sincronizam por consulta a cada 2 s quando a Mesa está aberta. Ações
retornam seu estado imediatamente. Um conflito exige repetir a edição após
conferir a versão atual. Uma falha de transporte não repete automaticamente uma
rolagem. A API reinicia o runtime a cada pedido; não use globais como persistência.

## Verificação local da etapa 1.2

21 testes de lógica cobrem permissões, privacidade, compatibilidade com fichas
antigas, proficiências, vantagem/desvantagem, PV, iniciativa, retratos, recursos
de ações e a linha do tempo da música. O teste de
interface usa o cliente real do MOD com transporte HTTP de laboratório, em
janelas de GM, jogador e terceiro, com CSP restritiva. Verifica o layout
estreito, publicação de retratos, criação/uso de ações, áudio Web Audio real
com medição de sinal, autorização local, pausa/retomada, silêncio sem conexão
e encerramento ao fechar/descarregar a Mesa. Exercita também o fallback CSSOM
para WebViews sem folhas adotadas e sua remoção sem afetar os estilos do host.

Há uma checagem adicional no mesmo motor JavaScript usado pelo SEELE, com
limite de memória de 8 MiB. Passou com retrato perto do teto, autorização,
ações, recursos e música por cena:

```sh
cargo run --manifest-path ferramentas/quickjs-check/Cargo.toml
```

Essa ferramenta exige Rust e um compilador C apenas no desenvolvimento. Ela
usa bindings de memória para dados/arquivos, não uma conexão QUIC real.
Esta etapa não altera a ponte e não substitui a homologação em duas janelas
Tauri conectadas ao servidor nativo antes de distribuir a versão.

## Referência VINLAND

Referência local: `packages/dnd5e/src/schema.ts` e `derived.ts`. A estrutura de
atributos, recursos e slots orientou esta implementação em JS. Não foi importado
o motor gráfico nem o catálogo de textos de livros. O compêndio começa vazio,
para conteúdo próprio ou autorizado do GM; o conjunto 5e é identificado como
2014 e não mistura silenciosamente revisões diferentes.

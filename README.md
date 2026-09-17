> **Este repositório saiu de dentro do SEELE em 2026-09-17.** A Mesa morava em
> `mods/mesa/` no repositório do produto, e não era o lugar dela: pelo
> `docs/como-se-faz-um-mod.md` do SEELE, todo MOD tem repositório próprio e
> chega a quem usa pelo indexador, não pelo binário do produto. O que ficou no
> SEELE foi a **ponte** — pedido autenticado e resposta privada, sem regra de
> RPG em Rust —, que é do produto pelo ADR 0045.
>
> **A URL em `mod.json` ainda não existe no GitHub.** Ela precisa existir, e o
> pacote precisa estar publicado nela, antes de a Mesa ser aceita no catálogo:
> o indexador confere o repositório declarado.
>
> As ferramentas em `ferramentas/` esperam o SEELE ao lado, em `../SEELE`.
> `mesa-preview.cjs` lê a casca de lá para o CSS e as fontes; aponte para outro
> lugar com `SEELE_UI=/caminho/para/apps/seele-app/ui`.

# Mesa 1.0

MOD de RPG para SEELE. Requer **API de MOD 2 / protocolo 6**, implementados junto
desta versão. Não funciona na build publicada anterior apenas copiando o MOD.
Código local de desenvolvimento; ainda não publicado nem assinado no indexador.

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

Na raiz do SEELE:

```sh
node --test mods/mesa/test/mesa.test.cjs
cargo test -p seele-conformance --test mesa
node tools/mesa-preview.cjs
```

O laboratório abre em `http://127.0.0.1:4318`. Usa o mesmo cliente e a mesma lógica
de servidor do MOD, com transporte local de desenvolvimento e estado temporário.
Escolha a identidade no topo antes de abrir MESA. Serve para conferir GM/jogador
em janelas separadas; não é um servidor de produção nem substitui o teste QUIC.

Para preparar uma instalação, use uma pasta **nova**:

```sh
node tools/mesa-package.mjs /caminho/absoluto/config/mods/seele/mesa
```

Instale os mesmos três arquivos no host e em cada cliente. Habilite `seele/mesa`
no servidor (comando Tauri `habilitar_mod`), reconecte e aceite o conjunto de
MODs. O botão MESA aparece após o cliente conferir o hash exigido pelo servidor.
Também há `cargo run -p seele-server --example mesa -- /pasta/nova` para um
servidor de desenvolvimento isolado com o pacote já habilitado.

A publicação e o download automático pelo indexador não fazem parte desta
instalação local. Não modifique uma instalação habilitada: alterações de código
mudam o hash e exigem reabilitar/reconectar para um novo aceite.

## Limites explícitos

16 fichas, 16 cenas, 48 peças e 128 obstáculos por cena, 32 participantes de
iniciativa, 100 entradas de compêndio, 40 eventos recentes. O quintal de dados da
API possui 256 KiB **para o MOD inteiro**, compartilhado pelas campanhas. Imagens
ficam na pasta de dados, até 256 KiB por cena. Não há edição de imagem, fog of
war, iluminação dinâmica, colisão ou automação completa das regras de D&D.
Valores de ficha, perícias, progressão e recursos de classe são manuais na v1.
Descanso longo só restaura PV e espaços cadastrados. Uso de magia registra e
consome o espaço; resolução de efeito/alvos e dano cabe à mesa.

Dados sincronizam por consulta a cada 2 s quando a Mesa está aberta. Ações
retornam seu estado imediatamente. Um conflito exige repetir a edição após
conferir a versão atual. Uma falha de transporte não repete automaticamente uma
rolagem. A API reinicia o runtime a cada pedido; não use globais como persistência.

## VINLAND

Referência local: `packages/dnd5e/src/schema.ts` e `derived.ts`. A estrutura de
atributos, recursos e slots orientou esta implementação em JS. Não foi importado
o motor gráfico nem o catálogo de textos de livros. O compêndio começa vazio,
para conteúdo próprio ou autorizado do GM; o conjunto 5e é identificado como
2014 e não mistura silenciosamente revisões diferentes.

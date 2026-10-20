//! O MOD, no motor de verdade.
//!
//! # Por que dois exercícios e não um
//!
//! A metade de servidor é `aoPedir`, sem ambiente, e o `smoke.js` ao lado a
//! percorre inteira, com o que a API 6 dá a ela: `dados.uso()` e `dados.teto`,
//! `mundo.avisar` e o `volume`.
//!
//! A metade de **cliente** é exercitada no `vm` do Node — que tem o JavaScript
//! moderno inteiro — e no laboratório do navegador, que tem ainda mais. Nenhum
//! dos dois prova o que este binário prova: que o código que sai deste pacote
//! sobe no mesmo motor, sob o mesmo teto de memória, com o mesmo prelúdio, e
//! sem as coisas que os outros dois oferecem de graça. Aqui ele conversa com a
//! metade de servidor de verdade, num segundo motor, e recebe os avisos dela.
//!
//! # O que este exercício **não** prova
//!
//! Não é o executor: não há supervisão, não há geração, não há fila com teto,
//! não há interrupção por tempo de volta nem descarte, e a janela que responde
//! às superfícies é esta função, e não o renderer. O que há é o motor, o limite
//! de heap e o prelúdio. O resto é o produto, e a auditoria pede observação
//! nativa para dar qualquer fluxo por homologado.
//!
//! # Onde está o SEELE
//!
//! `SEELE_RAIZ`, na compilação: a raiz de um checkout do SEELE 0.16, como a do
//! laboratório do navegador. Um caminho relativo fixo não achava o SEELE de
//! uma árvore de trabalho do git.

use rquickjs::{Context, Function, Runtime};
use std::cell::RefCell;
use std::rc::Rc;

/// O prelúdio, lido de onde ele mora: o motor em Rust.
///
/// Recortado do fonte e não copiado. Uma cópia é a segunda verdade que
/// discorda no dia em que só uma sobe — e a que discordasse aqui faria este
/// exercício provar um prelúdio que o produto não usa.
fn preludio() -> Result<String, String> {
    const FONTE: &str = include_str!(concat!(env!("SEELE_RAIZ"), "/crates/seele-motor/src/preludio.rs"));
    const MARCA: &str = "pub const PRELUDIO: &str = r#\"";
    let inicio = FONTE
        .find(MARCA)
        .ok_or("`PRELUDIO` não foi encontrado em preludio.rs")?;
    let resto = &FONTE[inicio + MARCA.len()..];
    let fim = resto.find("\"#;").ok_or("`PRELUDIO` não fecha")?;
    Ok(resto[..fim].to_owned())
}

/// O que a metade de servidor recebe da API 6, de mentira: o quintal com a
/// conta e o teto, o relógio, o aviso, o disco e o volume.
const AMBIENTE_DO_SERVIDOR: &str = r#"globalThis.dados = {};
    Object.defineProperty(dados, 'uso', { value: () => Object.entries(dados).reduce((n, [k, v]) => n + k.length + String(v).length, 0) });
    Object.defineProperty(dados, 'teto', { value: 262144 });
    const disk = {}, esperas = {};
    globalThis.__volumes = {};
    globalThis.__avisos = [];
    globalThis.mundo = { agora: () => 123, avisar: aviso => { __avisos.push(JSON.parse(JSON.stringify(aviso))); return { ok: true }; } };
    globalThis.arquivos = {
      ler: p => disk[p] ?? null,
      escrever: (p, v) => { disk[p] = v; return true; },
      listar: () => Object.keys(disk),
      apagar: p => delete disk[p]
    };
    globalThis.volume = {
      esperar: (token, caminho) => { esperas[token] = caminho; return true; },
      tamanho: c => (c in __volumes ? __volumes[c] : null),
      servir: c => (c in __volumes ? c : null),
      apagar: c => delete __volumes[c]
    };
    globalThis.__chegou = (token, bytes) => { __volumes[esperas[token]] = bytes; };"#;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    servidor()?;
    cliente()?;
    Ok(())
}

/// Um motor com o teto de memória do executor e um prazo.
fn motor() -> Result<(Runtime, Context), Box<dyn std::error::Error>> {
    let runtime = Runtime::new()?;
    runtime.set_memory_limit(8 * 1024 * 1024);
    let started = std::time::Instant::now();
    runtime.set_interrupt_handler(Some(Box::new(move || started.elapsed().as_secs() > 20)));
    let context = Context::full(&runtime)?;
    Ok((runtime, context))
}

/// A metade de servidor carregada, num motor só dela.
fn metade_de_servidor() -> Result<(Runtime, Context), Box<dyn std::error::Error>> {
    let (runtime, context) = motor()?;
    context.with(|ctx| -> Result<(), String> {
        ctx.eval::<(), _>(AMBIENTE_DO_SERVIDOR)
            .map_err(|e| format!("bindings: {e}: {:?}", ctx.catch()))?;
        ctx.eval::<(), _>(include_str!("../../../servidor/main.js"))
            .map_err(|e| format!("load: {e}: {:?}", ctx.catch()))
    })
    .map_err(std::io::Error::other)?;
    Ok((runtime, context))
}

/// A metade de servidor: `aoPedir`, sem ambiente nenhum além do da API 6.
fn servidor() -> Result<(), Box<dyn std::error::Error>> {
    let (_runtime, context) = metade_de_servidor()?;
    let result = context.with(|ctx| -> Result<String, String> {
        ctx.eval::<String, _>(include_str!("../smoke.js"))
            .map_err(|e| format!("smoke: {e}: {:?}", ctx.catch()))
    });
    println!("{}", result.map_err(std::io::Error::other)?);
    Ok(())
}

/// Uma volta de `aoPedir` na metade de servidor, e os avisos que ela deixou.
fn pedir(servidor: &Context, contexto: &serde_json::Value, valor: &serde_json::Value) -> Result<(String, Vec<String>), String> {
    servidor.with(|ctx| -> Result<(String, Vec<String>), String> {
        ctx.globals().set("__contexto", contexto.to_string()).map_err(|e| e.to_string())?;
        ctx.globals().set("__valor", valor.to_string()).map_err(|e| e.to_string())?;
        let resposta: String = ctx
            .eval("aoPedir(__contexto, __valor)")
            .map_err(|e| format!("aoPedir: {e}: {:?}", ctx.catch()))?;
        let avisos: String = ctx
            .eval("JSON.stringify(__avisos.splice(0))")
            .map_err(|e| format!("avisos: {e}: {:?}", ctx.catch()))?;
        let lista: Vec<serde_json::Value> = serde_json::from_str(&avisos).map_err(|e| e.to_string())?;
        Ok((resposta, lista.iter().map(|a| a.to_string()).collect()))
    })
}

/// A metade de cliente: o prelúdio do motor, e o pacote em cima dele.
///
/// O que o motor recebe é o que o executor entrega — `seele.postar` e
/// `seele.console`, e nada mais. Não há `document`, não há `window`, não há
/// `fetch` e não há o `vm` do Node por baixo. Se o pacote depender de qualquer
/// um deles, é aqui que se descobre.
fn cliente() -> Result<(), Box<dyn std::error::Error>> {
    let (_rs, servidor) = metade_de_servidor()?;
    // A mesa que a janela vai encontrar: uma cena com peça, uma ficha, a
    // trilha e a sala 7 amarrada.
    let mestre = serde_json::json!({ "person": "1", "channel": 1, "admin": true, "write": true, "sala": 7 });
    let mut revisao = 0;
    for (i, valor) in [
        serde_json::json!({ "op": "setup", "name": "Mesa do QuickJS", "system": "dnd5e-2014", "gm": "1" }),
        serde_json::json!({ "op": "scene-create", "name": "Cripta", "kind": "map" }),
        serde_json::json!({ "op": "scene-show", "id": "scene-1" }),
        serde_json::json!({ "op": "sheet-create", "name": "Iria", "owner": "1" }),
        serde_json::json!({ "op": "token-add", "scene": "scene-1", "sheet": "sheet-2", "x": 2, "y": 3 }),
        serde_json::json!({ "op": "music", "command": "select", "preset": "battle" }),
        serde_json::json!({ "op": "settings", "name": "Mesa do QuickJS", "allowMove": true, "allowEdit": true, "sala": 7 }),
    ]
    .into_iter()
    .enumerate()
    {
        let mut valor = valor;
        valor["nonce"] = serde_json::json!(format!("semente-{i}"));
        valor["revision"] = serde_json::json!(revisao);
        let (resposta, _) = pedir(&servidor, &mestre, &valor).map_err(std::io::Error::other)?;
        let lida: serde_json::Value = serde_json::from_str(&resposta)?;
        revisao = lida["campaign"]["revision"].as_u64().ok_or_else(|| format!("semente {i}: {resposta}"))?;
    }

    let (_rc, cliente) = motor()?;
    // O que o MOD falou, na ordem em que ele falou, e o que ele escreveu no
    // registro. É por aqui que se sabe se ele chegou a desenhar alguma coisa.
    let fita: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
    let registro: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
    let grandes: Rc<RefCell<usize>> = Rc::new(RefCell::new(0));

    cliente.with(|ctx| -> Result<(), String> {
        let eco = Rc::clone(&fita);
        let excesso = Rc::clone(&grandes);
        let postar = Function::new(ctx.clone(), move |texto: String| -> bool {
            // O mesmo teto de mensagem do executor. Um pacote que o estoure
            // descobre aqui, e não numa janela onde a volta some.
            if texto.len() > 12 * 1024 {
                *excesso.borrow_mut() += 1;
                return false;
            }
            eco.borrow_mut().push(texto);
            true
        })
        .map_err(|e| format!("postar: {e}"))?;
        let anotado = Rc::clone(&registro);
        let console = Function::new(ctx.clone(), move |nivel: String, texto: String| {
            anotado.borrow_mut().push(format!("{nivel}: {texto}"));
        })
        .map_err(|e| format!("console: {e}"))?;
        let seele = rquickjs::Object::new(ctx.clone()).map_err(|e| format!("seele: {e}"))?;
        seele.set("postar", postar).map_err(|e| format!("seele.postar: {e}"))?;
        seele.set("console", console).map_err(|e| format!("seele.console: {e}"))?;
        ctx.globals().set("seele", seele).map_err(|e| format!("global seele: {e}"))?;

        // As capacidades da API que este pacote declara, do contrato congelado.
        let manifesto: serde_json::Value = serde_json::from_str(include_str!("../../../mod.json"))
            .map_err(|e| format!("mod.json: {e}"))?;
        let api = manifesto.get("api").and_then(serde_json::Value::as_u64).ok_or("o manifesto não declara `api`")?;
        let contrato: serde_json::Value = serde_json::from_str(include_str!("../../../test/contrato/api-v6.json"))
            .map_err(|e| format!("contrato: {e}"))?;
        let capacidades = contrato["compatibilidade"]["capacidades-por-versao"][api.to_string()].clone();
        if !capacidades.is_array() {
            return Err(format!("o contrato da 6 não tem capacidades para a API {api}"));
        }
        ctx.eval::<(), _>(format!("globalThis.__seeleCapacidades = {capacidades};"))
            .map_err(|e| format!("capacidades: {e}: {:?}", ctx.catch()))?;
        ctx.eval::<(), _>(preludio()?)
            .map_err(|e| format!("prelúdio: {e}: {:?}", ctx.catch()))?;

        // **A prova do ambiente, antes do pacote.** Se o prelúdio deixasse
        // passar qualquer coisa de navegador ou de Node — ou o que a API 6
        // tirou —, um MOD poderia depender dela sem nada reclamar.
        let vazios: String = ctx
            .eval(
                r#"[...['document','window','fetch','XMLHttpRequest','WebSocket','localStorage',
                    'require','process','importScripts','Worker','Atomics']
                   .filter(n => typeof globalThis[n] !== 'undefined'),
                   ...(SeeleMods.snapshot ? ['SeeleMods.snapshot'] : []),
                   ...(SeeleUI.regiao ? ['SeeleUI.regiao'] : []),
                   ...(SeeleUI.cartoes ? ['SeeleUI.cartoes'] : [])].join(',')"#,
            )
            .map_err(|e| format!("ambiente: {e}: {:?}", ctx.catch()))?;
        if !vazios.is_empty() {
            return Err(format!("o contexto do MOD tem coisas que ele não deveria ter: {vazios}"));
        }
        ctx.eval::<(), _>(include_str!("../../../cliente/main.js"))
            .map_err(|e| format!("cliente: {e}: {:?}", ctx.catch()))?;
        while ctx.execute_pending_job() {}
        Ok(())
    })
    .map_err(std::io::Error::other)?;

    // A janela de mentira: responde ao que o MOD pede, e leva os pedidos à
    // metade de servidor. Os eventos são o que quem usa faria: abrir a mesa,
    // entrar na sala amarrada, percorrer as abas e abrir a ficha.
    let retrato = serde_json::json!({
        "eu": 1, "servidor": { "nome": "QuickJS" },
        "pessoas": [{ "id": 1, "apelido": "Alex", "falando": false, "mudo": false }],
        "salas": [{ "id": 7, "nome": "Taverna", "limite": 0, "pessoas": [], "minha": false }],
        "canais": [{ "id": 1, "nome": "geral", "aberto": true }],
        "onde": "computador",
        "regioes": ["servidor.navegacao", "canal.cabecalho", "pessoas.lista", "chamada.palco", "pagina", "dialogo", "folha", "aviso"]
    });
    let eventos = [
        r#"{"tipo":"evento","nome":"acao","acao":"abrir-mesa","pessoa":"","canal":""}"#,
        r#"{"tipo":"evento","nome":"sala","sala":7}"#,
        r#"{"tipo":"evento","nome":"lugar","onde":"computador","regioes":[],"largura":640,"altura":480,"regiao":"chamada.palco"}"#,
        r#"{"tipo":"evento","nome":"aba","chave":"aba","valor":"aba-fichas"}"#,
        r#"{"tipo":"evento","nome":"botao","chave":"abrir-ficha-sheet-2"}"#,
        r#"{"tipo":"evento","nome":"botao","chave":"palco:rolar"}"#,
        r#"{"tipo":"evento","nome":"aba","chave":"aba","valor":"aba-registro"}"#,
    ];
    let mut tipos: Vec<String> = Vec::new();
    // O que ele montou, por superfície e por ponto, e o que ele disse como erro.
    let mut montadas: Vec<String> = Vec::new();
    let mut pontos: Vec<String> = Vec::new();
    let mut ditos_como_erro: Vec<String> = Vec::new();
    let mut handles = 0;
    let mut proximo_evento = 0;
    for _volta in 0..400 {
        let falas: Vec<String> = fita.borrow_mut().drain(..).collect();
        if falas.is_empty() {
            if proximo_evento == eventos.len() {
                break;
            }
            let evento = eventos[proximo_evento];
            proximo_evento += 1;
            responder(&cliente, evento)?;
            continue;
        }
        for texto in falas {
            let m: serde_json::Value = serde_json::from_str(&texto)?;
            let tipo = m["tipo"].as_str().unwrap_or_default().to_owned();
            let n = m["n"].clone();
            tipos.push(tipo.clone());
            match tipo.as_str() {
                "superficie-montar" => montadas.push(m["superficie"].as_str().unwrap_or_default().to_owned()),
                "contribuir" => pontos.push(m["pedido"]["ponto"].as_str().unwrap_or_default().to_owned()),
                "superficie-criar" if m["descricao"]["tipo"] == "aviso" && m["descricao"]["tom"] == "erro" => {
                    ditos_como_erro.push(m["descricao"]["titulo"].as_str().unwrap_or_default().to_owned());
                }
                _ => {}
            }
            let mut avisos = Vec::new();
            let valor: serde_json::Value = match tipo.as_str() {
                "retrato" => retrato.clone(),
                "pedido" => {
                    let canal = m["canal"].as_u64().unwrap_or(0);
                    let contexto = serde_json::json!({
                        "person": "1", "channel": if canal == 0 { serde_json::Value::Null } else { serde_json::json!(canal) },
                        "admin": true, "write": true, "sala": 7
                    });
                    let (resposta, novos) = pedir(&servidor, &contexto, &m["valor"]).map_err(std::io::Error::other)?;
                    avisos = novos;
                    serde_json::from_str(&resposta)?
                }
                "superficie-criar" => serde_json::json!({ "superficie": m["descricao"]["id"], "reaproveitada": false }),
                "contribuir" => {
                    handles += 1;
                    serde_json::json!({ "handle": format!("c{handles}") })
                }
                "atualizar-contribuicao" | "revogar-contribuicao" => serde_json::json!(true),
                _ => serde_json::Value::Null,
            };
            let resposta = serde_json::json!({ "tipo": "resposta", "n": n, "ok": true, "valor": valor });
            responder(&cliente, &resposta.to_string())?;
            for aviso in avisos {
                let a: serde_json::Value = serde_json::from_str(&aviso)?;
                let evento = serde_json::json!({ "tipo": "evento", "nome": "servidor", "canal": a.get("canal").cloned().unwrap_or(serde_json::Value::Null), "carga": a["carga"] });
                responder(&cliente, &evento.to_string())?;
            }
        }
    }

    // O que ele falou. Um MOD que só perguntou e parou não chegou a desenhar,
    // e isso é uma falha silenciosa — a mais cara deste repositório.
    let conta = |nome: &str| tipos.iter().filter(|t| t.as_str() == nome).count();
    let erros: Vec<String> = registro.borrow().iter().filter(|l| l.starts_with("error") || l.starts_with("warn")).cloned().collect();
    if *grandes.borrow() > 0 {
        return Err(format!("{} mensagem(ns) passaram dos 12 KiB", grandes.borrow()).into());
    }
    if !erros.is_empty() {
        return Err(format!("o MOD anotou erros: {erros:?}").into());
    }
    // **O erro dito a quem usa também é erro.** O MOD pega o que lança num
    // evento e o diz num aviso; sem esta linha, uma página que não monta
    // passava aqui porque a folha montou.
    if !ditos_como_erro.is_empty() {
        return Err(format!("o MOD disse erros a quem usa: {ditos_como_erro:?}").into());
    }
    for superficie in ["mesa", "mesa-ficha"] {
        if !montadas.iter().any(|s| s == superficie) {
            return Err(format!("a superfície «{superficie}» não montou: {montadas:?}").into());
        }
    }
    for ponto in ["servidor.navegacao", "canal.cabecalho", "sala.acoes", "chamada.palco"] {
        if !pontos.iter().any(|p| p == ponto) {
            return Err(format!("o MOD não contribuiu em «{ponto}»: {pontos:?}").into());
        }
    }
    for preciso in ["retrato", "pedido", "contribuir", "superficie-criar", "superficie-montar", "superficie-atualizar", "atualizar-contribuicao"] {
        if conta(preciso) == 0 {
            return Err(format!("o MOD não chegou a «{preciso}»: {tipos:?}").into());
        }
    }
    if proximo_evento < eventos.len() {
        return Err(format!("a conversa não assentou: {} evento(s) não chegaram a ir", eventos.len() - proximo_evento).into());
    }
    println!(
        "QuickJS 0.12.2 / 8 MiB: o cliente sobe no prelúdio da 0.16, sem DOM e sem Node, conversa com a \
         metade de servidor e recebe os avisos dela: {} retrato(s), {} pedido(s), {} montagem(ns), {} parte(s) \
         atualizada(s), {} contribuição(ões) registrada(s) e {} atualizada(s), nenhuma acima de 12 KiB.",
        conta("retrato"), conta("pedido"), conta("superficie-montar"), conta("superficie-atualizar"),
        conta("contribuir"), conta("atualizar-contribuicao")
    );
    Ok(())
}

/// Entrega uma mensagem ao MOD e escoa as microtarefas que ela soltou. No
/// executor quem as escoa é o laço dele; aqui é esta função.
fn responder(cliente: &Context, texto: &str) -> Result<(), Box<dyn std::error::Error>> {
    cliente
        .with(|ctx| -> Result<(), String> {
            ctx.globals().set("__resposta", texto.to_owned()).map_err(|e| e.to_string())?;
            ctx.eval::<(), _>("aoResponder(__resposta)")
                .map_err(|e| format!("aoResponder: {e}: {:?}", ctx.catch()))?;
            while ctx.execute_pending_job() {}
            Ok(())
        })
        .map_err(|e| std::io::Error::other(e).into())
}

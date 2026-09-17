use rquickjs::{Context, Runtime};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let runtime = Runtime::new()?;
    runtime.set_memory_limit(8 * 1024 * 1024);
    let started = std::time::Instant::now();
    runtime.set_interrupt_handler(Some(Box::new(move || started.elapsed().as_secs() > 2)));
    let context = Context::full(&runtime)?;
    let result = context.with(|ctx| -> Result<String, String> {
        ctx.eval::<(), _>(
            r#"globalThis.dados = {};
            const disk = {};
            globalThis.mundo = {agora: () => 123};
            globalThis.arquivos = {
              ler: p => disk[p] ?? null,
              escrever: (p, v) => {disk[p] = v; return true;},
              listar: () => Object.keys(disk),
              apagar: p => delete disk[p]
            };"#,
        )
        .map_err(|e| format!("bindings: {e}: {:?}", ctx.catch()))?;
        ctx.eval::<(), _>(include_str!("../../../servidor/main.js"))
            .map_err(|e| format!("load: {e}: {:?}", ctx.catch()))?;
        ctx.eval::<String, _>(include_str!("../smoke.js"))
            .map_err(|e| format!("smoke: {e}: {:?}", ctx.catch()))
    });
    println!("{}", result.map_err(std::io::Error::other)?);
    Ok(())
}

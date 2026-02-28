const formJ1 = document.getElementById("form-j1");
const erroJ1 = document.getElementById("erro-j1");
const resultadoJ1 = document.getElementById("resultado-j1");

const formJ2 = document.getElementById("form-j2");
const erroJ2 = document.getElementById("erro-j2");
const resultadoJ2 = document.getElementById("resultado-j2");

const btnBatalhar = document.getElementById("btn-batalhar");
const btnCalcular = document.getElementById("btn-calcular");
const telaBatalha = document.getElementById("tela-batalha");
const telaResultado = document.getElementById("tela-resultado");

const pokemonJ1A = document.getElementById("pokemon-j1-a");
const pokemonJ1B = document.getElementById("pokemon-j1-b");
const pokemonJ2A = document.getElementById("pokemon-j2-a");
const pokemonJ2B = document.getElementById("pokemon-j2-b");

const pontosJ1El = document.getElementById("pontos-j1");
const pontosJ2El = document.getElementById("pontos-j2");
const mensagemResultadoEl = document.getElementById("mensagem-resultado");

const estado = {
  j1: [],
  j2: [],
};
let batalhaEmExecucao = false;

async function fetchJson(url, erroPadrao) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(erroPadrao);
  }

  return response.json();
}

function capitalizar(valor) {
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function normalizarNome(valor) {
  return valor.toLowerCase().trim();
}

function limparTextoFlavor(valor) {
  return valor.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
}

function obterDescricao(speciesData) {
  const entries = speciesData.flavor_text_entries || [];

  const ptBr = entries.find((entry) => entry.language.name === "pt-BR");
  if (ptBr) {
    return limparTextoFlavor(ptBr.flavor_text);
  }

  const pt = entries.find((entry) => entry.language.name === "pt");
  if (pt) {
    return limparTextoFlavor(pt.flavor_text);
  }

  const en = entries.find((entry) => entry.language.name === "en");
  if (en) {
    return limparTextoFlavor(en.flavor_text);
  }

  return "Sem descricao disponivel.";
}

function extrairNomesEvolucao(chainNode, lista = []) {
  if (!chainNode) {
    return lista;
  }

  if (chainNode.species && chainNode.species.name) {
    lista.push(chainNode.species.name);
  }

  (chainNode.evolves_to || []).forEach((proxima) => {
    extrairNomesEvolucao(proxima, lista);
  });

  return lista;
}

function calcularRelacoesDano(typeDetails) {
  const multiplicadores = {};

  typeDetails.forEach((typeData) => {
    const relacoes = typeData.damage_relations;

    relacoes.double_damage_from.forEach((item) => {
      multiplicadores[item.name] = (multiplicadores[item.name] || 1) * 2;
    });

    relacoes.half_damage_from.forEach((item) => {
      multiplicadores[item.name] = (multiplicadores[item.name] || 1) * 0.5;
    });

    relacoes.no_damage_from.forEach((item) => {
      multiplicadores[item.name] = 0;
    });
  });

  const fracos = [];
  const resistentes = [];
  const imunes = [];

  Object.entries(multiplicadores).forEach(([tipo, mult]) => {
    if (mult === 0) {
      imunes.push(tipo);
      return;
    }

    if (mult > 1) {
      fracos.push(`${tipo} (x${mult})`);
      return;
    }

    if (mult < 1) {
      resistentes.push(`${tipo} (x${mult})`);
    }
  });

  return { fracos, resistentes, imunes };
}

function pontuacaoPokemon(pokemon) {
  return pokemon.totalStats + pokemon.baseExperience;
}

async function buscarPokemonCompleto(nomeDigitado) {
  if (!nomeDigitado || !nomeDigitado.trim()) {
    throw new Error("Nome vazio");
  }

  const nome = normalizarNome(nomeDigitado);
  const pokemonData = await fetchJson(
    `https://pokeapi.co/api/v2/pokemon/${nome}`,
    "Pokemon nao encontrado"
  );

  const [speciesData, typeDetails] = await Promise.all([
    fetchJson(pokemonData.species.url, "Erro ao buscar especie"),
    Promise.all(
      pokemonData.types.map((item) =>
        fetchJson(item.type.url, "Erro ao buscar tipos")
      )
    ),
  ]);

  const evolutionData = await fetchJson(
    speciesData.evolution_chain.url,
    "Erro ao buscar evolucao"
  );

  const stats = pokemonData.stats.map((item) => ({
    nome: item.stat.name,
    valor: item.base_stat,
  }));

  const totalStats = stats.reduce((acc, item) => acc + item.valor, 0);

  const habilidades = pokemonData.abilities.map((item) =>
    item.is_hidden
      ? `${item.ability.name} (oculta)`
      : item.ability.name
  );

  const relacoesDano = calcularRelacoesDano(typeDetails);
  const evolucoes = extrairNomesEvolucao(evolutionData.chain).map(capitalizar);

  return {
    id: pokemonData.id,
    nome: capitalizar(pokemonData.name),
    sprite:
      pokemonData.sprites.other["official-artwork"].front_default ||
      pokemonData.sprites.front_default,
    spriteFrente: pokemonData.sprites.front_default,
    spriteCostas: pokemonData.sprites.back_default,
    tipos: pokemonData.types.map((item) => capitalizar(item.type.name)),
    alturaM: (pokemonData.height / 10).toFixed(1),
    pesoKg: (pokemonData.weight / 10).toFixed(1),
    baseExperience: pokemonData.base_experience || 0,
    stats,
    totalStats,
    habilidades: habilidades.map(capitalizar),
    moves: pokemonData.moves
      .slice(0, 6)
      .map((item) => capitalizar(item.move.name)),
    descricao: obterDescricao(speciesData),
    taxaCaptura: speciesData.capture_rate,
    felicidadeBase: speciesData.base_happiness,
    habitat: speciesData.habitat ? capitalizar(speciesData.habitat.name) : "N/A",
    crescimento: capitalizar(speciesData.growth_rate.name),
    geracao: capitalizar(speciesData.generation.name),
    evolucoes,
    fraquezas: relacoesDano.fracos.map(capitalizar),
    resistencias: relacoesDano.resistentes.map(capitalizar),
    imunidades: relacoesDano.imunes.map(capitalizar),
  };
}

function renderListaRotulo(titulo, itens) {
  const valor = itens.length ? itens.join(", ") : "N/A";
  return `<p class="pokemon-meta"><strong>${titulo}:</strong> ${valor}</p>`;
}

function renderBlocoStats(stats) {
  const maiorBaseStat = 255;

  return `
    <ul class="pokemon-stats">
      ${stats
        .map(
          (item) =>
            `<li>
              <div class="pokemon-stats__row">
                <span>${capitalizar(item.nome)}</span>
                <strong>${item.valor}</strong>
              </div>
              <div class="pokemon-stats__bar">
                <i style="width:${Math.min(
                  (item.valor / maiorBaseStat) * 100,
                  100
                ).toFixed(1)}%"></i>
              </div>
            </li>`
        )
        .join("")}
    </ul>
  `;
}

function renderChips(itens, variante = "") {
  if (!itens.length) {
    return `<span class="chip chip--vazio">N/A</span>`;
  }

  return itens
    .map((item) => `<span class="chip ${variante}">${item}</span>`)
    .join("");
}

function criarCardPokemon(pokemon, mostrarPontuacao = false) {
  return `
    <article class="pokemon-card pokemon-card--completo">
      <header class="pokemon-card__topo">
        <h3>#${pokemon.id} ${pokemon.nome}</h3>
        <span class="pokemon-score">BST ${pokemon.totalStats}</span>
      </header>

      <div class="pokemon-card__hero">
        <img src="${pokemon.sprite}" alt="${pokemon.nome}" />
        <div class="pokemon-card__hero-info">
          <div class="pokemon-chip-group">
            ${renderChips(pokemon.tipos, "chip--tipo")}
          </div>
          <p class="pokemon-meta"><strong>Altura:</strong> ${pokemon.alturaM} m</p>
          <p class="pokemon-meta"><strong>Peso:</strong> ${pokemon.pesoKg} kg</p>
          <p class="pokemon-meta"><strong>Base EXP:</strong> ${pokemon.baseExperience}</p>
          ${mostrarPontuacao ? `<p class="pokemon-meta pokemon-meta--pontos"><strong>Pontos:</strong> ${pontuacaoPokemon(pokemon)}</p>` : ""}
        </div>
      </div>

      <section class="pokemon-panel">
        <h4>Atributos</h4>
        ${renderBlocoStats(pokemon.stats)}
      </section>

      <section class="pokemon-panel">
        <h4>Talentos e Moves</h4>
        <div class="pokemon-chip-group">${renderChips(pokemon.habilidades, "chip--skill")}</div>
        <div class="pokemon-chip-group">${renderChips(pokemon.moves, "chip--move")}</div>
      </section>

      <section class="pokemon-panel">
        <h4>Combate</h4>
        <p class="pokemon-panel__label">Fraquezas</p>
        <div class="pokemon-chip-group">${renderChips(pokemon.fraquezas, "chip--fraqueza")}</div>
        <p class="pokemon-panel__label">Resistencias</p>
        <div class="pokemon-chip-group">${renderChips(pokemon.resistencias, "chip--resistencia")}</div>
        <p class="pokemon-panel__label">Imunidades</p>
        <div class="pokemon-chip-group">${renderChips(pokemon.imunidades, "chip--imune")}</div>
      </section>

      <section class="pokemon-panel">
        <h4>Bio</h4>
        ${renderListaRotulo("Habitat", [pokemon.habitat])}
        ${renderListaRotulo("Crescimento", [pokemon.crescimento])}
        ${renderListaRotulo("Captura", [String(pokemon.taxaCaptura)])}
        ${renderListaRotulo("Felicidade base", [String(pokemon.felicidadeBase)])}
        ${renderListaRotulo("Geracao", [pokemon.geracao])}
        ${renderListaRotulo("Linha evolutiva", pokemon.evolucoes)}
        <p class="pokemon-descricao">${pokemon.descricao}</p>
      </section>
    </article>
  `;
}

function renderGrupoCards(resultadoEl, pokemons) {
  resultadoEl.innerHTML = `
    <div class="pokemon-cards pokemon-cards--detalhado">
      ${pokemons.map((pokemon) => criarCardPokemon(pokemon)).join("")}
    </div>
  `;
}

function criarCardBatalha(pokemon, lado, indice) {
  const score = pontuacaoPokemon(pokemon);
  const usaSpriteCostas = lado === "j1" && pokemon.spriteCostas;
  const spriteBatalha = usaSpriteCostas
    ? pokemon.spriteCostas
    : pokemon.spriteFrente || pokemon.sprite;

  return `
    <article class="pokemon-card pokemon-card--batalha pokemon-card--${lado}" style="--entrada-delay:${indice * 120}ms">
      <header class="pokemon-card__topo">
        <h3>#${pokemon.id} ${pokemon.nome}</h3>
        <span class="pokemon-score">PWR ${score}</span>
      </header>

      <div class="pokemon-card__hero pokemon-card__hero--batalha">
        <img
          class="pokemon-battle-sprite ${!usaSpriteCostas && lado === "j1" ? "pokemon-battle-sprite--flip" : ""}"
          src="${spriteBatalha}"
          alt="${pokemon.nome}"
        />
        <div class="pokemon-card__hero-info">
          <div class="pokemon-chip-group">
            ${renderChips(pokemon.tipos, "chip--tipo")}
          </div>
          <p class="pokemon-meta"><strong>BST:</strong> ${pokemon.totalStats}</p>
          <p class="pokemon-meta"><strong>EXP:</strong> ${pokemon.baseExperience}</p>
          <p class="pokemon-meta"><strong>Fraq:</strong> ${pokemon.fraquezas.slice(0, 2).join(", ") || "N/A"}</p>
        </div>
      </div>
    </article>
  `;
}

function criarSkeletonCard() {
  return `
    <article class="pokemon-card pokemon-card--completo pokemon-card--skeleton">
      <div class="skeleton skeleton--titulo"></div>
      <div class="skeleton-card__hero">
        <div class="skeleton skeleton--sprite"></div>
        <div class="skeleton-card__meta">
          <div class="skeleton skeleton--linha"></div>
          <div class="skeleton skeleton--linha"></div>
          <div class="skeleton skeleton--linha skeleton--linha-curta"></div>
        </div>
      </div>
      <div class="skeleton-panel">
        <div class="skeleton skeleton--linha"></div>
        <div class="skeleton skeleton--linha"></div>
        <div class="skeleton skeleton--linha"></div>
      </div>
      <div class="skeleton-panel">
        <div class="skeleton skeleton--linha"></div>
        <div class="skeleton skeleton--linha skeleton--linha-curta"></div>
      </div>
    </article>
  `;
}

function renderSkeletonCards(resultadoEl, quantidade = 2) {
  const itens = Array.from({ length: quantidade }, () => criarSkeletonCard()).join("");
  resultadoEl.innerHTML = `
    <div class="pokemon-cards pokemon-cards--detalhado">
      ${itens}
    </div>
  `;
}

function atualizarBotaoBatalhar() {
  const pronto =
    estado.j1.length === 2 &&
    estado.j2.length === 2;
  btnBatalhar.style.display = pronto ? "inline-block" : "none";
}

async function buscarDupla(n1, n2) {
  return Promise.all([
    buscarPokemonCompleto(n1),
    buscarPokemonCompleto(n2),
  ]);
}

async function tratarSubmitJogador(config) {
  const { event, idsInputs, erroEl, resultadoEl, chaveEstado } = config;
  event.preventDefault();

  erroEl.textContent = "";
  renderSkeletonCards(resultadoEl, 2);

  const nome1 = document.getElementById(idsInputs[0]).value;
  const nome2 = document.getElementById(idsInputs[1]).value;

  try {
    const dupla = await buscarDupla(nome1, nome2);
    estado[chaveEstado] = dupla;
    renderGrupoCards(resultadoEl, dupla);
    atualizarBotaoBatalhar();
  } catch (error) {
    estado[chaveEstado] = [];
    resultadoEl.textContent = "";
    erroEl.textContent =
      error.message === "Nome vazio"
        ? "Digite os dois nomes."
        : "Nao foi possivel buscar um ou mais Pokemon. Verifique os nomes.";
    atualizarBotaoBatalhar();
  }
}

formJ1.addEventListener("submit", async (event) => {
  await tratarSubmitJogador({
    event,
    idsInputs: ["j1-pokemon1", "j1-pokemon2"],
    erroEl: erroJ1,
    resultadoEl: resultadoJ1,
    chaveEstado: "j1",
  });
});

formJ2.addEventListener("submit", async (event) => {
  await tratarSubmitJogador({
    event,
    idsInputs: ["j2-pokemon1", "j2-pokemon2"],
    erroEl: erroJ2,
    resultadoEl: resultadoJ2,
    chaveEstado: "j2",
  });
});

function renderAreaBatalha() {
  if (estado.j1.length !== 2 || estado.j2.length !== 2) {
    return;
  }

  pokemonJ1A.innerHTML = criarCardBatalha(estado.j1[0], "j1", 0);
  pokemonJ1B.innerHTML = criarCardBatalha(estado.j1[1], "j1", 1);
  pokemonJ2A.innerHTML = criarCardBatalha(estado.j2[0], "j2", 0);
  pokemonJ2B.innerHTML = criarCardBatalha(estado.j2[1], "j2", 1);

  iniciarEfeitoBatalha();
}

function iniciarEfeitoBatalha() {
  let fx = document.getElementById("battle-fx");

  if (!fx) {
    fx = document.createElement("div");
    fx.id = "battle-fx";
    telaBatalha.appendChild(fx);
  }

  fx.textContent = "BATTLE START";
  fx.classList.remove("battle-fx--run");
  telaBatalha.classList.remove("batalha-ativa");

  void fx.offsetWidth;
  fx.classList.add("battle-fx--run");
  telaBatalha.classList.add("batalha-ativa");

  setTimeout(() => {
    telaBatalha.classList.remove("batalha-ativa");
  }, 1600);
}

function calcularPontosEquipe(equipe) {
  return equipe.reduce((acc, pokemon) => acc + pontuacaoPokemon(pokemon), 0);
}

function mostrarResultado() {
  const pontosJ1 = calcularPontosEquipe(estado.j1);
  const pontosJ2 = calcularPontosEquipe(estado.j2);

  pontosJ1El.textContent = pontosJ1;
  pontosJ2El.textContent = pontosJ2;

  if (pontosJ1 > pontosJ2) {
    mensagemResultadoEl.textContent = "Jogador 1 venceu!";
    return "j1";
  }

  if (pontosJ2 > pontosJ1) {
    mensagemResultadoEl.textContent = "Jogador 2 venceu!";
    return "j2";
  }

  mensagemResultadoEl.textContent = "Empate!";
  return "empate";
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function garantirOverlayAtaque() {
  let overlay = document.getElementById("battle-attack-fx");
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "battle-attack-fx";
  overlay.innerHTML = `
    <div class="battle-attack-fx__title">COMBAT PHASE</div>
    <div class="battle-attack-fx__log"></div>
  `;
  telaBatalha.appendChild(overlay);
  return overlay;
}

function obterCardsBatalha() {
  return {
    j1: Array.from(telaBatalha.querySelectorAll(".pokemon-card--j1")),
    j2: Array.from(telaBatalha.querySelectorAll(".pokemon-card--j2")),
  };
}

function aplicarAnimacaoGolpe(atacanteEl, defensorEl) {
  if (!atacanteEl || !defensorEl) {
    return;
  }

  atacanteEl.classList.remove("pokemon-card--atacando");
  defensorEl.classList.remove("pokemon-card--atingido");
  void atacanteEl.offsetWidth;

  atacanteEl.classList.add("pokemon-card--atacando");
  defensorEl.classList.add("pokemon-card--atingido");

  setTimeout(() => atacanteEl.classList.remove("pokemon-card--atacando"), 320);
  setTimeout(() => defensorEl.classList.remove("pokemon-card--atingido"), 380);
}

function mostrarTelaResultado() {
  const telas = {
    inicio: document.getElementById("tela-inicio"),
    selecao: document.getElementById("tela-selecao"),
    batalha: document.getElementById("tela-batalha"),
    resultado: document.getElementById("tela-resultado"),
  };

  Object.values(telas).forEach((tela) => {
    tela.style.display = "none";
  });

  telas.resultado.style.display = "block";
}

function destacarResultado(vencedor){
  telaResultado.classList.remove(
    "resultado--vitoria-j1",
    "resultado--vitoria-j2",
    "resultado--empate",
    "resultado--show"
  );

  if (vencedor === "j1") {
    telaResultado.classList.add("resultado--vitoria-j1");
  } else if (vencedor === "j2") {
    telaResultado.classList.add("resultado--vitoria-j2");
  } else {
    telaResultado.classList.add("resultado--empate");
  }

  void telaResultado.offsetWidth;
  telaResultado.classList.add("resultado--show");
}

async function simularAtaquesPorCincoSegundos() {
  const duracao = 5000;
  const overlay = garantirOverlayAtaque();
  const logEl = overlay.querySelector(".battle-attack-fx__log");
  const cards = obterCardsBatalha();
  const inicio = Date.now();

  overlay.classList.add("battle-attack-fx--ativo");
  telaBatalha.classList.add("batalha-em-acao");

  let turno = 0;
  while (Date.now() - inicio < duracao) {
    const j1Ataca = turno % 2 === 0;
    const atacantes = j1Ataca ? cards.j1 : cards.j2;
    const defensores = j1Ataca ? cards.j2 : cards.j1;

    const atacante = atacantes[turno % atacantes.length];
    const defensor = defensores[turno % defensores.length];

    aplicarAnimacaoGolpe(atacante, defensor);
    logEl.textContent = j1Ataca
      ? "JOGADOR 1 ataca com impacto critico!"
      : "JOGADOR 2 contra-ataca em alta velocidade!";

    turno += 1;
    const restante = duracao - (Date.now() - inicio);
    await esperar(Math.max(0, Math.min(620, restante)));
  }

  overlay.classList.remove("battle-attack-fx--ativo");
  telaBatalha.classList.remove("batalha-em-acao");
}

async function executarFechamentoBatalha(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (batalhaEmExecucao || estado.j1.length !== 2 || estado.j2.length !== 2) {
    return;
  }

  batalhaEmExecucao = true;
  btnCalcular.disabled = true;

  await simularAtaquesPorCincoSegundos();

  const vencedor = mostrarResultado();
  mostrarTelaResultado();
  destacarResultado(vencedor);

  btnCalcular.disabled = false;
  batalhaEmExecucao = false;
}

btnBatalhar.addEventListener("click", renderAreaBatalha);
btnCalcular.addEventListener("click", executarFechamentoBatalha, true);

// ================================
// Efeito visual simples
// ================================

function aplicarEfeitoBotao() {
  btnCalcular.style.backgroundColor = "#ffcb05";
  btnCalcular.style.color = "#000";
  btnCalcular.style.transform = "scale(1.05)";
  btnCalcular.style.transition = "0.3s ease";

  setTimeout(() => {
    btnCalcular.style.backgroundColor = "";
    btnCalcular.style.color = "";
    btnCalcular.style.transform = "";
  }, 1000);
}

btnCalcular.addEventListener("click", aplicarEfeitoBotao);
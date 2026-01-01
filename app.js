const state = {
  currentView: "config",
  gameConfig: {
    jugadoresTotales: 6,
    numeroIA: 3,
    stackInicial: 1500,
    smallBlind: 10,
    bigBlind: 20,
  },
  gameState: null,
};

const app = document.getElementById("app");

const numericFields = {
  jugadoresTotales: {
    label: "Jugadores totales (2-9)",
    min: 2,
    max: 9,
  },
  numeroIA: {
    label: "Número de IA",
    min: 0,
  },
  stackInicial: {
    label: "Stack inicial",
    min: 1,
  },
  smallBlind: {
    label: "Small blind",
    min: 1,
  },
  bigBlind: {
    label: "Big blind",
    min: 1,
  },
};

const suits = ["♠", "♥", "♦", "♣"];
const ranks = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

const getRandomInt = (max) => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
};

const shuffleDeck = (deck) => {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = getRandomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const createDeck = () => {
  const deck = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push({
        suit,
        rank,
        id: `${rank}-${suit}`,
      });
    });
  });
  return deck;
};

const dealCard = (deck) => deck.shift();

const dealInitialHands = (deck, players) => {
  for (let round = 0; round < 2; round += 1) {
    players.forEach((player) => {
      player.hand.push(dealCard(deck));
    });
  }
};

const dealCommunityCards = (deck, count) => {
  const cards = [];
  for (let i = 0; i < count; i += 1) {
    cards.push(dealCard(deck));
  }
  return cards;
};

const collectCardsInPlay = (gameState) => {
  const cards = [];
  gameState.players.forEach((player) => {
    cards.push(...player.hand);
  });
  cards.push(...gameState.comunitarias);
  return cards.filter(Boolean);
};

const verifyUniqueCards = (gameState) => {
  const ids = collectCardsInPlay(gameState).map((card) => card.id);
  const unique = new Set(ids);
  return unique.size === ids.length;
};

const createPlayers = (config) => {
  const players = [];
  const total = config.jugadoresTotales;
  const humanCount = total - config.numeroIA;

  for (let i = 0; i < total; i += 1) {
    players.push({
      id: i + 1,
      nombre: i < humanCount ? `Jugador ${i + 1}` : `IA ${i + 1 - humanCount}`,
      esHumano: i < humanCount,
      stack: config.stackInicial,
      mano: [],
      apuestaActual: 0,
      estado: "activo",
    });
  }

  return players;
};

const createGameState = (config) => {
  const players = createPlayers(config);
  const deck = shuffleDeck(createDeck());
  dealInitialHands(deck, players);

  const gameState = {
    players,
    comunitarias: [],
    bote: 0,
    ciegas: {
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
    },
    dealerIndex: 0,
    turnoIndex: 0,
    fase: "preflop",
    deck,
    error: null,
    blocked: false,
  };

  if (!verifyUniqueCards(gameState)) {
    gameState.error =
      "Se detectaron cartas duplicadas. La mano quedó bloqueada.";
    gameState.blocked = true;
  }

  return gameState;
};

const advancePhase = () => {
  if (!state.gameState || state.gameState.blocked) {
    return;
  }

  const { fase, deck } = state.gameState;

  if (fase === "preflop") {
    state.gameState.comunitarias.push(...dealCommunityCards(deck, 3));
    state.gameState.fase = "flop";
  } else if (fase === "flop") {
    state.gameState.comunitarias.push(...dealCommunityCards(deck, 1));
    state.gameState.fase = "turn";
  } else if (fase === "turn") {
    state.gameState.comunitarias.push(...dealCommunityCards(deck, 1));
    state.gameState.fase = "river";
  } else if (fase === "river") {
    state.gameState.fase = "showdown";
  }

  if (!verifyUniqueCards(state.gameState)) {
    state.gameState.error =
      "Se detectaron cartas duplicadas. La mano quedó bloqueada.";
    state.gameState.blocked = true;
  }
};

const createField = (key, value) => {
  const wrapper = document.createElement("div");
  wrapper.className = "field";

  const label = document.createElement("label");
  label.htmlFor = key;
  label.textContent = numericFields[key].label;

  const input = document.createElement("input");
  input.type = "number";
  input.id = key;
  input.name = key;
  input.value = value;
  if (numericFields[key].min !== undefined) {
    input.min = numericFields[key].min;
  }
  if (numericFields[key].max !== undefined) {
    input.max = numericFields[key].max;
  }

  wrapper.append(label, input);
  return wrapper;
};

const renderConfigView = () => {
  app.innerHTML = "";

  const container = document.createElement("section");
  container.className = "view";

  const title = document.createElement("h1");
  title.textContent = "Configurar mesa";

  const formGrid = document.createElement("div");
  formGrid.className = "form-grid";

  Object.entries(state.gameConfig).forEach(([key, value]) => {
    formGrid.appendChild(createField(key, value));
  });

  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.hidden = true;

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.textContent = "Crear mesa";
  createButton.addEventListener("click", () => {
    const nextConfig = {};
    let errorText = "";

    Object.keys(state.gameConfig).forEach((key) => {
      const input = container.querySelector(`#${key}`);
      nextConfig[key] = Number(input.value);
    });

    Object.entries(nextConfig).some(([key, value]) => {
      if (Number.isNaN(value) || value <= 0) {
        errorText = "Todos los valores deben ser numéricos y mayores que 0.";
        return true;
      }

      const { min, max } = numericFields[key];
      if (min !== undefined && value < min) {
        errorText = `El valor de ${numericFields[key].label} debe ser al menos ${min}.`;
        return true;
      }

      if (max !== undefined && value > max) {
        errorText = `El valor de ${numericFields[key].label} no puede superar ${max}.`;
        return true;
      }

      return false;
    });

    if (!errorText) {
      const maxIA = nextConfig.jugadoresTotales - 1;
      if (nextConfig.numeroIA > maxIA) {
        errorText = "El número de IA debe ser menor o igual a jugadores totales menos uno.";
      }
    }

    if (!errorText && nextConfig.smallBlind >= nextConfig.bigBlind) {
      errorText = "El small blind debe ser menor que el big blind.";
    }

    if (errorText) {
      errorMessage.textContent = errorText;
      errorMessage.hidden = false;
      return;
    }

    errorMessage.hidden = true;
    state.gameConfig = nextConfig;
    state.gameState = createGameState(nextConfig);
    state.currentView = "table";
    renderTableView();
  });

  buttonRow.appendChild(createButton);
  container.append(title, formGrid, errorMessage, buttonRow);
  app.appendChild(container);
};

const renderTableView = () => {
  app.innerHTML = "";

  const container = document.createElement("section");
  container.className = "view";

  const title = document.createElement("h1");
  title.textContent = "Mesa creada";

  const placeholder = document.createElement("div");
  placeholder.className = "placeholder";
  placeholder.innerHTML = `
    <p>FASE 1 en progreso.</p>
    <p>La lógica de juego se agregará en el siguiente paso.</p>
  `;

  const infoList = document.createElement("div");
  infoList.className = "placeholder";

  if (state.gameState) {
    infoList.innerHTML = `
      <p>Fase actual: <strong>${state.gameState.fase}</strong></p>
      <p>Jugadores en mesa: <strong>${state.gameState.players.length}</strong></p>
      <p>Cartas comunitarias: <strong>${state.gameState.comunitarias.length}</strong></p>
    `;
  }

  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent =
    state.gameState?.error || "Sin errores en el reparto.";

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const advanceButton = document.createElement("button");
  advanceButton.type = "button";
  advanceButton.textContent = "Avanzar fase";
  advanceButton.addEventListener("click", () => {
    advancePhase();
    renderTableView();
  });

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "secondary";
  resetButton.textContent = "Nueva mesa";
  resetButton.addEventListener("click", () => {
    state.currentView = "config";
    renderConfigView();
  });

  if (state.gameState?.blocked) {
    advanceButton.disabled = true;
  }

  buttonRow.append(advanceButton, resetButton);
  container.append(title, placeholder, infoList, errorMessage, buttonRow);
  app.appendChild(container);
};

const renderApp = () => {
  if (state.currentView === "table") {
    renderTableView();
    return;
  }

  renderConfigView();
};

renderApp();

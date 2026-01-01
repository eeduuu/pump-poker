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

const ACTIONS = {
  FOLD: "fold",
  CHECK: "check",
  CALL: "call",
  BET: "bet",
  RAISE: "raise",
  ALL_IN: "all-in",
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

const rankValues = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

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

const getCardLabel = (card) => `${card.rank}${card.suit}`;

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
      hand: [],
      apuestaActual: 0,
      estado: "activo",
    });
  }

  return players;
};

const getActivePlayers = (gameState) =>
  gameState.players.filter((player) => player.estado !== "foldeado");

const getEligiblePlayers = (gameState) =>
  getActivePlayers(gameState).filter((player) => player.stack > 0);

const getNextIndex = (players, startIndex, predicate) => {
  for (let i = 1; i <= players.length; i += 1) {
    const index = (startIndex + i) % players.length;
    if (predicate(players[index])) {
      return index;
    }
  }
  return -1;
};

const updateUniqueness = (gameState) => {
  if (!verifyUniqueCards(gameState)) {
    gameState.error =
      "Se detectaron cartas duplicadas. La mano quedó bloqueada.";
    gameState.blocked = true;
  }
};

const postBlind = (player, amount) => {
  const blind = Math.min(player.stack, amount);
  player.stack -= blind;
  player.apuestaActual += blind;
  if (player.stack === 0) {
    player.estado = "all-in";
  }
};

const getBlindIndexes = (gameState) => {
  const { players, dealerIndex } = gameState;
  if (players.length === 2) {
    const smallBlindIndex = dealerIndex;
    const bigBlindIndex = (dealerIndex + 1) % players.length;
    return { smallBlindIndex, bigBlindIndex };
  }

  const smallBlindIndex = (dealerIndex + 1) % players.length;
  const bigBlindIndex = (dealerIndex + 2) % players.length;
  return { smallBlindIndex, bigBlindIndex };
};

const initializePendingActions = (gameState, excludeId = null) => {
  const pending = getEligiblePlayers(gameState)
    .filter((player) => player.id !== excludeId)
    .map((player) => player.id);
  gameState.pendingActionIds = pending;
};

const setNextTurn = (gameState) => {
  if (gameState.pendingActionIds.length === 0) {
    gameState.turnoIndex = -1;
    return;
  }
  const nextIndex = getNextIndex(
    gameState.players,
    gameState.turnoIndex,
    (player) =>
      gameState.pendingActionIds.includes(player.id) &&
      player.estado !== "foldeado" &&
      player.stack > 0
  );
  gameState.turnoIndex = nextIndex;
};

const startBettingRound = (gameState, startingIndex) => {
  initializePendingActions(gameState);
  gameState.turnoIndex = startingIndex;
};

const settleBetsToPot = (gameState) => {
  const total = gameState.players.reduce(
    (sum, player) => sum + player.apuestaActual,
    0
  );
  gameState.bote += total;
  gameState.players.forEach((player) => {
    player.apuestaActual = 0;
  });
  gameState.currentBet = 0;
};

const isHandOver = (gameState) => gameState.handOver || gameState.blocked;

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
    currentBet: 0,
    minRaise: config.bigBlind,
    pendingActionIds: [],
    error: null,
    blocked: false,
    handOver: false,
    winnerIds: [],
  };

  const { smallBlindIndex, bigBlindIndex } = getBlindIndexes(gameState);
  postBlind(players[smallBlindIndex], config.smallBlind);
  postBlind(players[bigBlindIndex], config.bigBlind);

  gameState.currentBet = Math.max(
    players[smallBlindIndex].apuestaActual,
    players[bigBlindIndex].apuestaActual
  );

  const firstToAct =
    players.length === 2 ? smallBlindIndex : (bigBlindIndex + 1) % players.length;
  startBettingRound(gameState, firstToAct);

  updateUniqueness(gameState);
  return gameState;
};

const dealStreet = (gameState) => {
  if (gameState.fase === "preflop") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 3));
    gameState.fase = "flop";
  } else if (gameState.fase === "flop") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 1));
    gameState.fase = "turn";
  } else if (gameState.fase === "turn") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 1));
    gameState.fase = "river";
  } else if (gameState.fase === "river") {
    gameState.fase = "showdown";
  }

  updateUniqueness(gameState);
};

const allActiveAllIn = (gameState) =>
  getActivePlayers(gameState).every((player) => player.stack === 0);

const hasSingleActivePlayer = (gameState) =>
  getActivePlayers(gameState).length === 1;

const finalizeWinnerByFold = (gameState) => {
  const [winner] = getActivePlayers(gameState);
  if (!winner) {
    return;
  }
  settleBetsToPot(gameState);
  winner.stack += gameState.bote;
  gameState.winnerIds = [winner.id];
  gameState.bote = 0;
  gameState.handOver = true;
  gameState.fase = "showdown";
};

const getStraightHigh = (values) => {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  if (unique.length < 5) {
    return null;
  }
  for (let i = 0; i <= unique.length - 5; i += 1) {
    const slice = unique.slice(i, i + 5);
    if (slice[0] - slice[4] === 4) {
      return slice[0];
    }
  }
  if (unique.includes(14) && unique.includes(5)) {
    const wheel = [5, 4, 3, 2, 1];
    const hasWheel = [5, 4, 3, 2, 14].every((value) => unique.includes(value));
    if (hasWheel) {
      return 5;
    }
  }
  return null;
};

const evaluateFiveCards = (cards) => {
  const values = cards.map((card) => rankValues[card.rank]).sort((a, b) => b - a);
  const suitsList = cards.map((card) => card.suit);
  const isFlush = suitsList.every((suit) => suit === suitsList[0]);
  const straightHigh = getStraightHigh(values);

  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const groups = Object.entries(counts)
    .map(([value, count]) => ({ value: Number(value), count }))
    .sort((a, b) => b.count - a.count || b.value - a.value);

  if (isFlush && straightHigh) {
    return { rank: 8, tiebreak: [straightHigh] };
  }

  if (groups[0].count === 4) {
    const kicker = groups.find((group) => group.count === 1).value;
    return { rank: 7, tiebreak: [groups[0].value, kicker] };
  }

  if (groups[0].count === 3 && groups[1].count === 2) {
    return { rank: 6, tiebreak: [groups[0].value, groups[1].value] };
  }

  if (isFlush) {
    return { rank: 5, tiebreak: values };
  }

  if (straightHigh) {
    return { rank: 4, tiebreak: [straightHigh] };
  }

  if (groups[0].count === 3) {
    const kickers = groups.filter((group) => group.count === 1).map((g) => g.value);
    return { rank: 3, tiebreak: [groups[0].value, ...kickers] };
  }

  if (groups[0].count === 2 && groups[1].count === 2) {
    const highPair = Math.max(groups[0].value, groups[1].value);
    const lowPair = Math.min(groups[0].value, groups[1].value);
    const kicker = groups.find((group) => group.count === 1).value;
    return { rank: 2, tiebreak: [highPair, lowPair, kicker] };
  }

  if (groups[0].count === 2) {
    const kickers = groups.filter((group) => group.count === 1).map((g) => g.value);
    return { rank: 1, tiebreak: [groups[0].value, ...kickers] };
  }

  return { rank: 0, tiebreak: values };
};

const combinations = (cards, choose) => {
  const result = [];
  const recurse = (start, picked) => {
    if (picked.length === choose) {
      result.push(picked);
      return;
    }
    for (let i = start; i < cards.length; i += 1) {
      recurse(i + 1, [...picked, cards[i]]);
    }
  };
  recurse(0, []);
  return result;
};

const compareHands = (handA, handB) => {
  if (handA.rank !== handB.rank) {
    return handA.rank - handB.rank;
  }
  for (let i = 0; i < handA.tiebreak.length; i += 1) {
    if (handA.tiebreak[i] !== handB.tiebreak[i]) {
      return handA.tiebreak[i] - handB.tiebreak[i];
    }
  }
  return 0;
};

const evaluateSevenCards = (cards) => {
  const hands = combinations(cards, 5).map(evaluateFiveCards);
  return hands.reduce((best, current) =>
    compareHands(best, current) < 0 ? current : best
  );
};

const resolveShowdown = (gameState) => {
  settleBetsToPot(gameState);
  const activePlayers = getActivePlayers(gameState);
  const scores = activePlayers.map((player) => ({
    player,
    score: evaluateSevenCards([...player.hand, ...gameState.comunitarias]),
  }));

  scores.sort((a, b) => compareHands(b.score, a.score));
  const bestScore = scores[0].score;
  const winners = scores
    .filter((entry) => compareHands(entry.score, bestScore) === 0)
    .map((entry) => entry.player);

  const prize = Math.floor(gameState.bote / winners.length);
  const remainder = gameState.bote - prize * winners.length;
  winners.forEach((winner, index) => {
    winner.stack += prize + (index === 0 ? remainder : 0);
  });

  gameState.winnerIds = winners.map((winner) => winner.id);
  gameState.bote = 0;
  gameState.handOver = true;
};

const autoRunout = (gameState) => {
  while (gameState.fase !== "showdown") {
    dealStreet(gameState);
  }
  resolveShowdown(gameState);
};

const startNextStreet = (gameState) => {
  const { dealerIndex, players } = gameState;
  if (players.length === 2) {
    gameState.turnoIndex = (dealerIndex + 1) % players.length;
  } else {
    gameState.turnoIndex = (dealerIndex + 1) % players.length;
  }
  initializePendingActions(gameState);
};

const completeBettingRound = (gameState) => {
  if (hasSingleActivePlayer(gameState)) {
    finalizeWinnerByFold(gameState);
    return;
  }

  if (allActiveAllIn(gameState)) {
    autoRunout(gameState);
    return;
  }

  if (gameState.fase === "river") {
    resolveShowdown(gameState);
    return;
  }

  settleBetsToPot(gameState);
  dealStreet(gameState);
  startNextStreet(gameState);
};

const commitBet = (gameState, player, targetAmount) => {
  const toPut = targetAmount - player.apuestaActual;
  const amount = Math.min(toPut, player.stack);
  player.stack -= amount;
  player.apuestaActual += amount;
  if (player.stack === 0) {
    player.estado = "all-in";
  }

  const previousBet = gameState.currentBet;
  if (player.apuestaActual > gameState.currentBet) {
    gameState.currentBet = player.apuestaActual;
    const raiseAmount = player.apuestaActual - previousBet;
    if (raiseAmount > gameState.minRaise) {
      gameState.minRaise = raiseAmount;
    }
    initializePendingActions(gameState, player.id);
  } else {
    gameState.pendingActionIds = gameState.pendingActionIds.filter(
      (id) => id !== player.id
    );
  }
};

const handleAction = (action, amount = 0) => {
  const gameState = state.gameState;
  if (!gameState || isHandOver(gameState)) {
    return;
  }

  const player = gameState.players[gameState.turnoIndex];
  if (!player || player.estado !== "activo") {
    return;
  }

  const callAmount = gameState.currentBet - player.apuestaActual;
  gameState.error = null;

  if (action === ACTIONS.FOLD) {
    player.estado = "foldeado";
    gameState.pendingActionIds = gameState.pendingActionIds.filter(
      (id) => id !== player.id
    );
  } else if (action === ACTIONS.CHECK) {
    if (callAmount !== 0) {
      gameState.error = "No puedes hacer check con apuesta pendiente.";
      return;
    }
    gameState.pendingActionIds = gameState.pendingActionIds.filter(
      (id) => id !== player.id
    );
  } else if (action === ACTIONS.CALL) {
    if (callAmount <= 0) {
      gameState.error = "No hay apuesta para igualar.";
      return;
    }
    commitBet(gameState, player, gameState.currentBet);
  } else if (action === ACTIONS.BET) {
    if (gameState.currentBet > 0) {
      gameState.error = "Ya hay apuesta, debes subir o igualar.";
      return;
    }
    if (amount < gameState.minRaise) {
      gameState.error = `La apuesta mínima es ${gameState.minRaise}.`;
      return;
    }
    commitBet(gameState, player, amount);
  } else if (action === ACTIONS.RAISE) {
    if (gameState.currentBet === 0) {
      gameState.error = "Debes apostar antes de subir.";
      return;
    }
    const minTotal = gameState.currentBet + gameState.minRaise;
    if (amount < minTotal && amount < player.apuestaActual + player.stack) {
      gameState.error = `La subida mínima es a ${minTotal}.`;
      return;
    }
    commitBet(gameState, player, amount);
  } else if (action === ACTIONS.ALL_IN) {
    commitBet(gameState, player, player.apuestaActual + player.stack);
  }

  updateUniqueness(gameState);
  if (gameState.blocked) {
    return;
  }

  if (gameState.pendingActionIds.length === 0) {
    completeBettingRound(gameState);
    return;
  }

  setNextTurn(gameState);
};

const autoActionForPlayer = () => {
  const gameState = state.gameState;
  const player = gameState.players[gameState.turnoIndex];
  if (!player || player.esHumano || player.estado !== "activo") {
    return false;
  }

  const callAmount = gameState.currentBet - player.apuestaActual;
  if (callAmount <= 0) {
    handleAction(ACTIONS.CHECK);
    return true;
  }

  if (callAmount >= player.stack) {
    handleAction(ACTIONS.ALL_IN);
    return true;
  }

  handleAction(ACTIONS.CALL);
  return true;
};

const runAutoActions = () => {
  const gameState = state.gameState;
  if (!gameState || isHandOver(gameState)) {
    return;
  }

  let guard = 0;
  while (
    gameState.turnoIndex !== -1 &&
    guard < 25 &&
    autoActionForPlayer()
  ) {
    guard += 1;
    if (isHandOver(gameState)) {
      break;
    }
  }
};

const startNewHand = () => {
  if (!state.gameConfig) {
    return;
  }
  state.gameState = createGameState(state.gameConfig);
  runAutoActions();
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
        errorText =
          "El número de IA debe ser menor o igual a jugadores totales menos uno.";
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
    runAutoActions();
    renderTableView();
  });

  buttonRow.appendChild(createButton);
  container.append(title, formGrid, errorMessage, buttonRow);
  app.appendChild(container);
};

const createCardList = (cards, totalSlots = cards.length) => {
  const list = document.createElement("div");
  list.className = "card-list";
  for (let i = 0; i < totalSlots; i += 1) {
    const card = document.createElement("span");
    card.className = "card";
    card.textContent = cards[i] ? getCardLabel(cards[i]) : "🂠";
    list.appendChild(card);
  }
  return list;
};

const createPlayerList = (gameState) => {
  const list = document.createElement("div");
  list.className = "player-list";

  gameState.players.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = "player-item";
    if (index === gameState.turnoIndex) {
      item.classList.add("active-turn");
    }
    item.innerHTML = `
      <div class="player-name">${player.nombre}</div>
      <div class="player-meta">Stack: ${player.stack}</div>
      <div class="player-meta">Apuesta: ${player.apuestaActual}</div>
      <div class="player-meta">Estado: ${player.estado}</div>
    `;
    list.appendChild(item);
  });

  return list;
};

const renderActions = (gameState, humanPlayer) => {
  const container = document.createElement("div");
  container.className = "action-bar";

  const actionRow = document.createElement("div");
  actionRow.className = "action-row";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = gameState.minRaise;
  amountInput.value = gameState.currentBet
    ? gameState.currentBet + gameState.minRaise
    : gameState.minRaise;
  amountInput.className = "bet-input";

  const makeButton = (label, handler, variant = "") => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (variant) {
      button.className = variant;
    }
    button.addEventListener("click", handler);
    return button;
  };

  const isTurn = gameState.turnoIndex !== -1 &&
    gameState.players[gameState.turnoIndex].id === humanPlayer.id;

  const disableActions = !isTurn || isHandOver(gameState) || gameState.blocked;

  const checkButton = makeButton("Check", () => {
    handleAction(ACTIONS.CHECK);
    runAutoActions();
    renderTableView();
  });

  const callButton = makeButton("Call", () => {
    handleAction(ACTIONS.CALL);
    runAutoActions();
    renderTableView();
  });

  const betButton = makeButton("Bet", () => {
    handleAction(ACTIONS.BET, Number(amountInput.value));
    runAutoActions();
    renderTableView();
  });

  const raiseButton = makeButton("Raise", () => {
    handleAction(ACTIONS.RAISE, Number(amountInput.value));
    runAutoActions();
    renderTableView();
  });

  const allInButton = makeButton("All-in", () => {
    handleAction(ACTIONS.ALL_IN);
    runAutoActions();
    renderTableView();
  });

  const foldButton = makeButton("Fold", () => {
    handleAction(ACTIONS.FOLD);
    runAutoActions();
    renderTableView();
  }, "secondary");

  [
    checkButton,
    callButton,
    betButton,
    raiseButton,
    allInButton,
    foldButton,
  ].forEach((button) => {
    button.disabled = disableActions;
    actionRow.appendChild(button);
  });

  container.append(amountInput, actionRow);
  return container;
};

const renderTableView = () => {
  app.innerHTML = "";

  const container = document.createElement("section");
  container.className = "view table-view";

  const title = document.createElement("h1");
  title.textContent = "Mesa creada";

  const info = document.createElement("div");
  info.className = "table-info";
  info.innerHTML = `
    <div>Fase: <strong>${state.gameState?.fase ?? "-"}</strong></div>
    <div>Bote: <strong>${state.gameState?.bote ?? 0}</strong></div>
    <div>Apuesta actual: <strong>${state.gameState?.currentBet ?? 0}</strong></div>
  `;

  const communitySection = document.createElement("div");
  communitySection.className = "section";
  const communityTitle = document.createElement("h2");
  communityTitle.textContent = "Comunitarias";
  communitySection.append(communityTitle);
  if (state.gameState) {
    communitySection.appendChild(
      createCardList(state.gameState.comunitarias, 5)
    );
  }

  const humanPlayer = state.gameState?.players.find(
    (player) => player.esHumano
  );
  const handSection = document.createElement("div");
  handSection.className = "section";
  const handTitle = document.createElement("h2");
  handTitle.textContent = "Tu mano";
  handSection.appendChild(handTitle);
  if (humanPlayer) {
    handSection.appendChild(createCardList(humanPlayer.hand, 2));
  }

  const playersSection = document.createElement("div");
  playersSection.className = "section";
  const playersTitle = document.createElement("h2");
  playersTitle.textContent = "Jugadores";
  playersSection.append(playersTitle);
  if (state.gameState) {
    playersSection.appendChild(createPlayerList(state.gameState));
  }

  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent =
    state.gameState?.error || "Sin errores en el reparto.";

  const resultMessage = document.createElement("div");
  resultMessage.className = "result-message";
  if (state.gameState?.handOver) {
    const winners = state.gameState.players.filter((player) =>
      state.gameState.winnerIds.includes(player.id)
    );
    const winnerNames = winners.map((player) => player.nombre).join(", ");
    resultMessage.textContent = `Ganador: ${winnerNames}`;
  } else {
    resultMessage.textContent = "La mano está en curso.";
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const newHandButton = document.createElement("button");
  newHandButton.type = "button";
  newHandButton.textContent = "Nueva mano";
  newHandButton.addEventListener("click", () => {
    startNewHand();
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

  buttonRow.append(newHandButton, resetButton);

  container.append(
    title,
    info,
    communitySection,
    handSection,
    playersSection,
    errorMessage,
    resultMessage,
    buttonRow
  );

  if (state.gameState && humanPlayer) {
    container.appendChild(renderActions(state.gameState, humanPlayer));
  }

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

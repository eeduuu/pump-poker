const state = {
  currentView: "config",
  gameConfig: {
    jugadoresTotales: 6,
    numeroIA: 3,
    stackInicial: 1500,
    smallBlind: 10,
    bigBlind: 20,
  },
  gameMode: null,
  gameState: null,
  tournamentTimerId: null,
};

const ACTIONS = {
  FOLD: "fold",
  CHECK: "check",
  CALL: "call",
  BET: "bet",
  RAISE: "raise",
  ALL_IN: "all-in",
};

// Ajusta este nivel global si no hay selector en la UI.
const DEFAULT_AI_LEVEL = "normal";
const AI_PERSONALITIES = ["conservador", "estandar", "agresivo"];
const TOURNAMENT_LEVEL_DURATION = 300000;
const TOURNAMENT_BLIND_LEVELS = [
  { sb: 25, bb: 50 },
  { sb: 50, bb: 100 },
  { sb: 75, bb: 150 },
  { sb: 100, bb: 200 },
  { sb: 150, bb: 300 },
  { sb: 200, bb: 400 },
  { sb: 300, bb: 600 },
  { sb: 400, bb: 800 },
  { sb: 600, bb: 1200 },
  { sb: 800, bb: 1600 },
];

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
      if (player.estado !== "eliminado") {
        player.hand.push(dealCard(deck));
      }
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
    const isHuman = i < humanCount;
    const aiPersonality = isHuman
      ? null
      : AI_PERSONALITIES[(i - humanCount) % AI_PERSONALITIES.length];
    const displayStyle =
      aiPersonality === "estandar" ? "estándar" : aiPersonality;

    players.push({
      id: i + 1,
      nombre: isHuman ? `Jugador ${i + 1}` : `IA ${i + 1 - humanCount}`,
      esHumano: isHuman,
      aiLevel: isHuman ? null : DEFAULT_AI_LEVEL,
      aiPersonality,
      estilo: isHuman ? "humano" : displayStyle,
      stack: config.stackInicial,
      hand: [],
      apuestaActual: 0,
      estado: "activo",
    });
  }

  return players;
};

const getActivePlayers = (gameState) =>
  gameState.players.filter(
    (player) => player.estado !== "foldeado" && player.estado !== "eliminado"
  );

const getEligiblePlayers = (gameState) =>
  getActivePlayers(gameState).filter((player) => player.stack > 0);

const getLivePlayerCount = (gameState) =>
  gameState.players.filter((player) => player.estado !== "eliminado").length;

const getNextLiveIndex = (gameState, startIndex) =>
  getNextIndex(
    gameState.players,
    startIndex,
    (player) => player.estado !== "eliminado"
  );

const getNextIndex = (players, startIndex, predicate) => {
  for (let i = 1; i <= players.length; i += 1) {
    const index = (startIndex + i) % players.length;
    if (predicate(players[index])) {
      return index;
    }
  }
  return -1;
};

const assertGameInvariants = (gameState, context) => {
  const cards = collectCardsInPlay(gameState);
  const uniqueIds = new Set(cards.map((card) => card.id));
  if (uniqueIds.size !== cards.length) {
    return { ok: false, error: "Se detectaron cartas duplicadas." };
  }

  const negativeStack = gameState.players.some((player) => player.stack < 0);
  if (negativeStack) {
    return { ok: false, error: "Se detectó un stack negativo." };
  }

  const negativeBet = gameState.players.some(
    (player) => player.apuestaActual < 0
  );
  if (negativeBet) {
    return { ok: false, error: "Se detectó una apuesta negativa." };
  }

  if (gameState.bote < 0) {
    return { ok: false, error: "El bote es negativo." };
  }

  const totalSystem = gameState.players.reduce(
    (sum, player) => sum + player.stack + player.apuestaActual,
    gameState.bote
  );

  if (Math.abs(totalSystem - gameState.initialTotal) > 0.001) {
    return {
      ok: false,
      error:
        "Inconsistencia financiera detectada (total fuera de balance).",
    };
  }

  return { ok: true };
};

const enforceInvariants = (gameState, context) => {
  if (!gameState || gameState.blocked) {
    return false;
  }
  const result = assertGameInvariants(gameState, context);
  if (!result.ok) {
    gameState.error = result.error;
    gameState.blocked = true;
    return false;
  }
  return true;
};

const updateUniqueness = (gameState) => {
  enforceInvariants(gameState, "cards");
};

const postBlind = (player, amount) => {
  const blind = Math.min(player.stack, amount);
  player.stack -= blind;
  player.apuestaActual += blind;
  if (player.stack === 0) {
    player.estado = "all-in";
  }
};

const getBlindIndexes = (gameState, dealerIndex) => {
  const liveCount = getLivePlayerCount(gameState);
  if (liveCount <= 1) {
    return { smallBlindIndex: -1, bigBlindIndex: -1 };
  }

  if (liveCount === 2) {
    const smallBlindIndex = dealerIndex;
    const bigBlindIndex = getNextLiveIndex(gameState, dealerIndex);
    return { smallBlindIndex, bigBlindIndex };
  }

  const smallBlindIndex = getNextLiveIndex(gameState, dealerIndex);
  const bigBlindIndex = getNextLiveIndex(gameState, smallBlindIndex);
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

const logAction = (gameState, message) => {
  gameState.actionLog.push(message);
};

const getPotSize = (gameState) =>
  gameState.bote +
  gameState.players.reduce((sum, player) => sum + player.apuestaActual, 0);

const createGameState = (config) => {
  const players = createPlayers(config);
  const deck = shuffleDeck(createDeck());
  dealInitialHands(deck, players);
  const gameMode = state.gameMode || "cash";
  const tournamentLevel = 0;
  const initialBlinds =
    gameMode === "tournament"
      ? TOURNAMENT_BLIND_LEVELS[tournamentLevel]
      : { sb: config.smallBlind, bb: config.bigBlind };

  const gameState = {
    players,
    comunitarias: [],
    bote: 0,
    ciegas: {
      smallBlind: initialBlinds.sb,
      bigBlind: initialBlinds.bb,
    },
    dealerIndex: 0,
    turnoIndex: 0,
    fase: "preflop",
    deck,
    currentBet: 0,
    minRaise: initialBlinds.bb,
    pendingActionIds: [],
    error: null,
    blocked: false,
    handOver: false,
    winnerIds: [],
    actionLog: [],
    initialTotal: players.length * config.stackInicial,
    gameMode,
    blindLevelIndex: tournamentLevel,
    pendingBlindLevel: null,
    noticeMessage: null,
    tournamentOver: false,
  };

  logAction(gameState, "Nueva mano iniciada.");
  const dealerIndex = getNextLiveIndex(gameState, gameState.dealerIndex - 1);
  gameState.dealerIndex = dealerIndex === -1 ? 0 : dealerIndex;
  const { smallBlindIndex, bigBlindIndex } = getBlindIndexes(
    gameState,
    gameState.dealerIndex
  );
  if (smallBlindIndex !== -1) {
    postBlind(players[smallBlindIndex], gameState.ciegas.smallBlind);
  }
  if (bigBlindIndex !== -1) {
    postBlind(players[bigBlindIndex], gameState.ciegas.bigBlind);
  }

  const smallBlindBet =
    smallBlindIndex === -1 ? 0 : players[smallBlindIndex].apuestaActual;
  const bigBlindBet =
    bigBlindIndex === -1 ? 0 : players[bigBlindIndex].apuestaActual;
  gameState.currentBet = Math.max(smallBlindBet, bigBlindBet);
  if (smallBlindIndex !== -1) {
    logAction(
      gameState,
      `${players[smallBlindIndex].nombre} publica SB ${players[smallBlindIndex].apuestaActual}.`
    );
  }
  if (bigBlindIndex !== -1) {
    logAction(
      gameState,
      `${players[bigBlindIndex].nombre} publica BB ${players[bigBlindIndex].apuestaActual}.`
    );
  }

  const firstToAct =
    getLivePlayerCount(gameState) === 2
      ? smallBlindIndex
      : getNextLiveIndex(gameState, bigBlindIndex);
  startBettingRound(gameState, firstToAct);

  enforceInvariants(gameState, "init");
  startTournamentTimer(gameState);
  return gameState;
};

const dealStreet = (gameState) => {
  if (gameState.fase === "preflop") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 3));
    gameState.fase = "flop";
    logAction(gameState, "Se reparte el flop.");
  } else if (gameState.fase === "flop") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 1));
    gameState.fase = "turn";
    logAction(gameState, "Se reparte el turn.");
  } else if (gameState.fase === "turn") {
    gameState.comunitarias.push(...dealCommunityCards(gameState.deck, 1));
    gameState.fase = "river";
    logAction(gameState, "Se reparte el river.");
  } else if (gameState.fase === "river") {
    gameState.fase = "showdown";
  }

  enforceInvariants(gameState, "street");
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
  gameState.actionLog.push(`${winner.nombre} gana por fold.`);
  enforceInvariants(gameState, "fold-end");
  handlePostHandEconomy(gameState);
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

const normalizeStrength = (value) => Math.min(Math.max(value, 0), 1);

const getSortedRanks = (cards) =>
  cards
    .map((card) => rankValues[card.rank])
    .filter(Boolean)
    .sort((a, b) => b - a);

const hasFlushDraw = (hand, comunitarias) => {
  const suitsCount = [...hand, ...comunitarias].reduce((acc, card) => {
    acc[card.suit] = (acc[card.suit] || 0) + 1;
    return acc;
  }, {});
  return Object.values(suitsCount).some((count) => count === 4);
};

const hasOpenEndedStraightDraw = (hand, comunitarias) => {
  const values = [...new Set(getSortedRanks([...hand, ...comunitarias]))];
  if (values.length < 4) {
    return false;
  }
  for (let i = 0; i <= values.length - 4; i += 1) {
    const slice = values.slice(i, i + 4);
    if (slice[0] - slice[3] === 3) {
      const high = slice[0];
      const low = slice[3];
      const needsHigh = high + 1 <= 14;
      const needsLow = low - 1 >= 2;
      if (needsHigh && needsLow) {
        return true;
      }
    }
  }
  return false;
};

const getPreflopStrength = (hand) => {
  const [first, second] = hand;
  if (!first || !second) {
    return 0;
  }
  const firstValue = rankValues[first.rank];
  const secondValue = rankValues[second.rank];
  const high = Math.max(firstValue, secondValue);
  const low = Math.min(firstValue, secondValue);
  const isPair = high === low;
  const suited = first.suit === second.suit;
  const isBroadway = high >= 11 && low >= 10;
  const isConnector = high - low === 1;
  const isOneGapper = high - low === 2;

  let score = (high + low) / 30;
  if (isPair) {
    score += 0.35 + high / 40;
  }
  if (isBroadway) {
    score += 0.15;
  }
  if (suited) {
    score += 0.08;
  }
  if (isConnector) {
    score += 0.06;
  } else if (isOneGapper) {
    score += 0.03;
  }

  return normalizeStrength(score);
};

const getPostflopStrength = (hand, comunitarias) => {
  const available = [...hand, ...comunitarias].filter(Boolean);
  if (available.length < 5) {
    return 0.25;
  }
  const best = evaluateSevenCards(available);
  const rankScore = best.rank / 8;
  const kickerScore =
    best.tiebreak.reduce(
      (sum, value, index) => sum + value / (14 * (index + 1)),
      0
    ) / best.tiebreak.length;
  return normalizeStrength(rankScore + kickerScore * 0.2);
};

const getAiFeatures = (gameState, player) => {
  const potSize = Math.max(getPotSize(gameState), gameState.ciegas.bigBlind);
  const toCall = Math.max(gameState.currentBet - player.apuestaActual, 0);
  const potOdds = toCall > 0 ? toCall / (potSize + toCall) : 0;
  const stackRemaining = player.stack;
  const stackToPotRatio = potSize > 0 ? stackRemaining / potSize : 1;

  const preflopStrength = getPreflopStrength(player.hand);
  const postflopStrength = getPostflopStrength(
    player.hand,
    gameState.comunitarias
  );
  const flushDraw = hasFlushDraw(player.hand, gameState.comunitarias);
  const straightDraw = hasOpenEndedStraightDraw(
    player.hand,
    gameState.comunitarias
  );

  return {
    potSize,
    toCall,
    potOdds,
    stackRemaining,
    stackToPotRatio,
    preflopStrength,
    postflopStrength,
    flushDraw,
    straightDraw,
    fase: gameState.fase,
  };
};

const resolveShowdown = (gameState) => {
  if (gameState.handOver || gameState.blocked) {
    return;
  }
  if (!enforceInvariants(gameState, "showdown")) {
    return;
  }
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
  gameState.actionLog.push(
    `Showdown: ${winners.map((winner) => winner.nombre).join(", ")} gana.`
  );
  enforceInvariants(gameState, "showdown-end");
  handlePostHandEconomy(gameState);
};

const handlePostHandEconomy = (gameState) => {
  if (gameState.gameMode === "cash") {
    gameState.players.forEach((player) => {
      if (player.stack === 0 && player.estado !== "eliminado") {
        player.stack = state.gameConfig.stackInicial;
        gameState.initialTotal += state.gameConfig.stackInicial;
        gameState.noticeMessage = `${player.nombre} recompra automáticamente.`;
        logAction(gameState, gameState.noticeMessage);
      }
    });
    return;
  }

  gameState.players.forEach((player) => {
    if (player.stack === 0 && player.estado !== "eliminado") {
      player.estado = "eliminado";
      gameState.noticeMessage = `${player.nombre} queda eliminado.`;
      logAction(gameState, gameState.noticeMessage);
    }
  });

  const remaining = gameState.players.filter(
    (player) => player.estado !== "eliminado"
  );
  if (remaining.length === 1) {
    gameState.noticeMessage = `Ganador del torneo: ${remaining[0].nombre}`;
    gameState.blocked = true;
    gameState.tournamentOver = true;
    stopTournamentTimer();
  }

  enforceInvariants(gameState, "post-hand");
};

const autoRunout = (gameState) => {
  if (gameState.handOver || gameState.blocked) {
    return;
  }
  while (gameState.fase !== "showdown") {
    dealStreet(gameState);
    if (gameState.blocked) {
      return;
    }
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
  if (!enforceInvariants(gameState, "betting-round")) {
    return;
  }
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

const getNoiseChance = (level) => {
  if (level === "facil") {
    return 0.25;
  }
  if (level === "normal") {
    return 0.08;
  }
  return 0.03;
};

const applyNoise = (actionPlan, level, alternatives) => {
  const roll = getRandomInt(100) / 100;
  if (roll < getNoiseChance(level) && alternatives.length > 0) {
    return alternatives[getRandomInt(alternatives.length)];
  }
  return actionPlan;
};

const getBaseThresholds = (level) => {
  if (level === "facil") {
    return { fold: 0.45, raise: 0.7, bluff: 0.05 };
  }
  if (level === "normal") {
    return { fold: 0.3, raise: 0.6, bluff: 0.12 };
  }
  return { fold: 0.2, raise: 0.52, bluff: 0.18 };
};

const applyPersonalityBias = (thresholds, personality) => {
  if (personality === "conservador") {
    return {
      fold: thresholds.fold + 0.12,
      raise: thresholds.raise + 0.1,
      bluff: thresholds.bluff * 0.5,
    };
  }
  if (personality === "agresivo") {
    return {
      fold: thresholds.fold - 0.08,
      raise: thresholds.raise - 0.08,
      bluff: thresholds.bluff * 1.6,
    };
  }
  return thresholds;
};

const getBetSizing = (features, personality, level, gameState, player) => {
  const basePot = features.potSize;
  const aggressive = personality === "agresivo";
  const baseMultiplier = aggressive ? 0.75 : 0.5;
  const levelBoost = level === "dificil" ? 0.1 : 0;
  const target = Math.max(
    gameState.minRaise,
    Math.floor(basePot * (baseMultiplier + levelBoost))
  );
  return Math.min(player.apuestaActual + player.stack, target);
};

const getRaiseSizing = (features, personality, level, gameState, player) => {
  const raiseFactor = personality === "agresivo" ? 3 : 2.5;
  const levelBoost = level === "dificil" ? 0.3 : 0;
  const target = Math.floor(
    gameState.currentBet + gameState.minRaise * (raiseFactor + levelBoost)
  );
  return Math.min(player.apuestaActual + player.stack, target);
};

const decideAiAction = (gameState, playerIndex) => {
  const player = gameState.players[playerIndex];
  const features = getAiFeatures(gameState, player);
  const level = player.aiLevel || DEFAULT_AI_LEVEL;
  const personality = player.aiPersonality || "estandar";
  const thresholds = applyPersonalityBias(
    getBaseThresholds(level),
    personality
  );

  const isPreflop = features.fase === "preflop";
  const strength = isPreflop ? features.preflopStrength : features.postflopStrength;
  const hasDraw = features.flushDraw || features.straightDraw;
  const callPressure = features.toCall / Math.max(features.potSize, 1);
  const sprLow = features.stackToPotRatio < 2.5;

  const alternatives = [];
  let plan = { type: ACTIONS.CHECK };

  if (features.toCall > 0) {
    alternatives.push({ type: ACTIONS.FOLD });
    alternatives.push({ type: ACTIONS.CALL });
  } else {
    alternatives.push({ type: ACTIONS.CHECK });
    alternatives.push({ type: ACTIONS.BET, amount: getBetSizing(features, personality, level, gameState, player) });
  }

  if (features.toCall <= 0) {
    if (strength >= thresholds.raise || (hasDraw && personality === "agresivo")) {
      plan = {
        type: ACTIONS.BET,
        amount: getBetSizing(features, personality, level, gameState, player),
      };
    } else {
      plan = { type: ACTIONS.CHECK };
    }
  } else {
    if (strength < thresholds.fold && callPressure > 0.35 && !hasDraw) {
      plan = { type: ACTIONS.FOLD };
    } else if (
      strength >= thresholds.raise ||
      (hasDraw && strength >= thresholds.fold && personality === "agresivo")
    ) {
      plan = {
        type: ACTIONS.RAISE,
        amount: getRaiseSizing(features, personality, level, gameState, player),
      };
    } else if (strength >= features.potOdds || hasDraw) {
      plan = { type: ACTIONS.CALL };
    } else {
      plan = { type: ACTIONS.FOLD };
    }
  }

  if (sprLow && strength > 0.7) {
    plan = { type: ACTIONS.ALL_IN };
  }

  if (
    level === "dificil" &&
    personality === "agresivo" &&
    !isPreflop &&
    strength < thresholds.fold &&
    features.toCall === 0 &&
    getRandomInt(100) / 100 < thresholds.bluff
  ) {
    plan = {
      type: ACTIONS.BET,
      amount: getBetSizing(features, personality, level, gameState, player),
    };
  }

  plan = applyNoise(plan, level, alternatives);

  if ((plan.type === ACTIONS.BET || plan.type === ACTIONS.RAISE) && !plan.amount) {
    plan.amount = getBetSizing(features, personality, level, gameState, player);
  }

  if (plan.amount) {
    plan.amount = Math.min(
      plan.amount,
      player.apuestaActual + player.stack
    );
    plan.amount = Math.max(plan.amount, player.apuestaActual);
    plan.amount = Math.round(plan.amount);
  }

  return plan;
};

const commitBet = (gameState, player, targetAmount) => {
  if (targetAmount <= player.apuestaActual) {
    gameState.error = "La apuesta debe superar la apuesta actual del jugador.";
    return false;
  }
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
  return enforceInvariants(gameState, "bet");
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
    logAction(gameState, `${player.nombre} se retira.`);
  } else if (action === ACTIONS.CHECK) {
    if (callAmount !== 0) {
      gameState.error = "No puedes hacer check con apuesta pendiente.";
      return;
    }
    gameState.pendingActionIds = gameState.pendingActionIds.filter(
      (id) => id !== player.id
    );
    logAction(gameState, `${player.nombre} pasa.`);
  } else if (action === ACTIONS.CALL) {
    if (callAmount <= 0) {
      gameState.error = "No hay apuesta para igualar.";
      return;
    }
    if (!commitBet(gameState, player, gameState.currentBet)) {
      return;
    }
    logAction(gameState, `${player.nombre} iguala ${gameState.currentBet}.`);
  } else if (action === ACTIONS.BET) {
    if (gameState.currentBet > 0) {
      gameState.error = "Ya hay apuesta, debes subir o igualar.";
      return;
    }
    if (amount < gameState.minRaise) {
      gameState.error = `La apuesta mínima es ${gameState.minRaise}.`;
      return;
    }
    if (!commitBet(gameState, player, amount)) {
      return;
    }
    logAction(gameState, `${player.nombre} apuesta ${amount}.`);
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
    if (!commitBet(gameState, player, amount)) {
      return;
    }
    logAction(gameState, `${player.nombre} sube a ${amount}.`);
  } else if (action === ACTIONS.ALL_IN) {
    if (!commitBet(gameState, player, player.apuestaActual + player.stack)) {
      return;
    }
    logAction(gameState, `${player.nombre} va all-in.`);
  }

  if (!enforceInvariants(gameState, "action")) {
    return;
  }
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
  const decision = decideAiAction(gameState, gameState.turnoIndex);
  handleAction(decision.type, decision.amount ?? 0);
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

const applyPendingBlindLevel = (gameState) => {
  if (
    gameState.gameMode !== "tournament" ||
    gameState.pendingBlindLevel === null
  ) {
    return;
  }
  const level = gameState.pendingBlindLevel;
  const blindConfig = TOURNAMENT_BLIND_LEVELS[level];
  gameState.ciegas.smallBlind = blindConfig.sb;
  gameState.ciegas.bigBlind = blindConfig.bb;
  gameState.minRaise = blindConfig.bb;
  gameState.blindLevelIndex = level;
  gameState.pendingBlindLevel = null;
};

const prepareNextHand = (gameState) => {
  if (gameState.tournamentOver) {
    return;
  }
  if (gameState.gameMode === "tournament") {
    gameState.players.forEach((player) => {
      if (player.stack === 0 && player.estado !== "eliminado") {
        player.estado = "eliminado";
      }
    });
    if (getLivePlayerCount(gameState) <= 1) {
      gameState.tournamentOver = true;
      gameState.blocked = true;
      stopTournamentTimer();
      return;
    }
  }

  applyPendingBlindLevel(gameState);

  gameState.deck = shuffleDeck(createDeck());
  gameState.comunitarias = [];
  gameState.bote = 0;
  gameState.currentBet = 0;
  gameState.pendingActionIds = [];
  gameState.error = null;
  gameState.handOver = false;
  gameState.winnerIds = [];

  gameState.players.forEach((player) => {
    if (player.estado !== "eliminado") {
      player.hand = [];
      player.apuestaActual = 0;
      player.estado = "activo";
    }
  });

  dealInitialHands(gameState.deck, gameState.players);
  const nextDealer = getNextLiveIndex(gameState, gameState.dealerIndex);
  gameState.dealerIndex = nextDealer === -1 ? gameState.dealerIndex : nextDealer;

  const { smallBlindIndex, bigBlindIndex } = getBlindIndexes(
    gameState,
    gameState.dealerIndex
  );

  if (smallBlindIndex !== -1) {
    postBlind(gameState.players[smallBlindIndex], gameState.ciegas.smallBlind);
  }
  if (bigBlindIndex !== -1) {
    postBlind(gameState.players[bigBlindIndex], gameState.ciegas.bigBlind);
  }

  const smallBlindBet =
    smallBlindIndex === -1
      ? 0
      : gameState.players[smallBlindIndex].apuestaActual;
  const bigBlindBet =
    bigBlindIndex === -1
      ? 0
      : gameState.players[bigBlindIndex].apuestaActual;
  gameState.currentBet = Math.max(smallBlindBet, bigBlindBet);
  if (smallBlindIndex !== -1) {
    logAction(
      gameState,
      `${gameState.players[smallBlindIndex].nombre} publica SB ${gameState.players[smallBlindIndex].apuestaActual}.`
    );
  }
  if (bigBlindIndex !== -1) {
    logAction(
      gameState,
      `${gameState.players[bigBlindIndex].nombre} publica BB ${gameState.players[bigBlindIndex].apuestaActual}.`
    );
  }

  const firstToAct =
    getLivePlayerCount(gameState) === 2
      ? smallBlindIndex
      : getNextLiveIndex(gameState, bigBlindIndex);
  startBettingRound(gameState, firstToAct);
  logAction(gameState, "Nueva mano iniciada.");
  enforceInvariants(gameState, "new-hand");
};

const startNewHand = () => {
  if (!state.gameConfig) {
    return;
  }
  if (state.gameState?.tournamentOver) {
    return;
  }
  if (!state.gameState) {
    state.gameState = createGameState(state.gameConfig);
  } else {
    prepareNextHand(state.gameState);
  }
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

  const modeField = document.createElement("div");
  modeField.className = "field";
  const modeLabel = document.createElement("label");
  modeLabel.htmlFor = "gameMode";
  modeLabel.textContent = "Modo de partida";
  const modeSelect = document.createElement("select");
  modeSelect.id = "gameMode";
  modeSelect.name = "gameMode";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona un modo";
  modeSelect.appendChild(placeholder);
  const cashOption = document.createElement("option");
  cashOption.value = "cash";
  cashOption.textContent = "Cash";
  const tournamentOption = document.createElement("option");
  tournamentOption.value = "tournament";
  tournamentOption.textContent = "Torneo";
  modeSelect.append(cashOption, tournamentOption);
  if (state.gameMode) {
    modeSelect.value = state.gameMode;
  }
  modeField.append(modeLabel, modeSelect);
  formGrid.appendChild(modeField);

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
    const selectedMode = modeSelect.value;

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

    if (!errorText && !selectedMode) {
      errorText = "Selecciona un modo de partida.";
    }

    if (errorText) {
      errorMessage.textContent = errorText;
      errorMessage.hidden = false;
      return;
    }

    errorMessage.hidden = true;
    state.gameMode = selectedMode;
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

const shouldRevealAI = (gameState) =>
  gameState.handOver || allActiveAllIn(gameState);

const createCardList = (cards, totalSlots = cards.length, hideCards = false) => {
  const list = document.createElement("div");
  list.className = "card-list";
  for (let i = 0; i < totalSlots; i += 1) {
    const card = document.createElement("span");
    card.className = "card";
    if (cards[i]) {
      card.textContent = hideCards ? "🂠" : getCardLabel(cards[i]);
      if (hideCards) {
        card.classList.add("hidden");
      }
    } else {
      card.textContent = "—";
    }
    list.appendChild(card);
  }
  return list;
};

const createSeat = (player, isTurn, revealCards, isHero) => {
  const seat = document.createElement("div");
  seat.className = "seat";
  if (isTurn) {
    seat.classList.add("turn");
  }
  if (player.estado === "foldeado") {
    seat.classList.add("folded");
  }
  if (isHero) {
    seat.classList.add("hero-seat");
  }

  const header = document.createElement("div");
  header.className = "seat-header";

  const name = document.createElement("div");
  name.className = "seat-name";
  name.textContent = player.nombre;

  const badges = document.createElement("div");
  badges.className = "seat-badges";
  if (player.estado === "all-in") {
    const badge = document.createElement("span");
    badge.className = "badge all-in";
    badge.textContent = "All-in";
    badges.appendChild(badge);
  }
  if (isTurn) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "Turno";
    badges.appendChild(badge);
  }

  header.append(name, badges);

  const meta = document.createElement("div");
  meta.className = "seat-meta";
  meta.innerHTML = `
    <div>Stack: ${player.stack}</div>
    <div>Apuesta: ${player.apuestaActual}</div>
    <div>Estado: ${player.estado}</div>
  `;

  const cardList = createCardList(
    player.hand,
    2,
    !revealCards && !player.esHumano
  );

  seat.append(header, meta, cardList);
  return seat;
};

const getPotTotalForUi = (gameState) =>
  gameState.bote +
  gameState.players.reduce((sum, player) => sum + player.apuestaActual, 0);

const stopTournamentTimer = () => {
  if (state.tournamentTimerId) {
    clearInterval(state.tournamentTimerId);
    state.tournamentTimerId = null;
  }
};

const startTournamentTimer = (gameState) => {
  if (gameState.gameMode !== "tournament") {
    return;
  }
  stopTournamentTimer();
  state.tournamentTimerId = setInterval(() => {
    if (!state.gameState || state.gameState.tournamentOver) {
      stopTournamentTimer();
      return;
    }
    const baseIndex =
      state.gameState.pendingBlindLevel ?? state.gameState.blindLevelIndex ?? 0;
    if (baseIndex >= TOURNAMENT_BLIND_LEVELS.length - 1) {
      return;
    }
    const nextIndex = baseIndex + 1;
    state.gameState.pendingBlindLevel = nextIndex;
    state.gameState.noticeMessage = `Suben las ciegas: SB ${TOURNAMENT_BLIND_LEVELS[nextIndex].sb} / BB ${TOURNAMENT_BLIND_LEVELS[nextIndex].bb}`;
  }, TOURNAMENT_LEVEL_DURATION);
};

const getStatusMessage = (gameState) => {
  if (!gameState) {
    return "Sin partida activa.";
  }
  if (gameState.tournamentOver) {
    return gameState.noticeMessage || "Torneo finalizado.";
  }
  if (gameState.handOver) {
    const winners = gameState.players.filter((player) =>
      gameState.winnerIds.includes(player.id)
    );
    const winnerNames = winners.map((player) => player.nombre).join(", ");
    const lastLog = gameState.actionLog[gameState.actionLog.length - 1] || "";
    const reason = lastLog.includes("fold")
      ? "abandono"
      : lastLog.includes("Showdown")
      ? "showdown"
      : "resultado final";
    return `Ganador: ${winnerNames} (${reason}).`;
  }
  const currentPlayer = gameState.players[gameState.turnoIndex];
  if (currentPlayer?.esHumano) {
    return "Tu turno";
  }
  if (currentPlayer) {
    return `Turno de ${currentPlayer.nombre}`;
  }
  return "Esperando acción";
};

const renderActions = (gameState, humanPlayer) => {
  const container = document.createElement("div");
  container.className = "action-bar";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.min = gameState.minRaise;
  const maxAmount = humanPlayer.apuestaActual + humanPlayer.stack;
  const defaultAmount = gameState.currentBet
    ? Math.min(maxAmount, gameState.currentBet + gameState.minRaise)
    : Math.min(maxAmount, gameState.minRaise);
  amountInput.value = defaultAmount;
  amountInput.max = maxAmount;
  amountInput.className = "bet-input";

  const rangeInput = document.createElement("input");
  rangeInput.type = "range";
  rangeInput.min = gameState.minRaise;
  rangeInput.max = maxAmount;
  rangeInput.value = defaultAmount;
  rangeInput.className = "bet-range";

  const amountMeta = document.createElement("div");
  amountMeta.className = "amount-meta";
  amountMeta.innerHTML = `
    <span>Cantidad: ${amountInput.value}</span>
    <span>Máximo: ${humanPlayer.stack}</span>
  `;

  const syncAmount = (value) => {
    const clamped = Math.max(
      Number(gameState.minRaise),
      Math.min(Number(value), maxAmount)
    );
    amountInput.value = clamped;
    rangeInput.value = clamped;
    amountMeta.querySelector("span").textContent = `Cantidad: ${clamped}`;
  };

  amountInput.addEventListener("input", (event) => {
    syncAmount(event.target.value);
  });

  rangeInput.addEventListener("input", (event) => {
    syncAmount(event.target.value);
  });

  const actionRow = document.createElement("div");
  actionRow.className = "action-row";

  const quickRow = document.createElement("div");
  quickRow.className = "quick-row";

  const potTotal = getPotTotalForUi(gameState);
  const quickButtons = [
    { label: "1/2 bote", value: Math.floor(potTotal * 0.5) },
    { label: "Bote", value: Math.floor(potTotal) },
    { label: "All-in", value: maxAmount },
  ];

  quickButtons.forEach((quick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary quick-button";
    button.textContent = quick.label;
    button.addEventListener("click", () => syncAmount(quick.value));
    quickRow.appendChild(button);
  });

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

  const isTurn =
    gameState.turnoIndex !== -1 &&
    gameState.players[gameState.turnoIndex].id === humanPlayer.id;

  const disableActions = !isTurn || isHandOver(gameState) || gameState.blocked;
  const callAmount = gameState.currentBet - humanPlayer.apuestaActual;
  const disableCheck = callAmount > 0;
  const disableCall = callAmount <= 0;

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

  if (!disableActions) {
    checkButton.disabled = disableCheck;
    callButton.disabled = disableCall;
  }

  const amountRow = document.createElement("div");
  amountRow.className = "amount-row";
  amountRow.append(amountInput, rangeInput, amountMeta);

  container.append(amountRow, quickRow, actionRow);
  return container;
};

const renderTableView = () => {
  app.innerHTML = "";

  const container = document.createElement("section");
  container.className = "view table-view table-screen";

  const topbar = document.createElement("div");
  topbar.className = "table-topbar";

  const topRow = document.createElement("div");
  topRow.className = "top-row";

  const title = document.createElement("h1");
  title.textContent = "Mesa creada";

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const newHandButton = document.createElement("button");
  newHandButton.type = "button";
  newHandButton.textContent = "Nueva mano";
  newHandButton.addEventListener("click", () => {
    startNewHand();
    renderTableView();
  });
  if (state.gameState?.tournamentOver) {
    newHandButton.disabled = true;
  }

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "secondary";
  resetButton.textContent = "Nueva mesa";
  resetButton.addEventListener("click", () => {
    stopTournamentTimer();
    state.currentView = "config";
    renderConfigView();
  });

  buttonRow.append(newHandButton, resetButton);
  topRow.append(title, buttonRow);

  const metaRow = document.createElement("div");
  metaRow.className = "table-meta";
  metaRow.innerHTML = `
    <span>Fase: <strong>${state.gameState?.fase ?? "-"}</strong></span>
    <span>Bote: <strong>${state.gameState?.bote ?? 0}</strong></span>
    <span>Apuesta actual: <strong>${state.gameState?.currentBet ?? 0}</strong></span>
  `;

  const statusMessage = document.createElement("div");
  statusMessage.className = "status-message";
  statusMessage.textContent = getStatusMessage(state.gameState);

  const errorMessage = document.createElement("div");
  errorMessage.className = "error-message";
  errorMessage.textContent =
    state.gameState?.error ||
    state.gameState?.noticeMessage ||
    "Sin errores en el reparto.";

  topbar.append(topRow, metaRow, statusMessage, errorMessage);

  const pokerTable = document.createElement("div");
  pokerTable.className = "poker-table";

  const community = document.createElement("div");
  community.className = "community";
  const communityTitle = document.createElement("h2");
  communityTitle.textContent = "Comunitarias";
  const communityCards = state.gameState
    ? createCardList(state.gameState.comunitarias, 5)
    : createCardList([], 5);
  const pot = document.createElement("div");
  pot.className = "pot";
  pot.textContent = `Bote total: ${state.gameState?.bote ?? 0}`;
  community.append(communityTitle, communityCards, pot);

  const seats = document.createElement("div");
  seats.className = "seats";

  const humanPlayer = state.gameState?.players.find(
    (player) => player.esHumano
  );
  const revealAI = state.gameState ? shouldRevealAI(state.gameState) : false;

  state.gameState?.players.forEach((player, index) => {
    const seat = createSeat(
      player,
      index === state.gameState.turnoIndex,
      revealAI || player.esHumano,
      player.esHumano
    );
    seats.appendChild(seat);
  });

  pokerTable.append(community, seats);

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

  const logToggle = document.createElement("button");
  logToggle.type = "button";
  logToggle.className = "log-toggle";
  logToggle.textContent = "Mostrar log";

  const logPanel = document.createElement("div");
  logPanel.className = "log-panel";
  const logTitle = document.createElement("strong");
  logTitle.textContent = "Log de acciones";
  const logList = document.createElement("ul");
  const lastIndex = state.gameState?.actionLog.length
    ? state.gameState.actionLog.length - 1
    : -1;
  state.gameState?.actionLog.forEach((entry, index) => {
    const item = document.createElement("li");
    item.textContent = entry;
    if (index === lastIndex) {
      item.classList.add("latest");
    }
    logList.appendChild(item);
  });
  logPanel.append(logTitle, logList);

  logToggle.addEventListener("click", () => {
    const isOpen = logPanel.classList.toggle("open");
    logToggle.textContent = isOpen ? "Ocultar log" : "Mostrar log";
  });

  topbar.append(logToggle);

  container.append(topbar, pokerTable, resultMessage, logPanel);

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

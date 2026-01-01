const state = {
  currentView: "config",
  gameConfig: {
    jugadoresTotales: 6,
    numeroIA: 3,
    stackInicial: 1500,
    smallBlind: 10,
    bigBlind: 20,
  },
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

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "secondary";
  resetButton.textContent = "Nueva mesa";
  resetButton.addEventListener("click", () => {
    state.currentView = "config";
    renderConfigView();
  });

  buttonRow.appendChild(resetButton);
  container.append(title, placeholder, buttonRow);
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

const defaultConfig = {
  brokerUrl: "wss://broker.emqx.io:8084/mqtt",
  deviceId: "wico-rehab-demo001"
};

const state = {
  client: null,
  connected: false,
  running: false,
  startTime: 0,
  elapsedMs: 0,
  timerHandle: null
};

const elements = {
  timerDisplay: document.querySelector("#timerDisplay"),
  startButton: document.querySelector("#startButton"),
  finishButton: document.querySelector("#finishButton"),
  lightButton: document.querySelector("#lightButton"),
  heavyButton: document.querySelector("#heavyButton"),
  totalCount: document.querySelector("#totalCount"),
  lightCount: document.querySelector("#lightCount"),
  heavyCount: document.querySelector("#heavyCount"),
  currentMode: document.querySelector("#currentMode"),
  sessionState: document.querySelector("#sessionState"),
  encouragementPanel: document.querySelector("#encouragementPanel"),
  connectButton: document.querySelector("#connectButton"),
  brokerInput: document.querySelector("#brokerInput"),
  deviceInput: document.querySelector("#deviceInput"),
  commandTopic: document.querySelector("#commandTopic"),
  statusTopic: document.querySelector("#statusTopic")
};

function loadConfig() {
  const savedBroker = localStorage.getItem("wicoRehabBrokerUrl");
  const savedDevice = localStorage.getItem("wicoRehabDeviceId");
  elements.brokerInput.value = savedBroker || defaultConfig.brokerUrl;
  elements.deviceInput.value = savedDevice || defaultConfig.deviceId;
  updateTopics();
}

function getTopics() {
  const safeDeviceId = elements.deviceInput.value.trim() || defaultConfig.deviceId;
  return {
    command: `wico/rehab/${safeDeviceId}/cmd`,
    status: `wico/rehab/${safeDeviceId}/status`
  };
}

function updateTopics() {
  const topics = getTopics();
  elements.commandTopic.textContent = topics.command;
  elements.statusTopic.textContent = topics.status;
}

function setConnectionStatus(_text, connected) {
  state.connected = connected;
  elements.connectButton.textContent = connected ? "Reconnect" : "Connect";
}

function formatTime(ms) {
  const totalTenths = Math.floor(ms / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function renderTimer() {
  const elapsed = state.running ? Date.now() - state.startTime : state.elapsedMs;
  elements.timerDisplay.textContent = formatTime(elapsed);
}

function startLocalTimer() {
  state.running = true;
  state.elapsedMs = 0;
  state.startTime = Date.now();
  window.clearInterval(state.timerHandle);
  state.timerHandle = window.setInterval(renderTimer, 100);
  renderTimer();
}

function finishLocalTimer() {
  if (state.running) {
    state.elapsedMs = Date.now() - state.startTime;
  }
  state.running = false;
  window.clearInterval(state.timerHandle);
  renderTimer();
}

function publishCommand(command) {
  if (!state.client || !state.connected) {
    setConnectionStatus("MQTT not connected", false);
    return;
  }
  state.client.publish(getTopics().command, command, { qos: 0, retain: false });
}

function connectMqtt() {
  updateTopics();
  localStorage.setItem("wicoRehabBrokerUrl", elements.brokerInput.value.trim());
  localStorage.setItem("wicoRehabDeviceId", elements.deviceInput.value.trim());

  if (state.client) {
    state.client.end(true);
    state.client = null;
  }

  if (!window.mqtt) {
    setConnectionStatus("MQTT library unavailable", false);
    return;
  }

  const topics = getTopics();
  const clientId = `wico_web_${Math.random().toString(16).slice(2)}`;
  setConnectionStatus("Connecting...", false);
  state.client = mqtt.connect(elements.brokerInput.value.trim(), {
    clientId,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000
  });

  state.client.on("connect", () => {
    setConnectionStatus("Connected to EMQX", true);
    state.client.subscribe(topics.status);
  });

  state.client.on("reconnect", () => setConnectionStatus("Reconnecting...", false));
  state.client.on("close", () => setConnectionStatus("Disconnected", false));
  state.client.on("error", () => setConnectionStatus("Connection error", false));
  state.client.on("message", (_topic, payload) => handleStatus(payload.toString()));
}

function handleStatus(message) {
  try {
    const data = JSON.parse(message);
    const light = Number(data.lightCount || 0);
    const heavy = Number(data.heavyCount || 0);
    elements.lightCount.textContent = light;
    elements.heavyCount.textContent = heavy;
    elements.totalCount.textContent = Number(data.totalCount ?? light + heavy);
    elements.currentMode.textContent = data.force === "heavy" ? "Heavy" : "Light";
    elements.sessionState.textContent = data.sessionActive ? "Session running" : "Session stopped";
  } catch {
    console.warn("Invalid status payload:", message);
  }
}

elements.startButton.addEventListener("click", () => {
  elements.encouragementPanel.classList.add("hidden");
  elements.lightCount.textContent = "0";
  elements.heavyCount.textContent = "0";
  elements.totalCount.textContent = "0";
  elements.sessionState.textContent = "Session running";
  startLocalTimer();
  publishCommand("START");
});

elements.finishButton.addEventListener("click", () => {
  finishLocalTimer();
  elements.sessionState.textContent = "Session stopped";
  elements.encouragementPanel.classList.remove("hidden");
  publishCommand("FINISH");
});

elements.lightButton.addEventListener("click", () => {
  elements.currentMode.textContent = "Light";
  publishCommand("LIGHT");
});

elements.heavyButton.addEventListener("click", () => {
  elements.currentMode.textContent = "Heavy";
  publishCommand("HEAVY");
});

elements.connectButton.addEventListener("click", connectMqtt);
elements.brokerInput.addEventListener("change", updateTopics);
elements.deviceInput.addEventListener("input", updateTopics);

window.addEventListener("load", () => {
  loadConfig();
  connectMqtt();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});

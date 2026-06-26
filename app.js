const nodes = {
  A: { name: "gateway", lambda: 0.0, mu: 100.0, x: 80, y: 180 },
  B: { name: "auth-crossroad", lambda: 10.0, mu: 22.0, x: 260, y: 80 },
  C: { name: "cache-crossroad", lambda: 8.0, mu: 20.0, x: 260, y: 280 },
  D: { name: "billing-crossroad", lambda: 12.0, mu: 25.0, x: 520, y: 80 },
  E: { name: "analytics-crossroad", lambda: 11.0, mu: 21.0, x: 520, y: 280 },
  F: { name: "target-zone", lambda: 0.0, mu: 100.0, x: 700, y: 180 }
};

const edges = [
  ["A", "B", 6.0], ["A", "C", 5.0], ["B", "D", 7.0], ["B", "E", 9.0],
  ["C", "D", 8.0], ["C", "E", 6.0], ["D", "F", 7.0], ["E", "F", 6.0],
  ["B", "C", 4.0], ["D", "E", 3.0]
];

const scenarios = {
  normal: { multiplier: 1.0, probability: 0.5 },
  peak: { multiplier: 1.35, probability: 0.3 },
  incident: { multiplier: 1.7, probability: 0.2 }
};

const SLA = 28.0;

function calculateMM1(lambdaRate, muRate) {
  if (lambdaRate === 0) return { rho: 0, wQueue: 0, stable: true };
  if (lambdaRate >= muRate) return { rho: lambdaRate / muRate, wQueue: Infinity, stable: false };
  const rho = lambdaRate / muRate;
  const wQueueHours = lambdaRate / (muRate * (muRate - lambdaRate));
  return { rho, wQueue: wQueueHours * 60, stable: true };
}

function scenarioMetrics(scenarioName) {
  const multiplier = scenarios[scenarioName].multiplier;
  const result = {};
  for (const [id, node] of Object.entries(nodes)) {
    const lambdaS = node.lambda * multiplier;
    result[id] = { ...calculateMM1(lambdaS, node.mu), lambdaS, mu: node.mu };
  }
  return result;
}

function buildWeightedEdges(scenarioName) {
  const metrics = scenarioMetrics(scenarioName);
  return edges.map(([source, target, base]) => ({
    source,
    target,
    base,
    queueDelay: metrics[target].wQueue,
    weight: base + metrics[target].wQueue
  }));
}

function bellmanFord(scenarioName, source = "A", target = "F") {
  const weighted = buildWeightedEdges(scenarioName);
  const dist = Object.fromEntries(Object.keys(nodes).map((id) => [id, Infinity]));
  const prev = Object.fromEntries(Object.keys(nodes).map((id) => [id, null]));
  dist[source] = 0;
  for (let i = 0; i < Object.keys(nodes).length - 1; i++) {
    for (const edge of weighted) {
      if (dist[edge.source] + edge.weight < dist[edge.target]) {
        dist[edge.target] = dist[edge.source] + edge.weight;
        prev[edge.target] = edge.source;
      }
    }
  }
  return recoverPath(prev, dist[target], source, target);
}

function dijkstra(scenarioName, source = "A", target = "F") {
  const weighted = buildWeightedEdges(scenarioName);
  const outgoing = {};
  Object.keys(nodes).forEach((id) => { outgoing[id] = []; });
  weighted.forEach((edge) => outgoing[edge.source].push(edge));
  const dist = Object.fromEntries(Object.keys(nodes).map((id) => [id, Infinity]));
  const prev = Object.fromEntries(Object.keys(nodes).map((id) => [id, null]));
  const visited = new Set();
  dist[source] = 0;

  while (visited.size < Object.keys(nodes).length) {
    const u = Object.keys(nodes)
      .filter((id) => !visited.has(id))
      .sort((a, b) => dist[a] - dist[b])[0];
    if (!u || !Number.isFinite(dist[u])) break;
    visited.add(u);
    for (const edge of outgoing[u]) {
      if (dist[u] + edge.weight < dist[edge.target]) {
        dist[edge.target] = dist[u] + edge.weight;
        prev[edge.target] = u;
      }
    }
  }
  return recoverPath(prev, dist[target], source, target);
}

function recoverPath(prev, cost, source, target) {
  const path = [];
  let current = target;
  while (current) {
    path.unshift(current);
    if (current === source) break;
    current = prev[current];
  }
  return { path, cost };
}

function solve(scenarioName, strategy) {
  return strategy === "dijkstra" ? dijkstra(scenarioName) : bellmanFord(scenarioName);
}

function edgeKey(a, b) { return `${a}->${b}`; }

function drawGraph(path) {
  const svg = document.getElementById("networkSvg");
  svg.innerHTML = `
    <defs>
      <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8"></path>
      </marker>
    </defs>`;
  const activeEdges = new Set();
  for (let i = 0; i < path.length - 1; i++) activeEdges.add(edgeKey(path[i], path[i + 1]));

  for (const [source, target, base] of edges) {
    const a = nodes[source];
    const b = nodes[target];
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", a.x);
    line.setAttribute("y1", a.y);
    line.setAttribute("x2", b.x);
    line.setAttribute("y2", b.y);
    line.setAttribute("class", activeEdges.has(edgeKey(source, target)) ? "edge active" : "edge");
    svg.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", (a.x + b.x) / 2);
    label.setAttribute("y", (a.y + b.y) / 2 - 8);
    label.setAttribute("class", "edge-label");
    label.textContent = base.toFixed(0);
    svg.appendChild(label);
  }

  for (const [id, node] of Object.entries(nodes)) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", path.includes(id) ? "node active" : "node");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", node.x);
    circle.setAttribute("cy", node.y);
    circle.setAttribute("r", 28);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", node.x);
    text.setAttribute("y", node.y + 1);
    text.textContent = id;
    g.appendChild(circle);
    g.appendChild(text);
    svg.appendChild(g);
  }
}

function renderMetrics(scenarioName) {
  const body = document.getElementById("metricsBody");
  body.innerHTML = "";
  const metrics = scenarioMetrics(scenarioName);
  for (const id of ["B", "C", "D", "E"]) {
    const row = document.createElement("tr");
    const m = metrics[id];
    row.innerHTML = `
      <td><strong>${id}</strong> · ${nodes[id].name}</td>
      <td>${m.lambdaS.toFixed(2)}</td>
      <td>${m.mu.toFixed(2)}</td>
      <td>${m.rho.toFixed(3)}</td>
      <td>${Number.isFinite(m.wQueue) ? m.wQueue.toFixed(3) : "∞"}</td>
      <td class="${m.stable ? "status-ok" : "status-bad"}">${m.stable ? "устойчив" : "неустойчив"}</td>`;
    body.appendChild(row);
  }
}

function renderAllScenarios(strategy) {
  const body = document.getElementById("allScenariosBody");
  body.innerHTML = "";
  for (const [name, scenario] of Object.entries(scenarios)) {
    const result = solve(name, strategy);
    const ok = result.cost <= SLA;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${name}</td>
      <td>×${scenario.multiplier}</td>
      <td>${result.path.join(" → ")}</td>
      <td>${result.cost.toFixed(3)}</td>
      <td class="${ok ? "status-ok" : "status-bad"}">${ok ? "да" : "нет"}</td>`;
    body.appendChild(row);
  }
}

function update() {
  const scenario = document.getElementById("scenarioSelect").value;
  const strategy = document.getElementById("strategySelect").value;
  const result = solve(scenario, strategy);
  const ok = result.cost <= SLA;

  document.getElementById("routeText").textContent = result.path.join(" → ");
  document.getElementById("timeText").textContent = `${result.cost.toFixed(3)} мин`;
  document.getElementById("slaText").textContent = ok ? "выполнен" : "нарушен";
  document.getElementById("slaText").className = ok ? "status-ok" : "status-bad";
  document.getElementById("explainText").textContent = ok
    ? "Маршрут укладывается в SLA. При текущей нагрузке задержки в очередях не делают путь критичным."
    : "Маршрут не укладывается в SLA. Причина — рост ожидания в узлах при приближении λ к μ.";

  drawGraph(result.path);
  renderMetrics(scenario);
  renderAllScenarios(strategy);
}

document.getElementById("runBtn").addEventListener("click", update);
document.getElementById("scenarioSelect").addEventListener("change", update);
document.getElementById("strategySelect").addEventListener("change", update);
update();

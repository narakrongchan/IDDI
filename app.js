(function () {
  const data = window.DASHBOARD_DATA;
  const SVG = "http://www.w3.org/2000/svg";

  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency, maximumFractionDigits: 0 });
  const money2 = new Intl.NumberFormat(undefined, { style: "currency", currency: data.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const count = new Intl.NumberFormat();
  const pct = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  const toDate = (s) => new Date(s + "T00:00:00Z");
  const shortDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
  const longDay = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  const days = data.daily
    .map(([date, revenue, orders, newCustomers]) => ({ date, revenue, orders, newCustomers }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // Last 28 days vs the 28 days before
  const cur = days.slice(-28);
  const prev = days.slice(-56, -28);
  const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
  const totals = (rows) => {
    const revenue = sum(rows, "revenue");
    const orders = sum(rows, "orders");
    return { revenue, orders, aov: orders ? revenue / orders : 0, newCustomers: sum(rows, "newCustomers") };
  };
  const c = totals(cur);
  const p = totals(prev);
  const change = (k) => (p[k] ? (c[k] - p[k]) / p[k] : null);

  document.getElementById("title").textContent = data.businessName;
  document.title = data.businessName;
  if (cur.length) {
    document.getElementById("period").textContent =
      `Last 28 days (${shortDay.format(toDate(cur[0].date))} – ${shortDay.format(toDate(cur[cur.length - 1].date))}) compared with the 28 days before`;
  }

  function setKpi(id, value, k) {
    document.getElementById("kpi-" + id).textContent = value;
    const el = document.getElementById("chg-" + id);
    const v = change(k);
    el.textContent = v == null ? "—" : pct(v);
    el.className = "chg " + (v == null ? "" : v >= 0 ? "up" : "down");
  }
  setKpi("revenue", money.format(c.revenue), "revenue");
  setKpi("orders", count.format(c.orders), "orders");
  setKpi("aov", money2.format(c.aov), "aov");
  setKpi("new", count.format(c.newCustomers), "newCustomers");

  const take = document.getElementById("takeaway");
  const rc = change("revenue");
  if (rc == null) {
    take.textContent = `Revenue in the last 28 days: ${money.format(c.revenue)}.`;
  } else {
    take.replaceChildren(
      "Revenue is ",
      Object.assign(document.createElement("b"), { textContent: rc >= 0 ? "up" : "down", className: rc >= 0 ? "up" : "down" }),
      " ",
      Object.assign(document.createElement("b"), { textContent: pct(Math.abs(rc)).replace("+", ""), className: rc >= 0 ? "up" : "down" }),
      " on the 28 days before."
    );
  }

  // Daily revenue chart
  const chart = document.getElementById("chart");
  function el(name, attrs, parent) {
    const node = document.createElementNS(SVG, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function niceMax(v) {
    const step = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
    return 10 * step;
  }

  function drawChart() {
    chart.replaceChildren();
    if (!days.length) return;
    const W = Math.max(280, chart.clientWidth);
    const H = 240;
    const m = { t: 8, r: 4, b: 26, l: 0 };
    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Daily revenue bar chart" }, chart);

    const max = niceMax(Math.max(...days.map((d) => d.revenue)));
    const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
    ticks.forEach((t) => {
      const tx = el("text", { class: "tick" }, svg);
      tx.textContent = money.format(t);
      m.l = Math.max(m.l, tx.getComputedTextLength());
      tx.remove();
    });
    m.l += 10;

    const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
    const step = (W - m.l - m.r) / days.length;
    const bw = Math.max(1, step * 0.72);
    const bx = (i) => m.l + i * step + (step - bw) / 2;
    const cutoff = Math.max(0, days.length - 28);

    ticks.forEach((t) => {
      el("line", { class: "grid", x1: m.l, x2: W - m.r, y1: y(t), y2: y(t) }, svg);
      const tx = el("text", { class: "tick", x: m.l - 8, y: y(t), dy: "0.32em", "text-anchor": "end" }, svg);
      tx.textContent = money.format(t);
    });

    const bars = days.map((d, i) =>
      el("rect", {
        class: "bar" + (i >= cutoff ? " cur" : ""),
        x: bx(i), width: bw, y: y(d.revenue), height: y(0) - y(d.revenue),
        rx: Math.min(2, bw / 2)
      }, svg)
    );
    if (cutoff > 0) {
      const cx = m.l + cutoff * step;
      el("line", { class: "divider", x1: cx, x2: cx, y1: m.t, y2: H - m.b }, svg);
    }
    el("line", { class: "axis", x1: m.l, x2: W - m.r, y1: y(0), y2: y(0) }, svg);

    const every = W < 480 ? 14 : 7;
    days.forEach((d, i) => {
      if ((days.length - 1 - i) % every !== 0) return;
      const tx = el("text", { class: "tick", x: bx(i) + bw / 2, y: H - 6, "text-anchor": "middle" }, svg);
      tx.textContent = shortDay.format(toDate(d.date));
    });

    const tip = document.createElement("div");
    tip.className = "tip";
    tip.hidden = true;
    chart.appendChild(tip);

    const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
    function show(ev) {
      const box = svg.getBoundingClientRect();
      const scale = box.width / W;
      const px = (ev.clientX - box.left) / scale;
      const i = Math.max(0, Math.min(days.length - 1, Math.floor((px - m.l) / step)));
      const d = days[i];
      bars.forEach((b, j) => b.setAttribute("opacity", j === i ? 1 : 0.55));
      tip.innerHTML = "";
      const a = document.createElement("div");
      a.className = "d";
      a.textContent = longDay.format(toDate(d.date));
      const b = document.createElement("div");
      b.textContent = `${money.format(d.revenue)} · ${count.format(d.orders)} orders`;
      tip.append(a, b);
      tip.hidden = false;
      const left = (bx(i) + bw / 2) * scale - tip.offsetWidth / 2;
      tip.style.left = Math.max(0, Math.min(chart.clientWidth - tip.offsetWidth, left)) + "px";
      tip.style.top = Math.max(0, y(d.revenue) * scale - tip.offsetHeight - 8) + "px";
    }
    function hide() {
      tip.hidden = true;
      bars.forEach((b) => b.setAttribute("opacity", 1));
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", hide);
  }
  drawChart();
  let lastW = chart.clientWidth;
  window.addEventListener("resize", () => {
    if (chart.clientWidth !== lastW) { lastW = chart.clientWidth; drawChart(); }
  });

  // Tables
  function row(cells) {
    const tr = document.createElement("tr");
    cells.forEach(([text, cls]) => {
      const td = document.createElement("td");
      if (text instanceof Node) td.appendChild(text); else td.textContent = text;
      if (cls) td.className = cls;
      tr.appendChild(td);
    });
    return tr;
  }

  const products = document.getElementById("products");
  [...data.products]
    .sort((a, b) => b[3] - a[3])
    .forEach(([name, category, units, revenue]) => {
      products.appendChild(row([[name], [category, "hide-sm"], [count.format(units), "num"], [money.format(revenue), "num"]]));
    });

  const orders = document.getElementById("orders");
  [...data.orders]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .forEach(([id, date, item, amount, status]) => {
      const pill = document.createElement("span");
      pill.className = "status " + String(status).toLowerCase();
      pill.textContent = status;
      orders.appendChild(row([[id], [shortDay.format(toDate(date))], [item, "hide-sm"], [money.format(amount), "num"], [pill]]));
    });
})();

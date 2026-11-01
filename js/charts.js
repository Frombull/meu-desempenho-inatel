/* Gráficos (Chart.js) no tema escuro do app. Cada função devolve { update(dados), destroy() }. */
(function (global) {
  'use strict';

  const COR = {
    nota: '#3987e5', media: '#199e70', ok: '#2fb98a', crit: '#ef6b6b',
    texto: '#b4bac1', forte: '#eceff1', grade: 'rgba(255,255,255,.07)', meta: '#cfd4da', fundo: '#1e1e1e'
  };

  Chart.defaults.font.family = 'Roboto, system-ui, sans-serif';
  Chart.defaults.font.size = 12;
  Chart.defaults.color = COR.texto;
  Chart.defaults.animation.duration = 350;

  /** Plugin: delega o desenho extra (linha de meta, rótulos, marcadores) à função do gráfico. */
  const overlay = {
    id: 'overlay',
    afterDatasetsDraw(chart, _args, opts) { if (opts && opts.draw) opts.draw(chart, chart.ctx); }
  };
  Chart.register(overlay);

  function hachura(cor) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const g = c.getContext('2d');
    g.strokeStyle = cor; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-2, 10); g.lineTo(10, -2); g.moveTo(-2, 6); g.lineTo(6, -2); g.moveTo(2, 10); g.lineTo(10, 2); g.stroke();
    return g.createPattern(c, 'repeat');
  }

  /** Linha tracejada de referência. modo: 'fora' (rótulo à direita da área do gráfico) ou 'dir'/'esq' (sobre a linha). */
  function linhaHorizontal(chart, ctx, y, rotulo, modo = 'dir') {
    const { left, right } = chart.chartArea;
    const py = chart.scales.y.getPixelForValue(y);
    ctx.save();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = COR.meta; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(left, py); ctx.lineTo(right, py); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '500 11px Roboto, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    if (modo === 'fora') {
      ctx.fillStyle = COR.meta; ctx.fillText(rotulo, right + 6, py);
    } else {
      const w = ctx.measureText(rotulo).width + 10;
      const x = modo === 'dir' ? right - w : left;
      ctx.fillStyle = COR.fundo; ctx.fillRect(x, py - 17, w, 15);
      ctx.fillStyle = COR.meta; ctx.fillText(rotulo, x + 5, py - 9.5);
    }
    ctx.restore();
  }

  const eixoY = (max = 100, min = 0, passo = 25) => ({
    min, max, ticks: { stepSize: passo, color: COR.texto }, grid: { color: COR.grade }, border: { display: false }
  });

  /* ---------- Barras: avaliações + média ---------- */
  function barras(canvas) {
    let estado = { itens: [], meta: 60 };
    const chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderColor: [], borderWidth: 0, borderRadius: 4, maxBarThickness: 38 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 18, right: 46 } },
        scales: { y: eixoY(), x: { grid: { display: false }, border: { color: '#444' }, ticks: { color: COR.forte } } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => { const it = estado.itens[c.dataIndex]; return `${it.rotuloTipo}: ${it.tipo === 'media' ? Fmt.num(c.parsed.y) : Math.round(c.parsed.y)}`; } } },
          overlay: {
            draw(ch, ctx) {
              linhaHorizontal(ch, ctx, estado.meta, `Meta ${estado.meta}`, 'fora');
              ctx.save(); ctx.font = '500 12px Roboto, sans-serif'; ctx.fillStyle = COR.forte; ctx.textAlign = 'center';
              ch.getDatasetMeta(0).data.forEach((bar, i) => {
                const it = estado.itens[i]; if (!it) return;
                ctx.fillText(it.tipo === 'media' ? Fmt.num(it.valor) : Math.round(it.valor), bar.x, bar.y - 5);
              });
              ctx.restore();
            }
          }
        }
      }
    });
    const padrao = hachura(COR.nota);
    return {
      update(dados) {
        estado = dados;
        const ds = chart.data.datasets[0];
        chart.data.labels = dados.itens.map(i => i.nome);
        ds.data = dados.itens.map(i => i.valor);
        ds.backgroundColor = dados.itens.map(i => i.tipo === 'media' ? COR.media : i.tipo === 'simulada' ? padrao : COR.nota);
        ds.borderColor = dados.itens.map(i => i.tipo === 'simulada' ? COR.nota : 'transparent');
        ds.borderWidth = dados.itens.map(i => i.tipo === 'simulada' ? 2 : 0);
        chart.update();
      },
      destroy() { chart.destroy(); }
    };
  }

  /* ---------- Linha: média final x nota nas pendentes ---------- */
  function sensibilidade(canvas) {
    let estado = { y0: 0, y100: 0, meta: 60, x: 0, y: 0, necessaria: null };
    const chart = new Chart(canvas, {
      type: 'line',
      data: { datasets: [{ data: [], borderColor: COR.nota, borderWidth: 2.5, pointRadius: 0, fill: false }] },
      options: {
        responsive: true, maintainAspectRatio: false, parsing: false,
        layout: { padding: { top: 6, right: 46 } },
        interaction: { mode: 'nearest', intersect: false },
        scales: {
          y: eixoY(),
          x: { type: 'linear', min: 0, max: 100, grid: { color: COR.grade }, border: { color: '#444' }, ticks: { stepSize: 20 },
               title: { display: true, text: 'Nota nas avaliações pendentes', color: COR.texto } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: i => `Se tirar ${Math.round(i[0].parsed.x)}`, label: c => `Média final: ${Fmt.num(c.parsed.y)}` } },
          overlay: {
            draw(ch, ctx) {
              const e = estado, { bottom } = ch.chartArea, sx = ch.scales.x, sy = ch.scales.y;
              linhaHorizontal(ch, ctx, e.meta, `Meta ${e.meta}`, 'fora');
              ctx.save();
              if (e.necessaria !== null && e.necessaria <= 100) {
                const px = sx.getPixelForValue(e.necessaria), py = sy.getPixelForValue(e.meta);
                ctx.setLineDash([3, 3]); ctx.strokeStyle = COR.ok; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, bottom); ctx.stroke(); ctx.setLineDash([]);
                ctx.fillStyle = COR.ok; ctx.font = '500 11px Roboto, sans-serif'; ctx.textAlign = e.necessaria > 70 ? 'right' : 'left';
                ctx.fillText(`precisa de ${e.necessaria}`, px + (e.necessaria > 70 ? -5 : 5), bottom - 6);
              }
              const px = sx.getPixelForValue(e.x), py = sy.getPixelForValue(e.y);
              ctx.fillStyle = COR.fundo; ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.fill();
              ctx.fillStyle = e.y >= e.meta - 1e-9 ? COR.ok : COR.crit; ctx.beginPath(); ctx.arc(px, py, 6, 0, 7); ctx.fill();
              ctx.restore();
            }
          }
        }
      }
    });
    return {
      update(dados) {
        estado = dados;
        chart.data.datasets[0].data = [{ x: 0, y: dados.y0 }, { x: 100, y: dados.y100 }];
        chart.update();
      },
      destroy() { chart.destroy(); }
    };
  }

  /* ---------- Linha: frequência x aulas que vou faltar ---------- */
  function frequencia(canvas, aoEscolher) {
    let estado = { pontos: [], minimo: 75, sel: 0 };
    const chart = new Chart(canvas, {
      type: 'line',
      data: { labels: [], datasets: [{ data: [], borderColor: '#7f8793', borderWidth: 2, tension: 0, pointRadius: 5, pointHoverRadius: 8, pointHitRadius: 18, pointBackgroundColor: [], pointBorderColor: COR.fundo, pointBorderWidth: 2 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 8 } },
        interaction: { mode: 'nearest', axis: 'x', intersect: false },
        onClick(_e, els) { if (els.length && aoEscolher) aoEscolher(els[0].index); },
        scales: {
          y: { min: 50, max: 100, ticks: { stepSize: 10, callback: v => v + '%' }, grid: { color: COR.grade }, border: { display: false } },
          x: { grid: { display: false }, border: { color: '#444' }, ticks: { color: COR.forte }, title: { display: true, text: 'Aulas que vou faltar a partir de hoje', color: COR.texto } }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { title: i => `Faltar mais ${i[0].label} aula(s)`, label: c => `Frequência: ${Fmt.pct(c.parsed.y)}` } },
          overlay: {
            draw(ch, ctx) {
              linhaHorizontal(ch, ctx, estado.minimo, `mínimo ${estado.minimo}%`, 'dir');
              const pt = ch.getDatasetMeta(0).data[estado.sel];
              if (!pt) return;
              ctx.save(); ctx.strokeStyle = COR.forte; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(pt.x, pt.y, 9, 0, 7); ctx.stroke(); ctx.restore();
            }
          }
        }
      }
    });
    return {
      update(dados) {
        estado = dados;
        const ds = chart.data.datasets[0];
        chart.data.labels = dados.pontos.map((_, k) => k);
        ds.data = dados.pontos;
        ds.pointBackgroundColor = dados.pontos.map(p => p >= dados.minimo - 1e-9 ? COR.ok : COR.crit);
        chart.options.scales.y.min = Math.max(0, Math.floor((Math.min(...dados.pontos, dados.minimo) - 5) / 10) * 10);
        chart.update();
      },
      destroy() { chart.destroy(); }
    };
  }

  global.Charts = { barras, sensibilidade, frequencia };
})(window);

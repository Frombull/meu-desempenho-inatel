/*
 * Telas do protótipo. Cada função devolve { el, destroy?, sujo?, limpar? }.
 *   Avisos e Notas: telas que já existem no app (com o botão "simular" novo).
 *   Meu Desempenho (lista) e Simulador: telas novas.
 */
(function (global) {
  'use strict';
  const { Avaliacao, Meta, MetaRepositorio, Simulador, Situacao } = global.Model;
  const aluno = global.Dados.aluno;
  const $ = (s, r) => (r || document).querySelector(s);

  const html = (strings, ...v) => strings.reduce((a, s, i) => a + s + (v[i] ?? ''), '');
  const secao = (classe, inner) => { const el = document.createElement('section'); el.className = `screen ${classe || ''}`; el.innerHTML = inner; return el; };
  const nota = n => (Number.isInteger(n) ? String(n) : Fmt.num(n));
  const dec2 = n => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  /* =============== AVISOS (existente) =============== */
  function avisos() {
    const itens = [
      ['CRA', 'Pendências comuns da matrícula', 'Confira se há pendências documentais ou financeiras antes da rematrícula do próximo período.', 'há 2 dias'],
      ['CRA', 'Transferência interna de curso', 'Abertas as inscrições para transferência interna. Consulte o edital no portal.', 'há 4 dias'],
      ['BIBLIOTECA', 'Horário especial de provas', 'Durante a semana de provas a biblioteca funcionará até as 23h.', 'há 6 dias'],
      ['TESOURARIA', 'Boletos de dezembro disponíveis', 'Os boletos já podem ser consultados no menu Financeiro.', 'há 1 semana']
    ];
    const el = secao('stagger', itens.map(([tag, tt, tx, dt]) => html`
      <article class="aviso"><div class="tag">${tag}</div><div class="tt">${tt}</div><div class="tx">${tx}</div><div class="dt">${dt}</div></article>`).join(''));
    return { el };
  }

  /* =============== NOTAS (existente + botão simular) =============== */
  function notas(app) {
    const cards = aluno.listarDisciplinas().map(d => html`
      <article class="nota-card">
        <div class="nc-head">
          <div class="nc-title">${d.titulo}</div>
          <button class="nc-act" data-acao="grafico" aria-label="Gráfico de ${esc(d.nome)}">${Icons.svg('chart', 'sm')}gráfico</button>
          <button class="nc-act sim" data-acao="simular" data-cod="${d.codigo}" aria-label="Simular notas de ${esc(d.nome)}"><span class="tag-novo">NOVO</span>${Icons.svg('calc', 'sm')}simular</button>
        </div>
        <div class="tbl">
          <div class="tr hd"><div class="a">Avaliação</div><div class="n">Nota</div></div>
          ${d.avaliacoes.map(a => `<div class="tr"><div class="a">${a.nome}</div><div class="n">${a.realizada ? a.nota : '-'}</div></div>`).join('')}
        </div>
      </article>`).join('');
    const el = secao('stagger', cards);
    el.addEventListener('click', e => {
      const b = e.target.closest('.nc-act');
      if (!b) return;
      if (b.dataset.acao === 'grafico') return UI.toast('O gráfico de notas já existe no app atual e não faz parte deste protótipo.');
      app.ir(`simulador/${b.dataset.cod}?de=notas`);
    });
    return { el };
  }

  /* =============== MEU DESEMPENHO: escolher disciplina (nova) =============== */
  function desempenho(app) {
    const linhas = aluno.listarDisciplinas().map((d, i) => {
      const sit = d.situacao();
      const salva = MetaRepositorio.obter(d.codigo);
      const destaque = sit === Situacao.EM_RISCO || sit.startsWith('REPROVADO');
      return html`
        <button class="li ${destaque ? 'destaque' : ''}" data-cod="${d.codigo}" style="animation-delay:${i * 0.04}s">
          <span class="li-main"><div class="li-name">${d.tituloCurto}</div>
            ${salva !== null ? `<div class="li-meta">Meta salva: ${salva}</div>` : `<div class="li-meta">Frequência ${Fmt.pct(d.frequencia.percentual())}</div>`}
          </span>
          ${UI.chipLista(d)}${Icons.svg('chevron', 'chev')}
        </button>`;
    }).join('');
    const el = secao('', html`
      <div class="band" style="margin:-12px -12px 0">Disciplinas Matriculadas</div>
      <div class="lista" style="margin:0 -12px">${linhas}</div>
      <p class="legenda">Toque em uma disciplina para simular suas notas e faltas. A etiqueta mostra a situação hoje.</p>`);
    el.addEventListener('click', e => {
      const b = e.target.closest('.li');
      if (b) app.ir(`simulador/${b.dataset.cod}?de=desempenho`);
    });
    return { el };
  }

  /* =============== SIMULADOR (novo) =============== */
  function simulador(app, codigo, origem) {
    const disc = aluno.listarDisciplinas().find(d => d.codigo === codigo);
    if (!disc) { app.ir('desempenho'); return { el: document.createElement('div') }; }

    const pend = disc.pendentes();
    const temPend = pend.length > 0;
    const metaSalva = MetaRepositorio.obter(codigo);
    const st = { meta: metaSalva ?? disc.notaMinima, hip: {}, k: 0, sujo: false, salva: metaSalva };
    const aulasNomes = pend.map(a => a.nome);

    function ressincronizar() {      // coloca cada nota simulada na nota necessária (limitada a 0-100)
      const nec = Simulador.notaNecessaria(disc, new Meta(disc, st.meta));
      pend.forEach(a => { st.hip[a.nome] = Math.min(100, nec ?? 0); });
    }
    ressincronizar();

    /* ---- estrutura ---- */
    const slidersHtml = pend.map(a => html`
      <div class="slider-wrap">
        <div class="field-label"><label for="sl-${a.nome}">Nota simulada na ${a.nome}</label><b id="sv-${a.nome}">0</b></div>
        <input type="range" id="sl-${a.nome}" data-nome="${a.nome}" min="0" max="100" step="1" value="0">
        <div class="range-scale"><span>0</span><span>100</span></div>
      </div>`).join('');

    const el = secao('stagger', html`
      <div class="sim-head"><h3>${disc.titulo}</h3><span id="tagSalva"></span></div>
      <div class="alerts" id="alTop" aria-live="polite"></div>

      <div class="card">
        <div class="tbl" id="tbl"></div>
        ${temPend ? html`<div style="margin-top:14px">${slidersHtml}</div>
          <button class="link-btn" id="usarNec">Usar a nota necessária</button>` : ''}
      </div>

      ${temPend ? html`
      <div class="card" id="cardMeta">
        <div class="field-label"><label for="metaIn">Meta de média</label><span class="mut">mínimo ${disc.notaMinima}</span></div>
        <div class="stepper">
          <button class="st-btn" id="metaMenos" aria-label="Diminuir meta">${Icons.svg('remove')}</button>
          <input class="st-input" id="metaIn" inputmode="numeric" autocomplete="off" value="${st.meta}" aria-describedby="metaHelp">
          <button class="st-btn" id="metaMais" aria-label="Aumentar meta">${Icons.svg('add')}</button>
        </div>
        <div class="help" id="metaHelp">Digite ou use + e −. Valores de ${disc.notaMinima} a 100.</div>
      </div>` : ''}

      <div class="card result" id="result">
        ${temPend ? html`<div class="rrow"><span class="rlabel" id="necLabel"></span><span class="big" id="nec"><span id="necV">0</span> <small id="necMax"></small></span></div><div class="divider"></div>` : ''}
        <div class="rrow"><span class="rlabel">${temPend ? 'Média projetada' : 'Média final'}</span><span class="big" id="med">0</span></div>
        <div class="rrow"><span class="rlabel" id="metaStatus"></span><span id="chipSit"></span></div>
        <div class="insight" id="insight"></div>
      </div>

      <div class="alerts" id="alMeta" aria-live="polite"></div>

      <div class="card">
        <h3>Notas e média</h3>
        <div class="sub">${temPend ? 'Barras hachuradas são notas simuladas.' : 'Notas lançadas e média final.'}</div>
        <div class="chart-box"><canvas id="cBarras" role="img" aria-label="Gráfico de barras das notas e da média projetada"></canvas></div>
        <div class="legend"><span><i style="background:var(--s-nota)"></i>Nota lançada</span>${temPend ? '<span><i class="hatch"></i>Simulada</span>' : ''}<span><i style="background:var(--s-media)"></i>Média</span><span><i class="dash"></i>Meta</span></div>
      </div>

      ${temPend ? html`
      <div class="card">
        <h3>E se eu tirar…?</h3>
        <div class="sub">Média final conforme a nota ${pend.length > 1 ? 'tirada em todas as avaliações pendentes' : 'na ' + pend[0].nome}.</div>
        <div class="chart-box short"><canvas id="cSens" role="img" aria-label="Gráfico da média final conforme a nota nas avaliações pendentes"></canvas></div>
      </div>` : ''}

      <div class="card">
        <h3>Frequência</h3>
        <div class="sub">Mínimo de ${disc.frequencia.minimo}% das aulas dadas.</div>
        <div class="freq-bar"><div class="freq-fill" id="ffill"></div><div class="freq-min"></div></div>
        <div class="freq-txt"><span id="ftxt"></span><span id="frest"></span></div>
        <div class="field-label" style="margin-top:14px"><span>Se eu faltar mais…</span></div>
        <div class="stepper">
          <button class="st-btn" id="kMenos" aria-label="Faltar menos uma aula">${Icons.svg('remove')}</button>
          <div class="st-input" id="kVal" style="display:grid;place-items:center" aria-live="polite">0 aulas</div>
          <button class="st-btn" id="kMais" aria-label="Faltar mais uma aula">${Icons.svg('add')}</button>
        </div>
        <div class="chart-box short" style="margin-top:12px"><canvas id="cFreq" role="img" aria-label="Gráfico da frequência conforme as aulas faltadas"></canvas></div>
        <div class="help">Toque em um ponto do gráfico para simular.</div>
        <div class="proximas"><h3 style="font-size:14px;margin-bottom:4px">Próximas aulas</h3><div id="prox"></div></div>
      </div>

      ${temPend ? html`
      <div class="sim-footer">
        <button class="btn primary block" id="salvar">Salvar meta</button>
        <div class="hint-saved" id="hintSalvar"></div>
      </div>` : ''}`);

    /* ---- referências ---- */
    const q = s => el.querySelector(s);
    const tbl = q('#tbl'), alTop = q('#alTop'), alMeta = q('#alMeta');
    const grafBarras = Charts.barras(q('#cBarras'));
    const grafSens = temPend ? Charts.sensibilidade(q('#cSens')) : null;
    const grafFreq = Charts.frequencia(q('#cFreq'), k => definirFaltas(k));
    let ultimaSit = null, ultimoNec = null;

    /* ---- tabela de avaliações ---- */
    function celulaSim(a) { return `<div class="n sim" data-cel="${a.nome}"><span class="v">${st.hip[a.nome]}</span> <small>(simulada)</small></div>`; }
    function renderTabela() {
      const labs = disc.avaliacoes.filter(a => a.tipo === 'lab');
      const labsFechados = labs.length > 0 && labs.every(a => a.realizada);
      let rows = '<div class="tr hd"><div class="a">Avaliação</div><div class="n">Nota</div></div>', labsFeito = false;
      disc.avaliacoes.forEach(a => {
        if (a.tipo === 'lab' && labsFechados) {
          if (!labsFeito) {
            const media = labs.reduce((s, l) => s + l.nota, 0) / labs.length;
            rows += `<div class="tr"><div class="a">Labs (${labs[0].nome}–${labs[labs.length - 1].nome})</div><div class="n">${nota(media)}</div></div>`;
            labsFeito = true;
          }
          return;
        }
        rows += `<div class="tr"><div class="a">${a.nome}</div>${a.realizada ? `<div class="n">${a.nota}</div>` : celulaSim(a)}</div>`;
      });
      tbl.innerHTML = rows;
    }

    /* ---- atualização completa a partir do estado ---- */
    function atualizar({ origemMeta = false } = {}) {
      const meta = new Meta(disc, st.meta);
      const hipoteses = pend.map(a => new Avaliacao(a.nome, a.peso, st.hip[a.nome]));
      const cen = aluno.simular(disc, hipoteses, meta, st.k);
      const nec = Simulador.notaNecessaria(disc, meta);

      // tabela e sliders
      pend.forEach(a => {
        const v = st.hip[a.nome];
        const inp = q(`#sl-${a.nome}`);
        inp.value = v; inp.style.setProperty('--pct', v + '%');
        inp.setAttribute('aria-valuetext', `${v} pontos`);
        q(`#sv-${a.nome}`).textContent = v;
        const cel = tbl.querySelector(`[data-cel="${a.nome}"] .v`);
        if (cel) cel.textContent = v;
      });

      // nota necessária
      if (temPend) {
        q('#necLabel').textContent = pend.length === 1 ? `Nota necessária na ${pend[0].nome}` : `Nota necessária em cada (${aulasNomes.join(', ')})`;
        const necEl = q('#nec');
        UI.animarNumero(q('#necV'), nec, v => Math.round(v));
        const imposs = nec > 100;
        necEl.className = 'big ' + (imposs ? 'crit' : nec > disc.notaMinima ? 'warn' : 'ok');
        q('#necMax').textContent = imposs ? 'máx. 100' : '';
      }

      // média projetada
      const medEl = q('#med');
      UI.animarNumero(medEl, cen.mediaProjetada, v => Fmt.num(v));
      const okMedia = cen.mediaProjetada >= disc.notaMinima - 1e-9;
      medEl.className = 'big ' + (!okMedia ? 'crit' : (temPend && !cen.metaAtingida) ? 'warn' : 'ok');
      q('#chipSit').innerHTML = UI.chipSituacao(cen.situacao);
      q('#metaStatus').textContent = !temPend ? 'Situação final'
        : cen.metaAtingida ? `Meta ${st.meta} atingida` : `Faltam ${Fmt.num(st.meta - cen.mediaProjetada)} ponto(s) para a meta ${st.meta}`;
      const somaPeso = pend.reduce((s, a) => s + a.peso, 0);
      q('#insight').textContent = temPend
        ? `Cada ponto ${pend.length > 1 ? 'em todas as avaliações pendentes' : 'na ' + pend[0].nome} vale ${dec2(somaPeso)} na média final.`
        : 'Todas as avaliações já foram lançadas.';

      if (ultimaSit !== null && ultimaSit !== cen.situacao) UI.vibrar(12);
      ultimaSit = cen.situacao;
      if (origemMeta || nec !== ultimoNec) { const r = q('#result'); r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse'); }
      ultimoNec = nec;

      // gráficos
      const itens = disc.avaliacoes.map(a => ({
        nome: a.nome, valor: a.realizada ? a.nota : st.hip[a.nome],
        tipo: a.realizada ? 'lancada' : 'simulada', rotuloTipo: a.realizada ? 'Nota lançada' : 'Nota simulada'
      }));
      itens.push({ nome: 'Média', valor: cen.mediaProjetada, tipo: 'media', rotuloTipo: temPend ? 'Média projetada' : 'Média final' });
      grafBarras.update({ itens, meta: st.meta });
      if (grafSens) {
        const m0 = Simulador.mediaComNotaUniforme(disc, 0), m100 = Simulador.mediaComNotaUniforme(disc, 100);
        const x = Math.round(pend.reduce((s, a) => s + st.hip[a.nome], 0) / pend.length);
        grafSens.update({ y0: m0, y100: m100, meta: st.meta, x, y: Simulador.mediaComNotaUniforme(disc, x), necessaria: nec });
      }

      // frequência
      const f = disc.frequencia, fp = cen.frequenciaProjetada;
      const fill = q('#ffill');
      fill.style.width = fp + '%';
      fill.className = 'freq-fill ' + (fp < f.minimo - 1e-9 ? 'crit' : cen.faltasRestantes <= 1 ? 'warn' : '');
      q('#ftxt').innerHTML = `<b>${Fmt.pct(fp)}</b> · ${f.faltas + st.k} faltas`;
      q('#frest').innerHTML = fp < f.minimo - 1e-9 ? '<b style="color:var(--crit)">abaixo do mínimo</b>'
        : cen.faltasRestantes === 0 ? '<b style="color:var(--warn)">não pode mais faltar</b>'
        : `pode faltar mais <b>${cen.faltasRestantes} aula${cen.faltasRestantes > 1 ? 's' : ''}</b>`;
      q('#kVal').textContent = st.k === 0 ? 'nenhuma aula' : `${st.k} aula${st.k > 1 ? 's' : ''}`;
      q('#kMenos').disabled = st.k === 0; q('#kMais').disabled = st.k === 8;
      grafFreq.update({ pontos: Array.from({ length: 9 }, (_, k) => f.percentual(k)), minimo: f.minimo, sel: st.k });
      q('#prox').innerHTML = disc.aulas.map(a => `<div class="pr"><span>${a}</span>${cen.faltasRestantes <= 1 ? UI.chip('warn', 'presença importante') : ''}</div>`).join('');

      // alertas
      alTop.innerHTML = ''; alMeta.innerHTML = '';
      cen.gerarAlertas().forEach(al => {
        const top = al.tipo === 'FALTAS' || al.tipo === 'FALTA_REPROVA';
        al.exibir(top ? alTop : alMeta, a => {
          if (a.tipo === 'META_INATINGIVEL') { UI.marcar('ajustar'); definirMeta(a.acao.valor, true); }
        });
      });

      // salvar e etiqueta de meta salva
      q('#tagSalva').innerHTML = st.salva !== null ? UI.chip('neutral', `Meta salva: ${st.salva}`) : '';
      if (temPend) {
        const btn = q('#salvar');
        const bloqueado = !meta.atingivel;
        btn.setAttribute('aria-disabled', bloqueado);
        q('#hintSalvar').textContent = bloqueado ? 'Ajuste a meta para um valor possível para salvar.'
          : st.sujo || st.salva !== st.meta ? '' : 'Meta já salva.';
      }
    }

    /* ---- ações ---- */
    function marcarSujo() { st.sujo = true; }
    function definirMeta(v, deAcao = false) {
      const novo = Math.min(100, Math.max(disc.notaMinima, v));
      if (novo === st.meta && !deAcao) return;
      st.meta = novo;
      q('#metaIn').value = st.meta;
      q('#metaIn').classList.remove('bad');
      const h = q('#metaHelp'); h.className = 'help'; h.textContent = `Digite ou use + e −. Valores de ${disc.notaMinima} a 100.`;
      marcarSujo(); ressincronizar();
      if (!new Meta(disc, st.meta).atingivel) UI.marcar('metaImpossivel');
      atualizar({ origemMeta: true });
      tbl.querySelectorAll('.n.sim').forEach(c => { c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash'); });
    }
    function definirFaltas(k) {
      st.k = Math.max(0, Math.min(8, k));
      if (st.k > 0) UI.marcar('faltas');
      marcarSujo(); atualizar();
    }

    if (temPend) {
      el.addEventListener('input', e => {
        if (e.target.type === 'range') {
          st.hip[e.target.dataset.nome] = +e.target.value;
          marcarSujo(); UI.marcar('slider'); atualizar();
        }
      });
      q('#usarNec').addEventListener('click', () => { ressincronizar(); atualizar({ origemMeta: true }); UI.toast('Notas simuladas ajustadas para a nota necessária.'); });

      UI.segurar(q('#metaMenos'), () => definirMeta(st.meta - 1));
      UI.segurar(q('#metaMais'), () => definirMeta(st.meta + 1));
      const mi = q('#metaIn');
      const confirmar = () => {
        const txt = mi.value.trim();
        const v = Number(txt.replace(',', '.'));
        if (txt === '' || !Number.isFinite(v) || v < disc.notaMinima || v > 100) {
          mi.classList.remove('bad'); void mi.offsetWidth; mi.classList.add('bad');
          const h = q('#metaHelp'); h.className = 'help bad';
          h.textContent = txt === '' ? 'Informe um valor.' : `Valor inválido. Digite de ${disc.notaMinima} a 100.`;
          mi.value = st.meta;
          return;
        }
        if (Math.round(v) !== st.meta) definirMeta(Math.round(v)); else mi.value = st.meta;
      };
      mi.addEventListener('change', confirmar);
      mi.addEventListener('keydown', e => { if (e.key === 'Enter') mi.blur(); });
      mi.addEventListener('focus', () => mi.select());

      q('#salvar').addEventListener('click', () => {
        const meta = new Meta(disc, st.meta);
        if (!meta.atingivel) return UI.toast(`Meta inatingível: a média máxima possível é ${Fmt.num(disc.mediaMaxima())}. Ajuste a meta para salvar.`);
        meta.salvar(); st.salva = st.meta; st.sujo = false;
        UI.marcar('salvar'); UI.vibrar(20);
        atualizar();
        const nec = Simulador.notaNecessaria(disc, meta);
        UI.modal({
          titulo: 'Meta salva!',
          icone: `<svg class="ico check-anim" viewBox="0 0 24 24" style="color:var(--ok)" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.5 3.5L17 9"/></svg>`,
          corpo: nec === 0 ? `Meta <b>${st.meta}</b> em ${esc(disc.nome)}. Você já está acima dela.`
            : `Meta <b>${st.meta}</b> em ${esc(disc.nome)}.<br>Você precisa de <b>${nec}</b> ${pend.length > 1 ? 'em cada avaliação pendente' : 'na ' + pend[0].nome}.`,
          acoes: [
            { rotulo: 'Ver notas', tipo: 'primary', fn: () => app.ir('notas') },
            { rotulo: 'Fechar', tipo: 'outline' }
          ]
        });
      });
    }
    UI.segurar(q('#kMenos'), () => definirFaltas(st.k - 1));
    UI.segurar(q('#kMais'), () => definirFaltas(st.k + 1));

    renderTabela();
    atualizar();
    if (codigo === 'M210') UI.marcar('disciplina');

    return {
      el,
      destroy() { grafBarras.destroy(); grafFreq.destroy(); if (grafSens) grafSens.destroy(); },
      sujo: () => st.sujo,
      limpar: () => { st.sujo = false; }
    };
  }

  global.Telas = { avisos, notas, desempenho, simulador };
})(window);

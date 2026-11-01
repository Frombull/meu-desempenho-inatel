/* Casca do app: barra superior, menu lateral, rotas (hash) e painel do desktop. */
(function (global) {
  'use strict';
  const { MetaRepositorio } = global.Model;
  const aluno = global.Dados.aluno;
  const $ = s => document.querySelector(s);

  const TITULOS = { avisos: 'Avisos', notas: 'Notas', desempenho: 'Meu Desempenho', simulador: 'Meu Desempenho' };
  const PROFUNDIDADE = { avisos: 0, notas: 1, desempenho: 1, simulador: 2 };
  const MENU_ATIVO = { avisos: 'avisos', notas: 'notas', desempenho: 'desempenho', simulador: 'desempenho' };

  const MENU = [
    { sec: 'Mensagens Acadêmicas' },
    { id: 'avisos', rotulo: 'Avisos', icone: 'bell', rota: 'avisos' },
    { sec: 'Aproveitamento Escolar' },
    { id: 'notas', rotulo: 'Notas', icone: 'list', rota: 'notas' },
    { id: 'freq', rotulo: 'Frequência', icone: 'pct' },
    { id: 'desempenho', rotulo: 'Meu Desempenho', icone: 'trend', rota: 'desempenho', novo: true },
    { id: 'mat', rotulo: 'Material Didático', icone: 'book' },
    { id: 'plano', rotulo: 'Plano de Ensino', icone: 'list' },
    { id: 'hist', rotulo: 'Histórico', icone: 'history' },
    { id: 'coef', rotulo: 'Coeficientes', icone: 'chart' },
    { sec: 'Atividades Complementares' },
    { id: 'aval', rotulo: 'Avaliações', icone: 'school' },
    { sec: 'Calendários e Horários' },
    { id: 'provas', rotulo: 'Provas', icone: 'event' },
    { id: 'horarios', rotulo: 'Horários de Aula', icone: 'event' },
    { sec: 'Financeiro' },
    { id: 'teso', rotulo: 'Tesouraria', icone: 'wallet' },
    { sec: 'Outras Opções' },
    { id: 'req', rotulo: 'Requerimentos', icone: 'more' }
  ];

  const App = {
    atual: null,      // { rota, nome, tela }
    ignorar: false,

    ir(rota) {
      const alvo = '#/' + rota;
      if (location.hash === alvo) this._aoMudar(); else location.hash = alvo;
    },

    _analisar(hash) {
      const [caminho, consulta = ''] = hash.replace(/^#\/?/, '').split('?');
      const [nome, param] = caminho.split('/');
      return { rota: caminho || 'avisos', nome: TITULOS[nome] ? nome : 'avisos', param, de: new URLSearchParams(consulta).get('de') };
    },

    _aoMudar() {
      if (this.ignorar) { this.ignorar = false; return; }
      const novo = this._analisar(location.hash);
      const ant = this.atual;
      // sair do simulador com alteração não salva pede confirmação
      if (ant && ant.tela.sujo && ant.tela.sujo() && ant.hash !== location.hash) {
        const destino = location.hash;
        this.ignorar = true;
        location.hash = ant.hash;
        UI.modal({
          titulo: 'Sair sem salvar?',
          corpo: 'Sua meta não foi salva e será perdida.',
          acoes: [
            { rotulo: 'Continuar editando', tipo: 'primary' },
            { rotulo: 'Sair', tipo: 'outline', fn: () => { ant.tela.limpar(); location.hash = destino; } }
          ]
        });
        return;
      }
      this._renderizar(novo);
    },

    _renderizar(r) {
      const ant = this.atual;
      if (ant && ant.tela.destroy) ant.tela.destroy();
      const tela = r.nome === 'avisos' ? Telas.avisos(this)
        : r.nome === 'notas' ? Telas.notas(this)
        : r.nome === 'desempenho' ? Telas.desempenho(this)
        : Telas.simulador(this, r.param, r.de);
      const voltando = ant && PROFUNDIDADE[r.nome] < PROFUNDIDADE[ant.nome];
      tela.el.classList.add(voltando ? 'enter-back' : 'enter-fwd');
      const view = $('#view');
      view.replaceChildren(tela.el);
      view.scrollTop = 0;
      this.atual = { rota: r.rota, nome: r.nome, hash: location.hash || '#/avisos', de: r.de, tela };
      this._barra(r);
      this._marcarMenu();
      if (r.nome === 'desempenho') UI.marcar('desempenho');
      if (r.nome !== 'avisos') this._sumirDica();
    },

    _barra(r) {
      const esq = $('#abLeft'), dir = $('#abRight');
      const voltar = r.nome === 'simulador';
      esq.innerHTML = Icons.svg(voltar ? 'back' : 'menu');
      esq.setAttribute('aria-label', voltar ? 'Voltar' : 'Abrir menu');
      esq.dataset.modo = voltar ? 'voltar' : 'menu';
      const busca = r.nome === 'avisos' || r.nome === 'notas';
      dir.innerHTML = busca ? Icons.svg('search') : '';
      dir.disabled = !busca;
      $('#abTitle').textContent = TITULOS[r.nome];
      esq.classList.toggle('pulse', r.nome === 'avisos' && !this._menuAberto);
    },

    voltar() {
      const a = this.atual;
      this.ir(a.de === 'notas' ? 'notas' : 'desempenho');
    },

    /* ---- menu lateral ---- */
    _montarMenu() {
      const d = $('#drawer');
      d.innerHTML = `
        <div class="dr-prof"><div class="dr-avatar">${aluno.nome[0]}</div><div class="dr-name">${aluno.nome}</div><div class="dr-mail">${aluno.email}</div></div>` +
        MENU.map(i => i.sec ? `<div class="dr-sec">${i.sec}</div>`
          : `<button class="dr-item ${i.novo ? 'novo' : ''}" data-id="${i.id}" ${i.rota ? `data-rota="${i.rota}"` : ''}>${Icons.svg(i.icone)}<span>${i.rotulo}</span>${i.novo ? '<span class="tag-novo">NOVO</span>' : ''}</button>`).join('');
      d.addEventListener('click', e => {
        const b = e.target.closest('.dr-item');
        if (!b) return;
        this.fecharMenu();
        if (b.dataset.rota) { if (b.dataset.id === 'desempenho') UI.marcar('desempenho'); this.ir(b.dataset.rota); }
        else setTimeout(() => UI.toast(`“${b.querySelector('span').textContent}” já existe no App Inatel e não faz parte deste protótipo.`), 200);
      });
    },
    _marcarMenu() {
      document.querySelectorAll('.dr-item').forEach(b => b.classList.toggle('active', b.dataset.id === MENU_ATIVO[this.atual.nome]));
    },
    abrirMenu() {
      this._menuAberto = true;
      $('#drawer').classList.add('on'); $('#scrim').classList.add('on');
      $('#drawer').setAttribute('aria-hidden', 'false');
      $('#abLeft').classList.remove('pulse');
      this._sumirDica();
      UI.marcar('menu');
      $('#drawer .dr-item.active, #drawer .dr-item').focus();
    },
    fecharMenu() {
      $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on');
      $('#drawer').setAttribute('aria-hidden', 'true');
    },

    /* ---- dica de primeiro uso ---- */
    _dica() {
      if (this._menuAberto) return;
      const c = document.createElement('div');
      c.className = 'coach'; c.id = 'coach';
      c.innerHTML = 'Comece aqui: abra o menu <b>☰</b> e toque em <b>Meu Desempenho</b>.';
      $('#app').appendChild(c);
    },
    _sumirDica() { const c = $('#coach'); if (c) c.remove(); },

    reiniciar() {
      MetaRepositorio.limpar();
      UI.zerarRoteiro();
      this._menuAberto = false;
      this.fecharMenu();
      if (UI.modalAberto()) UI.fecharModal();
      if (this.atual) this.atual.tela.limpar && this.atual.tela.limpar();
      this.ir('avisos');
      setTimeout(() => { this._barra(this._analisar('#/avisos')); this._sumirDica(); this._dica(); }, 50);
    },

    iniciar() {
      this._montarMenu();
      $('#abLeft').addEventListener('click', () => ($('#abLeft').dataset.modo === 'voltar' ? this.voltar() : this.abrirMenu()));
      $('#abRight').addEventListener('click', () => UI.toast('A busca já existe no App Inatel e não faz parte deste protótipo.'));
      $('#scrim').addEventListener('click', () => this.fecharMenu());
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (UI.modalAberto()) UI.fecharModal(); else this.fecharMenu();
      });
      $('#modalWrap').addEventListener('click', e => { if (e.target.id === 'modalWrap') UI.fecharModal(); });
      window.addEventListener('hashchange', () => this._aoMudar());

      // painel lateral (desktop)
      document.querySelectorAll('#devicePicker button').forEach(b => b.addEventListener('click', () => {
        document.querySelectorAll('#devicePicker button').forEach(x => x.setAttribute('aria-checked', x === b));
        document.documentElement.style.setProperty('--dw', b.dataset.w + 'px');
        document.documentElement.style.setProperty('--dh', b.dataset.h + 'px');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 380);
      }));
      $('#btnReset').addEventListener('click', () => this.reiniciar());

      const relogio = () => { const d = new Date(); $('#clock').textContent = d.toTimeString().slice(0, 5); };
      relogio(); setInterval(relogio, 30000);

      if (!location.hash) history.replaceState(null, '', '#/avisos');
      this._aoMudar();
      if (this.atual.nome === 'avisos') this._dica();
    }
  };

  global.App = App;
  document.addEventListener('DOMContentLoaded', () => App.iniciar());
})(window);

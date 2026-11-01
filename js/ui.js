/* Componentes de interface reutilizáveis: toast, modal, alertas, chips, animações e roteiro. */
(function (global) {
  'use strict';
  const { Situacao } = global.Model;
  const $ = (s, r = document) => r.querySelector(s);

  const ROTULO = {
    APROVADO: 'Aprovado', EM_RISCO: 'Em risco',
    REPROVADO_NOTA: 'Reprovado por nota', REPROVADO_FALTA: 'Reprovado por falta'
  };
  const VARIANTE = { APROVADO: 'ok', EM_RISCO: 'warn', REPROVADO_NOTA: 'crit', REPROVADO_FALTA: 'crit' };
  const ICONE = { ok: 'ok', warn: 'warn', crit: 'error', info: 'info', neutral: 'flag' };

  const UI = {
    /* ---------- chips ---------- */
    chip(variante, rotulo, icone) {
      return `<span class="chip ${variante}">${Icons.svg(icone || ICONE[variante], 'xs')}${rotulo}</span>`;
    },
    chipSituacao(sit, rotulo) {
      const v = VARIANTE[sit];
      return UI.chip(v, rotulo || ROTULO[sit]);
    },
    /** Rótulo na lista de disciplinas: "Em dia" enquanto há avaliações pendentes sem risco. */
    chipLista(disc) {
      const sit = disc.situacao();
      if (sit === Situacao.APROVADO) {
        const encerrada = disc.pendentes().length === 0 || disc.aprovadaPorNota();
        return UI.chip('ok', encerrada ? 'Aprovado' : 'Em dia');
      }
      return UI.chipSituacao(sit);
    },
    variante: sit => VARIANTE[sit],
    rotuloSituacao: sit => ROTULO[sit],

    /* ---------- alertas ---------- */
    renderAlerta(container, alerta, aoAcionar) {
      const icone = { erro: 'error', aviso: 'warn', info: 'info', sucesso: 'ok' }[alerta.nivel];
      const el = document.createElement('div');
      el.className = `alert ${alerta.nivel}`;
      el.setAttribute('role', alerta.nivel === 'erro' ? 'alert' : 'status');
      el.innerHTML = `${Icons.svg(icone)}<div class="txt">${alerta.mensagem}</div>`;
      if (alerta.acao) {
        const b = document.createElement('button');
        b.className = 'btn outline sm alert-act';
        b.textContent = alerta.acao.rotulo;
        b.addEventListener('click', () => aoAcionar && aoAcionar(alerta));
        el.querySelector('.txt').appendChild(b);
      }
      container.appendChild(el);
    },

    /* ---------- toast ---------- */
    toast(msg, ms = 2600) {
      const t = $('#toast');
      t.textContent = msg;
      t.classList.add('on');
      clearTimeout(UI._tt);
      UI._tt = setTimeout(() => t.classList.remove('on'), ms);
    },

    /* ---------- modal ---------- */
    modal({ titulo, icone, corpo, acoes, aoFechar }) {
      const wrap = $('#modalWrap'), m = $('#modal');
      m.innerHTML = `<h3 id="modalTitle">${icone || ''}${titulo}</h3><p>${corpo}</p><div class="actions"></div>`;
      const box = m.querySelector('.actions');
      acoes.forEach(a => {
        const b = document.createElement('button');
        b.className = `btn block ${a.tipo || 'outline'}`;
        b.textContent = a.rotulo;
        b.addEventListener('click', () => { UI.fecharModal(); if (a.fn) a.fn(); });
        box.appendChild(b);
      });
      UI._aoFechar = aoFechar;
      wrap.hidden = false;
      UI._foco = document.activeElement;
      box.querySelector('button').focus();
    },
    fecharModal() {
      $('#modalWrap').hidden = true;
      if (UI._foco && UI._foco.focus) UI._foco.focus();
    },
    modalAberto: () => !$('#modalWrap').hidden,

    /* ---------- números animados ---------- */
    animarNumero(el, para, formatar = v => Math.round(v)) {
      const de = typeof el._v === 'number' ? el._v : para;
      el._v = para;
      cancelAnimationFrame(el._raf);
      if (de === para || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = formatar(para); return; }
      const t0 = performance.now(), dur = 240;
      const passo = agora => {
        const p = Math.min(1, (agora - t0) / dur), e = 1 - Math.pow(1 - p, 3);
        el.textContent = formatar(de + (para - de) * e);
        if (p < 1) el._raf = requestAnimationFrame(passo);
      };
      el._raf = requestAnimationFrame(passo);
    },

    vibrar(ms = 10) { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* sem suporte */ } },

    /** Mantém o botão pressionado repetindo a ação (steppers). */
    segurar(btn, fn) {
      let t1, t2;
      const parar = () => { clearTimeout(t1); clearInterval(t2); };
      btn.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        fn();
        t1 = setTimeout(() => { t2 = setInterval(fn, 90); }, 420);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, parar));
      btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
    },

    /* ---------- eventos do roteiro de teste ---------- */
    feitos: new Set(),
    marcar(ev) {
      if (UI.feitos.has(ev)) return;
      UI.feitos.add(ev);
      const li = document.querySelector(`#roteiro li[data-ev="${ev}"]`);
      if (li) li.classList.add('done');
      const total = document.querySelectorAll('#roteiro li').length;
      $('#roteiroCount').textContent = `${UI.feitos.size}/${total}`;
    },
    zerarRoteiro() {
      UI.feitos.clear();
      document.querySelectorAll('#roteiro li').forEach(li => li.classList.remove('done'));
      $('#roteiroCount').textContent = `0/${document.querySelectorAll('#roteiro li').length}`;
    }
  };

  // Efeito de toque (ripple) em qualquer .btn
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest('.btn');
    if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 600);
  });

  global.UI = UI;
})(window);

/*
 * Modelo de domínio de "Meu Desempenho".
 * Segue o diagrama de classes da entrega 1 (nomes de classes, atributos e métodos).
 * Sem acesso a DOM: toda regra de negócio fica aqui.
 */
(function (global) {
  'use strict';

  const NOTA_MAX = 100;
  const EPS = 1e-9;

  const Situacao = Object.freeze({
    APROVADO: 'APROVADO',
    EM_RISCO: 'EM_RISCO',
    REPROVADO_NOTA: 'REPROVADO_NOTA',
    REPROVADO_FALTA: 'REPROVADO_FALTA'
  });

  /* ---------- Avaliacao ---------- */
  class Avaliacao {
    constructor(nome, peso, nota = null, data = '') {
      this.nome = nome;
      this.peso = peso;      // fração da média final (0 a 1)
      this.nota = nota;      // 0 a 100, ou null se ainda não realizada
      this.data = data;
    }
    get realizada() { return this.nota !== null; }
    get tipo() { return this.nome.startsWith('L') ? 'lab' : 'prova'; }
    registrarNota(nota) { this.nota = nota; }
  }

  /* ---------- Frequencia ---------- */
  class Frequencia {
    constructor(aulasDadas, faltas, minimo = 75) {
      this.aulasDadas = aulasDadas;
      this.faltas = faltas;
      this.minimo = minimo;
    }
    get presencas() { return this.aulasDadas - this.faltas; }

    /** Percentual de presença; `faltasExtras` simula faltar nas próximas aulas. */
    percentual(faltasExtras = 0) {
      return (this.presencas / (this.aulasDadas + faltasExtras)) * 100;
    }

    /** Quantas aulas seguidas ainda podem ser perdidas sem cair abaixo do mínimo. */
    faltasRestantes(faltasExtras = 0) {
      const presencas = this.presencas;
      const dadas = this.aulasDadas + faltasExtras;
      return Math.max(0, Math.floor(presencas / (this.minimo / 100) - dadas + EPS));
    }
  }

  /* ---------- DisciplinaCursada ---------- */
  class DisciplinaCursada {
    constructor({ codigo, nome, turma = 'A', professor = '', notaMinima = 60, avaliacoes, frequencia, aulas = [] }) {
      this.codigo = codigo;
      this.nome = nome;
      this.turma = turma;
      this.professor = professor;
      this.notaMinima = notaMinima;
      this.avaliacoes = avaliacoes;   // composição: Avaliacao[]
      this.frequencia = frequencia;   // composição: Frequencia
      this.aulas = aulas;             // próximos horários de aula
    }

    get titulo() { return `${this.codigo} ${this.turma} - ${this.nome}`; }
    get tituloCurto() { return `${this.codigo} - ${this.nome}`; }
    pendentes() { return this.avaliacoes.filter(a => !a.realizada); }
    realizadas() { return this.avaliacoes.filter(a => a.realizada); }

    /** Média ponderada. Avaliações pendentes usam a nota hipotética (ou 0 se não houver). */
    calcularMedia(hipoteses = []) {
      const hip = new Map(hipoteses.map(h => [h.nome, h.nota]));
      return this.avaliacoes.reduce((soma, a) => {
        const nota = a.realizada ? a.nota : (hip.has(a.nome) ? hip.get(a.nome) : 0);
        return soma + a.peso * nota;
      }, 0);
    }

    /** Pontos de média que ainda podem ser conquistados (peso das pendentes x 100). */
    pontosRestantes() {
      return this.pendentes().reduce((s, a) => s + a.peso * NOTA_MAX, 0);
    }

    mediaAtual() { return this.calcularMedia([]); }
    mediaMaxima() { return this.mediaAtual() + this.pontosRestantes(); }

    /** Situação hoje, sem hipóteses. */
    situacao() {
      if (this.frequencia.percentual() < this.frequencia.minimo - EPS) return Situacao.REPROVADO_FALTA;
      if (this.mediaMaxima() < this.notaMinima - EPS) return Situacao.REPROVADO_NOTA;
      const poucasFaltas = this.frequencia.faltasRestantes() <= 1;
      if (this.pendentes().length === 0) return Situacao.APROVADO;
      if (this.mediaAtual() >= this.notaMinima - EPS) return poucasFaltas ? Situacao.EM_RISCO : Situacao.APROVADO;
      const necessaria = Simulador.notaNecessaria(this, new Meta(this, this.notaMinima));
      return (necessaria > this.notaMinima || poucasFaltas) ? Situacao.EM_RISCO : Situacao.APROVADO;
    }

    /** Aprovação já garantida (mesmo zerando o que falta) ou disciplina encerrada. */
    aprovadaPorNota() { return this.mediaAtual() >= this.notaMinima - EPS; }
  }

  /* ---------- Meta ---------- */
  class Meta {
    constructor(disciplina, valor = 60) {
      this.disciplina = disciplina;
      this.valor = valor;
      this.atingivel = this.verificar();
    }
    /** A meta cabe na média máxima possível da disciplina? */
    verificar() {
      this.atingivel = this.disciplina.mediaMaxima() >= this.valor - EPS;
      return this.atingivel;
    }
    salvar() { MetaRepositorio.salvar(this.disciplina.codigo, this.valor); }
  }

  const MetaRepositorio = {
    CHAVE: 'inatel.meu-desempenho.metas.v1',
    todas() {
      try { return JSON.parse(localStorage.getItem(this.CHAVE)) || {}; } catch (e) { return this._mem || {}; }
    },
    salvar(codigo, valor) {
      const todas = this.todas();
      todas[codigo] = valor;
      this._mem = todas;
      try { localStorage.setItem(this.CHAVE, JSON.stringify(todas)); } catch (e) { /* modo privado: fica só em memória */ }
    },
    obter(codigo) { const v = this.todas()[codigo]; return typeof v === 'number' ? v : null; },
    limpar() { this._mem = {}; try { localStorage.removeItem(this.CHAVE); } catch (e) { /* ignora */ } }
  };

  /* ---------- Alerta ---------- */
  class Alerta {
    constructor(tipo, nivel, mensagem, acao = null) {
      this.tipo = tipo;         // META_INATINGIVEL, FALTAS, NOTA_ALTA, GARANTIDO...
      this.nivel = nivel;       // erro | aviso | info | sucesso
      this.mensagem = mensagem; // HTML simples (apenas valores numéricos do próprio sistema)
      this.acao = acao;         // { rotulo, valor } opcional
    }
    exibir(container, aoAcionar) { global.UI.renderAlerta(container, this, aoAcionar); }
  }

  /* ---------- Cenario ---------- */
  class Cenario {
    constructor({ disciplina, meta, hipoteses, faltasExtras }) {
      this.disciplina = disciplina;
      this.meta = meta;
      this.hipoteses = hipoteses;
      this.faltasExtras = faltasExtras;
      this.mediaProjetada = disciplina.calcularMedia(hipoteses);
      this.frequenciaProjetada = disciplina.frequencia.percentual(faltasExtras);
      this.faltasRestantes = disciplina.frequencia.faltasRestantes(faltasExtras);
      this.situacao = this._situacao();
    }

    get metaAtingida() { return this.mediaProjetada >= this.meta.valor - EPS; }

    _situacao() {
      const d = this.disciplina;
      if (this.frequenciaProjetada < d.frequencia.minimo - EPS) return Situacao.REPROVADO_FALTA;
      if (this.mediaProjetada < d.notaMinima - EPS) return Situacao.REPROVADO_NOTA;
      return this.faltasRestantes <= 1 ? Situacao.EM_RISCO : Situacao.APROVADO;
    }

    /** Regras de alerta; a ordem define a prioridade de exibição. */
    gerarAlertas() {
      const d = this.disciplina;
      const f = d.frequencia;
      const fmt = global.Fmt;
      const alertas = [];
      const necessaria = Simulador.notaNecessaria(d, this.meta);
      const maxima = d.mediaMaxima();
      const pend = d.pendentes();

      // Frequência
      if (this.frequenciaProjetada < f.minimo - EPS) {
        alertas.push(new Alerta('FALTA_REPROVA', 'erro',
          `<b>Reprovação por falta.</b><br>Com ${this.faltasExtras} falta(s) a mais a frequência cai para <b>${fmt.pct(this.frequenciaProjetada)}</b>, abaixo do mínimo de ${f.minimo}%.`));
      } else if (this.faltasRestantes === 0) {
        alertas.push(new Alerta('FALTAS', 'erro',
          '<b>Atenção às faltas.</b><br>Você <b>não pode mais faltar</b>. Mais uma falta e reprova por frequência.'));
      } else if (this.faltasRestantes === 1) {
        alertas.push(new Alerta('FALTAS', 'aviso',
          `<b>Atenção às faltas.</b><br>Você só pode faltar mais <b>1 aula</b>. Com 2 faltas a mais, reprova por frequência.`));
      }

      // Notas
      if (pend.length === 0) {
        alertas.push(new Alerta('ENCERRADA', 'info',
          `<b>Sem avaliações restantes.</b><br>Resultado final: média <b>${fmt.num(this.mediaProjetada)}</b>.`));
      } else if (maxima < d.notaMinima - EPS) {
        alertas.push(new Alerta('REPROVA_NOTA', 'erro',
          `<b>Aprovação por nota não é mais possível.</b><br>Mesmo com 100 em tudo o que falta, a média máxima é <b>${fmt.num(maxima)}</b> (mínimo ${d.notaMinima}). Converse com o professor sobre as opções.`));
      } else if (!this.meta.atingivel) {
        const teto = Math.floor(maxima + EPS);
        alertas.push(new Alerta('META_INATINGIVEL', 'erro',
          `<b>Meta inatingível.</b><br>Mesmo com 100 ${pend.length > 1 ? 'em todas as pendentes' : 'na ' + pend[0].nome}, a média máxima é <b>${fmt.num(maxima)}</b>. Tente uma meta de até <b>${teto}</b>.`,
          { rotulo: `Ajustar meta para ${teto}`, valor: teto }));
      } else if (d.aprovadaPorNota()) {
        alertas.push(new Alerta('GARANTIDO', 'sucesso',
          `<b>Aprovação por nota garantida.</b><br>Com as notas atuais a média já é <b>${fmt.num(d.mediaAtual())}</b>, mesmo sem as próximas avaliações.`));
      } else if (necessaria > d.notaMinima) {
        alertas.push(new Alerta('NOTA_ALTA', 'aviso',
          `<b>Exige reforço.</b><br>Você precisa de <b>${necessaria}</b> ${pend.length > 1 ? 'em cada avaliação pendente' : 'na ' + pend[0].nome}, acima da nota mínima (${d.notaMinima}). Vale reservar tempo de estudo.`));
      }
      return alertas;
    }
  }

  /* ---------- Simulador (sem estado) ---------- */
  const Simulador = {
    /**
     * Menor nota inteira, igual em todas as avaliações pendentes, que leva a média até a meta.
     * Retorna null se não há pendentes. Pode passar de 100 (meta inatingível).
     */
    notaNecessaria(disciplina, meta) {
      const pend = disciplina.pendentes();
      if (pend.length === 0) return null;
      const pesoPend = pend.reduce((s, a) => s + a.peso, 0);
      const x = (meta.valor - disciplina.mediaAtual()) / pesoPend;
      return Math.max(0, Math.ceil(x - EPS));
    },

    /** Média final se todas as pendentes tirarem `nota`. Usada pelo gráfico "e se eu tirar...?". */
    mediaComNotaUniforme(disciplina, nota) {
      return disciplina.mediaAtual() + disciplina.pendentes().reduce((s, a) => s + a.peso * nota, 0);
    },

    projetar(disciplina, hipoteses, meta, faltasExtras = 0) {
      return new Cenario({ disciplina, meta, hipoteses, faltasExtras });
    }
  };

  /* ---------- Aluno ---------- */
  class Aluno {
    constructor({ nome, matricula, curso, periodo, email, disciplinas }) {
      this.nome = nome;
      this.matricula = matricula;
      this.curso = curso;
      this.periodo = periodo;
      this.email = email;
      this.disciplinas = disciplinas;
    }
    listarDisciplinas() { return this.disciplinas; }
    definirMeta(disciplina, valor) { return new Meta(disciplina, valor); }
    simular(disciplina, hipoteses, meta = new Meta(disciplina), faltasExtras = 0) {
      return Simulador.projetar(disciplina, hipoteses, meta, faltasExtras);
    }
  }

  global.Model = { NOTA_MAX, Situacao, Avaliacao, Frequencia, DisciplinaCursada, Meta, MetaRepositorio, Alerta, Cenario, Simulador, Aluno };
})(window);

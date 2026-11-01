/*
 * Dados fictícios do aluno (persona Lucas Almeida) e das disciplinas.
 * Pesos assumidos: NP1 35%, NP2 35%, laboratórios 30% (divididos igualmente).
 * Cada disciplina foi escolhida para exercitar uma situação diferente do simulador.
 */
(function (global) {
  'use strict';
  const { Avaliacao: A, Frequencia: F, DisciplinaCursada: D, Aluno } = global.Model;

  // laboratórios dividem 30% igualmente
  const labs = (...notas) => notas.map((n, i) => new A('L' + (i + 1), 0.30 / notas.length, n));
  const np = (nome, nota, peso = 0.35) => new A(nome, peso, nota);

  const disciplinas = [
    // sem laboratório: NP1 e NP2 valem 50% cada
    new D({ codigo: 'H003', nome: 'Humanidades e Ciências Sociais', avaliacoes: [np('NP1', 74, 0.5), np('NP2', null, 0.5)],
      frequencia: new F(40, 2), aulas: ['Seg · 19:00', 'Qua · 21:00'] }),

    // todas as avaliações lançadas: simulador desabilitado, só resultado final
    new D({ codigo: 'H004', nome: 'Ciências do Ambiente', avaliacoes: [np('NP1', 55), ...labs(60, 70, 65), np('NP2', 62)],
      frequencia: new F(40, 5), aulas: ['Ter · 21:00', 'Qui · 21:00'] }),

    // caso principal da persona: nota necessária 68, 2 faltas restantes
    new D({ codigo: 'M210', nome: 'Otimização I', avaliacoes: [np('NP1', 48), ...labs(70, 65, 60), np('NP2', null)],
      frequencia: new F(40, 8), aulas: ['Qui · 19:00', 'Sex · 19:00'] }),

    // duas avaliações pendentes (L3 e NP2): dois sliders
    new D({ codigo: 'P108', nome: 'Otimização II', avaliacoes: [np('NP1', 78), ...labs(80, 85, null), np('NP2', null)],
      frequencia: new F(40, 3), aulas: ['Seg · 21:00', 'Sex · 21:00'] }),

    // aprovação já garantida pelas notas atuais
    new D({ codigo: 'C14', nome: 'Engenharia de Software', avaliacoes: [np('NP1', 95), ...labs(95, 88, 92), np('NP2', null)],
      frequencia: new F(40, 4), aulas: ['Ter · 19:00', 'Qui · 21:00'] }),

    // três pendentes (NP1, L3, NP2): como a tela Notas do app, só L1 e L2 lançados
    new D({ codigo: 'C216', nome: 'Sistemas Distribuídos', avaliacoes: [np('NP1', null), ...labs(60, 85, null), np('NP2', null)],
      frequencia: new F(40, 1), aulas: ['Qua · 19:00', 'Sex · 21:00'] }),

    // nota ok, mas só 1 falta restante: alerta de frequência
    new D({ codigo: 'S05', nome: 'Interação Homem Máquina', avaliacoes: [np('NP1', 70), ...labs(75, 80, 70), np('NP2', null)],
      frequencia: new F(40, 9), aulas: ['Seg · 19:00', 'Qua · 19:00'] }),

    // aprovação por nota impossível
    new D({ codigo: 'T106', nome: 'Gerência, QoS e Segurança de Redes', avaliacoes: [np('NP1', 30), ...labs(30, 40, 35), np('NP2', null)],
      frequencia: new F(40, 4), aulas: ['Ter · 21:00', 'Qui · 19:00'] })
  ];

  global.Dados = {
    aluno: new Aluno({
      nome: 'Lucas Almeida', matricula: '2024.0001', curso: 'Engenharia de Software', periodo: 3,
      email: 'lucas@ges.inatel.br', disciplinas
    })
  };
})(window);

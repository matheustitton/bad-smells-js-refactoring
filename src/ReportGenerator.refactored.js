// Limites de negócio que antes apareciam como números mágicos (1000 e 500).
const ADMIN_PRIORITY_THRESHOLD = 1000;
const USER_VALUE_LIMIT = 500;

// --- Formatadores (Replace Conditional with Polymorphism) ---
// Cada formato de relatório sabe montar seu próprio cabeçalho, linha e rodapé.

class CsvReportFormatter {
  header() {
    return 'ID,NOME,VALOR,USUARIO\n';
  }

  row(item, user) {
    return `${item.id},${item.name},${item.value},${user.name}\n`;
  }

  footer(total) {
    return `\nTotal,,\n${total},,\n`;
  }
}

class HtmlReportFormatter {
  header(user) {
    return (
      '<html><body>\n' +
      '<h1>Relatório</h1>\n' +
      `<h2>Usuário: ${user.name}</h2>\n` +
      '<table>\n' +
      '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>\n'
    );
  }

  row(item, user, highlighted) {
    const openTag = highlighted ? '<tr style="font-weight:bold;">' : '<tr>';
    return `${openTag}<td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>\n`;
  }

  footer(total) {
    return `</table>\n<h3>Total: ${total}</h3>\n</body></html>\n`;
  }
}

const FORMATTERS = new Map([
  ['CSV', new CsvReportFormatter()],
  ['HTML', new HtmlReportFormatter()],
]);

// --- Políticas por papel de usuário ---
// Cada política decide quais itens o usuário enxerga e quais recebem destaque.

const ROLE_POLICIES = new Map([
  [
    'ADMIN',
    {
      isVisible: () => true,
      // Comportamento original preservado: o item recebe a marca de prioridade.
      prepare: (item) => {
        if (item.value > ADMIN_PRIORITY_THRESHOLD) {
          item.priority = true;
        }
      },
      isHighlighted: (item) => Boolean(item.priority),
    },
  ],
  [
    'USER',
    {
      isVisible: (item) => item.value <= USER_VALUE_LIMIT,
      prepare: () => {},
      isHighlighted: () => false,
    },
  ],
]);

const NO_ACCESS_POLICY = {
  isVisible: () => false,
  prepare: () => {},
  isHighlighted: () => false,
};

export class ReportGenerator {
  constructor(database) {
    this.db = database;
  }

  /**
   * Gera um relatório de itens baseado no tipo e no usuário.
   * - Admins veem tudo.
   * - Users comuns só veem itens com valor <= 500.
   */
  generateReport(reportType, user, items) {
    const policy = ROLE_POLICIES.get(user.role) ?? NO_ACCESS_POLICY;
    const visibleItems = items.filter((item) => policy.isVisible(item));
    visibleItems.forEach((item) => policy.prepare(item));

    const formatter = FORMATTERS.get(reportType);
    if (!formatter) {
      return '';
    }

    const body = visibleItems
      .map((item) => formatter.row(item, user, policy.isHighlighted(item)))
      .join('');
    const total = visibleItems.reduce((sum, item) => sum + item.value, 0);

    return (formatter.header(user) + body + formatter.footer(total)).trim();
  }
}

// Limites de negócio (antes eram "números mágicos" espalhados no código)
const PRIORITY_THRESHOLD = 1000; // acima disso, o item é prioritário para admins
const USER_VALUE_LIMIT = 500; // usuários comuns só veem itens até este valor

// Admins: itens caros ganham a marca de prioridade (comportamento mantido do original)
function markPriority(item) {
  if (item.value > PRIORITY_THRESHOLD) {
    item.priority = true;
  }
}

// --- Regras por perfil de usuário (Strategy) ---
// Cada perfil sabe quais itens pode ver e quais devem ser destacados.
const adminPolicy = {
  canSee: () => true,
  prepare: markPriority,
  isHighlighted: (item) => Boolean(item.priority),
};

const userPolicy = {
  canSee: (item) => item.value <= USER_VALUE_LIMIT,
  prepare: () => {},
  isHighlighted: () => false,
};

// Perfis desconhecidos não veem nenhum item (mesmo comportamento do original)
const noAccessPolicy = {
  canSee: () => false,
  prepare: () => {},
  isHighlighted: () => false,
};

const ROLE_POLICIES = new Map([
  ['ADMIN', adminPolicy],
  ['USER', userPolicy],
]);

// --- Formatos de saída (Replace Conditional with Polymorphism) ---
// Todos os formatadores têm a mesma interface: header, row e footer.
class CsvFormatter {
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

class HtmlFormatter {
  header(user) {
    return (
      '<html><body>\n' +
      '<h1>Relatório</h1>\n' +
      `<h2>Usuário: ${user.name}</h2>\n` +
      '<table>\n' +
      '<tr><th>ID</th><th>Nome</th><th>Valor</th></tr>\n'
    );
  }

  row(item, _user, highlighted) {
    const style = highlighted ? ' style="font-weight:bold;"' : '';
    return `<tr${style}><td>${item.id}</td><td>${item.name}</td><td>${item.value}</td></tr>\n`;
  }

  footer(total) {
    return '</table>\n' + `<h3>Total: ${total}</h3>\n` + '</body></html>\n';
  }
}

const FORMATTERS = new Map([
  ['CSV', new CsvFormatter()],
  ['HTML', new HtmlFormatter()],
]);

// --- Funções auxiliares (Extract Method) ---
function policyFor(user) {
  return ROLE_POLICIES.get(user.role) ?? noAccessPolicy;
}

function selectVisibleItems(items, policy) {
  const visible = items.filter((item) => policy.canSee(item));
  visible.forEach((item) => policy.prepare(item));
  return visible;
}

function sumValues(items) {
  return items.reduce((total, item) => total + item.value, 0);
}

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
    const policy = policyFor(user);
    const visibleItems = selectVisibleItems(items, policy);

    const formatter = FORMATTERS.get(reportType);
    if (!formatter) {
      return '';
    }

    const body = visibleItems
      .map((item) => formatter.row(item, user, policy.isHighlighted(item)))
      .join('');
    const total = sumValues(visibleItems);

    return (formatter.header(user) + body + formatter.footer(total)).trim();
  }
}

import { useMemo, useState } from "react";

const demoCsv = `date,description,amount,currency
2026-05-01,Salary,3500,EUR
2026-05-02,Biedronka,-45.90,EUR
2026-05-03,Uber,-12.50,EUR
2026-05-04,Netflix,-15.99,EUR
2026-05-05,Rent,-1200,EUR
2026-05-06,Pharmacy,-24.30,EUR
2026-05-07,Restaurant,-67.40,EUR`;

const delimiterNames = {
  ",": "запятая",
  ";": "точка с запятой",
  "\t": "tab"
};

const categoryRules = [
  {
    category: "Продукты",
    keywords: [
      "biedronka",
      "lidl",
      "aldi",
      "carrefour",
      "auchan",
      "grocery",
      "market",
      "supermarket",
      "food",
      "sklep",
      "produkty"
    ]
  },
  {
    category: "Транспорт",
    keywords: [
      "uber",
      "bolt",
      "taxi",
      "metro",
      "bus",
      "train",
      "tram",
      "fuel",
      "parking",
      "transport",
      "paliwo",
      "bilet"
    ]
  },
  {
    category: "Жильё",
    keywords: [
      "rent",
      "apartment",
      "landlord",
      "mortgage",
      "home",
      "housing",
      "czynsz",
      "utilities",
      "mieszkanie",
      "prąd",
      "gaz"
    ]
  },
  {
    category: "Подписки",
    keywords: [
      "netflix",
      "spotify",
      "youtube",
      "subscription",
      "apple",
      "google",
      "icloud",
      "prime",
      "abonament"
    ]
  },
  {
    category: "Здоровье",
    keywords: [
      "pharmacy",
      "apteka",
      "doctor",
      "clinic",
      "medical",
      "health",
      "dentist",
      "medicine",
      "lekarz",
      "zdrowie"
    ]
  },
  {
    category: "Рестораны",
    keywords: [
      "restaurant",
      "cafe",
      "coffee",
      "bar",
      "pizza",
      "burger",
      "kebab",
      "dinner",
      "lunch",
      "restauracja",
      "kawiarnia"
    ]
  }
];

const columnAliases = {
  date: ["date", "data", "data operacji", "transaction date", "дата"],
  description: [
    "description",
    "opis",
    "opis operacji",
    "opis transakcji",
    "merchant",
    "details",
    "описание"
  ],
  amount: ["amount", "kwota", "kwota operacji", "value", "suma", "сумма"],
  currency: ["currency", "waluta", "curr", "ccy", "валюта"]
};

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .replace(/^"|"$/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFC");
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      count += 1;
    }
  }

  return count;
}

function detectDelimiter(text) {
  const sampleLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const delimiters = [",", ";", "\t"];
  const scores = delimiters.map((delimiter) => ({
    delimiter,
    score: sampleLines.reduce(
      (sum, line) => sum + countDelimiterOutsideQuotes(line, delimiter),
      0
    )
  }));

  const best = scores.sort((a, b) => b.score - a.score)[0];

  if (!best || best.score === 0) {
    return ",";
  }

  return best.delimiter;
}

function splitCsvLine(line, delimiter) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseAmount(value) {
  let normalized = String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s/g, "")
    .replace(/[^\d.,+\-]/g, "")
    .trim();

  if (!normalized) {
    return Number.NaN;
  }

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    normalized = normalized.replace(",", ".");
  }

  return Number(normalized);
}

function findColumnIndex(headers, type) {
  const aliases = columnAliases[type];
  return headers.findIndex((header) => aliases.includes(header));
}

function decodeArrayBuffer(arrayBuffer) {
  const tryDecode = (encoding, fatal = false) => {
    try {
      const decoder = new TextDecoder(encoding, { fatal });
      return decoder.decode(arrayBuffer);
    } catch {
      return "";
    }
  };

  const utf8Text = tryDecode("utf-8", true);

  if (utf8Text && !utf8Text.includes("�")) {
    return {
      text: utf8Text,
      encoding: "UTF-8"
    };
  }

  const windowsText = tryDecode("windows-1250");

  if (windowsText) {
    return {
      text: windowsText,
      encoding: "Windows-1250"
    };
  }

  return {
    text: tryDecode("utf-8"),
    encoding: "UTF-8"
  };
}

function parseCsv(text) {
  const cleanText = String(text || "").replace(/^\uFEFF/, "").trim();

  if (!cleanText) {
    throw new Error("Файл не удалось обработать. Проверьте формат CSV.");
  }

  const delimiter = detectDelimiter(cleanText);
  const lines = cleanText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("Файл не удалось обработать. Проверьте формат CSV.");
  }

  const rawHeaders = splitCsvLine(lines[0], delimiter);
  const headers = rawHeaders.map(normalizeHeader);

  const dateIndex = findColumnIndex(headers, "date");
  const descriptionIndex = findColumnIndex(headers, "description");
  const amountIndex = findColumnIndex(headers, "amount");
  const currencyIndex = findColumnIndex(headers, "currency");

  if (dateIndex === -1 || descriptionIndex === -1 || amountIndex === -1) {
    throw new Error("Файл не удалось обработать. Проверьте формат CSV.");
  }

  const transactions = lines
    .slice(1)
    .map((line, index) => {
      const values = splitCsvLine(line, delimiter);

      const date = values[dateIndex]?.trim() || "";
      const baseDescription = values[descriptionIndex]?.trim() || "";
      const amount = parseAmount(values[amountIndex]);
      const currency = currencyIndex > -1 ? values[currencyIndex]?.trim() || "" : "";

      const extraDescriptionParts = values
        .slice(descriptionIndex + 1)
        .filter((value, valueIndex) => {
          const originalIndex = descriptionIndex + 1 + valueIndex;
          if (originalIndex === amountIndex || originalIndex === currencyIndex || originalIndex === dateIndex) {
            return false;
          }

          return String(value || "").trim();
        })
        .map((value) => value.trim());

      const description = [baseDescription, ...extraDescriptionParts]
        .filter(Boolean)
        .join(" | ");

      if (!date || !description || Number.isNaN(amount)) {
        return null;
      }

      return {
        id: `${date}-${description}-${index}`,
        date,
        description,
        amount,
        currency,
        category: categorizeTransaction(description, amount)
      };
    })
    .filter(Boolean);

  if (transactions.length === 0) {
    throw new Error(
      "Колонки найдены, но операции не распознаны. Проверьте формат сумм и строк."
    );
  }

  return {
    transactions,
    delimiter,
    delimiterLabel: delimiterNames[delimiter],
    encoding: null
  };
}

function categorizeTransaction(description, amount) {
  if (amount > 0) {
    return "Доход";
  }

  const normalized = description.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return "Другое";
}

function formatMoney(value, currency = "EUR") {
  if (!currency) {
    return new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)} ${currency}`;
  }
}

function App() {
  const [transactions, setTransactions] = useState([]);
  const [sourceInfo, setSourceInfo] = useState(null);
  const [error, setError] = useState("");

  const currency = transactions.find((transaction) => transaction.currency)?.currency || "EUR";

  const summary = useMemo(() => {
    const income = transactions
      .filter((transaction) => transaction.amount > 0)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    const expenses = transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

    return {
      income,
      expenses,
      balance: income - expenses
    };
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const categories = transactions
      .filter((transaction) => transaction.amount < 0)
      .reduce((acc, transaction) => {
        acc[transaction.category] = (acc[transaction.category] || 0) + Math.abs(transaction.amount);
        return acc;
      }, {});

    return Object.entries(categories)
      .map(([category, amount]) => ({
        category,
        amount,
        percent: summary.expenses > 0 ? (amount / summary.expenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, summary.expenses]);

  const topExpenses = useMemo(() => {
    return transactions
      .filter((transaction) => transaction.amount < 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5);
  }, [transactions]);

  const insights = useMemo(() => {
    if (transactions.length === 0) {
      return [
        "Загрузите CSV-файл или демо-данные, чтобы увидеть финансовые наблюдения.",
        "Приложение автоматически разделит операции по простым категориям.",
        "Все расчёты выполняются только в браузере."
      ];
    }

    const biggestCategory = expensesByCategory[0];
    const biggestExpense = topExpenses[0];
    const savingsRate = summary.income > 0 ? (summary.balance / summary.income) * 100 : 0;

    return [
      biggestCategory
        ? `Самая крупная категория расходов: ${biggestCategory.category} — ${formatMoney(biggestCategory.amount, currency)}.`
        : "В выписке нет расходов для анализа по категориям.",
      biggestExpense
        ? `Самая крупная отдельная трата: ${biggestExpense.description} — ${formatMoney(Math.abs(biggestExpense.amount), biggestExpense.currency || currency)}.`
        : "В выписке нет отрицательных операций.",
      summary.balance >= 0
        ? `Баланс положительный: ${formatMoney(summary.balance, currency)}. Доля остатка от дохода: ${Math.max(savingsRate, 0).toFixed(1)}%.`
        : `Расходы выше доходов на ${formatMoney(Math.abs(summary.balance), currency)}. Стоит проверить крупные категории расходов.`
    ];
  }, [transactions, expensesByCategory, topExpenses, summary, currency]);

  function loadCsvText(text, name = "Демо-данные", encoding = "UTF-8") {
    try {
      const result = parseCsv(text);
      setTransactions(result.transactions);
      setSourceInfo({
        name,
        count: result.transactions.length,
        delimiter: result.delimiterLabel,
        encoding: encoding || result.encoding || "не определена"
      });
      setError("");
    } catch (csvError) {
      setTransactions([]);
      setSourceInfo(null);
      setError(csvError.message || "Файл не удалось обработать. Проверьте формат CSV.");
    }
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoded = decodeArrayBuffer(arrayBuffer);
      loadCsvText(decoded.text, file.name, decoded.encoding);
    } catch {
      setTransactions([]);
      setSourceInfo(null);
      setError("Файл не удалось обработать. Проверьте формат CSV.");
    }
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <span className="badge">CSV Finance Demo · v2</span>
          <h1>Анализ банковской CSV-выписки</h1>
          <p>
            Загрузите CSV-файл и получите простой dashboard: доходы, расходы,
            баланс, категории, топ трат и базовые финансовые выводы.
          </p>
        </div>
      </section>

      <section className="upload-card">
        <div>
          <h2>Загрузка данных</h2>
          <p>Формат CSV: дата, описание и сумма. Валюта может быть необязательной.</p>
        </div>

        <div className="actions">
          <label className="file-button">
            Выбрать CSV-файл
            <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} />
          </label>
          <button type="button" onClick={() => loadCsvText(demoCsv)}>
            Загрузить демо-данные
          </button>
        </div>

        {sourceInfo && (
          <div className="source-info">
            <div>
              <span>Источник</span>
              <strong>{sourceInfo.name}</strong>
            </div>
            <div>
              <span>Операций</span>
              <strong>{sourceInfo.count}</strong>
            </div>
            <div>
              <span>Разделитель</span>
              <strong>{sourceInfo.delimiter}</strong>
            </div>
            <div>
              <span>Кодировка</span>
              <strong>{sourceInfo.encoding}</strong>
            </div>
          </div>
        )}

        {error && <div className="error">{error}</div>}
      </section>

      <section className="info-card">
        <h2>Поддерживаемые форматы</h2>
        <p>
          CSV с колонками даты, описания и суммы. Разделители: запятая, точка с запятой, tab.
          Сервис работает с учебными и простыми банковскими CSV-файлами.
        </p>
      </section>

      <section className="dashboard-grid">
        <article className="metric-card income">
          <span>Общий доход</span>
          <strong>{formatMoney(summary.income, currency)}</strong>
        </article>
        <article className="metric-card expense">
          <span>Общие расходы</span>
          <strong>{formatMoney(summary.expenses, currency)}</strong>
        </article>
        <article className="metric-card balance">
          <span>Баланс</span>
          <strong>{formatMoney(summary.balance, currency)}</strong>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Расходы по категориям</h2>
            <span>{expensesByCategory.length} категорий</span>
          </div>

          {expensesByCategory.length > 0 ? (
            <div className="category-list">
              {expensesByCategory.map((item) => (
                <div className="category-row" key={item.category}>
                  <div className="category-top">
                    <span>{item.category}</span>
                    <strong>{formatMoney(item.amount, currency)}</strong>
                  </div>
                  <div className="bar">
                    <div style={{ width: `${item.percent}%` }} />
                  </div>
                  <small>{item.percent.toFixed(1)}% от всех расходов</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Пока нет расходов для отображения.</p>
          )}
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Топ-5 расходов</h2>
            <span>Самые крупные траты</span>
          </div>

          {topExpenses.length > 0 ? (
            <div className="top-list">
              {topExpenses.map((transaction, index) => (
                <div className="top-item" key={transaction.id}>
                  <div className="rank">{index + 1}</div>
                  <div>
                    <strong>{transaction.description}</strong>
                    <span>{transaction.date} · {transaction.category}</span>
                  </div>
                  <b>{formatMoney(Math.abs(transaction.amount), transaction.currency || currency)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">Пока нет расходов для отображения.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Выводы</h2>
          <span>3 наблюдения</span>
        </div>

        <div className="insights">
          {insights.map((insight, index) => (
            <div className="insight" key={insight}>
              <span>{index + 1}</span>
              <p>{insight}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Все транзакции</h2>
          <span>{transactions.length} операций</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Описание</th>
                <th>Категория</th>
                <th>Сумма</th>
                <th>Валюта</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.date}</td>
                    <td>{transaction.description}</td>
                    <td>
                      <span className="category-pill">{transaction.category}</span>
                    </td>
                    <td className={transaction.amount >= 0 ? "positive" : "negative"}>
                      {formatMoney(transaction.amount, transaction.currency || currency)}
                    </td>
                    <td>{transaction.currency || "—"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-table">
                    Загрузите CSV-файл или демо-данные.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default App;

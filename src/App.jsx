import { useMemo, useState } from "react";

const demoCsv = `date,description,amount,currency
2026-05-01,Salary,3500,EUR
2026-05-02,Biedronka,-45.90,EUR
2026-05-03,Uber,-12.50,EUR
2026-05-04,Netflix,-15.99,EUR
2026-05-05,Rent,-1200,EUR
2026-05-06,Pharmacy,-24.30,EUR
2026-05-07,Restaurant,-67.40,EUR`;

const categoryRules = [
  {
    category: "Продукты",
    keywords: ["biedronka", "lidl", "aldi", "carrefour", "auchan", "grocery", "market", "supermarket", "food"]
  },
  {
    category: "Транспорт",
    keywords: ["uber", "bolt", "taxi", "metro", "bus", "train", "tram", "fuel", "parking", "transport"]
  },
  {
    category: "Жильё",
    keywords: ["rent", "apartment", "landlord", "mortgage", "home", "housing", "czynsz", "utilities"]
  },
  {
    category: "Подписки",
    keywords: ["netflix", "spotify", "youtube", "subscription", "apple", "google", "icloud", "prime"]
  },
  {
    category: "Здоровье",
    keywords: ["pharmacy", "apteka", "doctor", "clinic", "medical", "health", "dentist", "medicine"]
  },
  {
    category: "Рестораны",
    keywords: ["restaurant", "cafe", "coffee", "bar", "pizza", "burger", "kebab", "dinner", "lunch"]
  }
];

function splitCsvLine(line) {
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
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error("CSV-файл должен содержать заголовок и хотя бы одну операцию.");
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const requiredHeaders = ["date", "description", "amount", "currency"];

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`В CSV не хватает колонок: ${missingHeaders.join(", ")}.`);
  }

  const transactions = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = headers.reduce((acc, header, headerIndex) => {
      acc[header] = values[headerIndex] || "";
      return acc;
    }, {});

    const amount = Number(String(row.amount).replace(",", "."));

    if (!row.date || !row.description || Number.isNaN(amount) || !row.currency) {
      throw new Error(`Ошибка в строке ${index + 2}. Проверьте date, description, amount и currency.`);
    }

    return {
      id: `${row.date}-${row.description}-${index}`,
      date: row.date,
      description: row.description,
      amount,
      currency: row.currency,
      category: categorizeTransaction(row.description, amount)
    };
  });

  return transactions;
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
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

function App() {
  const [transactions, setTransactions] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const currency = transactions[0]?.currency || "EUR";

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
        ? `Самая крупная отдельная трата: ${biggestExpense.description} — ${formatMoney(Math.abs(biggestExpense.amount), biggestExpense.currency)}.`
        : "В выписке нет отрицательных операций.",
      summary.balance >= 0
        ? `Баланс положительный: ${formatMoney(summary.balance, currency)}. Доля остатка от дохода: ${Math.max(savingsRate, 0).toFixed(1)}%.`
        : `Расходы выше доходов на ${formatMoney(Math.abs(summary.balance), currency)}. Стоит проверить крупные категории расходов.`
    ];
  }, [transactions, expensesByCategory, topExpenses, summary, currency]);

  function loadCsvText(text, name = "Демо-данные") {
    try {
      const parsedTransactions = parseCsv(text);
      setTransactions(parsedTransactions);
      setFileName(name);
      setError("");
    } catch (csvError) {
      setTransactions([]);
      setFileName("");
      setError(csvError.message);
    }
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      loadCsvText(readerEvent.target.result, file.name);
    };

    reader.onerror = () => {
      setError("Не удалось прочитать файл. Попробуйте загрузить CSV ещё раз.");
    };

    reader.readAsText(file);
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <span className="badge">CSV Finance Demo</span>
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
          <p>Формат CSV: date, description, amount, currency</p>
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

        {fileName && <div className="file-info">Загружено: {fileName}</div>}
        {error && <div className="error">{error}</div>}
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
                  <b>{formatMoney(Math.abs(transaction.amount), transaction.currency)}</b>
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
                      {formatMoney(transaction.amount, transaction.currency)}
                    </td>
                    <td>{transaction.currency}</td>
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

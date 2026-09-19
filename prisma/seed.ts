import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { subDays } from "date-fns";

const prisma = new PrismaClient();

const DEMO_EMAIL = process.env.DEMO_USER_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "Demo@1234";

const SYSTEM_CATEGORIES = [
  "Groceries",
  "Food & Dining",
  "Transportation",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Entertainment",
  "Subscriptions",
  "Salary",
  "Transfer",
  "Credit Card Payment",
  "Healthcare",
  "Investment",
  "Other",
];

async function main() {
  console.log(`Seeding demo data for ${DEMO_EMAIL}...`);

  // System default categories (userId: null) — idempotent via findFirst/create.
  const categoryIds = new Map<string, string>();
  for (const name of SYSTEM_CATEGORIES) {
    let cat = await prisma.category.findFirst({ where: { userId: null, name } });
    if (!cat) {
      cat = await prisma.category.create({ data: { userId: null, name } });
    }
    categoryIds.set(name, cat.id);
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { email: DEMO_EMAIL, passwordHash, name: "Demo User" },
  });

  // Wipe this demo user's transactions/accounts/cards so re-running seed is idempotent.
  await prisma.transactionAudit.deleteMany({ where: { userId: user.id } });
  await prisma.transaction.deleteMany({ where: { userId: user.id } });
  await prisma.financialAccount.deleteMany({ where: { userId: user.id } });
  await prisma.creditCard.deleteMany({ where: { userId: user.id } });

  const sbi = await prisma.financialAccount.create({
    data: { userId: user.id, type: "bank", name: "SBI Savings", institution: "State Bank of India", openingBalance: 185000 },
  });
  const hdfcAcc = await prisma.financialAccount.create({
    data: { userId: user.id, type: "bank", name: "HDFC Savings", institution: "HDFC Bank", openingBalance: 96000 },
  });
  const cash = await prisma.financialAccount.create({
    data: { userId: user.id, type: "cash", name: "Cash Wallet", institution: "Cash", openingBalance: 4200 },
  });
  await prisma.financialAccount.create({
    data: { userId: user.id, type: "investment", name: "Mutual Funds & Stocks", institution: "Zerodha / Groww", openingBalance: 312500 },
  });

  const hdfcCard = await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: "HDFC Millennia",
      issuer: "HDFC Bank",
      lastFourDigits: "4821",
      creditLimit: 150000,
      statementDay: 3,
      paymentDueDay: 23,
      openingOutstanding: 0,
    },
  });
  const iciciCard = await prisma.creditCard.create({
    data: {
      userId: user.id,
      name: "ICICI Amazon Pay",
      issuer: "ICICI Bank",
      lastFourDigits: "7734",
      creditLimit: 80000,
      statementDay: 10,
      paymentDueDay: 28,
      openingOutstanding: 0,
    },
  });

  const catId = (name: string) => categoryIds.get(name)!;
  const dateAgo = (days: number) => subDays(new Date(), days);

  type SeedTx = {
    daysAgo: number;
    type: "expense" | "income" | "credit_card_payment";
    amount: number;
    merchant: string;
    category: string;
    accountId?: string;
    creditCardId?: string;
  };

  const seedTx: SeedTx[] = [
    { daysAgo: 58, type: "income", amount: 95000, merchant: "Employer Pvt Ltd", category: "Salary", accountId: sbi.id },
    { daysAgo: 28, type: "income", amount: 95000, merchant: "Employer Pvt Ltd", category: "Salary", accountId: sbi.id },

    { daysAgo: 55, type: "expense", amount: 2140, merchant: "DMart", category: "Groceries", creditCardId: hdfcCard.id },
    { daysAgo: 48, type: "expense", amount: 1580, merchant: "Reliance Fresh", category: "Groceries", creditCardId: hdfcCard.id },
    { daysAgo: 40, type: "expense", amount: 1920, merchant: "Big Bazaar", category: "Groceries", accountId: hdfcAcc.id },
    { daysAgo: 30, type: "expense", amount: 2350, merchant: "DMart", category: "Groceries", creditCardId: hdfcCard.id },
    { daysAgo: 20, type: "expense", amount: 2890, merchant: "Reliance Fresh", category: "Groceries", creditCardId: hdfcCard.id },
    { daysAgo: 12, type: "expense", amount: 3100, merchant: "DMart", category: "Groceries", creditCardId: hdfcCard.id },
    { daysAgo: 5, type: "expense", amount: 1850, merchant: "Reliance Fresh", category: "Groceries", creditCardId: hdfcCard.id },

    { daysAgo: 53, type: "expense", amount: 420, merchant: "Swiggy", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 47, type: "expense", amount: 610, merchant: "Zomato", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 42, type: "expense", amount: 350, merchant: "Swiggy", category: "Food & Dining", accountId: cash.id },
    { daysAgo: 35, type: "expense", amount: 780, merchant: "Zomato", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 25, type: "expense", amount: 540, merchant: "Swiggy", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 18, type: "expense", amount: 690, merchant: "Zomato", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 10, type: "expense", amount: 460, merchant: "Swiggy", category: "Food & Dining", creditCardId: iciciCard.id },
    { daysAgo: 4, type: "expense", amount: 820, merchant: "Zomato", category: "Food & Dining", creditCardId: iciciCard.id },

    { daysAgo: 50, type: "expense", amount: 280, merchant: "Uber", category: "Transportation", accountId: cash.id },
    { daysAgo: 44, type: "expense", amount: 340, merchant: "Ola", category: "Transportation", creditCardId: iciciCard.id },
    { daysAgo: 33, type: "expense", amount: 195, merchant: "Uber", category: "Transportation", accountId: cash.id },
    { daysAgo: 22, type: "expense", amount: 410, merchant: "Uber", category: "Transportation", creditCardId: iciciCard.id },
    { daysAgo: 9, type: "expense", amount: 260, merchant: "Ola", category: "Transportation", accountId: cash.id },

    { daysAgo: 46, type: "expense", amount: 2500, merchant: "Indian Oil", category: "Fuel", accountId: hdfcAcc.id },
    { daysAgo: 31, type: "expense", amount: 2650, merchant: "Indian Oil", category: "Fuel", accountId: hdfcAcc.id },
    { daysAgo: 16, type: "expense", amount: 2400, merchant: "Bharat Petroleum", category: "Fuel", accountId: hdfcAcc.id },
    { daysAgo: 3, type: "expense", amount: 2700, merchant: "Indian Oil", category: "Fuel", accountId: hdfcAcc.id },

    { daysAgo: 45, type: "expense", amount: 3499, merchant: "Amazon", category: "Shopping", creditCardId: iciciCard.id },
    { daysAgo: 37, type: "expense", amount: 1899, merchant: "Flipkart", category: "Shopping", creditCardId: hdfcCard.id },
    { daysAgo: 24, type: "expense", amount: 5200, merchant: "Amazon", category: "Shopping", creditCardId: iciciCard.id },
    { daysAgo: 14, type: "expense", amount: 2350, merchant: "Myntra", category: "Shopping", creditCardId: hdfcCard.id },
    { daysAgo: 6, type: "expense", amount: 4100, merchant: "Flipkart", category: "Shopping", creditCardId: hdfcCard.id },

    { daysAgo: 52, type: "expense", amount: 1450, merchant: "Electricity Board", category: "Bills & Utilities", accountId: sbi.id },
    { daysAgo: 51, type: "expense", amount: 799, merchant: "Airtel", category: "Bills & Utilities", accountId: sbi.id },
    { daysAgo: 23, type: "expense", amount: 1620, merchant: "Electricity Board", category: "Bills & Utilities", accountId: sbi.id },
    { daysAgo: 21, type: "expense", amount: 799, merchant: "Airtel", category: "Bills & Utilities", accountId: sbi.id },
    { daysAgo: 2, type: "expense", amount: 1200, merchant: "Electricity Board", category: "Bills & Utilities", accountId: sbi.id },

    { daysAgo: 49, type: "expense", amount: 649, merchant: "Netflix", category: "Subscriptions", creditCardId: hdfcCard.id },
    { daysAgo: 43, type: "expense", amount: 599, merchant: "Spotify", category: "Subscriptions", creditCardId: hdfcCard.id },
    { daysAgo: 19, type: "expense", amount: 649, merchant: "Netflix", category: "Subscriptions", creditCardId: hdfcCard.id },
    { daysAgo: 13, type: "expense", amount: 599, merchant: "Spotify", category: "Subscriptions", creditCardId: hdfcCard.id },
    { daysAgo: 27, type: "expense", amount: 900, merchant: "PVR Cinemas", category: "Entertainment", creditCardId: iciciCard.id },
    { daysAgo: 7, type: "expense", amount: 1100, merchant: "PVR Cinemas", category: "Entertainment", creditCardId: iciciCard.id },

    { daysAgo: 15, type: "credit_card_payment", amount: 18420, merchant: "HDFC Credit Card Bill", category: "Credit Card Payment", accountId: sbi.id, creditCardId: hdfcCard.id },
    { daysAgo: 8, type: "credit_card_payment", amount: 6250, merchant: "ICICI Amazon Pay Bill", category: "Credit Card Payment", accountId: sbi.id, creditCardId: iciciCard.id },
  ];

  for (const s of seedTx) {
    const created = await prisma.transaction.create({
      data: {
        userId: user.id,
        transactionType: s.type,
        amount: s.amount,
        transactionDate: dateAgo(s.daysAgo),
        merchant: s.merchant,
        categoryId: catId(s.category),
        accountId: s.accountId,
        creditCardId: s.creditCardId,
        source: "manual",
      },
    });
    await prisma.transactionAudit.create({
      data: { transactionId: created.id, userId: user.id, action: "created", newValues: JSON.parse(JSON.stringify(created)) },
    });
  }

  // Two transfers between own accounts, sharing a transferId per leg.
  const transferPairs = [
    { daysAgo: 34, amount: 20000, from: sbi.id, to: hdfcAcc.id },
    { daysAgo: 11, amount: 15000, from: sbi.id, to: hdfcAcc.id },
  ];
  for (const t of transferPairs) {
    const transferId = randomUUID();
    await prisma.transaction.create({
      data: {
        userId: user.id,
        transactionType: "transfer",
        amount: t.amount,
        transactionDate: dateAgo(t.daysAgo),
        merchant: "Self Transfer",
        accountId: t.from,
        transferId,
        source: "manual",
      },
    });
    await prisma.transaction.create({
      data: {
        userId: user.id,
        transactionType: "transfer",
        amount: t.amount,
        transactionDate: dateAgo(t.daysAgo),
        merchant: "Self Transfer",
        accountId: t.to,
        transferId,
        source: "manual",
      },
    });
  }

  console.log(`Seed complete. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

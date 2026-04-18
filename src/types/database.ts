export type TransactionType = 'income' | 'expense'
export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly' | 'custom'
export type CategoryType = 'income' | 'expense' | 'both'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Account {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  icon: string
  color: string
  type: CategoryType
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  title: string
  description: string | null
  amount: number
  type: TransactionType
  date: string
  created_at: string
  updated_at: string
  account?: Account
  category?: Category
}

export interface Budget {
  id: string
  user_id: string
  account_id: string | null
  category_id: string | null
  name: string
  amount: number
  period_type: BudgetPeriod
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
  account?: Account
  category?: Category
  spent?: number
}

export interface SavingsGoal {
  id: string
  user_id: string
  account_id: string | null
  name: string
  target_amount: number
  current_amount: number
  deadline: string | null
  emoji: string
  color: string
  description: string | null
  created_at: string
  updated_at: string
  account?: Account
}

export interface ExportData {
  version: number
  exported_at: string
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  budgets: Budget[]
  savings_goals: SavingsGoal[]
}

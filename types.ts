
export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  DOCTOR = 'DOCTOR',
  MA = 'MA', // Medical Assistant
  FRONT_DESK = 'FRONT_DESK'
}

export const INITIAL_ROLE_CONFIGS: RoleConfig[] = [
  { role: UserRole.OWNER, permissions: ['inventory.view', 'inventory.edit', 'inventory.audit', 'orders.view', 'orders.create', 'orders.receive', 'orders.delete', 'reports.view', 'reports.create', 'prices.view', 'prices.manage', 'forms.manage', 'forms.generate', 'billing.view', 'codes.view', 'codes.manage', 'finance.view', 'finance.manage', 'admin.access'] },
  { role: UserRole.MANAGER, permissions: ['inventory.view', 'inventory.edit', 'inventory.audit', 'orders.view', 'orders.create', 'orders.receive', 'orders.delete', 'reports.view', 'reports.create', 'prices.view', 'prices.manage', 'forms.manage', 'forms.generate', 'billing.view', 'codes.view', 'codes.manage', 'finance.view', 'finance.manage', 'admin.access'] },
  { role: UserRole.DOCTOR, permissions: ['inventory.view', 'inventory.edit', 'orders.view', 'orders.create', 'reports.view', 'reports.create', 'prices.view', 'forms.generate', 'billing.view', 'codes.view'] },
  { role: UserRole.MA, permissions: ['inventory.view', 'inventory.audit', 'orders.view', 'forms.generate', 'codes.view'] },
  { role: UserRole.FRONT_DESK, permissions: ['prices.view', 'prices.manage', 'inventory.view', 'forms.generate', 'reports.view', 'reports.create', 'billing.view', 'codes.view', 'finance.view', 'finance.manage'] }
];

export type Permission =
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.audit'
  | 'orders.view'
  | 'orders.create'
  | 'orders.receive'
  | 'orders.delete' // New
  | 'prices.view'
  | 'prices.manage'
  | 'reports.view'
  | 'reports.create'
  | 'admin.access'
  | 'forms.manage'
  | 'forms.generate'
  | 'billing.view'
  | 'codes.view'
  | 'codes.manage' // New
  | 'finance.view' // New
  | 'finance.manage'; // New

export interface RoleConfig {
  role: UserRole;
  permissions: Permission[];
}

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  permissions?: Permission[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  averageCost: number; // Added for Asset Valuation
  minStock: number;
  maxStock: number;
  expiryDate: string;
  batchNumber: string;
  location: string;
  lastChecked?: string;
  lastCheckedBy?: string;
  sku?: string;
}

export interface PriceItem {
  id: string;
  serviceName: string;
  price: number;
  category: string;
  code?: string;
}

export interface MedicalCode {
  id: string; // Added ID for editing
  name: string;
  labCode: string;
  cptCode: string;
  adminCode: string;
}

export interface CodeGroup {
  id: string;
  name: string;
  description?: string;
  codeIds: string[]; // References MedicalCode.id
}

export interface BillingRule {
  id: string;
  insurers: string[];
  testName: string;
  cpt: string;
  billToClient: boolean;
}

export type OrderStatus = 'DRAFT' | 'PENDING' | 'RECEIVED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  inventoryItemId?: string; // Optional link to existing item
  name: string;
  category?: string;
  quantity: number;
  unitCost: number;
  unitType: string;
  total: number;
}

export interface Order {
  id: string;
  poNumber: string;
  vendor: string;
  orderDate: string;
  expectedDate: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  totalTax: number; // Absolute value, not percentage
  grandTotal: number;
  attachmentUrl?: string; // Base64 of invoice
  notes?: string;
  createdBy?: string; // User ID of creator
}

export interface ActivityLog {
  id: string;
  action: 'ADDED' | 'UPDATED' | 'REMOVED' | 'CONSUMED' | 'RESTOCKED' | 'AUDITED' | 'ORDER_CREATED' | 'ORDER_RECEIVED' | 'DELETED_ORDER' | 'PRICE_LIST_UPDATE' | 'PRICE_ADDED' | 'PRICE_UPDATED' | 'PRICE_DELETED' | 'PRICE_IMPORT' | 'CODE_ADDED' | 'CODE_UPDATED' | 'CODE_DELETED' | 'GROUP_ADDED' | 'GROUP_UPDATED' | 'GROUP_DELETED' | 'FORM_GENERATED' | 'DAILY_CLOSE' | 'PETTY_CASH' | 'IMPORT_INVENTORY' | 'TEMPLATE_CREATED' | 'TEMPLATE_UPDATED' | 'TEMPLATE_DELETED';
  details: string;
  timestamp: Date;
  user: string;
}

export interface FormTemplate {
  id: string;
  title: string;
  slug: string;
  version: string;
  language: 'English' | 'Spanish';
  status: 'Active' | 'Draft' | 'Archived';
  useLetterhead: boolean;
  content: string;
  variables: string[];
  updatedAt: string;
}

export interface PettyCashTransaction {
  id: string;
  userId: string;
  userName: string; // Stored for display/history even if user is deleted
  amount: number;
  action: 'DEPOSIT' | 'WITHDRAWAL';
  reason: string;
  runningBalance: number;
  timestamp: string; // ISO
}

export enum AppRoute {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ORDERS = 'ORDERS',
  PRICELIST = 'PRICELIST',
  REPORTS = 'REPORTS',
  DAILY_HISTORY = 'DAILY_HISTORY',
  DAILY_CLOSE = 'DAILY_CLOSE',
  SCANNER = 'SCANNER',
  SETTINGS = 'SETTINGS',
  ADMIN = 'ADMIN',
  FORMS = 'FORMS',
  BILLING_WIZARD = 'BILLING_WIZARD',
  MEDICAL_CODES = 'MEDICAL_CODES',
  PETTY_CASH = 'PETTY_CASH',
  VOICE_MEMOS = 'VOICE_MEMOS' // New
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

// --- DATABASE MODELS (Supabase Mirrors) ---
// These types reflect the actual PostgreSQL schema

export interface DBProfile {
  id: string; // UUID
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export interface DBItem {
  id: string; // UUID
  category_id: string | null;
  sku: string | null;
  name: string;
  unit: string;
  min_stock: number;
  is_active: boolean;
  average_cost: number; // For valuation
  created_at: string;
}

export interface DBStockLevel {
  id: string;
  item_id: string;
  location_id: string | null;
  lot_id: string | null;
  quantity: number;
  updated_at: string;
}

export interface DBLot {
  id: string;
  item_id: string;
  lot_number: string;
  expiration_date: string | null;
}

export interface DBLocation {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface DBVendor {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface DBOrder {
  id: string;
  po_number: string;
  vendor: string; // Storing vendor name directly for now, or UUID if normalized
  order_date: string;
  expected_arrival_date: string | null;
  status: OrderStatus;
  subtotal: number;
  tax_total: number;
  shipping_cost: number;
  grand_total: number;
  notes: string | null;
  attachment_url: string | null;
  created_by: string; // UUID
  created_at: string;
}

export interface DBOrderItem {
  id: string;
  order_id: string;
  item_id: string | null; // Link to public.items
  item_name: string; // Snapshot name
  quantity: number;
  unit_cost: number;
  unit_type: string;
  line_total: number;
}

export interface DBPrice {
  id: string;
  service_name: string;
  price: number;
  category: string;
  code: string | null;
  created_at?: string;
}

export interface DBMedicalCode {
  id: string; // UUID
  name: string;
  lab_code: string;
  cpt_code: string;
  admin_code: string;
  created_at?: string;
}

export interface DBCodeGroup {
  id: string; // UUID
  name: string;
  description: string;
  code_ids: string[]; // UUID[]
  created_at?: string;
}

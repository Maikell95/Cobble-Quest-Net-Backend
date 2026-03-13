import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase.js';

const SALT_ROUNDS = 10;

interface AdminUserRow {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

function toPublicUser(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Verify credentials and return the user (without hash), or null. */
export async function verifyCredentials(username: string, password: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username)
    .eq('active', true)
    .single();

  if (error || !data) return null;

  const row = data as AdminUserRow;
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) return null;

  return toPublicUser(row);
}

/** Get user by id (for token verification). */
export async function getAdminById(id: string): Promise<AdminUser | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single();

  if (error || !data) return null;
  return toPublicUser(data as AdminUserRow);
}

/** List all admin users (without password hashes). */
export async function getAllAdmins(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return (data as AdminUserRow[]).map(toPublicUser);
}

/** Create a new admin user. Returns the user or throws. */
export async function createAdmin(username: string, password: string): Promise<AdminUser> {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  const { data, error } = await supabase
    .from('admin_users')
    .insert({ username, password_hash: hash, role: 'admin' })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return toPublicUser(data as AdminUserRow);
}

/** Update password for admin user. */
export async function updateAdminPassword(id: string, newPassword: string): Promise<boolean> {
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

  const { error } = await supabase
    .from('admin_users')
    .update({ password_hash: hash })
    .eq('id', id);

  return !error;
}

/** Deactivate an admin user (soft delete). */
export async function deactivateAdmin(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('admin_users')
    .update({ active: false })
    .eq('id', id);

  return !error;
}

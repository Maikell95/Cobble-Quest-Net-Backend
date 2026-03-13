import { supabase } from '../config/supabase.js';
import type { StoreItem, CreateStoreItemDTO, UpdateStoreItemDTO } from '../types/index.js';

const TABLE = 'store_items';

interface StoreRow {
  id: string;
  name: string;
  image: string;
  price: number;
  category: string;
  description: string;
  discount: number | null;
  commands: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

function toItem(row: StoreRow): StoreItem {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    price: Number(row.price),
    category: row.category as StoreItem['category'],
    description: row.description,
    discount: row.discount ?? undefined,
    commands: row.commands ?? [],
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllItems(): Promise<StoreItem[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as StoreRow[]).map(toItem);
}

export async function getActiveItems(): Promise<StoreItem[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('active', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as StoreRow[]).map(toItem);
}

export async function getItemById(id: string): Promise<StoreItem | undefined> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) return undefined;
  return toItem(data as StoreRow);
}

export async function createItem(dto: CreateStoreItemDTO): Promise<StoreItem> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: dto.name,
      image: dto.image || '',
      price: dto.price,
      category: dto.category,
      description: dto.description || '',
      discount: dto.discount ?? null,
      commands: dto.commands ?? [],
      active: dto.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return toItem(data as StoreRow);
}

export async function updateItem(id: string, dto: UpdateStoreItemDTO): Promise<StoreItem | null> {
  const update: Record<string, unknown> = {};
  if (dto.name !== undefined) update.name = dto.name;
  if (dto.image !== undefined) update.image = dto.image;
  if (dto.price !== undefined) update.price = dto.price;
  if (dto.category !== undefined) update.category = dto.category;
  if (dto.description !== undefined) update.description = dto.description;
  if (dto.discount !== undefined) update.discount = dto.discount ?? null;
  if (dto.active !== undefined) update.active = dto.active;
  if (dto.commands !== undefined) update.commands = dto.commands;

  const { data, error } = await supabase.from(TABLE).update(update).eq('id', id).select().single();
  if (error) return null;
  return toItem(data as StoreRow);
}

export async function deleteItem(id: string): Promise<boolean> {
  const { error, count } = await supabase.from(TABLE).delete({ count: 'exact' }).eq('id', id);
  if (error) return false;
  return (count ?? 0) > 0;
}

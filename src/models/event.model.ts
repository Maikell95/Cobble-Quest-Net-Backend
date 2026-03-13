import { supabase } from '../config/supabase.js';
import type { ServerEvent, CreateEventDTO, UpdateEventDTO, EventTag } from '../types/index.js';

const TABLE = 'events';

interface EventRow {
  id: string;
  title: string;
  description: string;
  image: string;
  start_date: string;
  end_date: string;
  tags: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

function toEvent(row: EventRow): ServerEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    image: row.image,
    startDate: row.start_date,
    endDate: row.end_date,
    tags: row.tags as EventTag[],
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAllEvents(): Promise<ServerEvent[]> {
  const { data, error } = await supabase.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EventRow[]).map(toEvent);
}

export async function getActiveEvents(): Promise<ServerEvent[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('active', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EventRow[]).map(toEvent);
}

export async function getEventById(id: string): Promise<ServerEvent | undefined> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) return undefined;
  return toEvent(data as EventRow);
}

export async function createEvent(dto: CreateEventDTO): Promise<ServerEvent> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      title: dto.title,
      description: dto.description || '',
      image: dto.image || '',
      start_date: dto.startDate || '',
      end_date: dto.endDate || '',
      tags: dto.tags || [],
      active: dto.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return toEvent(data as EventRow);
}

export async function updateEvent(id: string, dto: UpdateEventDTO): Promise<ServerEvent | null> {
  const update: Record<string, unknown> = {};
  if (dto.title !== undefined) update.title = dto.title;
  if (dto.description !== undefined) update.description = dto.description;
  if (dto.image !== undefined) update.image = dto.image;
  if (dto.startDate !== undefined) update.start_date = dto.startDate;
  if (dto.endDate !== undefined) update.end_date = dto.endDate;
  if (dto.tags !== undefined) update.tags = dto.tags;
  if (dto.active !== undefined) update.active = dto.active;

  const { data, error } = await supabase.from(TABLE).update(update).eq('id', id).select().single();
  if (error) return null;
  return toEvent(data as EventRow);
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error, count } = await supabase.from(TABLE).delete({ count: 'exact' }).eq('id', id);
  if (error) return false;
  return (count ?? 0) > 0;
}

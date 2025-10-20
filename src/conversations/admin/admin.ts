export type AdminStep =
  | "awaitContent"
  | "awaitAudience"
  | "awaitMinLesson"
  | "awaitConfirm";

export interface AdminState {
  step: AdminStep;
  payload?: any;
  filteredUsers?: any[];
  minLesson?: number;
  keyboard?: any;
}

export const ADMIN_IDS = new Set<number>([428205877]);
export const adminState = new Map<number, AdminState>();

export type UserRole = 'employee' | 'manager';

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  category: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
}

export interface StatsData {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  completionRate: number;
  totalEmployees: number;
  activeEmployees: number;
}

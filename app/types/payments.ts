export interface Member {
  contact_id: string; // ✅ Changed from 'id' to match your database column perfectly
  name: string;
  contact_info?: string;
  type?: 'person' | 'group';
}

export interface Split {
  memberId: string;
  amount: number;
  percentage: number;
  status: string;
}

export interface Item {
  id: string;
  description: string;
  status: string;
  totalAmount: number;
  notes?: string;
  splits: Split[];
}
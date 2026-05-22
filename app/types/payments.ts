export type Member = {
  id: string;
  name: string;
  percent?: number; 

};

export type Split = {
  memberId: string;
  amount: number;
  percent?: number;
  status?: string;
};

export type Item = {
  id: string;
  description: string;
  status: string;
  totalAmount: number;
  notes?: string;
  splits: Split[];
};
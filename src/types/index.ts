export interface Menu {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  imageUrl: string;
  stock: number;
  isAvailable: boolean;
}

export interface CartItem extends Menu {
  quantity: number;
}
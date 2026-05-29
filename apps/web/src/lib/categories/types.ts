export interface Category {
  id: string;
  name: string;
  position: number;
}

export interface CategoryListResponse {
  categories: Category[];
}

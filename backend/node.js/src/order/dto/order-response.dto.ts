import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class OrderItemResponseDto {
  @Expose()
  id: number;

  @Expose()
  productId: number;

  @Expose()
  quantity: number;

  @Expose()
  price: number;
}

@Exclude()
export class OrderResponseDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  totalAmount: number;

  @Expose()
  status: string;

  @Expose()
  createdAt: Date;

  @Expose()
  items: OrderItemResponseDto[];
}

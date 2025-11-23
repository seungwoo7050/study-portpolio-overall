export enum OrderEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAID = 'ORDER_PAID',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
}

export interface OrderEvent {
  eventId: string;
  eventType: OrderEventType;
  timestamp: string;
  orderId: number;
  userId: number;
  totalAmount: number;
}

export const KAFKA_TOPICS = {
  ORDER_EVENTS: 'order-events',
} as const;

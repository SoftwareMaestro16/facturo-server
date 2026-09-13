import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ enum: ['STARTER', 'BUSINESS'], description: 'FREE needs no checkout' })
  @IsIn(['STARTER', 'BUSINESS'])
  plan!: 'STARTER' | 'BUSINESS';
}

export class CheckoutResponse {
  @ApiProperty({ description: "Where to send the customer's browser" })
  checkoutUrl!: string;
}

export class SubscriptionResponse {
  @ApiProperty({ enum: ['FREE', 'STARTER', 'BUSINESS'] }) plan!: string;
  @ApiProperty({ enum: ['ACTIVE', 'PAST_DUE', 'CANCELLED'] }) status!: string;
  @ApiPropertyOptional({ description: 'Null means unlimited' }) invoiceQuota!: number | null;
  @ApiProperty() invoicesUsed!: number;
  @ApiProperty() currentPeriodStart!: string;
  @ApiProperty() currentPeriodEnd!: string;
}

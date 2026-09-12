import { ApiProperty, PickType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './invoice.dto';

export class PreviewInvoiceDto extends PickType(CreateInvoiceDto, ['lines'] as const) {}

export class PreviewInvoiceResponse {
  @ApiProperty() subtotal!: string;
  @ApiProperty() vatTotal!: string;
  @ApiProperty() total!: string;
}

import { ApiProperty } from '@nestjs/swagger';

/// The numbers the first screen of the workspace opens with. Outgoing documents
/// of the current company only; amounts are fixed-scale strings in MDL.
export class InvoiceSummaryResponse {
  @ApiProperty({ description: 'Drafts, failed sends and cancellations waiting for the buyer' })
  attentionCount!: number;

  @ApiProperty() draftCount!: number;

  @ApiProperty() errorCount!: number;

  @ApiProperty({ description: 'Signed, sent or received documents the buyer has not finished' })
  awaitingBuyerCount!: number;

  @ApiProperty({ example: '1250.00' }) awaitingBuyerTotal!: string;

  @ApiProperty({ description: 'Issued this calendar month, excluding drafts, failures and cancellations' })
  monthIssuedCount!: number;

  @ApiProperty({ example: '1250.00' }) monthIssuedTotal!: string;

  @ApiProperty() monthFinishedCount!: number;
}

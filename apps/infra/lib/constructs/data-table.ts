import type { EnvName } from '@vozcoletiva/shared';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
  TableEncryption,
} from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DataTableProps {
  readonly env: EnvName;
}

/**
 * The single DynamoDB table that holds every entity for the env, per
 * docs/data-model.md. Overloaded PK/SK with three GSIs, each carrying disjoint,
 * sparse key-spaces:
 *   GSI1 — secondary-id lookups (slug→project, user→memberships, invite token/code)
 *   GSI2 — by root / by user (deliberation tree, vote history)
 *   GSI3 — time/status windows (closing-soon roots, document library, thread replies)
 */
export class DataTable extends Construct {
  readonly table: Table;

  constructor(scope: Construct, id: string, props: DataTableProps) {
    super(scope, id);

    this.table = new Table(this, 'Table', {
      tableName: `vozcoletiva-${props.env}`,
      partitionKey: { name: 'PK', type: AttributeType.STRING },
      sortKey: { name: 'SK', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      encryption: TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI3',
      partitionKey: { name: 'GSI3PK', type: AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
  }
}

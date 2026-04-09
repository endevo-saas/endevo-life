import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface FinOpsStackProps extends cdk.StackProps {
  lambdaRole: iam.Role
}

/**
 * FinOps Infrastructure Stack
 *
 * Creates DynamoDB tables for:
 *   1. endevo-uat-costs — AWS cost data aggregated by date
 *      PK=dateKey (e.g. "2026-04-09"), SK=service/tenant/total
 *      TTL enabled (90 days retention)
 *   2. endevo-uat-webhooks — Tenant webhook configurations
 *      PK=tenantId, SK=webhook/apikey identifiers
 *
 * Also grants the Lambda role Cost Explorer read permissions.
 */
export class FinOpsStack extends cdk.Stack {
  public readonly costsTable: dynamodb.Table
  public readonly webhooksTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: FinOpsStackProps) {
    super(scope, id, props)

    // --- 1. Costs table (AWS cost tracking) ---
    this.costsTable = new dynamodb.Table(this, 'Costs', {
      tableName: 'endevo-uat-costs',
      partitionKey: { name: 'dateKey', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 2. Webhooks table (tenant webhook configs) ---
    this.webhooksTable = new dynamodb.Table(this, 'Webhooks', {
      tableName: 'endevo-uat-webhooks',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 3. Cost Explorer read permissions for Lambda ---
    props.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CostExplorerReadAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'ce:GetCostAndUsage',
        'ce:GetCostAndUsageWithResources',
        'ce:GetTags',
      ],
      resources: ['*'],
    }))

    // --- Outputs ---
    new cdk.CfnOutput(this, 'CostsTableName', {
      value: 'endevo-uat-costs',
      description: 'FinOps cost tracking table',
    })
    new cdk.CfnOutput(this, 'CostsTableArn', {
      value: this.costsTable.tableArn,
      description: 'DynamoDB table ARN: endevo-uat-costs',
    })
    new cdk.CfnOutput(this, 'WebhooksTableName', {
      value: 'endevo-uat-webhooks',
      description: 'Tenant webhook configurations table',
    })
    new cdk.CfnOutput(this, 'WebhooksTableArn', {
      value: this.webhooksTable.tableArn,
      description: 'DynamoDB table ARN: endevo-uat-webhooks',
    })
  }
}

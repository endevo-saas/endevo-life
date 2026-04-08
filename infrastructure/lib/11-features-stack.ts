import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

/**
 * Features & Notifications Infrastructure Stack
 *
 * Creates DynamoDB tables for:
 *   1. endevo-uat-notifications — Tracks sent notifications (re-engagement, reminders, etc.)
 *      PK=userId, SK=type#date (e.g. "REENGAGE#2026-04-08")
 *      GSI: tenantId-index for tenant-scoped queries
 */
export class FeaturesStack extends cdk.Stack {
  public readonly notificationsTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // --- 1. Notifications table ---
    this.notificationsTable = new dynamodb.Table(this, 'Notifications', {
      tableName: 'endevo-uat-notifications',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    this.notificationsTable.addGlobalSecondaryIndex({
      indexName: 'tenantId-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // --- Outputs ---
    new cdk.CfnOutput(this, 'NotificationsTableName', {
      value: 'endevo-uat-notifications',
      description: 'Notifications tracking table',
    })
    new cdk.CfnOutput(this, 'NotificationsTableArn', {
      value: this.notificationsTable.tableArn,
      description: 'DynamoDB table ARN: endevo-uat-notifications',
    })
  }
}

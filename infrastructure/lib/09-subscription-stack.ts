import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class SubscriptionStack extends cdk.Stack {
  public readonly subscriptionsTable: dynamodb.Table
  public readonly sessionsTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // --- 1. Subscriptions (billing, invoices, plan changes) ---
    const subscriptions = new dynamodb.Table(this, 'Subscriptions', {
      tableName: 'endevo-uat-subscriptions',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    subscriptions.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    this.subscriptionsTable = subscriptions

    // --- 2. Sessions (1:1 coaching session booking + tracking) ---
    const sessions = new dynamodb.Table(this, 'Sessions', {
      tableName: 'endevo-uat-sessions',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    sessions.addGlobalSecondaryIndex({
      indexName: 'tenantId-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    sessions.addGlobalSecondaryIndex({
      indexName: 'status-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scheduledAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    this.sessionsTable = sessions

    // --- Outputs ---
    new cdk.CfnOutput(this, 'TableArnSubscriptions', {
      value: subscriptions.tableArn,
      description: 'DynamoDB table ARN: endevo-uat-subscriptions',
    })
    new cdk.CfnOutput(this, 'TableArnSessions', {
      value: sessions.tableArn,
      description: 'DynamoDB table ARN: endevo-uat-sessions',
    })
  }
}

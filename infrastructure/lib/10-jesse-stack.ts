import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

/**
 * Jesse AI Infrastructure Stack
 *
 * Creates DynamoDB tables for Jesse AI:
 *   1. endevo-uat-jesse-chat — Chat history (PK=userId, SK=createdAt)
 *   2. endevo-uat-knowledge-base — Vector embeddings for RAG (PK=sourceFile, SK=chunkIndex)
 *   3. endevo-uat-jesse-jobs — Async job tracking (PK=jobId, TTL=1hr)
 *
 * The Lambda (fn-jesse) and API Gateway route will be created
 * manually first, following the same pattern as LMS (Stack 08).
 *
 * Data model note: NO separate jesse-users table — Jesse uses
 * endevo-uat-users (enterprise users) for all auth and profile data.
 */
export class JesseStack extends cdk.Stack {
  public readonly jesseChatTable: dynamodb.Table
  public readonly knowledgeBaseTable: dynamodb.Table
  public readonly jesseJobsTable: dynamodb.Table

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // --- 1. Jesse Chat History table ---
    this.jesseChatTable = new dynamodb.Table(this, 'JesseChat', {
      tableName: 'endevo-uat-jesse-chat',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 2. Knowledge Base table (replaces Aurora pgvector) ---
    // Stores text chunks + Titan Embed V2 embeddings (1024-dim)
    // Vector search via DynamoDB scan + cosine similarity (OK for <10K chunks)
    // Migration path: OpenSearch Serverless or Bedrock Knowledge Base at scale
    this.knowledgeBaseTable = new dynamodb.Table(this, 'KnowledgeBase', {
      tableName: 'endevo-uat-knowledge-base',
      partitionKey: { name: 'sourceFile', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'chunkIndex', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 3. Jesse Async Jobs table (for API Gateway 30s timeout workaround) ---
    // Stores async job state when Bedrock calls exceed 25s.
    // Lambda self-invokes asynchronously and stores result here.
    // Client polls GET /api/jesse/chat/job/{jobId} until complete.
    this.jesseJobsTable = new dynamodb.Table(this, 'JesseJobs', {
      tableName: 'endevo-uat-jesse-jobs',
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: false, // Ephemeral data, TTL handles cleanup
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Ephemeral — safe to destroy
    })

    // Outputs
    new cdk.CfnOutput(this, 'JesseChatTableName', {
      value: 'endevo-uat-jesse-chat',
      description: 'Jesse AI chat history table',
    })
    new cdk.CfnOutput(this, 'JesseChatTableArn', {
      value: this.jesseChatTable.tableArn,
      description: 'Jesse AI chat history table ARN',
    })
    new cdk.CfnOutput(this, 'KnowledgeBaseTableName', {
      value: 'endevo-uat-knowledge-base',
      description: 'Jesse AI knowledge base (vector embeddings)',
    })
    new cdk.CfnOutput(this, 'KnowledgeBaseTableArn', {
      value: this.knowledgeBaseTable.tableArn,
      description: 'Jesse AI knowledge base table ARN',
    })
    new cdk.CfnOutput(this, 'JesseJobsTableName', {
      value: 'endevo-uat-jesse-jobs',
      description: 'Jesse AI async jobs table',
    })
    new cdk.CfnOutput(this, 'JesseJobsTableArn', {
      value: this.jesseJobsTable.tableArn,
      description: 'Jesse AI async jobs table ARN',
    })
  }
}

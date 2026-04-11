import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'

export class DynamoStack extends cdk.Stack {
  public readonly tableArns: string[]

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    const tables: dynamodb.Table[] = []

    // --- 1. Tenants ---
    const tenants = new dynamodb.Table(this, 'Tenants', {
      tableName: 'endevo-uat-tenants',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(tenants)

    // --- 2. Users (multi-index for lookups) ---
    const users = new dynamodb.Table(this, 'Users', {
      tableName: 'endevo-uat-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    users.addGlobalSecondaryIndex({
      indexName: 'email-index',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    users.addGlobalSecondaryIndex({
      indexName: 'tenantId-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    users.addGlobalSecondaryIndex({
      indexName: 'inviteToken-index',
      partitionKey: { name: 'inviteToken', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(users)

    // --- 3. Training Videos ---
    const training = new dynamodb.Table(this, 'Training', {
      tableName: 'endevo-uat-training',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'videoId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(training)

    // --- 4. Assessment Questions ---
    const questions = new dynamodb.Table(this, 'Questions', {
      tableName: 'endevo-uat-questions',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(questions)

    // --- 5. Assessment Responses ---
    const responses = new dynamodb.Table(this, 'Responses', {
      tableName: 'endevo-uat-responses',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'submittedAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    responses.addGlobalSecondaryIndex({
      indexName: 'tenantId-index',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(responses)

    // --- 6. Certificates ---
    const certificates = new dynamodb.Table(this, 'Certificates', {
      tableName: 'endevo-uat-certificates',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'issuedAt', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(certificates)

    // --- 7. Audit Log ---
    const audit = new dynamodb.Table(this, 'Audit', {
      tableName: 'endevo-uat-audit',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl', // auto-delete old audit logs after 2 years
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(audit)

    // --- 8. Video Progress ---
    const videoProgress = new dynamodb.Table(this, 'VideoProgress', {
      tableName: 'endevo-uat-video-progress',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'videoId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(videoProgress)

    // --- 9. Platform Config ---
    const config = new dynamodb.Table(this, 'Config', {
      tableName: 'endevo-uat-config',
      partitionKey: { name: 'configKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(config)

    // --- 10. Checklist Templates ---
    const checklistTemplates = new dynamodb.Table(this, 'ChecklistTemplates', {
      tableName: 'endevo-uat-checklist-templates',
      partitionKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'version', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    checklistTemplates.addGlobalSecondaryIndex({
      indexName: 'status-createdAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(checklistTemplates)

    // --- 11. Checklist Progress ---
    const checklistProgress = new dynamodb.Table(this, 'ChecklistProgress', {
      tableName: 'endevo-uat-checklist-progress',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    checklistProgress.addGlobalSecondaryIndex({
      indexName: 'templateId-userId-index',
      partitionKey: { name: 'templateId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(checklistProgress)

    // --- 12. Master Classes ---
    const masterClasses = new dynamodb.Table(this, 'MasterClasses', {
      tableName: 'endevo-uat-master-classes',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'classId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    masterClasses.addGlobalSecondaryIndex({
      indexName: 'status-scheduledAt-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'scheduledAt', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(masterClasses)

    // --- 13. Documents ---
    const documents = new dynamodb.Table(this, 'Documents', {
      tableName: 'endevo-uat-documents',
      partitionKey: { name: 'documentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    documents.addGlobalSecondaryIndex({
      indexName: 'userId-responseId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'responseId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    documents.addGlobalSecondaryIndex({
      indexName: 'responseId-userId-index',
      partitionKey: { name: 'responseId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })
    tables.push(documents)

    // --- 14. OTP ---
    const otp = new dynamodb.Table(this, 'Otp', {
      tableName: 'endevo-uat-otp',
      partitionKey: { name: 'otpId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })
    tables.push(otp)

    this.tableArns = tables.map(t => t.tableArn)

    // --- Outputs (IDs must be hardcoded — CDK tokens not allowed in IDs) ---
    // Note: lmsModules and lmsUserModules are managed by LmsInfraStack (imported resources).
    const tableNames = ['tenants','users','training','questions','responses','certificates','audit','videoProgress','config','checklistTemplates','checklistProgress','masterClasses','documents','otp']
    tables.forEach((t, i) => {
      new cdk.CfnOutput(this, `TableArn${tableNames[i]}`, {
        value: t.tableArn,
        description: `DynamoDB table ARN: endevo-uat-${tableNames[i]}`,
      })
    })
  }
}

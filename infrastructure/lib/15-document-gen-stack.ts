import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'

export interface DocumentGenStackProps extends cdk.StackProps {
  documentsTableName: string
  responsesTableName: string
  s3BucketName: string
}

/**
 * Document Generation Lambda Stack
 * Handles PDF/XLSX generation for assessments, checklists, and scorecards
 * Memory: 512 MB | Timeout: 120s
 */
export class DocumentGenStack extends cdk.Stack {
  public readonly functionArn: string
  public readonly functionName: string

  constructor(scope: cdk.App, id: string, props: DocumentGenStackProps) {
    super(scope, id, props)

    // --- Lambda Layer (wkhtmltopdf + openpyxl) ---
    const wkhtmltopdfLayer = new lambda.LayerVersion(this, 'WkhtmltopdfLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/document-gen/layers/wkhtmltopdf')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'wkhtmltopdf + openpyxl + reportlab for PDF/XLSX generation',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // --- Lambda Function ---
    const documentGenFunction = new lambda.Function(this, 'DocumentGenFunction', {
      functionName: 'endevo-uat-document-gen',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/document-gen')),
      timeout: cdk.Duration.seconds(120),
      memorySize: 512,
      layers: [wkhtmltopdfLayer],
      environment: {
        DOCUMENTS_TABLE: props.documentsTableName,
        RESPONSES_TABLE: props.responsesTableName,
        S3_BUCKET: props.s3BucketName,
        AWS_REGION: this.region,
      },
      description: 'Generate PDF/XLSX documents from assessment responses',
    })

    // --- IAM Permissions ---
    // DynamoDB: Read responses, write documents
    documentGenFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.responsesTableName}`,
        ],
      })
    )

    documentGenFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/${props.documentsTableName}`,
        ],
      })
    )

    // S3: Write documents
    documentGenFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:GetObject'],
        resources: [`arn:aws:s3:::${props.s3BucketName}/documents/*`],
      })
    )

    // S3: Read templates
    documentGenFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`arn:aws:s3:::${props.s3BucketName}/templates/*`],
      })
    )

    this.functionArn = documentGenFunction.functionArn
    this.functionName = documentGenFunction.functionName

    // --- Outputs ---
    new cdk.CfnOutput(this, 'DocumentGenFunctionArn', {
      value: this.functionArn,
      description: 'Document Generation Lambda function ARN',
      exportName: `endevo-document-gen-arn`,
    })

    new cdk.CfnOutput(this, 'DocumentGenFunctionName', {
      value: this.functionName,
      description: 'Document Generation Lambda function name',
      exportName: `endevo-document-gen-name`,
    })
  }
}

import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface IamStackProps extends cdk.StackProps {
  // dynamoTableArns and s3BucketArns removed — IAM now uses wildcard patterns
  // to avoid cross-stack CloudFormation ResourceExistenceCheck failures when
  // new tables/buckets are added. Pattern endevo-uat-* covers all current and
  // future resources automatically.
}

export class IamStack extends cdk.Stack {
  public readonly lambdaRole: iam.Role

  constructor(scope: Construct, id: string, props: IamStackProps) {
    super(scope, id, props)

    // Lambda execution role — least privilege
    this.lambdaRole = new iam.Role(this, 'LambdaRole', {
      roleName: 'endevo-uat-lambda-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    // DynamoDB — all endevo tables (wildcard covers current + future tables)
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:BatchGetItem', 'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/endevo-uat-*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/endevo-uat-*/index/*`,
      ],
    }))

    // S3 — all endevo buckets (wildcard covers current + future buckets)
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3Access',
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [`arn:aws:s3:::endevo-uat-*/*`],
    }))

    // S3 — list buckets
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3ListAccess',
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucket', 's3:GetBucketLocation'],
      resources: [`arn:aws:s3:::endevo-uat-*`],
    }))

    // SES — send emails
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SESAccess',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }))

    // Secrets Manager — WorkOS API key + client ID
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SecretsManagerAccess',
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:endevo/workos/*`],
    }))

    // SNS — publish SMS/notifications
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SnsPublish',
      effect: iam.Effect.ALLOW,
      actions: ['sns:Publish'],
      resources: ['*'],  // SNS Publish to phone numbers requires * resource
    }))

    // CloudFront signed URLs — LMS video delivery
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CloudFrontSignedUrls',
      effect: iam.Effect.ALLOW,
      actions: [
        'cloudfront:CreateInvalidation',
        'cloudfront:GetDistribution',
      ],
      resources: ['*'],
    }))

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      description: 'Lambda execution role ARN',
      exportName: 'endevo-uat-lambda-role-arn',
    })
  }
}

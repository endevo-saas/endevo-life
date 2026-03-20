import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface IamStackProps extends cdk.StackProps {
  dynamoTableArns: string[]
  s3BucketArns: string[]
  cognitoPoolArn: string
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

    // DynamoDB — all tables
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoDBAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query', 'dynamodb:Scan',
        'dynamodb:BatchGetItem', 'dynamodb:BatchWriteItem',
      ],
      resources: [
        ...props.dynamoTableArns,
        ...props.dynamoTableArns.map(arn => `${arn}/index/*`),
      ],
    }))

    // S3 — assets + videos
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3Access',
      effect: iam.Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:GeneratePresignedUrl'],
      resources: props.s3BucketArns.map(arn => `${arn}/*`),
    }))

    // SES — send emails
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SESAccess',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }))

    // Cognito — admin operations for register + invite
    this.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CognitoAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminUpdateUserAttributes',
        'cognito-idp:InitiateAuth',
        'cognito-idp:GetUser',
      ],
      resources: [props.cognitoPoolArn],
    }))

    new cdk.CfnOutput(this, 'LambdaRoleArn', {
      value: this.lambdaRole.roleArn,
      description: 'Lambda execution role ARN',
      exportName: 'endevo-uat-lambda-role-arn',
    })
  }
}

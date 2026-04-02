#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { CognitoStack } from '../lib/01-cognito-stack'
import { DynamoStack } from '../lib/02-dynamo-stack'
import { S3Stack } from '../lib/03-s3-stack'
import { IamStack } from '../lib/04-iam-stack'
import { ApiStack } from '../lib/05-api-stack'
import { AmplifyStack } from '../lib/06-amplify-stack'
import { CloudFrontLmsStack } from '../lib/07-cloudfront-lms-stack'

const app = new cdk.App()

const env = {
  account: process.env.AWS_ACCOUNT_ID || '383423735462',
  region: process.env.AWS_REGION || 'us-east-1',
}

const tags = {
  Project: 'endevo',
  Environment: 'uat',
  ManagedBy: 'cdk',
  Owner: 'shahzad',
}

// Stack 1 — Cognito (auth)
const cognito = new CognitoStack(app, 'EndevoUatCognito', { env, tags })

// Stack 2 — DynamoDB (database)
new DynamoStack(app, 'EndevoUatDynamo', { env, tags })

// Stack 3 — S3 (storage)
new S3Stack(app, 'EndevoUatS3', { env, tags })

// Stack 4 — IAM (roles + policies)
// Note: no dynamoTableArns/s3BucketArns props — IAM uses wildcard endevo-uat-* ARNs
// to avoid cross-stack ResourceExistenceCheck failures when new tables are added
const iam = new IamStack(app, 'EndevoUatIam', {
  env, tags,
  cognitoPoolArn: cognito.userPoolArn,
})

// Stack 5 — API Gateway + Python Lambdas
const api = new ApiStack(app, 'EndevoUatApi', {
  env, tags,
  lambdaRole: iam.lambdaRole,
  userPoolId: cognito.userPoolId,
  userPoolClientId: cognito.userPoolClientId,
})

// Stack 6 — Amplify (frontend hosting)
new AmplifyStack(app, 'EndevoUatAmplify', {
  env, tags,
  apiUrl: api.apiUrl,
  userPoolId: cognito.userPoolId,
  userPoolClientId: cognito.userPoolClientId,
})

// Stack 7 — CloudFront LMS (secure video delivery)
new CloudFrontLmsStack(app, 'EndevoUatCloudFrontLms', {
  env, tags,
  lambdaRoleArn: iam.lambdaRole.roleArn,
})

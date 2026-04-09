#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
// CognitoStack import removed — WorkOS replaces Cognito (01-cognito-stack.ts kept as safety net for 30 days)
import { DynamoStack } from '../lib/02-dynamo-stack'
import { S3Stack } from '../lib/03-s3-stack'
import { IamStack } from '../lib/04-iam-stack'
import { ApiStack } from '../lib/05-api-stack'
import { AmplifyStack } from '../lib/06-amplify-stack'
import { CloudFrontLmsStack } from '../lib/07-cloudfront-lms-stack'
import { LmsInfraStack } from '../lib/08-lms-infra-stack'
import { SubscriptionStack } from '../lib/09-subscription-stack'
import { JesseStack } from '../lib/10-jesse-stack'
import { FeaturesStack } from '../lib/11-features-stack'
import { EventBridgeStack } from '../lib/12-eventbridge-stack'
import { FinOpsStack } from '../lib/13-finops-stack'
import { KmsStack } from '../lib/14-kms-stack'
import { CloudFrontApiStack } from '../lib/15-cloudfront-api-stack'
import { EmailQueueStack } from '../lib/16-email-queue-stack'
import { ObservabilityStack } from '../lib/17-observability-stack'
import { JesseAgentStack } from '../lib/18-jesse-agent-stack'

const app = new cdk.App()

const env = {
  account: process.env.AWS_ACCOUNT_ID || '383423735462',
  region: process.env.AWS_REGION || 'us-east-1',
}

// Cost Allocation Tags — applied to ALL resources for FinOps per-tenant tracking
const tags = {
  Project: 'endevo',
  Environment: 'uat',
  ManagedBy: 'cdk',
  Owner: 'shahzad',
  CostCenter: 'endevo-platform',
  Service: 'endevo-life',
}

// Stack 1 — Cognito REMOVED (WorkOS replaces Cognito; 01-cognito-stack.ts kept as safety net for 30 days)

// Stack 2 — DynamoDB (database)
new DynamoStack(app, 'EndevoUatDynamo', { env, tags })

// Stack 3 — S3 (storage)
new S3Stack(app, 'EndevoUatS3', { env, tags })

// Stack 4 — IAM (roles + policies)
// Note: no dynamoTableArns/s3BucketArns props — IAM uses wildcard endevo-uat-* ARNs
// to avoid cross-stack ResourceExistenceCheck failures when new tables are added
const iam = new IamStack(app, 'EndevoUatIam', {
  env, tags,
})

// Stack 5 — API Gateway + Python Lambdas
const api = new ApiStack(app, 'EndevoUatApi', {
  env, tags,
  lambdaRole: iam.lambdaRole,
})

// Stack 6 — Amplify (frontend hosting)
new AmplifyStack(app, 'EndevoUatAmplify', {
  env, tags,
  apiUrl: api.apiUrl,
})

// Stack 7 — CloudFront LMS (secure video delivery)
new CloudFrontLmsStack(app, 'EndevoUatCloudFrontLms', {
  env, tags,
  lambdaRoleArn: iam.lambdaRole.roleArn,
})

// Stack 8 — LMS Infra (imports manually-created LMS resources for CDK awareness)
new LmsInfraStack(app, 'EndevoUatLmsInfra', { env, tags })

// Stack 9 — Subscriptions + Sessions
new SubscriptionStack(app, 'EndevoUatSubscriptions', { env, tags })

// Stack 10 — Jesse AI (chat history table)
new JesseStack(app, 'EndevoUatJesse', { env, tags })

// Stack 11 — Plan Features + Notifications
new FeaturesStack(app, 'EndevoUatFeatures', { env, tags })

// Stack 12 — EventBridge (event-driven backbone)
new EventBridgeStack(app, 'EndevoUatEventBridge', { env, tags })

// Stack 13 — FinOps (cost tracking + webhooks)
new FinOpsStack(app, 'EndevoUatFinOps', {
  env, tags,
  lambdaRole: iam.lambdaRole,
})

// Stack 14 — KMS (Zero-Trust envelope encryption for Digital Vault)
new KmsStack(app, 'EndevoUatKms', {
  env, tags,
  lambdaRole: iam.lambdaRole,
})

// Stack 15 — CloudFront + WAF (API Gateway security shield)
new CloudFrontApiStack(app, 'EndevoUatCloudFrontApi', { env, tags })

// Stack 16 — SQS Email Queue (SES throttle protection)
new EmailQueueStack(app, 'EndevoUatEmailQueue', {
  env, tags,
  lambdaRole: iam.lambdaRole,
})

// Stack 17 — Observability (CloudWatch error alarms for all Lambdas)
new ObservabilityStack(app, 'EndevoUatObservability', { env, tags })

// Stack 18 — Jesse AI Bedrock Agent (HITL action groups + Knowledge Base)
new JesseAgentStack(app, 'EndevoUatJesseAgent', {
  env, tags,
  lambdaRole: iam.lambdaRole,
})

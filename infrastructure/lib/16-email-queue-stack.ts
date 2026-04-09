import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources'
import { Construct } from 'constructs'

export interface EmailQueueStackProps extends cdk.StackProps {
  lambdaRole: iam.Role
}

/**
 * Email Queue Stack
 *
 * SQS-based email queue to prevent SES throttling (14 emails/sec limit).
 *
 * Creates:
 *   1. Dead letter queue: endevo-uat-email-dlq (14-day retention)
 *   2. Main queue: endevo-uat-email-queue (4-day retention, 3 retries before DLQ)
 *   3. Mailer Lambda: endevo-uat-fn-mailer (Python 3.12, sends via SES)
 *   4. SQS event source: batch size 1, max concurrency 10 (~14 emails/sec)
 *   5. IAM: SQS + SES permissions on the shared Lambda role
 */
export class EmailQueueStack extends cdk.Stack {
  public readonly emailQueue: sqs.Queue
  public readonly emailDlq: sqs.Queue
  public readonly mailerFunction: lambda.Function

  constructor(scope: Construct, id: string, props: EmailQueueStackProps) {
    super(scope, id, props)

    const tags = {
      Project: 'endevo',
      Environment: 'uat',
      ManagedBy: 'cdk',
      Owner: 'shahzad',
    }

    // --- 1. Dead Letter Queue ---
    this.emailDlq = new sqs.Queue(this, 'EmailDlq', {
      queueName: 'endevo-uat-email-dlq',
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 2. Main Email Queue ---
    this.emailQueue = new sqs.Queue(this, 'EmailQueue', {
      queueName: 'endevo-uat-email-queue',
      visibilityTimeout: cdk.Duration.seconds(60),
      retentionPeriod: cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.emailDlq,
        maxReceiveCount: 3,
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 3. Mailer Lambda ---
    const mailerCode = `
import json
import boto3
import os

ses = boto3.client('ses', region_name=os.environ.get('REGION', 'us-east-1'))

def handler(event, context):
    results = []

    for record in event.get('Records', []):
        try:
            body = json.loads(record['body'])

            to_addresses = body['to']
            if isinstance(to_addresses, str):
                to_addresses = [to_addresses]

            message = {
                'Subject': {'Data': body['subject'], 'Charset': 'UTF-8'},
                'Body': {},
            }

            if body.get('htmlBody'):
                message['Body']['Html'] = {
                    'Data': body['htmlBody'],
                    'Charset': 'UTF-8',
                }

            if body.get('textBody'):
                message['Body']['Text'] = {
                    'Data': body['textBody'],
                    'Charset': 'UTF-8',
                }

            source = body.get('source', os.environ.get('FROM_EMAIL', 'noreply@endevo.life'))

            response = ses.send_email(
                Source=source,
                Destination={'ToAddresses': to_addresses},
                Message=message,
            )

            results.append({
                'messageId': response['MessageId'],
                'status': 'success',
            })

        except Exception as e:
            results.append({
                'error': str(e),
                'status': 'failure',
            })
            raise

    return {
        'statusCode': 200,
        'body': json.dumps(results),
    }
`

    this.mailerFunction = new lambda.Function(this, 'MailerFunction', {
      functionName: 'endevo-uat-fn-mailer',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(mailerCode),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      role: props.lambdaRole,
      environment: {
        REGION: 'us-east-1',
        FROM_EMAIL: 'noreply@endevo.life',
      },
    })

    // --- 4. SQS Event Source ---
    this.mailerFunction.addEventSource(
      new lambdaEventSources.SqsEventSource(this.emailQueue, {
        batchSize: 1,
        maxConcurrency: 10,
      })
    )

    // --- 5. IAM — SQS permissions on the shared Lambda role ---
    props.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SQSEmailQueueAccess',
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
          'sqs:GetQueueAttributes',
        ],
        resources: [this.emailQueue.queueArn],
      })
    )

    // SES send permissions (already in IAM stack but explicit for this Lambda)
    props.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'SESEmailSendAccess',
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      })
    )

    // --- Tags ---
    for (const [key, value] of Object.entries(tags)) {
      cdk.Tags.of(this).add(key, value)
    }

    // --- Outputs ---
    new cdk.CfnOutput(this, 'EmailQueueUrl', {
      value: this.emailQueue.queueUrl,
      description: 'SQS email queue URL',
    })
    new cdk.CfnOutput(this, 'EmailQueueArn', {
      value: this.emailQueue.queueArn,
      description: 'SQS email queue ARN',
    })
    new cdk.CfnOutput(this, 'EmailDlqUrl', {
      value: this.emailDlq.queueUrl,
      description: 'SQS email dead letter queue URL',
    })
    new cdk.CfnOutput(this, 'MailerFunctionArn', {
      value: this.mailerFunction.functionArn,
      description: 'Mailer Lambda function ARN',
    })
  }
}

import * as cdk from 'aws-cdk-lib'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import * as logs from 'aws-cdk-lib/aws-logs'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'

export interface EventBridgeStackProps extends cdk.StackProps {}

/**
 * EventBridge Infrastructure Stack
 *
 * Creates:
 *   1. Custom event bus: endevo-uat-events
 *   2. Dead letter queue: endevo-uat-events-dlq (failed event delivery)
 *   3. CloudWatch log group: /endevo/uat/events (30-day retention, all events)
 *   4. Event rules for core platform events:
 *      - endevo.user.created
 *      - endevo.user.activated
 *      - endevo.module.completed
 *      - endevo.assessment.completed
 *      - endevo.certificate.issued
 *      - endevo.subscription.changed
 *      - endevo.subscription.cancelled
 *      - endevo.tenant.created
 *
 * All rules target CloudWatch Logs for now — Lambda subscribers added later.
 */
export class EventBridgeStack extends cdk.Stack {
  public readonly eventBus: events.EventBus

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props)

    const tags = {
      Project: 'endevo',
      Environment: 'uat',
      ManagedBy: 'cdk',
      Owner: 'shahzad',
    }

    // --- 1. Dead Letter Queue for failed event delivery ---
    const dlq = new sqs.Queue(this, 'EventsDlq', {
      queueName: 'endevo-uat-events-dlq',
      retentionPeriod: cdk.Duration.days(14),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- 2. Custom Event Bus ---
    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: 'endevo-uat-events',
    })

    // --- 3. CloudWatch Log Group for all events ---
    const eventLogGroup = new logs.LogGroup(this, 'EventLogGroup', {
      logGroupName: '/endevo/uat/events',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // --- 4. Event Rules ---
    const eventTypes = [
      {
        id: 'UserCreated',
        detailType: 'endevo.user.created',
        description: 'Fires when a new user is created',
      },
      {
        id: 'UserActivated',
        detailType: 'endevo.user.activated',
        description: 'Fires when user activates account',
      },
      {
        id: 'ModuleCompleted',
        detailType: 'endevo.module.completed',
        description: 'Fires when employee finishes an LMS module',
      },
      {
        id: 'AssessmentCompleted',
        detailType: 'endevo.assessment.completed',
        description: 'Fires when readiness assessment is done',
      },
      {
        id: 'CertificateIssued',
        detailType: 'endevo.certificate.issued',
        description: 'Fires when Module 6 certificate generated',
      },
      {
        id: 'SubscriptionChanged',
        detailType: 'endevo.subscription.changed',
        description: 'Fires when tenant plan changes',
      },
      {
        id: 'SubscriptionCancelled',
        detailType: 'endevo.subscription.cancelled',
        description: 'Fires when subscription cancelled',
      },
      {
        id: 'TenantCreated',
        detailType: 'endevo.tenant.created',
        description: 'Fires when new tenant provisioned',
      },
    ]

    for (const eventType of eventTypes) {
      const rule = new events.Rule(this, `Rule${eventType.id}`, {
        ruleName: `endevo-uat-${eventType.detailType.replace(/\./g, '-')}`,
        description: eventType.description,
        eventBus: this.eventBus,
        eventPattern: {
          detailType: [eventType.detailType],
        },
      })

      rule.addTarget(
        new targets.CloudWatchLogGroup(eventLogGroup, {
          deadLetterQueue: dlq,
        })
      )
    }

    // --- Tags ---
    for (const [key, value] of Object.entries(tags)) {
      cdk.Tags.of(this).add(key, value)
    }

    // --- Outputs ---
    new cdk.CfnOutput(this, 'EventBusName', {
      value: this.eventBus.eventBusName,
      description: 'Endevo custom EventBridge bus name',
    })
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      description: 'Endevo custom EventBridge bus ARN',
    })
  }
}

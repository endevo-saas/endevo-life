import * as cdk from 'aws-cdk-lib'
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch'
import { Construct } from 'constructs'

/**
 * Observability Stack — CloudWatch Error Alarms
 *
 * Creates a CloudWatch Alarm for each Lambda function that triggers
 * when >= 1 error occurs in any 1-minute window.
 *
 * Alarm naming: endevo-uat-{function-name}-errors
 *
 * No cross-stack dependencies — uses raw Metric objects pointing
 * to function names, so it works whether the Lambda is CDK-managed
 * (auth, admin, hr, employee) or manually created (lms, jesse).
 */
export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    const lambdaFunctions = [
      'endevo-uat-fn-auth',
      'endevo-uat-fn-admin',
      'endevo-uat-fn-hr',
      'endevo-uat-fn-employee',
      'endevo-uat-fn-lms',
      'endevo-uat-fn-jesse',
    ] as const

    for (const functionName of lambdaFunctions) {
      const shortName = functionName.replace('endevo-uat-fn-', '')

      const errorMetric = new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Errors',
        dimensionsMap: { FunctionName: functionName },
        period: cdk.Duration.seconds(60),
        statistic: 'Sum',
      })

      new cloudwatch.Alarm(this, `ErrorAlarm-${shortName}`, {
        alarmName: `endevo-uat-${shortName}-errors`,
        alarmDescription: `Error alarm for ${functionName} — triggers when >= 1 error in 1 minute`,
        metric: errorMetric,
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      })
    }

    // --- Outputs ---
    new cdk.CfnOutput(this, 'AlarmCount', {
      value: String(lambdaFunctions.length),
      description: 'Number of Lambda error alarms created',
    })
  }
}

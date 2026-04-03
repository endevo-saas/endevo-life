import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

/**
 * LMS Infrastructure Stack
 *
 * IMPORTANT: These resources were manually created to unblock deployment.
 * This stack IMPORTS them (does not create) so CDK tracks them.
 * Future LMS resources should be added here.
 */
export class LmsInfraStack extends cdk.Stack {
  public readonly lmsModulesTable: dynamodb.ITable
  public readonly lmsUserModulesTable: dynamodb.ITable
  public readonly lmsFn: lambda.IFunction

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // Import existing manually-created tables
    this.lmsModulesTable = dynamodb.Table.fromTableName(
      this, 'LmsModules', 'endevo-uat-lms-modules'
    )
    this.lmsUserModulesTable = dynamodb.Table.fromTableName(
      this, 'LmsUserModules', 'endevo-uat-lms-user-modules'
    )

    // Import existing manually-created Lambda
    this.lmsFn = lambda.Function.fromFunctionName(
      this, 'LmsFn', 'endevo-uat-fn-lms'
    )

    new cdk.CfnOutput(this, 'LmsModulesTableName', {
      value: 'endevo-uat-lms-modules',
      description: 'LMS modules config table',
    })
    new cdk.CfnOutput(this, 'LmsUserModulesTableName', {
      value: 'endevo-uat-lms-user-modules',
      description: 'LMS per-user module progress table',
    })
    new cdk.CfnOutput(this, 'LmsFunctionName', {
      value: 'endevo-uat-fn-lms',
      description: 'LMS Lambda function',
    })
  }
}

import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'
import { Construct } from 'constructs'

/**
 * Cognito custom-auth Lambda triggers for email OTP passwordless flow.
 * Deploy this stack BEFORE CognitoStack so its function ARNs can be passed in.
 *
 * Trigger chain:
 *   1. DefineAuthChallenge   — decides what challenge type to issue
 *   2. CreateAuthChallenge   — generates OTP, stores it, sends via SES
 *   3. VerifyAuthChallenge   — checks user's answer against stored OTP
 *   4. PreTokenGeneration    — injects custom:role from Cognito group into JWT
 *   5. PostConfirmation      — creates DynamoDB user stub on first login
 */
export class CognitoTriggersStack extends cdk.Stack {
  public readonly defineChallengeFn: lambda.Function
  public readonly createChallengeFn: lambda.Function
  public readonly verifyChallengeFn: lambda.Function
  public readonly preTokenGenFn: lambda.Function
  public readonly postConfirmationFn: lambda.Function

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // Shared IAM role for all five trigger Lambdas (least privilege)
    const triggerRole = new iam.Role(this, 'CognitoTriggerRole', {
      roleName: 'endevo-uat-cognito-trigger-role',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    // DynamoDB — endevo-uat-users and endevo-uat-audit only
    triggerRole.addToPolicy(new iam.PolicyStatement({
      sid: 'DynamoOtpAndUsers',
      effect: iam.Effect.ALLOW,
      actions: [
        'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem',
        'dynamodb:DeleteItem', 'dynamodb:Query',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/endevo-uat-users`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/endevo-uat-users/index/*`,
        `arn:aws:dynamodb:${this.region}:${this.account}:table/endevo-uat-audit`,
      ],
    }))

    // SES — send OTP emails from verified sender
    triggerRole.addToPolicy(new iam.PolicyStatement({
      sid: 'SesOtpEmail',
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],  // SES requires * for send; scoped by verified identity in code
    }))

    // Cognito — read group membership for pre-token-generation trigger
    triggerRole.addToPolicy(new iam.PolicyStatement({
      sid: 'CognitoGroupRead',
      effect: iam.Effect.ALLOW,
      actions: ['cognito-idp:AdminListGroupsForUser'],
      resources: [`arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`],
    }))

    const commonTriggerProps = {
      runtime: lambda.Runtime.PYTHON_3_12,
      role: triggerRole,
      timeout: cdk.Duration.seconds(10),  // triggers have short deadlines
      memorySize: 128,
      environment: {
        USERS_TABLE:          'endevo-uat-users',
        AUDIT_TABLE:          'endevo-uat-audit',
        FROM_EMAIL:           'no-reply@endevo.life',
        REGION:               this.region,
      },
    }

    // ── 1. Define Auth Challenge ───────────────────────────────────────────
    this.defineChallengeFn = new lambda.Function(this, 'DefineChallengeFn', {
      ...commonTriggerProps,
      functionName: 'uat-endevo-fn-cognito-define-challenge',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/functions/cognito-triggers/define-challenge')
      ),
      description: 'Cognito DefineAuthChallenge — routes OTP flow',
    })

    // ── 2. Create Auth Challenge ───────────────────────────────────────────
    this.createChallengeFn = new lambda.Function(this, 'CreateChallengeFn', {
      ...commonTriggerProps,
      functionName: 'uat-endevo-fn-cognito-create-challenge',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/functions/cognito-triggers/create-challenge')
      ),
      description: 'Cognito CreateAuthChallenge — generates OTP and sends via SES',
    })

    // ── 3. Verify Auth Challenge ───────────────────────────────────────────
    this.verifyChallengeFn = new lambda.Function(this, 'VerifyChallengeFn', {
      ...commonTriggerProps,
      functionName: 'uat-endevo-fn-cognito-verify-challenge',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/functions/cognito-triggers/verify-challenge')
      ),
      description: 'Cognito VerifyAuthChallengeResponse — validates OTP answer',
    })

    // ── 4. Pre-Token Generation ────────────────────────────────────────────
    this.preTokenGenFn = new lambda.Function(this, 'PreTokenGenFn', {
      ...commonTriggerProps,
      functionName: 'uat-endevo-fn-cognito-pre-token-gen',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/functions/cognito-triggers/pre-token-gen')
      ),
      description: 'Cognito PreTokenGeneration — injects custom:role from group into ID token',
    })

    // ── 5. Post Confirmation ───────────────────────────────────────────────
    this.postConfirmationFn = new lambda.Function(this, 'PostConfirmationFn', {
      ...commonTriggerProps,
      functionName: 'uat-endevo-fn-cognito-post-confirmation',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../backend/functions/cognito-triggers/post-confirmation')
      ),
      description: 'Cognito PostConfirmation — creates DynamoDB user stub on first login',
    })

    // ── Resource tags ──────────────────────────────────────────────────────
    const fns = [
      this.defineChallengeFn, this.createChallengeFn, this.verifyChallengeFn,
      this.preTokenGenFn, this.postConfirmationFn,
    ]
    const fnTags = {
      Project: 'uat-endevo-life', Environment: 'uat',
      Owner: 'shahzad', Component: 'cognito', ManagedBy: 'cdk',
    }
    fns.forEach(fn => {
      Object.entries(fnTags).forEach(([k, v]) => cdk.Tags.of(fn).add(k, v))
    })
    Object.entries(fnTags).forEach(([k, v]) => cdk.Tags.of(triggerRole).add(k, v))

    // ── Outputs ────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DefineChallengeArn',  { value: this.defineChallengeFn.functionArn,  exportName: 'cognito-trigger-define-challenge'  })
    new cdk.CfnOutput(this, 'CreateChallengeArn',  { value: this.createChallengeFn.functionArn,  exportName: 'cognito-trigger-create-challenge'  })
    new cdk.CfnOutput(this, 'VerifyChallengeArn',  { value: this.verifyChallengeFn.functionArn,  exportName: 'cognito-trigger-verify-challenge'  })
    new cdk.CfnOutput(this, 'PreTokenGenArn',       { value: this.preTokenGenFn.functionArn,       exportName: 'cognito-trigger-pre-token-gen'     })
    new cdk.CfnOutput(this, 'PostConfirmationArn',  { value: this.postConfirmationFn.functionArn,  exportName: 'cognito-trigger-post-confirmation' })
  }
}

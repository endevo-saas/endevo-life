import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

interface CognitoStackProps extends cdk.StackProps {
  // Trigger Lambdas are optional at stack-create time.
  // CognitoTriggersStack must be deployed first; pass its outputs here.
  defineChallengeFn?: lambda.IFunction
  createChallengeFn?: lambda.IFunction
  verifyChallengeFn?: lambda.IFunction
  preTokenGenFn?: lambda.IFunction
  postConfirmationFn?: lambda.IFunction
}

export class CognitoStack extends cdk.Stack {
  public readonly userPoolId: string
  public readonly userPoolClientId: string
  public readonly userPoolArn: string
  public readonly userPoolDomain: string

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props)

    // ── User Pool ───────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'uat-endevo-users-v2',
      selfSignUpEnabled: false,           // admin-created accounts only
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,          // users can enrol TOTP voluntarily
      mfaSecondFactor: {
        otp: true,    // TOTP authenticator app
        sms: false,   // disabled until SNS sandbox exit
      },
      passwordPolicy: {
        // Permissive policy — passwords are never actually set (passwordless).
        // minLength 32 prevents accidental password UX from appearing in Cognito hosted UI.
        minLength: 32,
        requireDigits: false,
        requireLowercase: false,
        requireUppercase: false,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(1),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: false },
      },
      customAttributes: {
        role:       new cognito.StringAttribute({ mutable: true, maxLen: 50 }),
        tenantId:   new cognito.StringAttribute({ mutable: true, maxLen: 100 }),
        tenantName: new cognito.StringAttribute({ mutable: true, maxLen: 200 }),
      },
      // Wire custom-auth triggers only when Lambda ARNs are provided.
      lambdaTriggers: {
        ...(props.defineChallengeFn    ? { defineAuthChallenge: props.defineChallengeFn }    : {}),
        ...(props.createChallengeFn    ? { createAuthChallenge: props.createChallengeFn }    : {}),
        ...(props.verifyChallengeFn    ? { verifyAuthChallengeResponse: props.verifyChallengeFn } : {}),
        ...(props.preTokenGenFn        ? { preTokenGeneration: props.preTokenGenFn }        : {}),
        ...(props.postConfirmationFn   ? { postConfirmation: props.postConfirmationFn }      : {}),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never auto-delete user data
      deletionProtection: true,
    })

    // ── Pool Groups (role = group membership) ──────────────────────────────
    new cognito.CfnUserPoolGroup(this, 'GroupGlobalAdmin', {
      userPoolId: userPool.userPoolId,
      groupName: 'GLOBAL_ADMIN',
      description: 'Platform-wide administrators',
      precedence: 1,
    })
    new cognito.CfnUserPoolGroup(this, 'GroupHrAdmin', {
      userPoolId: userPool.userPoolId,
      groupName: 'HR_ADMIN',
      description: 'Tenant HR administrators',
      precedence: 2,
    })
    new cognito.CfnUserPoolGroup(this, 'GroupEmployee', {
      userPoolId: userPool.userPoolId,
      groupName: 'EMPLOYEE',
      description: 'Regular employees',
      precedence: 3,
    })

    // ── App Client (SPA — no client secret) ───────────────────────────────
    const client = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      userPoolClientName: 'uat-endevo-web-client',
      generateSecret: false,  // public client for SPA
      authFlows: {
        custom: true,          // CUSTOM_AUTH for email OTP flow
        userPassword: false,   // no passwords
        userSrp: false,        // no SRP
        adminUserPassword: false,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          'https://uat.endevo.life/api/auth/callback',
          'http://localhost:3000/api/auth/callback',
        ],
        logoutUrls: [
          'https://uat.endevo.life/login',
          'http://localhost:3000/login',
        ],
      },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
      readAttributes: new cognito.ClientAttributes().withStandardAttributes({
        email: true,
      }).withCustomAttributes('role', 'tenantId', 'tenantName'),
      writeAttributes: new cognito.ClientAttributes().withCustomAttributes(
        'tenantId', 'tenantName'
        // 'role' is admin-managed only — not writable by the client
      ),
    })

    // Grant Cognito service principal permission to invoke trigger Lambdas.
    // CDK does this automatically for lambdaTriggers wired above, but we also
    // add explicit grants for future trigger additions.
    for (const fn of [
      props.defineChallengeFn, props.createChallengeFn, props.verifyChallengeFn,
      props.preTokenGenFn, props.postConfirmationFn,
    ]) {
      if (fn) {
        fn.addPermission(`CognitoInvoke-${fn.node.id}`, {
          principal: new cdk.aws_iam.ServicePrincipal('cognito-idp.amazonaws.com'),
          action: 'lambda:InvokeFunction',
          sourceArn: userPool.userPoolArn,
        })
      }
    }

    // ── Exports ────────────────────────────────────────────────────────────
    this.userPoolId       = userPool.userPoolId
    this.userPoolClientId = client.userPoolClientId
    this.userPoolArn      = userPool.userPoolArn
    this.userPoolDomain   = `cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID — uat-endevo-users-v2',
      exportName: 'endevo-uat-cognito-pool-id-v2',
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: client.userPoolClientId,
      description: 'Cognito App Client ID (SPA, no secret)',
      exportName: 'endevo-uat-cognito-client-id-v2',
    })
    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: userPool.userPoolArn,
      exportName: 'endevo-uat-cognito-pool-arn-v2',
    })
    new cdk.CfnOutput(this, 'JwksUrl', {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}/.well-known/jwks.json`,
      description: 'JWKS endpoint for Lambda JWT verification',
      exportName: 'endevo-uat-cognito-jwks-url',
    })
  }
}

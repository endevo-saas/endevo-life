import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import { Construct } from 'constructs'

export class CognitoStack extends cdk.Stack {
  public readonly userPoolId: string
  public readonly userPoolClientId: string
  public readonly userPoolArn: string

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    // --- User Pool ---
    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'endevo-uat-users',
      selfSignUpEnabled: false,           // employees only via invite
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.OPTIONAL,          // MFA optional, HR can enforce per tenant
      mfaSecondFactor: { totp: true, sms: false },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      customAttributes: {
        role:       new cognito.StringAttribute({ mutable: true, maxLen: 50 }),
        tenantId:   new cognito.StringAttribute({ mutable: true, maxLen: 100 }),
        tenantName: new cognito.StringAttribute({ mutable: true, maxLen: 200 }),
      },
      removalPolicy: cdk.RemovalPolicy.RETAIN, // never auto-delete user data
    })

    // --- App Client ---
    const client = new cognito.UserPoolClient(this, 'WebClient', {
      userPool,
      userPoolClientName: 'endevo-uat-web-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
      },
      accessTokenValidity: cdk.Duration.hours(8),
      idTokenValidity: cdk.Duration.hours(8),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    })

    // --- Outputs (visible in AWS Console + CDK deploy output) ---
    this.userPoolId = userPool.userPoolId
    this.userPoolClientId = client.userPoolClientId
    this.userPoolArn = userPool.userPoolArn

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID — add to Amplify env vars',
      exportName: 'endevo-uat-cognito-pool-id',
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: client.userPoolClientId,
      description: 'Cognito App Client ID — add to Amplify env vars',
      exportName: 'endevo-uat-cognito-client-id',
    })
    new cdk.CfnOutput(this, 'UserPoolArn', {
      value: userPool.userPoolArn,
      exportName: 'endevo-uat-cognito-pool-arn',
    })
  }
}

import * as cdk from 'aws-cdk-lib'
import * as amplify from 'aws-cdk-lib/aws-amplify'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface AmplifyStackProps extends cdk.StackProps {
  apiUrl: string
  userPoolId: string
  userPoolClientId: string
}

export class AmplifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props)

    // Amplify service role
    const amplifyRole = new iam.Role(this, 'AmplifyRole', {
      roleName: 'endevo-uat-amplify-role',
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    })

    // Amplify app connected to GitHub
    const app = new amplify.CfnApp(this, 'App', {
      name: 'endevo-uat-frontend',
      repository: 'https://github.com/shahzadms7/endevo-life',
      oauthToken: process.env.GH_TOKEN_AMPLIFY || '',
      iamServiceRole: amplifyRole.roleArn,
      platform: 'WEB_COMPUTE',
      buildSpec: [
        'version: 1',
        'applications:',
        '  - appRoot: apps/web',
        '    frontend:',
        '      phases:',
        '        preBuild:',
        '          commands:',
        '            - cd $CODEBUILD_SRC_DIR/endevo-life && npm install -g pnpm@9 && pnpm install --frozen-lockfile',
        '        build:',
        '          commands:',
        '            - cd $CODEBUILD_SRC_DIR/endevo-life && pnpm run build --filter=@endevo/web',
        '      artifacts:',
        '        baseDirectory: .next',
        '        files:',
        '          - "**/*"',
        '      cache:',
        '        paths:',
        '          - node_modules/**/*',
        '      buildSettings:',
        '        platform: WEB_COMPUTE',
      ].join('\n'),
      environmentVariables: [
        { name: 'NEXT_PUBLIC_API_URL', value: props.apiUrl },
        { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', value: props.userPoolId },
        { name: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', value: props.userPoolClientId },
        { name: 'NEXT_PUBLIC_COGNITO_REGION', value: this.region },
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'apps/web' },
      ],
    })

    // Connect main branch
    new amplify.CfnBranch(this, 'MainBranch', {
      appId: app.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      stage: 'PRODUCTION',
    })

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: app.attrAppId,
      description: 'Amplify App ID',
      exportName: 'endevo-uat-amplify-app-id',
    })
    new cdk.CfnOutput(this, 'AmplifyUrl', {
      value: `https://main.${app.attrDefaultDomain}`,
      description: 'Live URL after first deploy',
      exportName: 'endevo-uat-live-url',
    })
  }
}

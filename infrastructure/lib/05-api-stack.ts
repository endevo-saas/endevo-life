import * as cdk from 'aws-cdk-lib'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2'
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as path from 'path'
import { Construct } from 'constructs'

interface ApiStackProps extends cdk.StackProps {
  lambdaRole: iam.Role
  userPoolId: string
  userPoolClientId: string
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: string

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props)

    const commonEnv = {
      USER_POOL_ID: props.userPoolId,
      USER_POOL_CLIENT_ID: props.userPoolClientId,
      REGION: this.region,
      ENVIRONMENT: 'uat',
    }

    const lambdaDefaults = {
      runtime: lambda.Runtime.PYTHON_3_12,
      role: props.lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: commonEnv,
    }

    // --- Auth Lambda ---
    const authFn = new lambda.Function(this, 'AuthFn', {
      ...lambdaDefaults,
      functionName: 'endevo-uat-fn-auth',
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/auth')),
      description: 'Handles login, register, MFA, password operations',
    })

    // --- HR Admin Lambda ---
    const hrFn = new lambda.Function(this, 'HrFn', {
      ...lambdaDefaults,
      functionName: 'endevo-uat-fn-hr',
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/hr')),
      description: 'HR Admin operations: employees, invites, imports, audit',
    })

    // --- Employee Lambda ---
    const employeeFn = new lambda.Function(this, 'EmployeeFn', {
      ...lambdaDefaults,
      functionName: 'endevo-uat-fn-employee',
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/employee')),
      description: 'Employee operations: training, assessment, certificates',
    })

    // --- Global Admin Lambda ---
    const adminFn = new lambda.Function(this, 'AdminFn', {
      ...lambdaDefaults,
      functionName: 'endevo-uat-fn-admin',
      handler: 'main.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/functions/admin')),
      description: 'Global Admin: tenant management, system stats',
    })

    // Note: endevo-uat-fn-lms Lambda is managed by LmsInfraStack (imported resource).
    // It was manually created to unblock deployment. Do not recreate it here.

    // --- API Gateway HTTP API ---
    const api = new apigw.HttpApi(this, 'HttpApi', {
      apiName: 'endevo-uat-api',
      description: 'Endevo Life backend API',
      corsPreflight: {
        allowOrigins: [
          'https://uat.endevo.life',
          'https://uat.endevo.life',
          'https://main.d1vvfv8oltolcf.amplifyapp.com',
          'http://localhost:3000',
        ],
        allowMethods: [apigw.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    })

    // --- Routes ---
    api.addRoutes({ path: '/api/auth/{proxy+}', methods: [apigw.HttpMethod.ANY], integration: new integrations.HttpLambdaIntegration('AuthInt', authFn) })
    api.addRoutes({ path: '/api/hr/{proxy+}',   methods: [apigw.HttpMethod.ANY], integration: new integrations.HttpLambdaIntegration('HrInt',   hrFn) })
    api.addRoutes({ path: '/api/employee/{proxy+}', methods: [apigw.HttpMethod.ANY], integration: new integrations.HttpLambdaIntegration('EmpInt', employeeFn) })
    api.addRoutes({ path: '/api/admin/{proxy+}', methods: [apigw.HttpMethod.ANY], integration: new integrations.HttpLambdaIntegration('AdminInt', adminFn) })
    // Note: /api/lms/{proxy+} route is managed manually (points to endevo-uat-fn-lms).
    // It was created outside CDK to unblock deployment. LmsInfraStack imports the Lambda reference.

    this.apiUrl = api.url!

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url!,
      description: 'API Gateway URL — set as NEXT_PUBLIC_API_URL in Amplify',
      exportName: 'endevo-uat-api-url',
    })
  }
}

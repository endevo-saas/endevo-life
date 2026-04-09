import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

interface JesseAgentStackProps extends cdk.StackProps {
  lambdaRole: iam.Role
}

/**
 * Jesse AI Bedrock Agent Stack
 *
 * Creates an Amazon Bedrock Agent for Jesse AI with:
 *   1. IAM role — bedrock.amazonaws.com trust, model invocation, KB retrieval, Lambda invoke
 *   2. CfnResource Agent — foundation model, system prompt, idle TTL, auto-prepare
 *   3. Knowledge Base association (inline on agent)
 *   4. Action Group — RETURN_CONTROL (HITL) with OpenAPI schema for 6 actions
 *   5. Agent Alias — "live" alias for stable invocation endpoint
 *   6. Lambda role permission — bedrock:InvokeAgent on the agent ARN
 *
 * Note: Uses CfnResource instead of CfnAgent because aws-cdk-lib@2.130.0
 * does not include L1 Bedrock Agent constructs (added in 2.142.0+).
 *
 * Model: us.amazon.nova-lite-v1:0
 * Knowledge Base: MUJXTOAKSR
 * HITL: All actions use RETURN_CONTROL — no Lambda executor, human approval required.
 */
export class JesseAgentStack extends cdk.Stack {
  public readonly agentId: string
  public readonly agentAliasId: string
  public readonly agentArn: string

  constructor(scope: Construct, id: string, props: JesseAgentStackProps) {
    super(scope, id, props)

    const account = this.account
    const region = this.region
    const knowledgeBaseId = 'MUJXTOAKSR'
    const foundationModel = 'us.amazon.nova-lite-v1:0'

    // ---------------------------------------------------------------
    // 1. IAM Role for the Bedrock Agent
    // ---------------------------------------------------------------
    const agentRole = new iam.Role(this, 'JesseAgentRole', {
      roleName: 'endevo-uat-jesse-agent-role',
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      description: 'Execution role for Jesse AI Bedrock Agent',
    })

    // Invoke foundation model
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'InvokeModel',
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }))

    // Retrieve from Knowledge Base
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'RetrieveKnowledgeBase',
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:Retrieve'],
      resources: [
        `arn:aws:bedrock:${region}:${account}:knowledge-base/${knowledgeBaseId}`,
      ],
    }))

    // Invoke Jesse Lambda (for future direct invocation if needed)
    agentRole.addToPolicy(new iam.PolicyStatement({
      sid: 'InvokeLambda',
      effect: iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [
        `arn:aws:lambda:${region}:${account}:function:endevo-uat-fn-jesse`,
      ],
    }))

    // ---------------------------------------------------------------
    // 2. System prompt
    // ---------------------------------------------------------------
    const instruction = [
      'You are Jesse, an empathetic AI assistant for Endevo Life \u2014 a digital legacy and estate planning platform.',
      'You help three types of users:',
      '',
      'GLOBAL_ADMIN (Super Admin): You can view platform metrics, manage tenants, manage users, and configure the system. You have full visibility.',
      '',
      'HR_ADMIN: You help manage their company\'s employees, track learning progress, send campaigns, and book coaching sessions. You cannot access other tenants\' data.',
      '',
      'EMPLOYEE: You guide them through legacy planning \u2014 legal readiness, financial planning, digital assets, and physical preparedness. You explain complex topics with warmth and clarity.',
      '',
      'CRITICAL RULES:',
      '- Never execute actions without human approval. Always use ReturnControl.',
      '- Never provide actual legal, medical, or financial advice. Guide users to professionals.',
      '- Be warm, empathetic, and clear. This involves end-of-life topics.',
      '- Respect role boundaries strictly. An employee cannot see admin data.',
    ].join('\n')

    // ---------------------------------------------------------------
    // 3. OpenAPI schema for Action Group (inline string)
    // ---------------------------------------------------------------
    const openApiSchema = JSON.stringify({
      openapi: '3.0.0',
      info: {
        title: 'Jesse AI Actions',
        version: '1.0.0',
      },
      paths: {
        '/get-tenant-metrics': {
          post: {
            operationId: 'GetTenantMetrics',
            description: 'Get platform metrics \u2014 total tenants, users, revenue, activity rates',
            parameters: [],
            responses: {
              '200': { description: 'Metrics data' },
            },
          },
        },
        '/create-employee': {
          post: {
            operationId: 'CreateEmployee',
            description: 'Create a new employee in a tenant',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'string', description: 'The tenant to add the employee to' },
                      email: { type: 'string', description: 'Employee email address' },
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                    },
                    required: ['tenantId', 'email', 'firstName', 'lastName'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Employee created' },
            },
          },
        },
        '/draft-invite-email': {
          post: {
            operationId: 'DraftInviteEmail',
            description: 'Draft and send an invite email to an employee',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      email: { type: 'string', description: 'Recipient email' },
                      tenantName: { type: 'string', description: 'Company name for the invite' },
                    },
                    required: ['email'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Email drafted' },
            },
          },
        },
        '/change-tenant-plan': {
          post: {
            operationId: 'ChangeTenantPlan',
            description: 'Change a tenant subscription plan (basic or premium)',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'string' },
                      newPlan: { type: 'string', enum: ['basic', 'premium'] },
                    },
                    required: ['tenantId', 'newPlan'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Plan changed' },
            },
          },
        },
        '/get-employee-progress': {
          post: {
            operationId: 'GetEmployeeProgress',
            description: 'Get an employee readiness score and module progress',
            parameters: [],
            responses: {
              '200': { description: 'Progress data' },
            },
          },
        },
        '/send-nudge-campaign': {
          post: {
            operationId: 'SendNudgeCampaign',
            description: 'Send a re-engagement email campaign to inactive employees',
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'string' },
                      message: { type: 'string', description: 'Custom message for the campaign' },
                    },
                    required: ['tenantId'],
                  },
                },
              },
            },
            responses: {
              '200': { description: 'Campaign sent' },
            },
          },
        },
      },
    })

    // ---------------------------------------------------------------
    // 4. Bedrock Agent (CfnResource — escape hatch for CDK 2.130.0)
    // ---------------------------------------------------------------
    const agent = new cdk.CfnResource(this, 'JesseAgent', {
      type: 'AWS::Bedrock::Agent',
      properties: {
        AgentName: 'endevo-jesse-agent',
        AgentResourceRoleArn: agentRole.roleArn,
        FoundationModel: foundationModel,
        Instruction: instruction,
        Description: 'Jesse AI \u2014 Endevo Life digital legacy planning assistant with HITL action groups',
        IdleSessionTTLInSeconds: 1800,
        AutoPrepare: true,

        // Knowledge Base association
        KnowledgeBases: [{
          KnowledgeBaseId: knowledgeBaseId,
          Description: 'Endevo Life legacy planning content \u2014 modules, workbook, legal guides',
          KnowledgeBaseState: 'ENABLED',
        }],

        // Action Groups
        ActionGroups: [
          {
            ActionGroupName: 'endevo-actions',
            Description: 'Jesse AI actions for tenant management, employee operations, and campaigns',
            ActionGroupExecutor: {
              CustomControl: 'RETURN_CONTROL',
            },
            ApiSchema: {
              Payload: openApiSchema,
            },
          },
          {
            ActionGroupName: 'UserInputAction',
            ParentActionGroupSignature: 'AMAZON.UserInput',
            ActionGroupState: 'ENABLED',
          },
        ],
      },
    })

    const agentId = agent.getAtt('AgentId').toString()
    const agentArn = cdk.Fn.sub(
      'arn:aws:bedrock:${AWS::Region}:${AWS::AccountId}:agent/${AgentId}',
      { AgentId: agentId },
    )

    // ---------------------------------------------------------------
    // 5. Agent Alias ("live")
    // ---------------------------------------------------------------
    const agentAlias = new cdk.CfnResource(this, 'JesseAgentAlias', {
      type: 'AWS::Bedrock::AgentAlias',
      properties: {
        AgentId: agentId,
        AgentAliasName: 'live',
        Description: 'Live alias for Jesse AI Bedrock Agent',
      },
    })

    agentAlias.addDependency(agent)

    const agentAliasId = agentAlias.getAtt('AgentAliasId').toString()

    // IAM: bedrock:InvokeAgent permission handled in 04-iam-stack.ts
    // (wildcard on Bedrock actions) to avoid cyclic cross-stack dependency

    // ---------------------------------------------------------------
    // 7. Store references for cross-stack access
    // ---------------------------------------------------------------
    this.agentId = agentId
    this.agentAliasId = agentAliasId
    this.agentArn = agentArn

    // ---------------------------------------------------------------
    // 8. Outputs
    // ---------------------------------------------------------------
    new cdk.CfnOutput(this, 'AgentId', {
      value: agentId,
      description: 'Jesse AI Bedrock Agent ID',
    })

    new cdk.CfnOutput(this, 'AgentAliasId', {
      value: agentAliasId,
      description: 'Jesse AI Bedrock Agent Alias ID (live)',
    })

    new cdk.CfnOutput(this, 'AgentArn', {
      value: agentArn,
      description: 'Jesse AI Bedrock Agent ARN',
    })
  }
}

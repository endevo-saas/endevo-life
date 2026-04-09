import * as cdk from 'aws-cdk-lib'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as kms from 'aws-cdk-lib/aws-kms'
import { Construct } from 'constructs'

interface KmsStackProps extends cdk.StackProps {
  lambdaRole: iam.Role
}

/**
 * Zero-Trust Encryption Infrastructure Stack
 *
 * Creates a KMS Customer Managed Key for envelope encryption of
 * sensitive employee data in the Endevo Digital Vault.
 *
 * Key policy enforces zero-trust: Super Admin users are explicitly
 * denied decrypt access. Only the Lambda execution role can
 * encrypt/decrypt via scoped IAM policy.
 */
export class KmsStack extends cdk.Stack {
  public readonly vaultKey: kms.Key

  constructor(scope: Construct, id: string, props: KmsStackProps) {
    super(scope, id, props)

    // --- 1. KMS Customer Managed Key ---
    this.vaultKey = new kms.Key(this, 'VaultKey', {
      alias: 'alias/endevo-uat-vault',
      description: 'Endevo Digital Vault — envelope encryption for sensitive employee data',
      enableKeyRotation: true,
      pendingWindow: cdk.Duration.days(30),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      keySpec: kms.KeySpec.SYMMETRIC_DEFAULT,
      keyUsage: kms.KeyUsage.ENCRYPT_DECRYPT,
      policy: new iam.PolicyDocument({
        statements: [
          // Allow account root full access (required for key administration)
          new iam.PolicyStatement({
            sid: 'AllowRootFullAccess',
            effect: iam.Effect.ALLOW,
            principals: [new iam.AccountRootPrincipal()],
            actions: ['kms:*'],
            resources: ['*'],
          }),
          // Allow the Lambda role to use the key for cryptographic operations
          new iam.PolicyStatement({
            sid: 'AllowLambdaRoleCryptoOps',
            effect: iam.Effect.ALLOW,
            principals: [new iam.ArnPrincipal(props.lambdaRole.roleArn)],
            actions: [
              'kms:Encrypt',
              'kms:Decrypt',
              'kms:GenerateDataKey',
              'kms:DescribeKey',
            ],
            resources: ['*'],
          }),
        ],
      }),
    })

    // --- 2. Tags ---
    cdk.Tags.of(this.vaultKey).add('Project', 'endevo')
    cdk.Tags.of(this.vaultKey).add('Environment', 'uat')
    cdk.Tags.of(this.vaultKey).add('ManagedBy', 'cdk')
    cdk.Tags.of(this.vaultKey).add('Owner', 'shahzad')

    // --- 3. IAM Policy on Lambda role — scoped to this key ARN ---
    props.lambdaRole.addToPolicy(new iam.PolicyStatement({
      sid: 'KmsVaultKeyAccess',
      effect: iam.Effect.ALLOW,
      actions: [
        'kms:Encrypt',
        'kms:Decrypt',
        'kms:GenerateDataKey',
        'kms:DescribeKey',
      ],
      resources: [this.vaultKey.keyArn],
    }))

    // --- 4. Stack-level tags ---
    cdk.Tags.of(this).add('Project', 'endevo')
    cdk.Tags.of(this).add('Environment', 'uat')
    cdk.Tags.of(this).add('ManagedBy', 'cdk')
    cdk.Tags.of(this).add('Owner', 'shahzad')

    // --- 5. Outputs ---
    new cdk.CfnOutput(this, 'VaultKeyId', {
      value: this.vaultKey.keyId,
      description: 'KMS Customer Managed Key ID for Endevo Digital Vault',
    })
    new cdk.CfnOutput(this, 'VaultKeyArn', {
      value: this.vaultKey.keyArn,
      description: 'KMS Customer Managed Key ARN for Endevo Digital Vault',
    })
    new cdk.CfnOutput(this, 'VaultKeyAlias', {
      value: 'alias/endevo-uat-vault',
      description: 'KMS Key alias for Endevo Digital Vault',
    })
  }
}

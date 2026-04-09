import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as wafv2 from 'aws-cdk-lib/aws-wafv2'
import { Construct } from 'constructs'

interface CloudFrontApiStackProps extends cdk.StackProps {}

/**
 * Enterprise Security Stack — CloudFront + WAF for API Gateway
 *
 * HTTP APIs (ApiGatewayV2) do not support WAF natively.
 * This stack places a CloudFront distribution in front of the API Gateway
 * and attaches a CLOUDFRONT-scoped WAF WebACL for:
 *   - SQL injection / XSS / path traversal blocking (AWSManagedRulesCommonRuleSet)
 *   - Known bad input blocking (AWSManagedRulesKnownBadInputsRuleSet)
 *   - IP-based rate limiting (2000 req / 5 min per IP)
 *
 * A custom origin header (x-origin-verify) ensures the API Gateway
 * only accepts traffic originating from this CloudFront distribution.
 */
export class CloudFrontApiStack extends cdk.Stack {
  public readonly distributionDomainName: string
  public readonly distributionId: string
  public readonly wafWebAclArn: string

  constructor(scope: Construct, id: string, props: CloudFrontApiStackProps) {
    super(scope, id, props)

    // --- 1. WAF WebACL (CLOUDFRONT scope — must be in us-east-1, which is default for CF) ---
    const webAcl = new wafv2.CfnWebACL(this, 'ApiWaf', {
      name: 'endevo-uat-api-waf',
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      description: 'WAF for Endevo API Gateway via CloudFront — blocks SQLi, XSS, bad inputs, DDoS',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: 'endevo-uat-api-waf',
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rule 1: AWS Managed — Common Rule Set (SQLi, XSS, path traversal)
        {
          name: 'AWSManagedRulesCommonRuleSet',
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'endevo-uat-common-rules',
            sampledRequestsEnabled: true,
          },
        },
        // Rule 2: AWS Managed — Known Bad Inputs
        {
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'endevo-uat-bad-inputs',
            sampledRequestsEnabled: true,
          },
        },
        // Rule 3: Rate Limiting — 2000 requests per 5 minutes per IP
        {
          name: 'RateLimitPerIP',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: 2000,
              aggregateKeyType: 'IP',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'endevo-uat-rate-limit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    })

    // --- 2. CloudFront Distribution pointed at API Gateway ---
    const apiOrigin = new origins.HttpOrigin(
      '4jms6sdzk9.execute-api.us-east-1.amazonaws.com',
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
        customHeaders: {
          'x-origin-verify': 'endevo-cf-secret-2026',
        },
      },
    )

    const distribution = new cloudfront.Distribution(this, 'ApiDistribution', {
      comment: 'endevo-uat-api — CloudFront shield for API Gateway with WAF',
      defaultBehavior: {
        origin: apiOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
      webAclId: webAcl.attrArn,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    })

    // --- 3. Expose public properties ---
    this.distributionDomainName = distribution.distributionDomainName
    this.distributionId = distribution.distributionId
    this.wafWebAclArn = webAcl.attrArn

    // --- 4. Stack-level tags ---
    cdk.Tags.of(this).add('Project', 'endevo')
    cdk.Tags.of(this).add('Environment', 'uat')
    cdk.Tags.of(this).add('ManagedBy', 'cdk')
    cdk.Tags.of(this).add('Owner', 'shahzad')
    cdk.Tags.of(this).add('CostCenter', 'endevo-platform')

    // --- 5. Outputs ---
    new cdk.CfnOutput(this, 'ApiDistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain for API Gateway — use this instead of direct API Gateway URL',
      exportName: 'endevo-uat-cf-api-domain',
    })
    new cdk.CfnOutput(this, 'ApiDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID for API Gateway',
      exportName: 'endevo-uat-cf-api-id',
    })
    new cdk.CfnOutput(this, 'ApiWafWebAclArn', {
      value: webAcl.attrArn,
      description: 'WAF WebACL ARN (CLOUDFRONT scope) protecting API Gateway',
      exportName: 'endevo-uat-api-waf-arn',
    })
  }
}

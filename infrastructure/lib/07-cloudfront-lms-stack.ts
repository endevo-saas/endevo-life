import * as cdk from 'aws-cdk-lib'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import { Construct } from 'constructs'

// NOTE: This stack uses OriginAccessIdentity (OAI) because aws-cdk-lib 2.130.0
// does not export S3OriginAccessControl or origins.S3BucketOrigin.withOriginAccessControl.
// Those APIs were introduced in CDK 2.147.0+. OAI is fully supported and production-ready.

interface CloudFrontLmsStackProps extends cdk.StackProps {
  lambdaRoleArn: string
}

export class CloudFrontLmsStack extends cdk.Stack {
  public readonly distributionDomainName: string
  public readonly distributionId: string

  constructor(scope: Construct, id: string, props: CloudFrontLmsStackProps) {
    super(scope, id, props)

    // Import existing S3 buckets (already created in S3Stack)
    const videosBucket = s3.Bucket.fromBucketName(this, 'VideosBucket', 'endevo-uat-videos')
    const assetsBucket = s3.Bucket.fromBucketName(this, 'AssetsBucket', 'endevo-uat-assets')

    // Origin Access Identity — grants CloudFront read access to S3 buckets
    // (OAI is the correct API for CDK 2.130.0; OAC/S3BucketOrigin added in 2.147.0)
    const oai = new cloudfront.OriginAccessIdentity(this, 'LmsOAI', {
      comment: 'endevo-uat-lms — OAI for secure LMS video + asset delivery',
    })

    // Grant read access to both buckets.
    // For imported buckets, grantRead creates a standalone AWS::S3::BucketPolicy resource.
    videosBucket.grantRead(oai)
    assetsBucket.grantRead(oai)

    // CloudFront distribution using OAI-backed S3Origins
    const distribution = new cloudfront.Distribution(this, 'LmsDistribution', {
      comment: 'endevo-uat-lms — secure LMS video + asset delivery',
      defaultBehavior: {
        origin: new origins.S3Origin(videosBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        '/assets/*': {
          origin: new origins.S3Origin(assetsBucket, { originAccessIdentity: oai }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enabled: true,
    })

    // Grant the Lambda role permission to create CloudFront invalidations
    // (scoped to this specific distribution now that we have the ID)
    const lambdaRole = iam.Role.fromRoleArn(this, 'LambdaRole', props.lambdaRoleArn)
    lambdaRole.addToPrincipalPolicy(new iam.PolicyStatement({
      sid: 'CloudFrontInvalidation',
      effect: iam.Effect.ALLOW,
      actions: ['cloudfront:CreateInvalidation'],
      resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
    }))

    this.distributionDomainName = distribution.distributionDomainName
    this.distributionId = distribution.distributionId

    new cdk.CfnOutput(this, 'LmsDistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain for LMS video delivery — set as NEXT_PUBLIC_CF_DOMAIN in Amplify',
      exportName: 'endevo-uat-cf-lms-domain',
    })
    new cdk.CfnOutput(this, 'LmsDistributionId', {
      value: distribution.distributionId,
      exportName: 'endevo-uat-cf-lms-id',
    })
    new cdk.CfnOutput(this, 'LmsOaiId', {
      value: oai.originAccessIdentityId,
      description: 'CloudFront OAI ID — referenced in S3 bucket policies',
      exportName: 'endevo-uat-cf-lms-oai-id',
    })
  }
}

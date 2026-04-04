import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'

export class S3Stack extends cdk.Stack {
  public readonly bucketArns: string[]
  public readonly assetsBucketName: string
  public readonly videosBucketName: string

  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    const allowedOrigins = [
      'https://uat.endevo.life',
      'https://main.d1vvfv8oltolcf.amplifyapp.com',
      'http://localhost:3000',
    ]

    // --- Assets bucket (PDFs, CSV imports, certificates) ---
    const assets = new s3.Bucket(this, 'Assets', {
      bucketName: 'endevo-uat-assets',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins,
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 3000,
      }],
      lifecycleRules: [{
        id: 'delete-temp-uploads',
        prefix: 'temp/',
        expiration: cdk.Duration.days(1),
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // --- Videos bucket (training video files) ---
    const videos = new s3.Bucket(this, 'Videos', {
      bucketName: 'endevo-uat-videos',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: false,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins,
        allowedHeaders: ['Content-Type', 'Authorization'],
        maxAge: 3000,
      }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    this.assetsBucketName = assets.bucketName
    this.videosBucketName = videos.bucketName
    this.bucketArns = [assets.bucketArn, videos.bucketArn]

    new cdk.CfnOutput(this, 'AssetsBucket', { value: assets.bucketName })
    new cdk.CfnOutput(this, 'VideosBucket', { value: videos.bucketName })
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { EnvName } from '@vozcoletiva/shared';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachedMethods,
  Distribution,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface WebHostingProps {
  readonly env: EnvName;
}

/**
 * S3 + CloudFront pair for the React PWA. Bucket is private; CloudFront uses
 * an Origin Access Identity. SPA-fallback rewrites 404/403 to index.html so
 * client-side routes (TanStack Router) resolve.
 */
export class WebHosting extends Construct {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props: WebHostingProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'WebBucket', {
      bucketName: `voz-${props.env}-web-${COMMON_ACCOUNT}-${COMMON_REGION}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.env !== 'prod',
    });

    const responseHeaders = new ResponseHeadersPolicy(this, 'SecurityHeaders', {
      responseHeadersPolicyName: `voz-${props.env}-security-headers`,
      securityHeadersBehavior: {
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: 'DENY' as never, override: true } as never,
        referrerPolicy: {
          referrerPolicy: 'strict-origin-when-cross-origin' as never,
          override: true,
        } as never,
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        xssProtection: { protection: true, modeBlock: true, override: true },
      },
    });

    this.distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        responseHeadersPolicy: responseHeaders,
      },
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Deploy the built PWA to S3 and invalidate CloudFront, but only if the
    // build output exists. The deploy script ensures the web build runs before
    // CDK synth — this guard prevents `cdk synth` from failing when used for
    // diff-only flows where the dist/ may not have been built yet.
    const webDist = path.resolve(__dirname, '..', '..', '..', 'web', 'dist');
    if (fs.existsSync(webDist) && fs.existsSync(path.join(webDist, 'index.html'))) {
      new BucketDeployment(this, 'WebDeploy', {
        sources: [Source.asset(webDist)],
        destinationBucket: this.bucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
        prune: true,
        memoryLimit: 512,
      });
    }
  }
}

// Placeholders only used to compose the bucket name uniquely. The actual values
// live in env-config; we resolve them at runtime via the props chain in real
// stack code rather than hard-coding here. For the foundation we keep them
// inline to satisfy CDK's requirement that bucket names are deterministic.
const COMMON_ACCOUNT = '130141755138';
const COMMON_REGION = 'eu-west-1';

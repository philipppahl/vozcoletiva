import type { EnvName } from '@vozcoletiva/shared';
import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachedMethods,
  Distribution,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface MediaProps {
  readonly env: EnvName;
}

/**
 * User-uploaded media (avatars today; chat images/voice later). The bucket is
 * private; a CloudFront distribution (OAC) serves objects over a stable HTTPS
 * URL — avatars are member-visible by design (decision 0029).
 *
 * Objects are written under immutable, versioned keys
 * (`avatars/<userId>/<version>.webp`), so the CDN can cache them forever and a
 * new upload simply yields a new URL — no invalidation, no cache-busting.
 */
export class Media extends Construct {
  readonly bucket: Bucket;
  /** `https://…` base; an object's URL is `${baseUrl}/${key}`. */
  readonly baseUrl: string;

  constructor(scope: Construct, id: string, props: MediaProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'MediaBucket', {
      bucketName: `voz-${props.env}-media-130141755138-eu-west-1`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      removalPolicy: props.env === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.env !== 'prod',
      // Browsers PUT chat media directly to S3 via server-issued presigned URLs
      // (the signature is the real auth; CORS just permits the cross-origin PUT).
      cors: [
        {
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    const distribution = new Distribution(this, 'MediaDistribution', {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
      },
      priceClass: PriceClass.PRICE_CLASS_100,
    });

    this.baseUrl = `https://${distribution.distributionDomainName}`;
  }
}

import type { StackProps } from 'aws-cdk-lib';
import { Stack } from 'aws-cdk-lib';
import type { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import { HostedZone } from 'aws-cdk-lib/aws-route53';
import type { Construct } from 'constructs';

export interface CertStackProps extends StackProps {
  /** Hostname the cert covers, e.g. `dev.vozcoletiva.com`. */
  readonly domainName: string;
  readonly hostedZoneId: string;
  readonly zoneName: string;
}

/**
 * A DNS-validated ACM certificate for the PWA's custom domain.
 *
 * CloudFront only accepts certificates from **us-east-1**, but the app stack
 * lives in `eu-west-1`. So the cert gets its own stack pinned to us-east-1 and
 * is handed to the app stack via `crossRegionReferences` (decision 0036).
 * Validation records are written into the shared vozcoletiva.com hosted zone,
 * so issuance is automatic.
 */
export class CertStack extends Stack {
  readonly certificate: ICertificate;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);

    const zone = HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.zoneName,
    });

    this.certificate = new Certificate(this, 'Cert', {
      domainName: props.domainName,
      validation: CertificateValidation.fromDns(zone),
    });
  }
}

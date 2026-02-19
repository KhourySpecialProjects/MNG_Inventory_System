import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export interface DnsStackProps extends cdk.StackProps {
  /** The root domain name (e.g. "myapp.com") */
  rootDomain: string;
  /** Deployment stage name */
  stage: string;
}

/**
 * Shared DNS infrastructure: Route 53 hosted zone + ACM certificate.
 *
 * This stack is only created when a custom domain is configured.
 * Both WebStack (CloudFront) and SesStack (email) consume these resources.
 *
 * After deploying this stack, you must manually update your domain registrar
 * to use the NS records output by this stack.
 */
export class DnsStack extends cdk.Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;
  public readonly rootDomain: string;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    this.rootDomain = props.rootDomain;

    // Route 53 hosted zone — authoritative DNS for the domain.
    // After deploy, copy the NS records to your registrar (Porkbun, etc.)
    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: props.rootDomain,
    });

    // ACM certificate for CloudFront (must be us-east-1, which it will be
    // as long as the stack is deployed to us-east-1).
    // Covers both the apex and wildcard for subdomains.
    this.certificate = new acm.Certificate(this, 'SiteCert', {
      domainName: props.rootDomain,
      subjectAlternativeNames: [`*.${props.rootDomain}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 Hosted Zone ID',
    });

    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(', ', (this.hostedZone as route53.HostedZone).hostedZoneNameServers!),
      description: 'Set these as your nameservers in Porkbun (or your registrar)',
    });

    new cdk.CfnOutput(this, 'CertificateArn', {
      value: this.certificate.certificateArn,
      description: 'ACM certificate ARN (used by CloudFront)',
    });
  }
}

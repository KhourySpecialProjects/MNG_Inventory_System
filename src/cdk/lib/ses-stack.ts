import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sns from 'aws-cdk-lib/aws-sns';

export interface SesStackProps extends cdk.StackProps {
  /** Route 53 hosted zone (if provided, domain identity + DKIM are set up) */
  hostedZone?: route53.IHostedZone;
  /** Root domain for the SES identity (required if hostedZone is provided) */
  rootDomain?: string;
  /** Local part for the from address (default: noreply) */
  fromLocalPart?: string;
  /** Create SNS feedback topic for bounces/complaints (default: true) */
  createFeedbackTopic?: boolean;
  /** Deployment stage name */
  stage?: string;
  /** Verified email address to use in dev/sandbox mode (required when no domain identity) */
  emailFrom?: string;
}

export class SesStack extends cdk.Stack {
  public readonly fromAddress: string;
  public readonly configurationSetName: string;
  public readonly feedbackTopicArn?: string;
  public readonly sendPolicy: iam.ManagedPolicy;

  constructor(scope: Construct, id: string, props: SesStackProps) {
    super(scope, id, props);

    const {
      hostedZone,
      rootDomain,
      fromLocalPart = 'noreply',
      createFeedbackTopic = true,
      stage = 'dev',
      emailFrom,
    } = props;

    const useDomainIdentity = !!(hostedZone && rootDomain);

    // ===== SES Identity =====
    if (useDomainIdentity) {
      // Domain identity with automatic DKIM DNS records via Route 53
      new ses.EmailIdentity(this, 'DomainIdentity', {
        identity: ses.Identity.publicHostedZone(hostedZone!),
        mailFromDomain: `mail.${rootDomain}`,
      });

      this.fromAddress = `${fromLocalPart}@${rootDomain}`;

      // DMARC TXT record for email deliverability
      new route53.TxtRecord(this, 'DmarcRecord', {
        zone: hostedZone!,
        recordName: `_dmarc.${rootDomain}`,
        values: [`v=DMARC1; p=quarantine; rua=mailto:postmaster@${rootDomain}`],
        ttl: cdk.Duration.hours(1),
      });
    } else {
      // Dev/sandbox mode: use a pre-verified email address.
      // No SES resources are created — the email must be manually verified
      // in the SES console or already be verified.
      if (!emailFrom) {
        throw new Error(
          'SES_FROM_ADDRESS is required for dev/sandbox deployments. ' +
          'Set the SES_FROM_ADDRESS environment variable to an email address ' +
          'that has been verified in the AWS SES console. ' +
          'See deployment.md for instructions.',
        );
      }
      this.fromAddress = emailFrom;
    }

    // ===== Configuration Set =====
    const cfgName = `cfg-${cdk.Stack.of(this).stackName}`;
    const cfg = new ses.CfnConfigurationSet(this, 'ConfigSet', {
      name: cfgName,
      reputationOptions: { reputationMetricsEnabled: true },
      sendingOptions: { sendingEnabled: true },
      suppressionOptions: { suppressedReasons: ['BOUNCE', 'COMPLAINT'] },
      deliveryOptions: { tlsPolicy: 'REQUIRE' },
    });
    this.configurationSetName = cfg.name!;

    // ===== SNS Feedback Topic (bounces + complaints) =====
    if (createFeedbackTopic) {
      const feedbackTopic = new sns.Topic(this, 'SesFeedbackTopic', {
        displayName: `SES Feedback (${stage})`,
      });

      feedbackTopic.addToResourcePolicy(
        new iam.PolicyStatement({
          principals: [new iam.ServicePrincipal('ses.amazonaws.com')],
          actions: ['SNS:Publish'],
          resources: [feedbackTopic.topicArn],
          conditions: {
            StringEquals: { 'AWS:SourceAccount': this.account },
            ArnLike: {
              'AWS:SourceArn': `arn:aws:ses:${this.region}:${this.account}:configuration-set/${cfgName}`,
            },
          },
        }),
      );

      new ses.CfnConfigurationSetEventDestination(this, 'CfgSetEvents', {
        configurationSetName: cfgName,
        eventDestination: {
          name: `sns-destination-${stage.toLowerCase()}`,
          enabled: true,
          matchingEventTypes: [
            'SEND',
            'REJECT',
            'BOUNCE',
            'COMPLAINT',
            'DELIVERY',
            'OPEN',
            'CLICK',
            'RENDERING_FAILURE',
          ],
          snsDestination: { topicArn: feedbackTopic.topicArn },
        },
      });

      this.feedbackTopicArn = feedbackTopic.topicArn;
    }

    // ===== Send Policy =====
    this.sendPolicy = new iam.ManagedPolicy(this, 'SesSendPolicy', {
      description: 'Allow sending via SES from the configured address & configuration set.',
      statements: [
        new iam.PolicyStatement({
          actions: ['ses:SendEmail', 'ses:SendRawEmail'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'ses:FromAddress': this.fromAddress,
              'ses:ConfigurationSet': cfgName,
            },
          },
        }),
      ],
    });

    // ===== Outputs =====
    new cdk.CfnOutput(this, 'Stage', { value: stage });
    new cdk.CfnOutput(this, 'FromAddress', { value: this.fromAddress });
    new cdk.CfnOutput(this, 'ConfigSetName', { value: this.configurationSetName });
    new cdk.CfnOutput(this, 'Mode', {
      value: useDomainIdentity ? 'domain-identity' : 'sandbox-email',
    });

    if (this.feedbackTopicArn) {
      new cdk.CfnOutput(this, 'FeedbackTopicArn', {
        value: this.feedbackTopicArn,
      });
    }

    // ✅ Make export name unique per stage to avoid collisions
    new cdk.CfnOutput(this, 'SesSendPolicyArn', {
      value: this.sendPolicy.managedPolicyArn,
      exportName: `SesSendPolicyArn-${stage}`,
    });
  }
}

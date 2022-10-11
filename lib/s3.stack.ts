import { Stack, StackProps } from "aws-cdk-lib";
import { Certificate, CertificateValidation } from "aws-cdk-lib/aws-certificatemanager";
import { AllowedMethods, Distribution, OriginAccessIdentity, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
import { S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Key } from "aws-cdk-lib/aws-kms";
import { HostedZone, RecordSet, RecordTarget, RecordType } from "aws-cdk-lib/aws-route53";
import { Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

export class S3Stack extends Stack {
  public bucket: Bucket;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps
  ) {
    super(scope, id, props);

    const deployEnvironment = "test";
    const bucketKey = new Key(this, 'bucket-key')

    // The hosting bucket
    this.bucket = new Bucket(this, "s3-bucket", {
      bucketName: `${deployEnvironment}-hosted-frontend`,
      encryption: BucketEncryption.KMS,
      encryptionKey: bucketKey,
      websiteIndexDocument: "index.html"
    });

    const environmentDomainName = "dev2.example.com";
    const hostedZone = new HostedZone(this, `test-hosted-zone`, 
    {
      zoneName: environmentDomainName
    });

    const cert = new Certificate(this, 'certificate',
    {
      domainName: environmentDomainName,
      validation: CertificateValidation.fromDns(hostedZone)
    })

    const originAccessIdentity = new OriginAccessIdentity(this, `${deployEnvironment}-origin-access-identity`,
    {
      comment: `${deployEnvironment} origin access identity`
    })

    this.bucket.grantRead(originAccessIdentity);
    bucketKey.grantDecrypt(originAccessIdentity);

    const cloudFrontDistribution = new Distribution(this, "distro",
    {
      defaultBehavior: {
        origin: new S3Origin(this.bucket, {
          originAccessIdentity: originAccessIdentity
        }
        ),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD
      },
      certificate: cert,
      domainNames: [environmentDomainName],
      defaultRootObject: "index.html"
    });

    new RecordSet(this, 'recordset',
    {
      recordType: RecordType.A,
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFrontDistribution))
    });

  }
}

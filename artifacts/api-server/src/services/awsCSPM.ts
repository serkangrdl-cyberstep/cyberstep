import { S3Client, ListBucketsCommand, GetBucketAclCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import { IAMClient, GetAccountSummaryCommand } from "@aws-sdk/client-iam";
import { logger } from "../lib/logger";

export interface CloudFindingInput {
  provider: "aws" | "azure";
  region?: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  findingType: string;
  severity: string;
  title: string;
  description: string;
  remediationSteps: string;
}

const CRITICAL_PORTS = [22, 3389, 1433, 3306, 5432, 27017, 6379];

export class AWSCSPMScanner {
  private regions: string[];
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(accessKeyId: string, secretAccessKey: string, regions: string[]) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.regions = regions.length > 0 ? regions : ["eu-central-1"];
  }

  async runFullScan(): Promise<CloudFindingInput[]> {
    const results = await Promise.allSettled([
      this.checkPublicS3Buckets(),
      this.checkOpenSecurityGroups(),
      this.checkRootAccountMFA(),
    ]);

    const findings: CloudFindingInput[] = [];
    for (const r of results) {
      if (r.status === "fulfilled") findings.push(...r.value);
      else logger.warn({ err: r.reason }, "AWS CSPM check failed");
    }
    return findings;
  }

  private creds() {
    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    };
  }

  private async checkPublicS3Buckets(): Promise<CloudFindingInput[]> {
    const s3 = new S3Client({ credentials: this.creds(), region: "us-east-1" });
    const findings: CloudFindingInput[] = [];

    const { Buckets } = await s3.send(new ListBucketsCommand({}));
    for (const bucket of Buckets ?? []) {
      try {
        const acl = await s3.send(new GetBucketAclCommand({ Bucket: bucket.Name! }));
        const isPublic = acl.Grants?.some(
          g => g.Grantee?.URI?.includes("AllUsers")
        );
        if (isPublic) {
          findings.push({
            provider: "aws",
            resourceType: "s3_bucket",
            resourceId: bucket.Name!,
            resourceName: bucket.Name!,
            findingType: "public_s3_bucket",
            severity: "critical",
            title: `S3 Bucket Herkese Acik: ${bucket.Name}`,
            description: "Bu bucket internetten herkes tarafindan okunabilir.",
            remediationSteps: `AWS Console → S3 → ${bucket.Name} → Permissions → Block Public Access → Enable all`,
          });
        }
      } catch { /* erişim hatası, atla */ }
    }
    return findings;
  }

  private async checkOpenSecurityGroups(): Promise<CloudFindingInput[]> {
    const findings: CloudFindingInput[] = [];

    for (const region of this.regions) {
      try {
        const ec2 = new EC2Client({ credentials: this.creds(), region });
        const { SecurityGroups } = await ec2.send(new DescribeSecurityGroupsCommand({}));

        for (const sg of SecurityGroups ?? []) {
          for (const rule of sg.IpPermissions ?? []) {
            const isOpenToAll = rule.IpRanges?.some(r => r.CidrIp === "0.0.0.0/0");
            if (isOpenToAll && rule.FromPort && CRITICAL_PORTS.includes(rule.FromPort)) {
              findings.push({
                provider: "aws",
                region,
                resourceType: "security_group",
                resourceId: sg.GroupId!,
                resourceName: sg.GroupName!,
                findingType: "open_security_group",
                severity: "high",
                title: `Guvenlik Grubu ${sg.GroupName}: Port ${rule.FromPort} herkese acik`,
                description: `${rule.FromPort} portu internetten herhangi bir IP'ye acik.`,
                remediationSteps: `AWS Console → EC2 → Security Groups → ${sg.GroupName} → Inbound Rules → Port ${rule.FromPort} kuralini kisitla`,
              });
            }
          }
        }
      } catch { /* region error */ }
    }
    return findings;
  }

  private async checkRootAccountMFA(): Promise<CloudFindingInput[]> {
    try {
      const iam = new IAMClient({ credentials: this.creds() });
      const summary = await iam.send(new GetAccountSummaryCommand({}));
      const mfaEnabled = summary.SummaryMap?.["AccountMFAEnabled"] === 1;

      if (!mfaEnabled) {
        return [{
          provider: "aws",
          resourceType: "iam_user",
          resourceId: "root",
          resourceName: "Root Account",
          findingType: "mfa_not_enabled",
          severity: "critical",
          title: "AWS Root Hesabinda MFA Aktif Degil",
          description: "Root hesabi en yuksek yetkiye sahip. MFA olmadan ele gecirilmesi tum AWS ortamini tehlikeye atar.",
          remediationSteps: "AWS Console → IAM → Dashboard → Activate MFA on your root account",
        }];
      }
    } catch { /* IAM erişim hatası */ }
    return [];
  }
}

export function parseAwsCredentials(encrypted: string): { accessKeyId: string; secretAccessKey: string } | null {
  try {
    const parsed = JSON.parse(encrypted) as { accessKeyId?: string; secretAccessKey?: string };
    if (parsed.accessKeyId && parsed.secretAccessKey) {
      return { accessKeyId: parsed.accessKeyId, secretAccessKey: parsed.secretAccessKey };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * migrate-teams-items.ts
 *
 * Migrates team metadata and item records from a source DynamoDB table
 * to a destination table, rewriting all user references to a single
 * "migration user" in the destination. Also copies item images from the
 * source S3 bucket to the destination S3 bucket.
 *
 * Automatically creates MEMBER records so the migration user is an OWNER
 * of each migrated team.
 *
 * Skips: USER# records, ROLE# records (roles are seeded by CDK),
 *        profile images, and generated documents.
 *
 * Usage:
 *   npx ts-node scripts/migrate-teams-items.ts [--dry-run]
 *
 * Configure the variables below before running.
 */

import {
  DynamoDBClient,
  ScanCommand,
  BatchWriteItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';

// ============== CONFIGURE THESE ==============

/** AWS region */
const REGION = 'us-east-1';

/** Source DynamoDB table name */
const SOURCE_TABLE = 'mng-beta-data';

/** Destination DynamoDB table name */
const DEST_TABLE = 'mng-prod-data';

/** Source S3 uploads bucket name */
const SOURCE_BUCKET = 'mng-beta-uploads-245120345540';

/** Destination S3 uploads bucket name */
const DEST_BUCKET = 'mng-prod-uploads-245120345540';

/** Cognito sub of the destination user to attribute everything to */
const MIGRATION_USER_SUB = '2448b418-b021-70d5-cd81-683d159cdb65';

/** Display name for the migration user (used in updateLog entries) */
const MIGRATION_USER_NAME = 'Paul Martin';

/** AWS profile for the SOURCE account (set to undefined to use default/ambient credentials) */
const SOURCE_PROFILE: string | undefined = 'mng_inventory';

/** AWS profile for the DESTINATION account (set to same as SOURCE for same-account migration) */
const DEST_PROFILE: string | undefined = 'mng_inventory';

/**
 * Set to true when source and destination are in the same AWS account.
 * Enables server-side S3 copy (faster, no data transfer costs).
 * Set to false for cross-account migrations (uses download-then-upload).
 */
const SAME_ACCOUNT = true;

// =============================================

const DRY_RUN = process.argv.includes('--dry-run');

if (
  MIGRATION_USER_SUB === ('REPLACE_ME' as string) ||
  MIGRATION_USER_NAME === ('REPLACE_ME' as string)
) {
  console.error('Please set MIGRATION_USER_SUB and MIGRATION_USER_NAME before running.');
  process.exit(1);
}

function makeCredentials(profile?: string) {
  return profile ? fromIni({ profile }) : undefined;
}

const sourceDdb = new DynamoDBClient({
  region: REGION,
  credentials: makeCredentials(SOURCE_PROFILE),
});
const destDdb = new DynamoDBClient({ region: REGION, credentials: makeCredentials(DEST_PROFILE) });
const sourceS3 = new S3Client({ region: REGION, credentials: makeCredentials(SOURCE_PROFILE) });
const destS3 = new S3Client({ region: REGION, credentials: makeCredentials(DEST_PROFILE) });

// ============== DynamoDB helpers ==============

function rewriteUserRefs(record: Record<string, any>): Record<string, any> {
  const rewritten = { ...record };

  if (rewritten.ownerId) {
    rewritten.ownerId = MIGRATION_USER_SUB;
  }

  if (rewritten.createdBy) {
    rewritten.createdBy = MIGRATION_USER_SUB;
  }

  if (Array.isArray(rewritten.updateLog)) {
    rewritten.updateLog = rewritten.updateLog.map((entry: any) => ({
      ...entry,
      userId: MIGRATION_USER_SUB,
      userName: MIGRATION_USER_NAME,
    }));
  }

  return rewritten;
}

/**
 * Build a MEMBER record that grants the migration user OWNER access to a team.
 * Includes GSI attributes so the user's team list works correctly.
 */
function buildMemberRecord(teamId: string): Record<string, any> {
  return {
    PK: `TEAM#${teamId}`,
    SK: `MEMBER#${MIGRATION_USER_SUB}`,
    Type: 'TeamMember',
    teamId,
    userId: MIGRATION_USER_SUB,
    role: 'OWNER',
    joinedAt: new Date().toISOString(),
    GSI1PK: `USER#${MIGRATION_USER_SUB}`,
    GSI1SK: `TEAM#${teamId}`,
  };
}

async function scanAll(client: DynamoDBClient, tableName: string): Promise<Record<string, any>[]> {
  const items: Record<string, any>[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const res = await client.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastKey as any,
      }),
    );

    for (const item of res.Items ?? []) {
      items.push(unmarshall(item));
    }

    lastKey = res.LastEvaluatedKey as any;
  } while (lastKey);

  return items;
}

/**
 * Check the destination table for existing teams by name to warn about conflicts.
 */
async function checkTeamNameConflicts(teamNames: string[]): Promise<string[]> {
  const conflicts: string[] = [];

  for (const name of teamNames) {
    const res = await destDdb.send(
      new QueryCommand({
        TableName: DEST_TABLE,
        IndexName: 'GSI_WorkspaceByName',
        KeyConditionExpression: 'GSI_NAME = :name',
        ExpressionAttributeValues: marshall({ ':name': name.toLowerCase() }),
        Limit: 1,
      }),
    );

    if (res.Items && res.Items.length > 0) {
      conflicts.push(name);
    }
  }

  return conflicts;
}

async function batchWrite(items: Record<string, any>[]): Promise<void> {
  const BATCH_SIZE = 25;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const request = {
      RequestItems: {
        [DEST_TABLE]: batch.map((item) => ({
          PutRequest: {
            Item: marshall(item, { removeUndefinedValues: true }),
          },
        })),
      },
    };

    const res = await destDdb.send(new BatchWriteItemCommand(request));

    let unprocessed = res.UnprocessedItems?.[DEST_TABLE];
    let retries = 0;
    while (unprocessed && unprocessed.length > 0 && retries < 3) {
      retries++;
      console.warn(`  Retrying ${unprocessed.length} unprocessed items (attempt ${retries})...`);
      await new Promise((r) => setTimeout(r, 1000 * retries));
      const retry = await destDdb.send(
        new BatchWriteItemCommand({ RequestItems: { [DEST_TABLE]: unprocessed } }),
      );
      unprocessed = retry.UnprocessedItems?.[DEST_TABLE];
    }

    if (unprocessed && unprocessed.length > 0) {
      console.error(`  Failed to write ${unprocessed.length} items after retries.`);
    }

    console.log(`  Wrote batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)`);
  }
}

// ============== S3 helpers ==============

/**
 * Copy all objects under items/ from the source bucket to the dest bucket.
 * The key paths stay the same since teamIds are preserved.
 *
 * Same-account: uses server-side CopyObject (faster, no data transfer).
 * Cross-account: downloads from source and uploads to dest.
 */
async function copyItemImages(): Promise<number> {
  const prefix = 'items/';
  let copied = 0;
  let continuationToken: string | undefined;

  do {
    const listed = await sourceS3.send(
      new ListObjectsV2Command({
        Bucket: SOURCE_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of listed.Contents ?? []) {
      const key = obj.Key!;

      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would copy ${key}`);
        copied++;
        continue;
      }

      try {
        if (SAME_ACCOUNT) {
          await destS3.send(
            new CopyObjectCommand({
              Bucket: DEST_BUCKET,
              Key: key,
              CopySource: `${SOURCE_BUCKET}/${encodeURIComponent(key)}`,
            }),
          );
        } else {
          const getRes = await sourceS3.send(
            new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: key }),
          );
          const body = await getRes.Body!.transformToByteArray();
          await destS3.send(
            new PutObjectCommand({
              Bucket: DEST_BUCKET,
              Key: key,
              Body: body,
              ContentType: getRes.ContentType,
            }),
          );
        }
        copied++;
        console.log(`  Copied ${key}`);
      } catch (err: any) {
        console.error(`  Failed to copy ${key}: ${err.message}`);
      }
    }

    continuationToken = listed.NextContinuationToken;
  } while (continuationToken);

  return copied;
}

// ============== Main ==============

async function main() {
  if (DRY_RUN) {
    console.log('\n=== DRY RUN MODE - no changes will be made ===\n');
  }

  console.log(`Migration: ${SOURCE_TABLE} -> ${DEST_TABLE}`);
  console.log(`S3 copy:   ${SOURCE_BUCKET} -> ${DEST_BUCKET}`);
  console.log(`Mode:      ${SAME_ACCOUNT ? 'same-account' : 'cross-account'}`);
  console.log(`Migration user: ${MIGRATION_USER_NAME} (${MIGRATION_USER_SUB})\n`);

  // 1. Scan source table
  console.log(`Scanning ${SOURCE_TABLE}...`);
  const allRecords = await scanAll(sourceDdb, SOURCE_TABLE);
  console.log(`  Found ${allRecords.length} total records.\n`);

  // 2. Filter to team metadata + items only
  const toMigrate = allRecords.filter((r) => {
    const pk = r.PK as string;
    const sk = r.SK as string;

    if (!pk.startsWith('TEAM#')) return false;
    if (sk === 'METADATA') return true;
    if (sk.startsWith('ITEM#')) return true;
    return false;
  });

  const teams = toMigrate.filter((r) => r.SK === 'METADATA');
  const items = toMigrate.filter((r) => (r.SK as string).startsWith('ITEM#'));

  console.log(`Records to migrate:`);
  console.log(`  Teams:   ${teams.length}`);
  console.log(`  Items:   ${items.length}`);

  // Log skipped record types for visibility
  const skipped = allRecords.filter((r) => {
    const pk = r.PK as string;
    return (
      pk.startsWith('USER#') || pk.startsWith('ROLE#') || (r.SK as string).startsWith('MEMBER#')
    );
  });
  console.log(`  Skipped: ${skipped.length} (users, roles, members)\n`);

  // 3. Check for team name conflicts in destination
  const teamNames = teams.map((t) => t.name as string);
  console.log('Checking for team name conflicts in destination...');
  const conflicts = await checkTeamNameConflicts(teamNames);
  if (conflicts.length > 0) {
    console.warn(`  WARNING: The following teams already exist in the destination:`);
    for (const name of conflicts) {
      console.warn(`    - ${name}`);
    }
    console.warn(`  These teams will be OVERWRITTEN. Press Ctrl+C within 5 seconds to abort.`);
    if (!DRY_RUN) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  } else {
    console.log('  No conflicts found.\n');
  }

  // 4. Rewrite user references
  console.log('Rewriting user references...');
  const rewritten = toMigrate.map(rewriteUserRefs);

  // 5. Build MEMBER records for migration user
  const memberRecords = teams.map((t) => buildMemberRecord(t.teamId as string));
  console.log(`  Created ${memberRecords.length} MEMBER records for migration user.\n`);

  const allToWrite = [...rewritten, ...memberRecords];

  // 6. Write to destination table
  if (DRY_RUN) {
    console.log(`[DRY RUN] Would write ${allToWrite.length} records to ${DEST_TABLE}:`);
    console.log(`  ${rewritten.length} team/item records`);
    console.log(`  ${memberRecords.length} member records\n`);
  } else if (allToWrite.length > 0) {
    console.log(`Writing ${allToWrite.length} records to ${DEST_TABLE}...`);
    await batchWrite(allToWrite);
    console.log('');
  } else {
    console.log('No DynamoDB records to migrate.\n');
  }

  // 7. Copy item images from S3
  console.log(`Copying item images from S3...`);
  const imagesCopied = await copyItemImages();
  console.log(`  ${DRY_RUN ? 'Would copy' : 'Copied'} ${imagesCopied} images.\n`);

  if (DRY_RUN) {
    console.log('=== DRY RUN COMPLETE - no changes were made ===\n');
    console.log('Run without --dry-run to perform the migration.');
  } else {
    console.log('Migration complete!\n');
    console.log('Next steps:');
    console.log('  1. Log into the destination environment and verify teams and items appear.');
    console.log('  2. The migration user has been added as OWNER of all migrated teams.');
    console.log('  3. Use the UI to invite additional team members as needed.');
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

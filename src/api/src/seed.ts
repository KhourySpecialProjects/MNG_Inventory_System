/**
 * Seed script for local DynamoDB development
 * 
 * This script seeds the local DynamoDB instance with:
 * - Mock users (Owner, Manager, Member)
 * - Two teams with different inventory states
 * - Roles with permissions
 * - Realistic inventory items with varied statuses
 * 
 * Usage: npm run seed
 */

import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// Mock user data
export const MOCK_USER = {
  sub: 'local-dev-user-001',
  email: 'dev@localhost',
  username: 'local-dev',
  name: 'Local Developer',
  role: 'Owner',
  accountId: 'local-account-001',
};

const ADDITIONAL_USERS = [
  {
    sub: 'local-dev-user-002',
    username: 'jane.smith',
    name: 'Jane Smith',
    role: 'Manager',
    email: 'jane.smith@example.com',
  },
  {
    sub: 'local-dev-user-003',
    username: 'john.doe',
    name: 'John Doe',
    role: 'Member',
    email: 'john.doe@example.com',
  },
];

// Helper functions
function generateItemId(): string {
  return 'item-' + Math.random().toString(36).substring(2, 9);
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomQuantity(): number {
  if (Math.random() < 0.5) return 1;
  return Math.floor(Math.random() * 4) + 2; // 2-5
}

function randomDateInPast(days: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

function getRandomUser(): { userId: string; username: string; name: string } {
  const users = [
    { userId: MOCK_USER.sub, username: MOCK_USER.username, name: MOCK_USER.name },
    { userId: 'local-dev-user-002', username: 'jane.smith', name: 'Jane Smith' },
    { userId: 'local-dev-user-003', username: 'john.doe', name: 'John Doe' },
  ];
  return randomElement(users);
}

interface ItemDefinition {
  name: string;
  actualName: string;
  nsn: string;
  serialNumber: string;
  description?: string;
  status?: string;
  quantity?: number;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedByUserId?: string;
}

interface KitDefinition {
  name: string;
  actualName: string;
  nsn: string;
  description?: string;
  children: ItemDefinition[];
  quantity?: number;
}

function createItem(def: ItemDefinition, teamId: string, now: string): any {
  const itemId = generateItemId();
  const user = getRandomUser();
  const creationTime = randomDateInPast(7);
  
  const updateLog: any[] = [
    {
      userId: user.userId,
      userName: user.name,
      action: 'create',
      timestamp: creationTime,
    },
  ];
  
  let reviewTime = creationTime;
  if (def.status && def.status !== 'To Review') {
    const reviewer = getRandomUser();
    reviewTime = new Date(new Date(creationTime).getTime() + Math.random() * 6 * 24 * 60 * 60 * 1000).toISOString();
    updateLog.push({
      userId: reviewer.userId,
      userName: reviewer.name,
      action: `review - ${def.status.toLowerCase()}`,
      timestamp: reviewTime,
    });
  }
  
  return {
    itemId,
    name: def.name,
    actualName: def.actualName,
    nsn: def.nsn,
    serialNumber: def.serialNumber,
    status: def.status ?? 'To Review',
    description: def.description,
    reviewedBy: def.reviewedBy,
    reviewedByName: def.reviewedByName,
    reviewedByUserId: def.reviewedByUserId,
    isKit: false,
    quantity: def.quantity ?? randomQuantity(),
    createdAt: creationTime,
    updatedAt: reviewTime,
    createdBy: user.userId,
    updateLog,
  };
}

function createKit(def: KitDefinition, teamId: string, now: string): any[] {
  const kitId = generateItemId();
  const user = getRandomUser();
  const creationTime = randomDateInPast(7);
  
  const updateLog: any[] = [
    {
      userId: user.userId,
      userName: user.name,
      action: 'create',
      timestamp: creationTime,
    },
  ];
  
  const kit = {
    itemId: kitId,
    name: def.name,
    actualName: def.actualName,
    nsn: def.nsn,
    status: 'To Review',
    description: def.description,
    isKit: true,
    quantity: def.quantity ?? 1,
    createdAt: creationTime,
    updatedAt: creationTime,
    createdBy: user.userId,
    updateLog,
  };

  const children = def.children.map(childDef => ({
    ...createItem(childDef, teamId, now),
    parent: kitId,
    isKit: false,
  }));

  return [kit, ...children];
}

function createBulkItems(
  definitions: ItemDefinition[],
  statuses: string[],
  teamId: string,
  now: string,
): any[] {
  return definitions.map((def, idx) => ({
    ...createItem(
      {
        ...def,
        status: statuses[idx % statuses.length],
      },
      teamId,
      now,
    ),
  }));
}

// Seed data definitions
const ROLES = [
  {
    name: 'Owner',
    permissions: [
      'team.create',
      'team.view',
      'team.update',
      'team.delete',
      'team.add_member',
      'team.remove_member',
      'item.create',
      'item.view',
      'item.update',
      'item.delete',
      'item.reset',
      'user.invite',
      'user.view',
      'user.update',
      'user.remove',
      'user.delete',
      'user.assign_roles',
      'role.view',
      'role.assign',
      'role.add',
      'role.modify',
      'role.remove',
      'reports.create',
      'reports.view',
      'reports.export',
      'reports.delete',
    ],
  },
  {
    name: 'Manager',
    permissions: [
      'team.view',
      'item.create',
      'item.view',
      'item.update',
      'user.invite',
      'user.view',
      'reports.view',
      'reports.export',
    ],
  },
  {
    name: 'Member',
    permissions: ['team.view', 'item.view', 'item.create', 'reports.view'],
  },
];

const ITEM_DEFINITIONS: ItemDefinition[] = [
  // Rifles & Firearms
  { name: 'M4 Carbine', actualName: 'M4A1 Carbine Rifle', nsn: '1005-01-231-0973', serialNumber: 'W123456', description: 'Standard issue M4 carbine' },
  { name: 'M9 Pistol', actualName: 'M9 Beretta 9mm Pistol', nsn: '1005-01-118-2187', serialNumber: 'M9-789456', description: 'Sidearm pistol' },
  { name: 'M240 Machine Gun', actualName: 'M240 7.62mm Machine Gun', nsn: '1005-01-429-5879', serialNumber: 'MG-234567', description: 'General purpose machine gun' },
  
  // Body Armor & Protection
  { name: 'IOTV Body Armor', actualName: 'Improved Outer Tactical Vest', nsn: '8470-01-580-1305', serialNumber: 'BA-345678', description: 'Body armor vest with plate carrier' },
  { name: 'ACH Helmet', actualName: 'Advanced Combat Helmet', nsn: '8470-01-519-8669', serialNumber: 'HELM-567890', description: 'Combat helmet with padding' },
  { name: 'Combat Shirt', actualName: 'Flame Resistant Army Combat Shirt', nsn: '8405-01-507-7896', serialNumber: 'CS-123789', description: 'FR combat shirt' },
  { name: 'Combat Pants', actualName: 'Flame Resistant Army Combat Pants', nsn: '8405-01-507-7897', serialNumber: 'CP-234567', description: 'FR combat pants' },
  
  // Optics & Vision
  { name: 'Night Vision Goggles', actualName: 'AN/PVS-14 Night Vision Monocular', nsn: '5855-01-432-0524', serialNumber: 'NVG-789012', description: 'Night vision device' },
  { name: 'ACOG Scope', actualName: 'Advanced Combat Optical Gunsight', nsn: '5855-00-121-9223', serialNumber: 'ACOG-345678', description: 'Magnified rifle optic' },
  { name: 'Binoculars', actualName: 'M22 Binoculars', nsn: '6650-01-329-5386', serialNumber: 'BIN-890123', description: '7x50 military binoculars' },
  
  // Communications
  { name: 'Radio Set AN/PRC-152', actualName: 'Multiband Handheld Radio', nsn: '5820-01-525-6389', serialNumber: 'RADIO-123789', description: 'Tactical communications radio' },
  { name: 'Radio Set AN/PRC-117', actualName: 'Lightweight Tactical Radio', nsn: '5820-01-524-6827', serialNumber: 'RADIO-456789', description: 'Single channel radio' },
  
  // Medical & First Aid
  { name: 'IFAK', actualName: 'Individual First Aid Kit', nsn: '6545-01-531-3147', serialNumber: 'IFAK-901234', description: 'Standard issue first aid kit' },
  { name: 'Combat Tourniquet', actualName: 'CAT Combat Application Tourniquet', nsn: '6515-01-609-9034', serialNumber: 'CAT-567890', description: 'Combat tourniquet' },
  { name: 'Elastic Bandage', actualName: '3 inch Elastic Bandage', nsn: '6510-00-112-4344', serialNumber: 'EB-123456', description: 'Elastic bandage roll' },
  
  // Packs & Carriers
  { name: 'Assault Pack', actualName: 'MOLLE II Assault Pack', nsn: '8465-01-525-0585', serialNumber: 'PACK-456123', description: 'Three-day assault pack' },
  { name: 'Ruck Sack', actualName: 'MOLLE II Large Rucksack', nsn: '8465-01-525-0586', serialNumber: 'RUCK-789012', description: 'Large capacity rucksack' },
  { name: 'Hydration Carrier', actualName: 'MOLLE II Hydration Carrier', nsn: '8465-01-525-0587', serialNumber: 'HC-345678', description: 'Hydration pack carrier' },
  
  // Field Gear
  { name: 'Sleeping Bag', actualName: 'Modular Sleeping Bag System', nsn: '8465-01-547-2657', serialNumber: 'SLP-678901', description: 'Cold weather sleeping system' },
  { name: 'Tent', actualName: 'General Purpose Tent', nsn: '8340-01-529-0639', serialNumber: 'TENT-234567', description: 'Two-person field tent' },
  { name: 'Poncho', actualName: 'Waterproof Poncho', nsn: '8340-01-084-8456', serialNumber: 'PONT-567890', description: 'Lightweight rain protection' },
  { name: 'Entrenching Tool', actualName: 'E-Tool with Carrier', nsn: '5240-01-383-6054', serialNumber: 'ET-890123', description: 'Folding entrenching tool' },
  
  // Survival & Equipment
  { name: 'Water Canteen', actualName: '1 Quart Canteen with Cover', nsn: '8465-00-162-5605', serialNumber: 'CANT-234567', description: 'Water canteen with carrier' },
  { name: 'Flashlight', actualName: 'MX-991/U Angle Head Flashlight', nsn: '6230-00-106-6471', serialNumber: 'FLASH-345890', description: 'Angle-head flashlight with filters' },
  { name: 'Compass', actualName: 'M2 Lensatic Compass', nsn: '6695-00-935-7319', serialNumber: 'COMP-678901', description: 'Military compass' },
  { name: 'Rope Nylon', actualName: 'Nylon Rope 50 feet', nsn: '4020-00-201-2348', serialNumber: 'ROPE-234567', description: 'Tactical nylon rope' },
  
  // Ammunition & Ordnance
  { name: 'Ammo Case', actualName: 'Ammunition Storage Case', nsn: '1080-01-234-5678', serialNumber: 'AC-567890', description: 'Waterproof ammo container' },
  { name: 'Grenade Pouch', actualName: 'Grenade/Magazine Pouch', nsn: '8465-01-234-5678', serialNumber: 'GP-890123', description: 'Magazine and grenade carrier' },
  
  // Uniforms & Gear
  { name: 'Tactical Gloves', actualName: 'Improved Operator Tactical Gloves', nsn: '8405-01-546-1234', serialNumber: 'TG-345678', description: 'Tactical work gloves' },
  { name: 'Military Boots', actualName: 'Desert Combat Boots', nsn: '8430-01-407-8854', serialNumber: 'BOOT-567890', description: 'Desert terrain boots' },
  { name: 'Body Armor Carrier', actualName: 'Plate Carrier Vest System', nsn: '8470-01-603-4567', serialNumber: 'PAC-678901', description: 'Empty plate carrier' },
  
  // Additional items
  { name: 'Magazine Pouch', actualName: 'Double Mag Pouch', nsn: '8465-01-234-5679', serialNumber: 'MP-123456', description: 'Magazine carrier' },
  { name: 'Mag 30 round', actualName: '5.56mm Magazine 30rd', nsn: '1080-01-245-6789', serialNumber: 'MAG-234567', description: '30 round magazine' },
  { name: 'Sling', actualName: 'Combat Weapon Sling', nsn: '8465-00-234-5678', serialNumber: 'SLING-345678', description: 'Three-point weapon sling' },
  { name: 'Sunscreen', actualName: 'SPF 30 Sunscreen', nsn: '6510-01-234-5678', serialNumber: 'SPF-123456', description: 'Military sunscreen' },
  { name: 'Insect Repellent', actualName: 'DEET Insect Repellent', nsn: '6508-01-234-5679', serialNumber: 'INSECT-234567', description: 'Mosquito/insect repellent' },
  { name: 'Water Purification', actualName: 'Water Purification Tablets', nsn: '6505-01-234-5680', serialNumber: 'WP-345678', description: 'Chemical water purification' },
  { name: 'MRE', actualName: 'Meal Ready to Eat', nsn: '8970-01-234-5681', serialNumber: 'MRE-456789', description: 'Field ration' },
  { name: 'Multi-tool', actualName: 'Leatherman Multi-Tool', nsn: '5110-01-234-5687', serialNumber: 'MT-123456', description: 'Military multi-tool' },
  { name: 'Wire Cutters', actualName: 'Wire Cutters', nsn: '5110-00-234-5688', serialNumber: 'WC-234567', description: 'Diagonal wire cutters' },
  { name: 'Hammer', actualName: 'Claw Hammer', nsn: '5120-01-234-5689', serialNumber: 'HAM-345678', description: 'Standard hammer' },
];

const KIT_DEFINITIONS: KitDefinition[] = [
  {
    name: 'Rifleman Kit',
    actualName: 'Complete Rifleman Combat Kit',
    nsn: '8999-01-234-5678',
    description: 'Full combat loadout for rifleman',
    children: [
      { name: 'Magazine Pouch', actualName: 'Double Mag Pouch', nsn: '8465-01-234-5679', serialNumber: 'MP-123456', description: 'Magazine carrier' },
      { name: 'Mag 30 round', actualName: '5.56mm Magazine 30rd', nsn: '1080-01-245-6789', serialNumber: 'MAG-234567', description: '30 round magazine' },
      { name: 'Sling', actualName: 'Combat Weapon Sling', nsn: '8465-00-234-5678', serialNumber: 'SLING-345678', description: 'Three-point weapon sling' },
    ],
  },
  {
    name: 'Patrol Kit',
    actualName: 'Field Patrol Essentials Kit',
    nsn: '8999-01-345-6789',
    description: 'Essential items for patrol operations',
    children: [
      { name: 'Sunscreen', actualName: 'SPF 30 Sunscreen', nsn: '6510-01-234-5678', serialNumber: 'SPF-123456', description: 'Military sunscreen' },
      { name: 'Insect Repellent', actualName: 'DEET Insect Repellent', nsn: '6508-01-234-5679', serialNumber: 'INSECT-234567', description: 'Mosquito/insect repellent' },
      { name: 'Water Purification', actualName: 'Water Purification Tablets', nsn: '6505-01-234-5680', serialNumber: 'WP-345678', description: 'Chemical water purification' },
      { name: 'MRE', actualName: 'Meal Ready to Eat', nsn: '8970-01-234-5681', serialNumber: 'MRE-456789', description: 'Field ration' },
    ],
  },
  {
    name: 'Medical Kit Advanced',
    actualName: 'Advanced Field Medical Kit',
    nsn: '8999-01-456-7890',
    description: 'Extended medical supplies for squad',
    children: [
      { name: 'IV Fluid', actualName: 'Normal Saline IV', nsn: '6505-01-234-5682', serialNumber: 'IV-567890', description: 'Intravenous saline' },
      { name: 'Pressure Dressing', actualName: 'Emergency Pressure Dressing', nsn: '6510-01-234-5683', serialNumber: 'PD-678901', description: 'Field pressure bandage' },
      { name: 'Pain Relief', actualName: 'Morphine Injector', nsn: '6505-01-234-5684', serialNumber: 'MOR-789012', description: 'Emergency pain reliever' },
      { name: 'Antibacterial', actualName: 'Antibiotic Ointment', nsn: '6505-01-234-5685', serialNumber: 'AB-890123', description: 'Neosporin antibiotic' },
      { name: 'Gauze Pads', actualName: 'Sterile Gauze Pads 4x4', nsn: '6510-01-234-5686', serialNumber: 'GAUZE-234567', description: 'Medical gauze pads' },
    ],
  },
  {
    name: 'Engineer Tool Kit',
    actualName: 'Combat Engineer Basic Tool Set',
    nsn: '8999-01-567-8901',
    description: 'Engineering and construction tools',
    children: [
      { name: 'Multi-tool', actualName: 'Leatherman Multi-Tool', nsn: '5110-01-234-5687', serialNumber: 'MT-123456', description: 'Military multi-tool' },
      { name: 'Wire Cutters', actualName: 'Wire Cutters', nsn: '5110-00-234-5688', serialNumber: 'WC-234567', description: 'Diagonal wire cutters' },
      { name: 'Hammer', actualName: 'Claw Hammer', nsn: '5120-01-234-5689', serialNumber: 'HAM-345678', description: 'Standard hammer' },
    ],
  },
];

// Create DynamoDB table schema
async function createTable(client: DynamoDBClient, tableName: string) {
  const listTablesCommand = new ListTablesCommand({});
  const tables = await client.send(listTablesCommand);
  
  if (tables.TableNames?.includes(tableName)) {
    console.log(`Table ${tableName} already exists, skipping creation`);
    return;
  }

  const createTableCommand = new CreateTableCommand({
    TableName: tableName,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' },
      { AttributeName: 'GSI6PK', AttributeType: 'S' },
      { AttributeName: 'GSI6SK', AttributeType: 'S' },
      { AttributeName: 'GSI_NAME', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI_UserTeams',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'GSI_UsersByUid',
        KeySchema: [
          { AttributeName: 'GSI6PK', KeyType: 'HASH' },
          { AttributeName: 'GSI6SK', KeyType: 'RANGE' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: 'GSI_WorkspaceByName',
        KeySchema: [
          { AttributeName: 'GSI_NAME', KeyType: 'HASH' },
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    BillingMode: 'PROVISIONED',
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  });

  await client.send(createTableCommand);
  console.log(`✅ Created table: ${tableName}`);
  
  // Wait for table to be active
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function seedDatabase() {
  const tableName = process.env.DDB_TABLE_NAME || 'mng-api-dev-data';
  const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
  
  console.log('Starting database seed...');
  console.log(`Table: ${tableName}`);
  console.log(`Endpoint: ${endpoint}`);

  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint,
    credentials: {
      accessKeyId: 'dummy',
      secretAccessKey: 'dummy',
    },
  });

  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  try {
    // Create table
    await createTable(client, tableName);

    const now = new Date().toISOString();

    // 1. Seed Users
    console.log('\nSeeding users...');
    const allUsers = [{ ...MOCK_USER, email: MOCK_USER.email }, ...ADDITIONAL_USERS];
    for (const user of allUsers) {
      const userKey = `USER#${user.sub}`;
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: userKey,
          SK: 'METADATA',
          sub: user.sub,
          username: user.username,
          name: user.name,
          role: user.role,
          accountId: `account-${user.sub}`,
          createdAt: now,
          updatedAt: now,
          GSI6PK: `UID#${user.sub}`,
          GSI6SK: userKey,
        },
      }));
      console.log(`  ✓ Created user: ${user.username}`);
    }

    // 2. Seed Roles
    console.log('\nSeeding roles...');
    for (const role of ROLES) {
      const roleKey = `ROLE#${role.name.toUpperCase()}`;
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: roleKey,
          SK: 'METADATA',
          roleId: role.name.toUpperCase(),
          name: role.name,
          permissions: role.permissions,
          createdAt: now,
          updatedAt: now,
        },
      }));
      console.log(`  ✓ Created role: ${role.name}`);
    }

    // 3. Seed Team 1 - Mixed statuses
    console.log('\nSeeding Team 1 (Local Dev Team)...');
    const teamId1 = 'local-team-001';
    const teamKey1 = `TEAM#${teamId1}`;
    
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: teamKey1,
        SK: 'METADATA',
        Type: 'Team',
        teamId: teamId1,
        name: 'Local Dev Team',
        description: 'Default team for local development',
        uic: 'W1A1AA',
        fe: 'FE001',
        ownerId: MOCK_USER.sub,
        createdAt: now,
        updatedAt: now,
        GSI_NAME: 'local dev team',
      },
    }));

    // Add team members
    for (const user of allUsers) {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: teamKey1,
          SK: `MEMBER#${user.sub}`,
          Type: 'TeamMember',
          teamId: teamId1,
          userId: user.sub,
          role: user.role,
          joinedAt: now,
          GSI1PK: `USER#${user.sub}`,
          GSI1SK: `TEAM#${teamId1}`,
        },
      }));
    }

    // Add items with mixed statuses
    const statuses = ['To Review', 'Completed', 'Damaged', 'Shortages'];
    const basicItems1 = createBulkItems(ITEM_DEFINITIONS, statuses, teamId1, now);
    
    const kitItems1: any[] = [];
    KIT_DEFINITIONS.forEach(kitDef => {
      kitItems1.push(...createKit(kitDef, teamId1, now));
    });

    const kitParents1 = kitItems1.filter(item => item.isKit);
    kitParents1.forEach((kit, idx) => {
      kit.status = statuses[idx % statuses.length];
    });

    const allItems1 = [...basicItems1, ...kitItems1];
    for (const item of allItems1) {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: teamKey1,
          SK: `ITEM#${item.itemId}`,
          teamId: teamId1,
          ...item,
        },
      }));
    }
    console.log(`  ✓ Created ${allItems1.length} items for Team 1`);

    // 4. Seed Team 2 - All reviewed
    console.log('\nSeeding Team 2 (Completed Review Team)...');
    const teamId2 = 'local-team-002';
    const teamKey2 = `TEAM#${teamId2}`;
    
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK: teamKey2,
        SK: 'METADATA',
        Type: 'Team',
        teamId: teamId2,
        name: 'Completed Review Team',
        description: 'Team with all items already reviewed',
        uic: 'W2B2BB',
        fe: 'FE002',
        ownerId: MOCK_USER.sub,
        createdAt: now,
        updatedAt: now,
        GSI_NAME: 'completed review team',
      },
    }));

    // Add team members
    for (const user of allUsers) {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: teamKey2,
          SK: `MEMBER#${user.sub}`,
          Type: 'TeamMember',
          teamId: teamId2,
          userId: user.sub,
          role: user.role,
          joinedAt: now,
          GSI1PK: `USER#${user.sub}`,
          GSI1SK: `TEAM#${teamId2}`,
        },
      }));
    }

    // Add items with reviewed statuses only
    const reviewedStatuses = ['Completed', 'Damaged', 'Shortages'];
    const basicItems2 = createBulkItems(ITEM_DEFINITIONS, reviewedStatuses, teamId2, now);
    
    const kitItems2: any[] = [];
    KIT_DEFINITIONS.forEach(kitDef => {
      const kitResult = createKit(kitDef, teamId2, now);
      kitResult.forEach((item, idx) => {
        item.status = reviewedStatuses[idx % reviewedStatuses.length];
      });
      kitItems2.push(...kitResult);
    });

    const allItems2 = [...basicItems2, ...kitItems2];
    for (const item of allItems2) {
      await docClient.send(new PutCommand({
        TableName: tableName,
        Item: {
          PK: teamKey2,
          SK: `ITEM#${item.itemId}`,
          teamId: teamId2,
          ...item,
        },
      }));
    }
    console.log(`  ✓ Created ${allItems2.length} items for Team 2`);

    console.log('\nDatabase seeding completed successfully!');
    console.log('\nSummary:');
    console.log(`  - ${allUsers.length} users`);
    console.log(`  - ${ROLES.length} roles`);
    console.log(`  - 2 teams`);
    console.log(`  - ${allItems1.length + allItems2.length} total items`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.destroy();
  }
}

// Run if executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedDatabase };

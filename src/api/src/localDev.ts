/**
 * Local Development Mode
 *
 * Provides in-memory storage and mock auth for running without AWS.
 * Enable with: LOCAL_DEV=true npm run dev
 */

export const isLocalDev = process.env.LOCAL_DEV === 'true';

// Mock user for local development
export const MOCK_USER = {
  sub: 'local-dev-user-001',
  email: 'dev@localhost',
  username: 'local-dev',
  name: 'Local Developer',
  role: 'Owner',
  accountId: 'local-account-001',
};

// In-memory data store
interface Store {
  users: Map<string, any>;
  teams: Map<string, any>;
  items: Map<string, any>;
  members: Map<string, any>;
  roles: Map<string, any>;
}

export const memoryStore: Store = {
  users: new Map(),
  teams: new Map(),
  items: new Map(),
  members: new Map(),
  roles: new Map(),
};

/**
 * Helper to generate a random ID for items
 */
function generateItemId(): string {
  return 'item-' + Math.random().toString(36).substring(2, 9);
}

/**
 * Helper to pick a random element from an array
 */
function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Helper to get random quantity (1 or 2-5)
 */
function randomQuantity(): number {
  if (Math.random() < 0.5) return 1;
  return Math.floor(Math.random() * 4) + 2; // 2-5
}

/**
 * Helper to get a random date in the past N days
 */
function randomDateInPast(days: number): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * days * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

/**
 * Helper to get a random user from available users
 */
function getRandomUser(): { userId: string; username: string; name: string } {
  const users = [
    { userId: MOCK_USER.sub, username: MOCK_USER.username, name: MOCK_USER.name },
    { userId: 'local-dev-user-002', username: 'jane.smith', name: 'Jane Smith' },
    { userId: 'local-dev-user-003', username: 'john.doe', name: 'John Doe' },
  ];
  return randomElement(users);
}

/**
 * Helper to create a base item object
 */
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

function createItem(def: ItemDefinition, teamId: string, now: string): any {
  const itemId = generateItemId();
  const user = getRandomUser();
  const creationTime = randomDateInPast(7);
  
  // Build update log with creation and optional status change
  const updateLog: any[] = [
    {
      userId: user.userId,
      userName: user.name,
      action: 'create',
      timestamp: creationTime,
    },
  ];
  
  // If item has a status that's not "To Review", add a review action
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

/**
 * Helper to create a kit and its child items
 */
interface KitDefinition {
  name: string;
  actualName: string;
  nsn: string;
  description?: string;
  children: ItemDefinition[];
  quantity?: number;
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

  // Create child items with parent reference
  const children = def.children.map(childDef => ({
    ...createItem(childDef, teamId, now),
    parent: kitId,
    isKit: false,
  }));

  return [kit, ...children];
}

/**
 * Helper to create multiple items with a variety of statuses
 */
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

// Initialize with default data
function initializeStore() {
  const now = new Date().toISOString();

  // Create default user
  const userKey = `USER#${MOCK_USER.sub}`;
  memoryStore.users.set(userKey, {
    PK: userKey,
    SK: 'METADATA',
    sub: MOCK_USER.sub,
    username: MOCK_USER.username,
    name: MOCK_USER.name,
    role: MOCK_USER.role,
    accountId: MOCK_USER.accountId,
    createdAt: now,
    updatedAt: now,
    GSI6PK: `UID#${MOCK_USER.sub}`,
    GSI6SK: userKey,
  });

  // Create default roles
  const roles = [
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

  for (const role of roles) {
    const roleKey = `ROLE#${role.name.toUpperCase()}`;
    memoryStore.roles.set(roleKey, {
      PK: roleKey,
      SK: 'METADATA',
      roleId: role.name.toUpperCase(),
      name: role.name,
      permissions: role.permissions,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create a default team
  const teamId = 'local-team-001';
  const teamKey = `TEAM#${teamId}`;
  memoryStore.teams.set(teamKey, {
    PK: teamKey,
    SK: 'METADATA',
    Type: 'Team',
    teamId,
    name: 'Local Dev Team',
    description: 'Default team for local development',
    uic: 'W1A1AA',
    fe: 'FE001',
    ownerId: MOCK_USER.sub,
    createdAt: now,
    updatedAt: now,
    GSI_NAME: 'local dev team',
  });

  // Add user as team member
  const memberKey = `${teamKey}#MEMBER#${MOCK_USER.sub}`;
  memoryStore.members.set(memberKey, {
    PK: teamKey,
    SK: `MEMBER#${MOCK_USER.sub}`,
    Type: 'TeamMember',
    teamId,
    userId: MOCK_USER.sub,
    role: 'Owner',
    joinedAt: now,
    GSI1PK: `USER#${MOCK_USER.sub}`,
    GSI1SK: `TEAM#${teamId}`,
  });

  // Add additional mock users
  const additionalUsers = [
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

  for (const user of additionalUsers) {
    const uKey = `USER#${user.sub}`;
    memoryStore.users.set(uKey, {
      PK: uKey,
      SK: 'METADATA',
      sub: user.sub,
      username: user.username,
      name: user.name,
      role: user.role,
      accountId: `account-${user.sub}`,
      createdAt: now,
      updatedAt: now,
      GSI6PK: `UID#${user.sub}`,
      GSI6SK: uKey,
    });

    // Add as team members
    const mKey = `${teamKey}#MEMBER#${user.sub}`;
    memoryStore.members.set(mKey, {
      PK: teamKey,
      SK: `MEMBER#${user.sub}`,
      Type: 'TeamMember',
      teamId,
      userId: user.sub,
      role: user.role,
      joinedAt: now,
      GSI1PK: `USER#${user.sub}`,
      GSI1SK: `TEAM#${teamId}`,
    });
  }

  // Create seed inventory items with complex structure
  const seedItemDefs: ItemDefinition[] = [
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
    
    // Additional items for better status distribution
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

  // Define statuses to distribute across items
  const statuses = ['To Review', 'Completed', 'Damaged', 'Shortages'];

  // Create all basic items with distributed statuses
  const basicItems = createBulkItems(seedItemDefs, statuses, teamId, now);

  // Define kits with child items
  const kitDefs: KitDefinition[] = [
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

  // Create kits with their children
  const kitItems: any[] = [];
  kitDefs.forEach(kitDef => {
    kitItems.push(...createKit(kitDef, teamId, now));
  });

  // Distribute kit statuses
  const kitParentItems = kitItems.filter(item => item.isKit);
  const kitChildItems = kitItems.filter(item => !item.isKit);
  
  kitParentItems.forEach((kit, idx) => {
    kit.status = statuses[idx % statuses.length];
  });

  // Combine all items
  const allSeedItems = [...basicItems, ...kitItems];

  // Store all items for team 1
  for (const item of allSeedItems) {
    const itemKey = `${teamKey}#ITEM#${item.itemId}`;
    memoryStore.items.set(itemKey, {
      PK: teamKey,
      SK: `ITEM#${item.itemId}`,
      teamId,
      ...item,
    });
  }

  // ========== CREATE SECOND TEAM (All Items Reviewed) ==========
  const teamId2 = 'local-team-002';
  const teamKey2 = `TEAM#${teamId2}`;
  memoryStore.teams.set(teamKey2, {
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
  });

  // Add all 3 users as team members to team 2
  for (const user of additionalUsers.concat([{
    sub: MOCK_USER.sub,
    username: MOCK_USER.username,
    name: MOCK_USER.name,
    role: 'Owner',
    email: MOCK_USER.email,
  }])) {
    const mKey2 = `${teamKey2}#MEMBER#${user.sub}`;
    memoryStore.members.set(mKey2, {
      PK: teamKey2,
      SK: `MEMBER#${user.sub}`,
      Type: 'TeamMember',
      teamId: teamId2,
      userId: user.sub,
      role: user.role,
      joinedAt: now,
      GSI1PK: `USER#${user.sub}`,
      GSI1SK: `TEAM#${teamId2}`,
    });
  }

  // Create items for team 2 - all reviewed (no "To Review" status)
  const reviewedStatuses = ['Completed', 'Damaged', 'Shortages'];
  const basicItems2 = createBulkItems(seedItemDefs, reviewedStatuses, teamId2, now);

  // Create kits for team 2 - manually to control status
  const kitItems2: any[] = [];
  kitDefs.forEach(kitDef => {
    const kitResult = createKit(kitDef, teamId2, now);
    // Override all statuses to be reviewed-only
    kitResult.forEach((item, idx) => {
      item.status = reviewedStatuses[idx % reviewedStatuses.length];
    });
    kitItems2.push(...kitResult);
  });

  const kitParentItems2 = kitItems2.filter(item => item.isKit);
  const kitChildItems2 = kitItems2.filter(item => !item.isKit);

  // Combine team 2 items
  const allSeedItems2 = [...basicItems2, ...kitItems2];

  // Store all items for team 2
  for (const item of allSeedItems2) {
    const itemKey = `${teamKey2}#ITEM#${item.itemId}`;
    memoryStore.items.set(itemKey, {
      PK: teamKey2,
      SK: `ITEM#${item.itemId}`,
      teamId: teamId2,
      ...item,
    });
  }

  console.log('[LocalDev] Initialized in-memory store with:');
  console.log(`  - 3 users (1 Owner, 1 Manager, 1 Member)`);
  console.log(`  - 2 teams:`);
  console.log(`    • Team 1 (Local Dev Team): ${allSeedItems.length} items`);
  console.log(`      - Basic items: ${basicItems.length}`);
  console.log(`      - Kit items: ${kitItems.length} (${kitParentItems.length} kits + ${kitChildItems.length} children)`);
  console.log(`      - Status breakdown:`);
  for (const status of statuses) {
    const count = allSeedItems.filter(i => i.status === status).length;
    if (count > 0) console.log(`        • ${status}: ${count}`);
  }
  console.log(`    • Team 2 (Completed Review Team): ${allSeedItems2.length} items`);
  console.log(`      - Basic items: ${basicItems2.length}`);
  console.log(`      - Kit items: ${kitItems2.length} (${kitParentItems2.length} kits + ${kitChildItems2.length} children)`);
  console.log(`      - Status breakdown (all reviewed):`);
  for (const status of reviewedStatuses) {
    const count = allSeedItems2.filter(i => i.status === status).length;
    if (count > 0) console.log(`        • ${status}: ${count}`);
  }
  console.log(`  - 3 roles (Owner, Manager, Member)`);
}

// Initialize on load if in local dev mode
if (isLocalDev) {
  initializeStore();
}

/**
 * Mock DynamoDB operations for local dev
 */
export const mockDynamoDB = {
  get(params: { TableName: string; Key: { PK: string; SK: string } }) {
    const { PK, SK } = params.Key;
    const key = `${PK}#${SK}`;

    // Check all stores
    for (const store of Object.values(memoryStore)) {
      if (store.has(key)) {
        return { Item: store.get(key) };
      }
      // Also check by PK only for some queries
      if (store.has(PK)) {
        const item = store.get(PK);
        if (item.SK === SK) {
          return { Item: item };
        }
      }
    }

    // Direct key lookup
    if (PK.startsWith('USER#')) {
      const item = memoryStore.users.get(PK);
      if (item && item.SK === SK) return { Item: item };
    }
    if (PK.startsWith('TEAM#')) {
      const item = memoryStore.teams.get(PK);
      if (item && item.SK === SK) return { Item: item };
    }
    if (PK.startsWith('ROLE#')) {
      const item = memoryStore.roles.get(PK);
      if (item && item.SK === SK) return { Item: item };
    }

    return { Item: undefined };
  },

  put(params: { TableName: string; Item: any }) {
    const item = params.Item;
    const key = `${item.PK}#${item.SK}`;

    if (item.PK.startsWith('USER#')) {
      memoryStore.users.set(item.PK, item);
    } else if (item.PK.startsWith('TEAM#') && item.SK === 'METADATA') {
      memoryStore.teams.set(item.PK, item);
    } else if (item.PK.startsWith('TEAM#') && item.SK.startsWith('ITEM#')) {
      memoryStore.items.set(key, item);
    } else if (item.PK.startsWith('TEAM#') && item.SK.startsWith('MEMBER#')) {
      memoryStore.members.set(key, item);
    } else if (item.PK.startsWith('ROLE#')) {
      memoryStore.roles.set(item.PK, item);
    }

    return {};
  },

  query(params: {
    TableName: string;
    KeyConditionExpression?: string;
    ExpressionAttributeValues?: Record<string, any>;
    ExpressionAttributeNames?: Record<string, string>;
    IndexName?: string;
    Limit?: number;
  }) {
    const items: any[] = [];
    const pkValue = params.ExpressionAttributeValues?.[':pk'];
    const skValue = params.ExpressionAttributeValues?.[':sk'];
    const keyExpr = params.KeyConditionExpression || '';

    // Check for begins_with on SK
    const hasBeginsWithSk = keyExpr.includes('begins_with(SK');

    // Handle GSI queries first
    if (params.IndexName) {
      switch (params.IndexName) {
        case 'GSI_UserTeams':
          // Query memberships by user ID (GSI1PK = USER#xxx)
          const userIdForTeams = params.ExpressionAttributeValues?.[':uid'] || pkValue;
          for (const [, item] of memoryStore.members) {
            if (item.GSI1PK === userIdForTeams) {
              items.push(item);
            }
          }
          break;

        case 'GSI_WorkspaceByName':
          // Query teams by name
          const teamName = params.ExpressionAttributeValues?.[':n'];
          for (const [, item] of memoryStore.teams) {
            if (item.GSI_NAME === teamName) {
              items.push(item);
            }
          }
          break;

        case 'GSI_UsersByUsername':
          // Query users by username
          const username = params.ExpressionAttributeValues?.[':u'];
          for (const [, item] of memoryStore.users) {
            if (item.username === username) {
              items.push(item);
            }
          }
          break;

        case 'GSI_UsersByUid':
          // Query users by UID
          for (const [, item] of memoryStore.users) {
            if (item.GSI6PK === pkValue) {
              items.push(item);
            }
          }
          break;

        case 'GSI_RolesByName':
          // Query roles by name
          for (const [, item] of memoryStore.roles) {
            if (item.name === pkValue) {
              items.push(item);
            }
          }
          break;
      }

      const limit = params.Limit;
      if (limit && items.length > limit) {
        return { Items: items.slice(0, limit), Count: limit };
      }
      return { Items: items, Count: items.length };
    }

    // Primary key queries
    if (pkValue) {
      // Query items by team
      if (pkValue.startsWith('TEAM#')) {
        // If querying for items specifically
        if (hasBeginsWithSk && skValue === 'ITEM#') {
          for (const [, item] of memoryStore.items) {
            if (item.PK === pkValue && item.SK?.startsWith('ITEM#')) {
              items.push(item);
            }
          }
        } else if (hasBeginsWithSk && skValue === 'MEMBER#') {
          for (const [, item] of memoryStore.members) {
            if (item.PK === pkValue && item.SK?.startsWith('MEMBER#')) {
              items.push(item);
            }
          }
        } else {
          // Return all team data (no SK filter or just PK = :pk)
          for (const [, item] of memoryStore.items) {
            if (item.PK === pkValue) items.push(item);
          }
          for (const [, item] of memoryStore.members) {
            if (item.PK === pkValue) items.push(item);
          }
          const team = memoryStore.teams.get(pkValue);
          if (team) items.push(team);
        }
      }
      // Query by user
      if (pkValue.startsWith('USER#') || pkValue.startsWith('UID#')) {
        for (const [, item] of memoryStore.users) {
          if (item.PK === pkValue || item.GSI6PK === pkValue) items.push(item);
        }
      }
    }

    return { Items: items, Count: items.length };
  },

  delete(params: { TableName: string; Key: { PK: string; SK: string } }) {
    const { PK, SK } = params.Key;
    const key = `${PK}#${SK}`;

    memoryStore.items.delete(key);
    memoryStore.members.delete(key);
    memoryStore.teams.delete(PK);
    memoryStore.users.delete(PK);

    return {};
  },

  scan(params: { TableName: string; FilterExpression?: string; ExpressionAttributeValues?: Record<string, any> }) {
    const items: any[] = [];
    const filter = params.FilterExpression;
    const values = params.ExpressionAttributeValues;

    // Collect all items from all stores
    for (const store of Object.values(memoryStore)) {
      for (const [, item] of store) {
        items.push(item);
      }
    }

    // Apply filter if present
    if (filter && values) {
      // Handle: begins_with(PK, :pk) AND SK = :sk
      if (filter.includes('begins_with(PK') && filter.includes('SK =')) {
        const pkPrefix = values[':pk'];
        const skValue = values[':sk'];
        return {
          Items: items.filter(item => item.PK?.startsWith(pkPrefix) && item.SK === skValue),
          Count: items.filter(item => item.PK?.startsWith(pkPrefix) && item.SK === skValue).length,
        };
      }
      // Handle other common patterns as needed
    }

    return { Items: items, Count: items.length };
  },
};

if (isLocalDev) {
  console.log('');
  console.log('='.repeat(60));
  console.log('🔧 LOCAL DEV MODE ENABLED');
  console.log('   - Auth: Bypassed (mock user)');
  console.log('   - Database: In-memory store');
  console.log('   - S3: Mock responses');
  console.log('   - Sign in with any email/password (min 10 chars)');
  console.log('='.repeat(60));
  console.log('');
}

import { trpcFetch } from './utils';
import { me } from './auth';

const TRPC = '/trpc';

/** CREATE ITEM */
export async function createItem(
  teamId: string,
  name: string,
  actualName: string,
  imageBase64?: string,
  description?: string,
  parent?: string | null,
  isKit?: boolean,
  // Item-specific fields
  nsn?: string,
  serialNumber?: string,
  authQuantity?: number,
  ohQuantity?: number,
  // Kit-specific fields
  liin?: string,
  endItemNiin?: string,
) {
  const currentUser = await me();

  const body = {
    teamId,
    name,
    actualName,
    userId: currentUser.userId,
    status: 'To Review',
    imageBase64,
    description,
    parent,
    isKit: isKit || false,
    // Item fields
    nsn: nsn || '',
    serialNumber: serialNumber || '',
    authQuantity: authQuantity || 1,
    ohQuantity: ohQuantity || 1,
    // Kit fields
    liin: liin || '',
    endItemNiin: endItemNiin || '',
  };

  return (
    (await trpcFetch(`${TRPC}/createItem`, {
      method: 'POST',
      body: JSON.stringify(body),
    })) ?? {}
  );
}

/** GET ALL ITEMS */
export async function getItems(teamId: string) {
  const currentUser = await me();

  const data = await trpcFetch(
    `${TRPC}/getItems?input=${encodeURIComponent(
      JSON.stringify({ teamId, userId: currentUser.userId }),
    )}`,
    { method: 'GET' },
  );
  // console.log(data);
  return data ?? {};
}

/** GET SINGLE ITEM */
export async function getItem(teamId: string, itemId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(
      `${TRPC}/getItem?input=${encodeURIComponent(
        JSON.stringify({ teamId, itemId, userId: currentUser.userId }),
      )}`,
      { method: 'GET' },
    )) ?? {}
  );
}

/**
 * Helper function to find the closest parent kit and get its liin/endItemNiin
 * Recursively traverses up the parent chain until it finds a kit
 */
async function getKitInfoFromParent(
  teamId: string,
  parentId: string | null,
): Promise<{ liin?: string; endItemNiin?: string }> {
  if (!parentId) return {};

  try {
    const parentItem = await getItem(teamId, parentId);

    // If parent is a kit with liin and endItemNiin, return them
    if (parentItem.item?.isKit && parentItem.item?.liin && parentItem.item?.endItemNiin) {
      return {
        liin: parentItem.item.liin,
        endItemNiin: parentItem.item.endItemNiin,
      };
    }

    // If parent is an item (not a kit), recursively check its parent
    if (parentItem.item?.parent) {
      return getKitInfoFromParent(teamId, parentItem.item.parent);
    }

    return {};
  } catch (error) {
    console.error('Error fetching parent kit info:', error);
    return {};
  }
}

/** UPDATE ITEM */
export async function updateItem(
  teamId: string,
  itemId: string,
  updates: {
    name?: string;
    actualName?: string;
    description?: string;
    imageBase64?: string;
    status?: string;
    damageReports?: string[];
    parent?: string | null;
    notes?: string;
    isKit?: boolean;
    // Item-specific fields
    nsn?: string;
    serialNumber?: string;
    authQuantity?: number;
    ohQuantity?: number;
    // Kit-specific fields
    liin?: string;
    endItemNiin?: string;
  },
) {
  const currentUser = await me();

  // If this is an item (not a kit) and doesn't have liin/endItemNiin,
  // get them from the closest parent kit
  let finalUpdates = { ...updates };

  if (!updates.isKit && updates.parent && (!updates.liin || !updates.endItemNiin)) {
    const kitInfo = await getKitInfoFromParent(teamId, updates.parent);
    finalUpdates = {
      ...finalUpdates,
      liin: updates.liin || kitInfo.liin || '',
      endItemNiin: updates.endItemNiin || kitInfo.endItemNiin || '',
    };
  }

  const payload = {
    teamId,
    itemId,
    userId: currentUser.userId,
    ...finalUpdates,
  };

  return (
    (await trpcFetch(`${TRPC}/updateItem`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })) ?? {}
  );
}

/** DELETE ITEM */
export async function deleteItem(teamId: string, itemId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/deleteItem`, {
      method: 'POST',
      body: JSON.stringify({
        teamId,
        itemId,
        userId: currentUser.userId,
      }),
    })) ?? {}
  );
}

/** UPLOAD IMAGE */
export async function uploadImage(teamId: string, nsn: string, imageBase64: string) {
  interface UploadImageResponse {
    imageKey?: string;
  }

  const data: UploadImageResponse = await trpcFetch(`${TRPC}/uploadImage`, {
    method: 'POST',
    body: JSON.stringify({
      teamId,
      nsn,
      imageBase64,
    }),
  });

  return data?.imageKey ? { imageKey: data.imageKey } : (data ?? {});
}

/**
 * Templates API: CRUD operations for inventory templates.
 * Handles template creation, retrieval, item management, and deletion.
 */
import { trpcFetch } from './utils';
import { me } from './auth';

const TRPC = '/trpc';

/** GET ALL TEMPLATES */
export async function getTemplates() {
  const currentUser = await me();

  return (
    (await trpcFetch(
      `${TRPC}/getTemplates?input=${encodeURIComponent(
        JSON.stringify({ userId: currentUser.userId }),
      )}`,
      { method: 'GET' },
    )) ?? {}
  );
}

/** GET SINGLE TEMPLATE */
export async function getTemplate(templateId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(
      `${TRPC}/getTemplate?input=${encodeURIComponent(
        JSON.stringify({ templateId, userId: currentUser.userId }),
      )}`,
      { method: 'GET' },
    )) ?? {}
  );
}

/** GET TEMPLATE ITEMS */
export async function getTemplateItems(templateId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(
      `${TRPC}/getTemplateItems?input=${encodeURIComponent(
        JSON.stringify({ templateId, userId: currentUser.userId }),
      )}`,
      { method: 'GET' },
    )) ?? {}
  );
}

/** CREATE TEMPLATE */
export async function createTemplate(name: string, description?: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/createTemplate`, {
      method: 'POST',
      body: JSON.stringify({
        userId: currentUser.userId,
        name,
        description: description ?? null,
      }),
    })) ?? {}
  );
}

/** ADD ITEM TO TEMPLATE */
export async function addItemToTemplate(
  templateId: string,
  item: {
    name: string;
    actualName?: string;
    description?: string;
    isKit?: boolean;
    parent?: string | null;
    nsn?: string;
    liin?: string;
    endItemNiin?: string;
  },
) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/addItemToTemplate`, {
      method: 'POST',
      body: JSON.stringify({
        templateId,
        userId: currentUser.userId,
        ...item,
      }),
    })) ?? {}
  );
}

/** REMOVE ITEM FROM TEMPLATE */
export async function removeItemFromTemplate(templateId: string, templateItemId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/removeItemFromTemplate`, {
      method: 'POST',
      body: JSON.stringify({
        templateId,
        templateItemId,
        userId: currentUser.userId,
      }),
    })) ?? {}
  );
}

/** CREATE TEMPLATE ITEM (brand-new, not sourced from a team) */
export async function createTemplateItem(
  templateId: string,
  item: {
    name: string;
    actualName?: string;
    description?: string;
    isKit?: boolean;
    parent?: string | null;
    nsn?: string;
    liin?: string;
    endItemNiin?: string;
  },
) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/createTemplateItem`, {
      method: 'POST',
      body: JSON.stringify({
        templateId,
        userId: currentUser.userId,
        ...item,
      }),
    })) ?? {}
  );
}

/** DELETE TEMPLATE */
export async function deleteTemplate(templateId: string) {
  const currentUser = await me();

  return (
    (await trpcFetch(`${TRPC}/deleteTemplate`, {
      method: 'POST',
      body: JSON.stringify({
        templateId,
        userId: currentUser.userId,
      }),
    })) ?? {}
  );
}

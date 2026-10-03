import { sql } from 'drizzle-orm';
import type { db } from '@/db';

/** Keep IDs and move the whole ownership graph in one statement. Composite
 * foreign keys see the final owners at the end of this statement, so no
 * intermediate contact/thread/offer ownership is exposed or left invalid. */
export async function transferGuestCrm(tx: Pick<typeof db, 'execute'>, guestId: string, userId: string) {
  await tx.execute(sql`
    with memberships as (
      insert into user_company ("userId", "companyId", "isFavorite", "createdAt")
      select ${userId}::uuid, "companyId", "isFavorite", "createdAt"
      from user_company where "userId" = ${guestId}::uuid
      on conflict ("userId", "companyId") do update
      set "isFavorite" = user_company."isFavorite" or excluded."isFavorite"
      returning "companyId"
    ), offers as (
      update job_offer set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), contacts as (
      update person set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), avatars as (
      update person_avatar set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning "personId"
    ), company_links as (
      update person_company set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning "personId"
    ), offer_links as (
      update person_offer set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning "personId"
    ), threads as (
      update person_thread set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), imports as (
      update person_import set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), messages as (
      update person_message set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), advice as (
      update person_ai_result set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), notes as (
      update company_note set "userId" = ${userId}::uuid where "userId" = ${guestId}::uuid returning id
    ), views as (
      update application_view as source set
        "userId" = ${userId}::uuid,
        name = case when exists (
          select 1 from application_view as destination where destination."userId" = ${userId}::uuid
          and destination.entity = source.entity and destination.name = source.name
        ) then left(source.name, 40) || ' (try ' || left(source.id::text, 8) || ')' else source.name end,
        "isDefault" = source."isDefault" and not exists (
          select 1 from application_view as destination where destination."userId" = ${userId}::uuid
          and destination.entity = source.entity and destination."isDefault"
        )
      where source."userId" = ${guestId}::uuid returning id
    ), jobs as (
      update ai_job set "userId" = ${userId}::uuid,
        "initiatedByUserId" = case when "initiatedByUserId" = ${guestId}::uuid then ${userId}::uuid else "initiatedByUserId" end
      where "userId" = ${guestId}::uuid returning id
    )
    select count(*) from contacts
  `);
}

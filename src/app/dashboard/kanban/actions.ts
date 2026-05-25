"use server";

import { db } from "@/db";
import { jobOffers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function updateJobOfferStatus(offerId: string, newStatus: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        status: newStatus,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer status:", error);
    return { error: error.message || "Failed to update status" };
  }
}

export async function updateJobOfferCv(offerId: string, cvId: string | null) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        cvId: cvId || null,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer CV:", error);
    return { error: error.message || "Failed to link CV" };
  }
}

export async function deleteJobOffer(offerId: string) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db.delete(jobOffers).where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting offer:", error);
    return { error: error.message || "Failed to delete offer" };
  }
}

export async function createJobOffer(offerData: {
  title: string;
  company: string;
  url?: string;
  platform: string;
  description?: string;
}) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    await db.insert(jobOffers).values({
      userId: session.user.id,
      title: offerData.title,
      company: offerData.company,
      url: offerData.url || null,
      platform: offerData.platform || "other",
      description: offerData.description || null,
      status: "interested"
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating manual job offer:", error);
    return { error: error.message || "Failed to create manual offer" };
  }
}

export async function updateJobOfferDetails(
  offerId: string,
  offerData: {
    title: string;
    company: string;
    url?: string | null;
    platform: string;
    description?: string | null;
  }
) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      throw new Error("Unauthorized");
    }

    const [offer] = await db
      .select()
      .from(jobOffers)
      .where(eq(jobOffers.id, offerId))
      .limit(1);

    if (!offer || offer.userId !== session.user.id) {
      throw new Error("Forbidden or Offer not found");
    }

    await db
      .update(jobOffers)
      .set({
        title: offerData.title,
        company: offerData.company,
        url: offerData.url || null,
        platform: offerData.platform || "other",
        description: offerData.description || null,
        updatedAt: new Date()
      })
      .where(eq(jobOffers.id, offerId));

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating offer details:", error);
    return { error: error.message || "Failed to update offer details" };
  }
}

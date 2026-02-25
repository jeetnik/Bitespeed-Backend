import { prisma } from "../db";
import { LinkPrecedence, Contact } from "../generated/prisma/client";

// response shape for the /identify endpoint
interface IdentifyResponse {
    contact: {
        primaryContatctId: number;
        emails: string[];
        phoneNumbers: string[];
        secondaryContactIds: number[];
    };
}

// main function — figures out who the customer is based on email/phone
// and links everything together
export async function identifyContact(
    email: string | null,
    phoneNumber: string | null
): Promise<IdentifyResponse> {
    // grab all contacts that match the given email or phone
    const conditions: any[] = [];
    if (email) conditions.push({ email });
    if (phoneNumber) conditions.push({ phoneNumber });

    const matchedContacts = await prisma.contact.findMany({
        where: { OR: conditions },
    });

    // nothing found? this is a brand new customer
    if (matchedContacts.length === 0) {
        const newContact = await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkPrecedence: LinkPrecedence.primary,
            },
        });
        return buildResponse(newContact, []);
    }

    // figure out which primary contact(s) these matches belong to
    const primaryIds = new Set<number>();
    const primaryMap = new Map<number, Contact>();

    for (const contact of matchedContacts) {
        let rootId: number;
        if (
            contact.linkPrecedence === LinkPrecedence.primary
        ) {
            rootId = contact.id;
            primaryMap.set(rootId, contact);
        } else {
            rootId = contact.linkedId!;
            if (!primaryMap.has(rootId)) {
                const primary = await prisma.contact.findUnique({
                    where: { id: rootId },
                });
                if (primary) primaryMap.set(rootId, primary);
            }
        }
        primaryIds.add(rootId);
    }

    // if matches point to different primaries, we need to merge them
    if (primaryIds.size > 1) {
        const sortedPrimaries = Array.from(primaryIds)
            .map((id) => primaryMap.get(id)!)
            .sort(
                (a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );

        const olderPrimary = sortedPrimaries[0];
        const newerPrimary = sortedPrimaries[1];

        // the older one wins — demote the newer primary to secondary
        await prisma.contact.update({
            where: { id: newerPrimary.id },
            data: {
                linkedId: olderPrimary.id,
                linkPrecedence: LinkPrecedence.secondary,
            },
        });

        // move all the demoted primary's secondaries over to the older one
        await prisma.contact.updateMany({
            where: { linkedId: newerPrimary.id },
            data: { linkedId: olderPrimary.id },
        });

        // check if the request has any info we haven't seen before
        const allContacts = await prisma.contact.findMany({
            where: {
                OR: [{ id: olderPrimary.id }, { linkedId: olderPrimary.id }],
            },
            orderBy: { createdAt: "asc" },
        });

        const shouldCreateSecondary = needsNewSecondary(
            allContacts,
            email,
            phoneNumber
        );

        if (shouldCreateSecondary) {
            await prisma.contact.create({
                data: {
                    email,
                    phoneNumber,
                    linkedId: olderPrimary.id,
                    linkPrecedence: LinkPrecedence.secondary,
                },
            });
        }

        // fetch everything again so the response is up to date
        const finalContacts = await prisma.contact.findMany({
            where: {
                OR: [{ id: olderPrimary.id }, { linkedId: olderPrimary.id }],
            },
            orderBy: { createdAt: "asc" },
        });

        const primary = finalContacts.find(
            (c) => c.linkPrecedence === LinkPrecedence.primary
        )!;
        const secondaries = finalContacts.filter(
            (c) => c.linkPrecedence === LinkPrecedence.secondary
        );
        return buildResponse(primary, secondaries);
    }

    // all matches belong to one primary — simpler case
    const primaryId = Array.from(primaryIds)[0];
    const primary = primaryMap.get(primaryId)!;

    // pull all contacts in this group
    let allContacts = await prisma.contact.findMany({
        where: {
            OR: [{ id: primaryId }, { linkedId: primaryId }],
        },
        orderBy: { createdAt: "asc" },
    });

    // does this request have new info we should save?
    const shouldCreateSecondary = needsNewSecondary(
        allContacts,
        email,
        phoneNumber
    );

    if (shouldCreateSecondary) {
        await prisma.contact.create({
            data: {
                email,
                phoneNumber,
                linkedId: primaryId,
                linkPrecedence: LinkPrecedence.secondary,
            },
        });

        // refresh the list after adding the new contact
        allContacts = await prisma.contact.findMany({
            where: {
                OR: [{ id: primaryId }, { linkedId: primaryId }],
            },
            orderBy: { createdAt: "asc" },
        });
    }

    const secondaries = allContacts.filter(
        (c) => c.linkPrecedence === LinkPrecedence.secondary
    );
    return buildResponse(primary, secondaries);
}

// checks if the incoming email/phone combo has something new
// that isn't already stored in the contact group
function needsNewSecondary(
    contacts: Contact[],
    email: string | null,
    phoneNumber: string | null
): boolean {
    if (!email && !phoneNumber) return false;

    const existingEmails = new Set(
        contacts.map((c) => c.email).filter(Boolean)
    );
    const existingPhones = new Set(
        contacts.map((c) => c.phoneNumber).filter(Boolean)
    );

    const emailIsNew = email && !existingEmails.has(email);
    const phoneIsNew = phoneNumber && !existingPhones.has(phoneNumber);

    // only worth creating a new row if both fields are given
    // and at least one of them is something we don't already have
    if (email && phoneNumber) {
        return emailIsNew || phoneIsNew ? true : false;
    }
    return false;
}

// puts together the final response — primary contact info first, then secondaries
function buildResponse(
    primary: Contact,
    secondaries: Contact[]
): IdentifyResponse {
    const emails: string[] = [];
    const phoneNumbers: string[] = [];

    // primary contact's info goes first
    if (primary.email) emails.push(primary.email);
    if (primary.phoneNumber) phoneNumbers.push(primary.phoneNumber);

    // then add any new info from secondaries (skip duplicates)
    for (const sec of secondaries) {
        if (sec.email && !emails.includes(sec.email)) {
            emails.push(sec.email);
        }
        if (sec.phoneNumber && !phoneNumbers.includes(sec.phoneNumber)) {
            phoneNumbers.push(sec.phoneNumber);
        }
    }

    return {
        contact: {
            primaryContatctId: primary.id,
            emails,
            phoneNumbers,
            secondaryContactIds: secondaries.map((s) => s.id),
        },
    };
}

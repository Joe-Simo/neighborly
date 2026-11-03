/** Grace Fellowship is a fictional church. Its address, phone (555) and email (.example) are fictional too. */
export const SAMPLE_CHURCH = { name: "Grace Fellowship", city: "Fort Myers, FL", zip: "33919" };

export const DISCLOSURE = "This message was translated with AI help and checked by a volunteer from our church.";

export type Sample = { id: string; label: string; title: string; body: string };

export const SAMPLES: Sample[] = [
  {
    id: "sunday",
    label: "Sunday visit and kids check-in",
    title: "Join us this Sunday",
    body: `Everyone is welcome at Grace Fellowship this Sunday, November 15. Our worship service starts at 10:30 AM at 250 Grace Lane.

Kids check-in opens at 10:15 AM in the Family Room. Bring your child to the front desk and we will give you a matching name tag.

Free parking is behind the building. Questions? Call (239) 555-0142 or email hello@gracefellowship.example.`,
  },
  {
    id: "meal",
    label: "Community Thanksgiving meal",
    title: "Free community Thanksgiving meal",
    body: `On Thursday, November 26, Grace Fellowship will serve a free Thanksgiving meal from 12:00 PM to 2:00 PM. Everyone in the neighborhood is invited, and no one will be asked to sign anything.

Our food pantry is open every Tuesday from 4 PM to 6 PM. Each family can take one box of groceries, about 20 pounds.

We need 15 volunteers to help serve. Sign up at gracefellowship.example/meal.`,
  },
  {
    id: "groups",
    label: "English class and small groups",
    title: "English class and small groups",
    body: `Free English conversation class every Wednesday at 6:30 PM. Classes are for adults at every level, and childcare is provided.

Small groups meet in homes on Friday at 7 PM. A small group is a place to share a meal, read the Bible together and pray for one another.

Communion is offered at every Sunday worship service. If you have questions about it, a pastor is happy to talk with you after the service.`,
  },
];

/** Title first, then one block per paragraph, then the AI disclosure line, which is translated and reviewed like the rest. */
export function toBlocks(title: string, body: string): string[] {
  const paras = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [title.trim(), ...paras, DISCLOSURE].filter(Boolean);
}

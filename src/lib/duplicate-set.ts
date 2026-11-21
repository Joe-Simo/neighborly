/**
 * Made-up pairs of household records, to measure the question that reads two records' notes against the live model.
 * Nobody here is real. Only what the model is sent is written: the notes, as they would arrive with names and streets
 * already taken out, and how many adults and children live there. `same` was written from the two notes alone, before
 * any run. Pairs marked `heldOut` must never be used to set the line or a wording: their marks are the honest figure.
 */
export interface DuplicateSide { notes: string; adults: number; children: number }
interface DuplicatePair { id: string; a: DuplicateSide; b: DuplicateSide; same: boolean; heldOut?: true }

export const duplicateSet: DuplicatePair[] = [
  { id: "same-power", same: true,
    a: { notes: "Mother of two, works nights at the hospital laundry. Behind on the power bill.", adults: 1, children: 2 },
    b: { notes: "Single mom, two kids, night shift at the hospital. Power bill past due, $180.", adults: 1, children: 2 } },
  { id: "same-elder", same: true,
    a: { notes: "Lives alone, 82, uses a walker. Needs groceries brought.", adults: 1, children: 0 },
    b: { notes: "Elderly, lives by herself, walker. Asked again for food delivery.", adults: 1, children: 0 } },
  { id: "diff-family", same: false,
    a: { notes: "Couple with three children, husband lost his job at the plant.", adults: 2, children: 3 },
    b: { notes: "Retired man living alone, needs help with his water bill.", adults: 1, children: 0 } },
  { id: "diff-same-building", same: false,
    a: { notes: "Grandmother raising one grandchild. Rent help in March.", adults: 1, children: 1 },
    b: { notes: "Young couple, new baby on the way, both work at the restaurant.", adults: 2, children: 0 } },
  { id: "es-same", same: true,
    a: { notes: "Madre con tres hijos. Trabaja limpiando oficinas. Debe la luz.", adults: 1, children: 3 },
    b: { notes: "Mamá sola, tres niños, limpia oficinas de noche. Pide ayuda con la luz.", adults: 1, children: 3 } },
  { id: "es-diff", same: false,
    a: { notes: "Señor mayor que vive solo. Necesita medicinas.", adults: 1, children: 0 },
    b: { notes: "Familia de cinco, el padre trabaja en construcción. Atrasados con la renta.", adults: 2, children: 3 } },
  { id: "same-moved", same: true,
    a: { notes: "Veteran, diabetic, lives with his adult daughter. Insulin costs.", adults: 2, children: 0 },
    b: { notes: "Veteran with diabetes; his grown daughter lives with him. Moved last month.", adults: 2, children: 0 } },
  { id: "diff-shared-phone", same: false,
    a: { notes: "Uses her sister's phone. Three kids, rent is short.", adults: 1, children: 3 },
    b: { notes: "Sister of another client, lives alone, needs a winter coat.", adults: 1, children: 0 } },
  { id: "empty-notes", same: false,
    a: { notes: "", adults: 1, children: 0 },
    b: { notes: "", adults: 1, children: 0 } },
  { id: "same-short", same: true,
    a: { notes: "Disabled, wheelchair. Gas bill.", adults: 1, children: 0 },
    b: { notes: "In a wheelchair, on disability. Gas shut-off notice.", adults: 1, children: 0 } },
  { id: "ho-same-kids", same: true, heldOut: true,
    a: { notes: "Father with two boys, drives for a delivery company. Rent short this month.", adults: 1, children: 2 },
    b: { notes: "Dad raising two sons alone, delivery driver. Asked about rent again.", adults: 1, children: 2 } },
  { id: "ho-diff-ages", same: false, heldOut: true,
    a: { notes: "College student, lives with roommates, needs food.", adults: 3, children: 0 },
    b: { notes: "Widow, 75, on oxygen. Electric bill.", adults: 1, children: 0 } },
  { id: "ho-es-same", same: true, heldOut: true,
    a: { notes: "Abuela cuida a dos nietos. Pide comida.", adults: 1, children: 2 },
    b: { notes: "Abuela con dos nietos a su cargo. Necesita despensa.", adults: 1, children: 2 } },
  { id: "ho-es-diff", same: false, heldOut: true,
    a: { notes: "Pareja joven con un bebé. Necesitan pañales.", adults: 2, children: 1 },
    b: { notes: "Hombre que vive solo, perdió su trabajo. Debe el agua.", adults: 1, children: 0 } },
  { id: "ho-same-household-split", same: false, heldOut: true,
    a: { notes: "Mother and her adult son share the home; she asked for help with rent.", adults: 2, children: 0 },
    b: { notes: "Her son moved out last year and lives on his own now; asking for a bus pass.", adults: 1, children: 0 } },
];

/** A callback still owed two days after the call was taken is late. One rule for the home's glance and the Help line's late view. */
const LATE_CALLBACK_MS = 2 * 86_400_000;
export const isLateCallback = (takenAt: number, at: number) => at - takenAt >= LATE_CALLBACK_MS;
/** A call kept only for the year's count, after its neighbor's record was removed: it has no name and no phone, and nobody returns it. */
export const keptForCount = (call: { callerName: string; phone: string }) => !call.callerName && !call.phone;

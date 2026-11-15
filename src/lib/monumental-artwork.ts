/** Delivery contract for the sculpted relief, independent of the approved live artwork. */
export type MonumentalArtwork = {
  model: string;
  mobileModel?: string;
  poster: string;
  mobilePoster?: string;
  neutralPitchDegrees?: number;
  mobileCamera?: { target: readonly [number, number, number]; height: number };
  description: string;
  margin: number;
  yawDegrees: number;
  pitchDegrees: number;
};

export const monumentalArtwork: MonumentalArtwork = {
  model: "/assets/monumental-relief.glb",
  mobileModel: "/assets/monumental-relief-mobile.glb",
  mobilePoster: "/assets/monumental-relief-mobile.webp",
  poster: "/assets/monumental-relief.webp",
  description: "The Kind Helps community, sculpted as a warm painted relief.",
  margin: 1.08,
  neutralPitchDegrees: 4.2,
  mobileCamera: { target: [0, 1.2, 0], height: 8.2 },
  yawDegrees: 3,
  pitchDegrees: 1.5,
};

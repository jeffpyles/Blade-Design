/* Seed data: the AEB-L vs vintage Stanley run from the project brief.
 * Loaded on first visit (or via Data → "Reset to seed data").
 * Readings are grams of force to cut monofilament; strokes are cumulative. */
window.BLADE_SEED = {
  version: 1,
  irons: [
    {
      id: "iron-aebl",
      name: "AEB-L iron",
      steel: "AEB-L",
      hrc: 64,
      hrcVerified: true,
      charpy: 11.8,
      charpySource: "Estimate from Larrin Thomas / Knife Steel Nerds toughness tables",
      notes: "Heat treated to ~64 HRc, verified on a calibrated tester."
    },
    {
      id: "iron-stanley",
      name: "Vintage Stanley iron",
      steel: "Unknown (presumably ~1095-like)",
      hrc: null,
      hrcVerified: false,
      charpy: null,
      charpySource: "",
      notes: "Steel and hardness unknown."
    }
  ],
  // Reference steels for the Pareto chart (hardness vs toughness).
  // Add more from Larrin's tables; keep the source for each value.
  steels: [
    { id: "steel-aebl-64", name: "AEB-L", hrc: 64, charpy: 11.8, source: "Knife Steel Nerds tables (as quoted in the brief)" }
  ],
  references: [
    { id: "ref-razor", name: "Razor blade", readings: [676, 620, 750], notes: "Sharpness reference" }
  ],
  runs: [
    makeSeedRun("run-aebl-20", "iron-aebl", [
      [0, 330, 387, 400], [20, 450, 471, 491], [40, 460, 419, 490], [60, 444, 472, 469],
      [80, 540, 590, 660], [100, 601, 547, 645], [130, 568, 460, 490], [160, 485, 440, 500],
      [200, 465, 494, 490], [250, 430, 445, 459]
    ], "Bump at 80–100 strokes (~600 g) then back to ~470 g. Possible burr breaking off, a micro-chip leaving a fresh apex, or testing at a different spot; force readings alone can't tell which. Started sharper than the razor reference."),
    makeSeedRun("run-stanley-20", "iron-stanley", [
      [0, 695, 623, 700], [20, 823, 806, 829], [40, 982, 1062, 1060], [60, 1060, 1154, 975],
      [80, 894, 929, 909], [100, 868, 899, 1010], [130, 1194, 1014, 1036], [160, 1066, 1061, 1254],
      [200, 876, 1040, 1080], [250, 970, 945, 1019]
    ], "Plateaus near ~1000 g (about +50% over the starting sharpness).")
  ]
};

function makeSeedRun(id, ironId, rows, notes) {
  return {
    id: id,
    ironId: ironId,
    label: "",
    date: "",
    bedAngle: 45,
    bevelAngle: 20,
    microbevelAngle: null,
    wood: "",
    useCase: "",
    shavingIn: 0.006,
    strokeLengthIn: null,
    media: "Monofilament",
    outcome: "plateau-uninspected",
    notes: notes,
    checkpoints: rows.map(function (r) {
      return {
        strokes: r[0],
        feet: null,
        readings: [r[1], r[2], r[3]],
        media: "",
        failureMode: "",
        chipCount: null,
        chipMaxUm: null,
        microscopeNotes: "",
        photos: []
      };
    })
  };
}

import { describe, expect, it } from "vitest";
import {
  GUIDE_BOQ_ACTIONS,
  getGuideBoqAction,
  getGuideStageHref,
  getProjectBoqHref,
  isSupportedGuideHref,
  parseGuideBoqAction,
  type GuideBoqAction,
} from "../src/lib/guidance/guide-navigation";
import { GUIDE_STAGE_IDS, type GuideStageId } from "../src/lib/guidance/guide-registry";

const PROJECT_ID = "dubai-tower";
const PROJECT_BOQ_HREF = `/projects/${PROJECT_ID}/boq`;

const EXPECTED_GUIDE_BOQ_ACTIONS = [
  "review_dimensions",
  "review_calculations",
  "view_boq",
] as const satisfies readonly GuideBoqAction[];

const MUTATION_CAPABLE_BOQ_ACTIONS = [
  "create-initial",
  "new-revision",
  "import-reviewed",
  "open_boq",
  "lock_boq",
] as const;

describe("Guide actionability v3 BOQ action contract", () => {
  it("exports only the three non-mutating Guide BOQ actions", () => {
    expect(GUIDE_BOQ_ACTIONS).toEqual(EXPECTED_GUIDE_BOQ_ACTIONS);

    for (const mutationAction of MUTATION_CAPABLE_BOQ_ACTIONS) {
      expect(GUIDE_BOQ_ACTIONS).not.toContain(mutationAction);
    }
  });

  it.each(EXPECTED_GUIDE_BOQ_ACTIONS)(
    "recognizes the exact Guide-safe action %s",
    (action) => {
      expect(getGuideBoqAction(action)).toBe(action);
    },
  );

  it.each([
    null,
    undefined,
    "",
    " ",
    "review_dimensions ",
    " review_dimensions",
    "REVIEW_DIMENSIONS",
    "review-dimensions",
    "unknown",
    0,
    false,
    ["review_dimensions"],
    { action: "review_dimensions" },
    ...MUTATION_CAPABLE_BOQ_ACTIONS,
  ])("rejects a non-exact or unsafe action value: %j", (value) => {
    expect(getGuideBoqAction(value)).toBeNull();
  });

  it("builds a bare BOQ destination unless a Guide-safe action is explicit", () => {
    expect(getProjectBoqHref(PROJECT_ID)).toBe(PROJECT_BOQ_HREF);
    expect(getProjectBoqHref(PROJECT_ID, undefined)).toBe(PROJECT_BOQ_HREF);

    for (const action of EXPECTED_GUIDE_BOQ_ACTIONS) {
      expect(getProjectBoqHref(PROJECT_ID, action)).toBe(
        `${PROJECT_BOQ_HREF}?action=${action}`,
      );
    }

    expect(getProjectBoqHref(" Dubai Tower / 01 ", "view_boq")).toBe(
      "/projects/Dubai%20Tower%20%2F%2001/boq?action=view_boq",
    );
  });

  it("parses one exact Guide-safe action and nothing else", () => {
    for (const action of EXPECTED_GUIDE_BOQ_ACTIONS) {
      expect(parseGuideBoqAction(new URLSearchParams({ action }))).toBe(action);
    }

    expect(parseGuideBoqAction(new URLSearchParams())).toBeNull();
    expect(parseGuideBoqAction(new URLSearchParams("action=unknown"))).toBeNull();
    expect(parseGuideBoqAction(new URLSearchParams("action=review_dimensions%20"))).toBeNull();
    expect(parseGuideBoqAction(new URLSearchParams("Action=review_dimensions"))).toBeNull();
    expect(parseGuideBoqAction(new URLSearchParams("action[]=review_dimensions"))).toBeNull();
  });

  it("rejects duplicate actions and unrelated query state in the parser", () => {
    expect(
      parseGuideBoqAction(
        new URLSearchParams("action=review_dimensions&action=review_dimensions"),
      ),
    ).toBeNull();
    expect(
      parseGuideBoqAction(
        new URLSearchParams("action=review_dimensions&action=review_calculations"),
      ),
    ).toBeNull();
    expect(
      parseGuideBoqAction(new URLSearchParams("action=review_dimensions&tab=reviewed")),
    ).toBeNull();
    expect(
      parseGuideBoqAction(new URLSearchParams("tab=reviewed&action=review_dimensions")),
    ).toBeNull();
  });

  it("never parses existing mutation-capable BOQ action IDs as Guide actions", () => {
    for (const action of MUTATION_CAPABLE_BOQ_ACTIONS) {
      expect(parseGuideBoqAction(new URLSearchParams({ action }))).toBeNull();
    }
  });
});

describe("Guide actionability v3 route map", () => {
  it("maps every Guide stage to the exact supported project destination", () => {
    const expectedRoutes = {
      PROJECT_SETUP: `/projects/${PROJECT_ID}`,
      SOURCES: `/projects/${PROJECT_ID}/files`,
      EXTRACTION: `/projects/${PROJECT_ID}/extractions`,
      DIMENSIONS: `${PROJECT_BOQ_HREF}?action=review_dimensions`,
      CALCULATIONS: `${PROJECT_BOQ_HREF}?action=review_calculations`,
      BOQ: `${PROJECT_BOQ_HREF}?action=view_boq`,
      REVIEW: `/projects/${PROJECT_ID}/extractions`,
      VALIDATION: `/projects/${PROJECT_ID}/verification`,
      OUTPUT: `/projects/${PROJECT_ID}/documents`,
    } satisfies Record<GuideStageId, string>;

    expect(
      Object.fromEntries(
        GUIDE_STAGE_IDS.map((stageId) => [
          stageId,
          getGuideStageHref(stageId, PROJECT_ID),
        ]),
      ),
    ).toEqual(expectedRoutes);

    for (const href of Object.values(expectedRoutes)) {
      expect(isSupportedGuideHref(href)).toBe(true);
    }
  });

  it("continues to support the bare BOQ route", () => {
    expect(isSupportedGuideHref(PROJECT_BOQ_HREF)).toBe(true);
  });

  it.each(EXPECTED_GUIDE_BOQ_ACTIONS)(
    "supports the exact single BOQ Guide action %s",
    (action) => {
      expect(isSupportedGuideHref(`${PROJECT_BOQ_HREF}?action=${action}`)).toBe(true);
    },
  );

  it.each([
    `${PROJECT_BOQ_HREF}?action=`,
    `${PROJECT_BOQ_HREF}?action`,
    `${PROJECT_BOQ_HREF}?action=unknown`,
    `${PROJECT_BOQ_HREF}?action=REVIEW_DIMENSIONS`,
    `${PROJECT_BOQ_HREF}?action=%20review_dimensions`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions%20`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions%00`,
    `${PROJECT_BOQ_HREF}?action[]=review_dimensions`,
    `${PROJECT_BOQ_HREF}?Action=review_dimensions`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions&action=review_dimensions`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions&action=review_calculations`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions&tab=reviewed`,
    `${PROJECT_BOQ_HREF}?tab=reviewed&action=review_dimensions`,
    `${PROJECT_BOQ_HREF}#action=review_dimensions`,
    ` ${PROJECT_BOQ_HREF}?action=review_dimensions`,
    `${PROJECT_BOQ_HREF}?action=review_dimensions `,
    `https://quantara.example${PROJECT_BOQ_HREF}?action=review_dimensions`,
    `//quantara.example${PROJECT_BOQ_HREF}?action=review_dimensions`,
  ])("rejects malformed or unsupported Guide BOQ URL %s", (href) => {
    expect(isSupportedGuideHref(href)).toBe(false);
  });

  it("rejects every mutation-capable BOQ query action", () => {
    for (const action of MUTATION_CAPABLE_BOQ_ACTIONS) {
      expect(isSupportedGuideHref(`${PROJECT_BOQ_HREF}?action=${action}`)).toBe(false);
    }
  });

  it("does not admit query parameters on non-BOQ Guide destinations", () => {
    expect(isSupportedGuideHref(`/projects/${PROJECT_ID}?action=view_boq`)).toBe(false);
    expect(isSupportedGuideHref(`/projects/${PROJECT_ID}/extractions?action=view_boq`)).toBe(false);
    expect(isSupportedGuideHref(`/projects/${PROJECT_ID}/verification?action=view_boq`)).toBe(false);
    expect(isSupportedGuideHref(`/projects/${PROJECT_ID}/documents?action=view_boq`)).toBe(false);
  });
});

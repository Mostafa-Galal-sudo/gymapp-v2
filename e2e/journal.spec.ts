import { test, expect } from "@playwright/test";
test.describe.configure({ timeout: 120_000 });
test.beforeEach(async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    // Isolated browser profile. Import the real data services through Vite for deterministic fixtures.
    const module = await import(/* @vite-ignore */ "/src/db/db.ts");
    const db = module.default;
    await db.users.put({
      id: "default_user",
      profile: {
        name: "Journal Test",
        age: 30,
        weight: 80,
        height: 180,
        gender: "male",
        level: "Beginner",
        goals: ["maintain"],
      },
      supplements: [],
      weightHistory: [],
    });
    await db.preferences.bulkPut([
      {
        id: "omnibody-lang",
        value: JSON.stringify({
          state: { lang: "en", hasSelectedLanguage: true },
          version: 0,
        }),
      },
      {
        id: "omnibody-onboarding",
        value: JSON.stringify({
          state: { hasSeenWalkthrough: true },
          version: 0,
        }),
      },
    ]);
    localStorage.setItem("omni_active_user", "default_user");
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Log the work." }),
  ).toBeVisible();
});
test("mobile routes, check-in persistence, insights drilldown and RTL", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/measurements");
  await page.getByRole("button", { name: "＋ Weekly check-in" }).click();
  await page
    .getByRole("spinbutton", { name: "Weight", exact: true })
    .fill("80");
  await page
    .getByRole("spinbutton", { name: "Left upper arm", exact: true })
    .fill("32");
  await page
    .getByRole("spinbutton", { name: "Right upper arm", exact: true })
    .fill("33");
  await page.getByRole("button", { name: "Save & compare" }).click();
  await expect(
    page.getByRole("heading", { name: "Left / right balance" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.getByText("3 measurements")).toBeVisible();
  await page.screenshot({
    path: "test-results/measurements-mobile.png",
    fullPage: true,
  });
  await page.goto("/insights");
  await expect(
    page.getByRole("heading", { name: "Activity map" }),
  ).toBeVisible();
  await page.locator(".heat-cell").last().click();
  await expect(
    page.getByRole("heading", { name: "Weight & measurements" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.screenshot({
    path: "test-results/insights-mobile.png",
    fullPage: true,
  });
  for (const route of [
    "/workout",
    "/nutrition",
    "/calendar",
    "/progress",
    "/profile",
    "/daily-detail",
  ]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main")).not.toBeEmpty();
    if (route === "/workout" || route === "/nutrition") {
      await page.screenshot({
        path: `test-results/${route.slice(1)}-mobile.png`,
        fullPage: true,
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBeTruthy();
  }
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Log the work." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/today-mobile.png",
    fullPage: true,
  });
  await page.evaluate(async () => {
    const { useLanguageStore } = await import(
      /* @vite-ignore */ "/src/store/useLanguageStore.ts"
    );
    useLanguageStore.getState().selectLanguage("ar");
  });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/measurements");
  await expect(
    page.getByRole("heading", { name: "قياسات الجسم" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/measurements-rtl-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("custom food can be logged twice, one occurrence removed, and restored offline", async ({
  page,
  context,
}) => {
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "Custom food", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Local lentils");
  await page
    .getByRole("spinbutton", { name: "calories (kcal)", exact: true })
    .fill("120");
  await page
    .getByRole("spinbutton", { name: "protein (g)", exact: true })
    .fill("9");
  await page.getByRole("button", { name: "Save food" }).click();
  for (let i = 0; i < 2; i++) {
    await page
      .getByRole("button")
      .filter({ hasText: "Local lentils" })
      .first()
      .click();
    await page.getByRole("button", { name: "Add to meal" }).click();
  }
  expect(await page.getByRole("button", { name: "Remove entry" }).count()).toBe(
    2,
  );
  await page.getByRole("button", { name: "Remove entry" }).first().click();
  expect(await page.getByRole("button", { name: "Remove entry" }).count()).toBe(
    1,
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove entry" })).toHaveCount(
    1,
  );
  await context.setOffline(true);
  await page
    .getByRole("searchbox", { name: "Search food" })
    .fill("Local lentils");
  await expect(
    page.getByRole("button").filter({ hasText: "Local lentils" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Offline" }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("workout autosave survives page reload and finish leaves tomorrow untouched", async ({
  page,
}) => {
  await page.evaluate(async () => {
    const { useWorkoutStore, flushWorkoutWrites } = await import(
      /* @vite-ignore */ "/src/store/useWorkoutStore.ts"
    );
    const { format, addDays } = await import(
      /* @vite-ignore */ "/node_modules/.vite/deps/date-fns.js"
    );
    const store = useWorkoutStore.getState();
    store.scheduleSession(format(new Date(), "yyyy-MM-dd"), "Scheduled today", [
      "bench_press",
    ]);
    store.scheduleSession(
      format(addDays(new Date(), 1), "yyyy-MM-dd"),
      "Tomorrow untouched",
      ["squat"],
    );
    const plan = useWorkoutStore.getState().scheduledSessions[0];
    store.startSession(plan.type, plan.exerciseIds, plan.id);
    store.setPhase("main");
    await flushWorkoutWrites();
  });
  await page.goto("/workout");
  await page.getByRole("button", { name: "Resume workout" }).click();
  await page.getByRole("spinbutton", { name: "Set 1 weight" }).fill("50");
  await page.getByRole("spinbutton", { name: "Set 1 reps" }).fill("10");
  await page.locator(".set-row").first().getByRole("button").click();
  await page.getByRole("button", { name: "Skip rest" }).click();
  await page.evaluate(async () => {
    const { flushWorkoutWrites } = await import(
      /* @vite-ignore */ "/src/store/useWorkoutStore.ts"
    );
    await flushWorkoutWrites();
  });
  await page.reload();
  await page.getByRole("button", { name: "Resume workout" }).click();
  await expect(
    page.getByRole("spinbutton", { name: "Set 1 weight" }),
  ).toHaveValue("50");
  await page.getByRole("button", { name: "Finish Main Workout" }).click();
  await page.getByRole("button", { name: "Proceed" }).click();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { default: db } = await import(
          /* @vite-ignore */ "/src/db/db.ts"
        );
        return db.workouts.count();
      }),
    )
    .toBe(1);
  const state = await page.evaluate(async () => {
    const { default: db } = await import(/* @vite-ignore */ "/src/db/db.ts");
    return {
      active: await db.active_workouts.count(),
      plans: await db.schedules.toArray(),
    };
  });
  expect(state.active).toBe(0);
  expect(
    state.plans.find((p) => p.type === "Tomorrow untouched")
      ?.completedSessionId,
  ).toBeUndefined();
  expect(
    state.plans.find((p) => p.type === "Scheduled today")?.completedSessionId,
  ).toBeTruthy();
});
test("3D renders the canonical models and reaches the cached common stage", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/muscles");
  await expect
    .poll(
      async () =>
        Number(
          await page.locator(".model-progress progress").getAttribute("value"),
        ),
      { timeout: 90_000 },
    )
    .toBeGreaterThanOrEqual(3);
  await expect(
    page.getByText(
      "3D unavailable on this device / العرض ثلاثي الأبعاد غير متاح",
    ),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Select muscle" })
    .selectOption("biceps");
  await expect(page.getByRole("heading", { name: /biceps/i })).toBeVisible();
  await page.screenshot({
    path: "test-results/muscles-mobile.png",
    fullPage: true,
  });
});

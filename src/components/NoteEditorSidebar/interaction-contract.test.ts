const sidebarSources = import.meta.glob("./**/*.tsx", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

describe("sidebar interaction cursor contract", () => {
  it("reserves pointer cursors for links outside inspector controls", () => {
    const violations = Object.entries(sidebarSources)
      .filter(([, source]) => source.includes("cursor-pointer"))
      .map(([file]) => file);

    expect(violations).toEqual([]);
  });

  it("routes every preset menu, including nested editors, through PresetCombobox", () => {
    const violations = Object.entries(sidebarSources)
      .filter(([file, source]) =>
        !file.endsWith("PresetCombobox.tsx") && (
          /<select\b/.test(source)
          || /<Select(?:\s|>)/.test(source)
          || source.includes("@/components/ui/select")
        ))
      .map(([file]) => file);

    expect(violations).toEqual([]);
  });
});

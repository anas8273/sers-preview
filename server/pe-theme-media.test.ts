import { describe, expect, it } from "vitest";
import { BUILTIN_PE_THEMES, mergeDBThemes } from "../client/src/components/evidence/pe-themes";

describe("performance evidence theme media mapping", () => {
  it("carries a database cover image and logo into the merged theme", () => {
    const [theme] = mergeDBThemes([{
      id: 41,
      name: "قالب إداري",
      headerBg: "#0d7377",
      headerText: "#ffffff",
      accent: "#0d7377",
      borderColor: "#d1fae5",
      bodyBg: "#ffffff",
      coverImageUrl: "https://cdn.example.com/cover.webp",
      logoUrl: "https://cdn.example.com/logo.webp",
      templateLayout: { fieldStyle: "cards" },
    }]);

    expect(theme.coverImageUrl).toBe("https://cdn.example.com/cover.webp");
    expect(theme.coverBackgroundUrl).toBe("https://cdn.example.com/cover.webp");
    expect(theme.logoUrl).toBe("https://cdn.example.com/logo.webp");
    expect(theme.fieldStyle).toBe("cards");
  });

  it("provides ten distinct built-in designs, including light and sidebar layouts", () => {
    expect(BUILTIN_PE_THEMES).toHaveLength(10);
    expect(BUILTIN_PE_THEMES.map((theme) => theme.id)).toEqual(expect.arrayContaining([
      "builtin-sky-light",
      "builtin-sidebar-teal",
    ]));
    expect(BUILTIN_PE_THEMES.map((theme) => theme.layoutType)).toEqual(expect.arrayContaining([
      "white-header-light",
      "white-header-sidebar",
    ]));
  });
});
